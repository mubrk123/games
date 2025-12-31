import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin } from "./auth";
import passport from "passport";
import bcrypt from "bcrypt";
import { insertUserSchema, insertBetSchema } from "@shared/schema";
import { oddsApiService, POPULAR_SPORTS } from "./oddsApi";
import { cricketApiService } from "./cricketApi";
import { instanceBettingService } from "./instanceBetting";
import { casinoService } from "./casinoService";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // ============================================
  // Authentication Routes
  // ============================================
  
  // Login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ error: "Login failed" });
        }
        
        // Save session explicitly before responding
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ error: "Session save failed" });
          }
          
          // Don't send password to client
          const { password, ...userWithoutPassword } = user;
          return res.json({ user: userWithoutPassword });
        });
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  // Get current user
  app.get("/api/auth/me", requireAuth, (req, res) => {
    const { password, ...userWithoutPassword } = req.user as any;
    res.json({ user: userWithoutPassword });
  });

  // ============================================
  // Admin Routes
  // ============================================
  
  // Create a new user (Admin only)
  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const parsed = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existing = await storage.getUserByUsername(parsed.username);
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(parsed.password, 10);
      
      const user = await storage.createUser({
        ...parsed,
        password: hashedPassword,
      });

      // Create initial wallet transaction
      if (parsed.balance && parseFloat(parsed.balance) > 0) {
        await storage.createWalletTransaction({
          userId: user.id,
          amount: parsed.balance,
          type: 'CREDIT',
          description: 'Initial balance',
        });
      }

      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Add credits to user (Admin only)
  app.post("/api/admin/users/:id/credit", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;

      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const currentBalance = parseFloat(user.balance);
      const newBalance = currentBalance + parseFloat(amount);

      const updatedUser = await storage.updateUserBalance(id, newBalance);

      // Create wallet transaction
      await storage.createWalletTransaction({
        userId: id,
        amount: String(amount),
        type: 'CREDIT',
        description: 'Manual credit by admin',
      });

      const { password, ...userWithoutPassword } = updatedUser!;
      res.json({ user: userWithoutPassword });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Remove credits from user (Admin only)
  app.post("/api/admin/users/:id/debit", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount } = req.body;

      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const currentBalance = parseFloat(user.balance);
      const newBalance = Math.max(0, currentBalance - parseFloat(amount));

      const updatedUser = await storage.updateUserBalance(id, newBalance);

      // Create wallet transaction
      await storage.createWalletTransaction({
        userId: id,
        amount: `-${amount}`,
        type: 'DEBIT',
        description: 'Manual debit by admin',
      });

      const { password, ...userWithoutPassword } = updatedUser!;
      res.json({ user: userWithoutPassword });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all users (Admin only)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Remove passwords
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      
      // Get bet statistics for each user
      const usersWithStats = await Promise.all(
        usersWithoutPasswords.map(async (user) => {
          const bets = await storage.getUserBets(user.id);
          const wonBets = bets.filter(bet => bet.status === 'WON').length;
          const lostBets = bets.filter(bet => bet.status === 'LOST').length;
          
          return {
            ...user,
            totalBets: bets.length,
            wonBets,
            lostBets,
          };
        })
      );

      res.json({ users: usersWithStats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all bets (Admin only)
  app.get("/api/admin/bets", requireAdmin, async (req, res) => {
    try {
      const bets = await storage.getAllBets();
      res.json({ bets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Match Routes
  // ============================================
  
  // Get all matches (from database - legacy)
  app.get("/api/matches", requireAuth, async (req, res) => {
    try {
      const matches = await storage.getAllMatches();
      
      // For each match, get markets and runners
      const matchesWithDetails = await Promise.all(
        matches.map(async (match) => {
          const markets = await storage.getMarketsByMatch(match.id);
          
          const marketsWithRunners = await Promise.all(
            markets.map(async (market) => {
              const runners = await storage.getRunnersByMarket(market.id);
              return { ...market, runners };
            })
          );

          return { ...match, markets: marketsWithRunners };
        })
      );

      res.json({ matches: matchesWithDetails });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Live Odds Routes (The Odds API)
  // ============================================
  
  // Get available sports (public endpoint - no auth required)
  app.get("/api/live/sports", async (req, res) => {
    try {
      const sports = await oddsApiService.getSports();
      // Filter to only active sports
      const activeSports = sports.filter(s => s.active);
      res.json({ sports: activeSports });
    } catch (error: any) {
      console.error('Failed to fetch sports:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get live events with odds for a specific sport (public endpoint)
  app.get("/api/live/odds/:sportKey", async (req, res) => {
    try {
      const { sportKey } = req.params;
      const events = await oddsApiService.getOdds(sportKey);
      
      // Convert to our match format, filter out events without bookmakers
      const matches = events
        .filter(event => event.bookmakers && event.bookmakers.length > 0)
        .map(event => oddsApiService.convertToMatch(event));
      
      res.json({ matches });
    } catch (error: any) {
      console.error(`Failed to fetch odds for ${req.params.sportKey}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all live events across popular sports (public endpoint)
  app.get("/api/live/all", async (req, res) => {
    try {
      const allMatches: any[] = [];
      
      // Use the exported POPULAR_SPORTS list (limit to first 6 to avoid API rate limits)
      const sportsToFetch = POPULAR_SPORTS.slice(0, 6);
      
      const results = await Promise.allSettled(
        sportsToFetch.map(async (sportKey) => {
          try {
            const events = await oddsApiService.getOdds(sportKey);
            return events
              .filter(event => event.bookmakers && event.bookmakers.length > 0)
              .map(event => oddsApiService.convertToMatch(event));
          } catch (e) {
            return [];
          }
        })
      );
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          allMatches.push(...result.value);
        }
      });
      
      // Sort by status (LIVE first) then by start time
      allMatches.sort((a, b) => {
        if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
        if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
      
      res.json({ matches: allMatches });
    } catch (error: any) {
      console.error('Failed to fetch all live events:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get live scores for a sport
  app.get("/api/live/scores/:sportKey", requireAuth, async (req, res) => {
    try {
      const { sportKey } = req.params;
      const scores = await oddsApiService.getScores(sportKey);
      res.json({ scores });
    } catch (error: any) {
      console.error(`Failed to fetch scores for ${req.params.sportKey}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Cricket API Routes (CricketData.org)
  // ============================================

  // Get all current cricket matches (live and upcoming only)
  app.get("/api/cricket/current", async (req, res) => {
    try {
      const matches = await cricketApiService.getCurrentMatches();
      const formattedMatches = matches
        .map(m => cricketApiService.convertToMatch(m))
        .filter(m => m.status === 'LIVE' || m.status === 'UPCOMING')
        .sort((a, b) => {
          // Live matches first
          if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
          if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        });
      res.json({ matches: formattedMatches });
    } catch (error: any) {
      console.error('Failed to fetch current cricket matches:', error);
      res.status(500).json({ error: error.message, matches: [] });
    }
  });

  // Get all cricket matches (including upcoming)
  app.get("/api/cricket/matches", async (req, res) => {
    try {
      const offset = parseInt(req.query.offset as string) || 0;
      const matches = await cricketApiService.getAllMatches(offset);
      const formattedMatches = matches.map(m => cricketApiService.convertToMatch(m));
      res.json({ matches: formattedMatches });
    } catch (error: any) {
      console.error('Failed to fetch cricket matches:', error);
      res.status(500).json({ error: error.message, matches: [] });
    }
  });

  // Get cricket series list
  app.get("/api/cricket/series", async (req, res) => {
    try {
      const search = req.query.search as string;
      const series = search 
        ? await cricketApiService.searchSeries(search)
        : await cricketApiService.getSeries();
      res.json({ series });
    } catch (error: any) {
      console.error('Failed to fetch cricket series:', error);
      res.status(500).json({ error: error.message, series: [] });
    }
  });

  // Get cricket match details
  app.get("/api/cricket/match/:matchId", async (req, res) => {
    try {
      const { matchId } = req.params;
      // Remove 'cricket-' prefix if present
      const cleanId = matchId.replace('cricket-', '');
      const matchInfo = await cricketApiService.getMatchInfo(cleanId);
      res.json({ match: matchInfo });
    } catch (error: any) {
      console.error('Failed to fetch cricket match info:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Betting Routes
  // ============================================
  
  // Place a bet
  app.post("/api/bets", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const parsed = insertBetSchema.parse(req.body);
      
      // Validate stake amount
      const stake = parseFloat(parsed.stake);
      const currentBalance = parseFloat(user.balance);
      
      if (stake <= 0) {
        return res.status(400).json({ error: "Invalid stake amount" });
      }

      if (stake > currentBalance) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Calculate potential profit
      const odds = parseFloat(parsed.odds);
      let potentialProfit = 0;
      
      if (parsed.type === 'BACK') {
        // Back bet: profit = (odds - 1) * stake
        potentialProfit = (odds - 1) * stake;
      } else {
        // Lay bet: profit = stake, liability = (odds - 1) * stake
        potentialProfit = stake;
      }

      // Create the bet with runnerName for settlement
      const bet = await storage.createBet({
        ...parsed,
        userId,
        runnerName: req.body.runnerName || null,
        potentialProfit: String(potentialProfit),
      });

      // Deduct stake from user balance
      const newBalance = currentBalance - stake;
      await storage.updateUserBalance(userId, newBalance);

      // Create wallet transaction
      await storage.createWalletTransaction({
        userId,
        amount: `-${stake}`,
        type: 'BET_PLACED',
        description: `Bet placed: ${parsed.type} bet on match ${parsed.matchId}`,
      });

      res.json({ bet });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get user's bets
  app.get("/api/bets/me", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const bets = await storage.getUserBets(userId);
      res.json({ bets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get wallet transactions
  app.get("/api/wallet/transactions", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const transactions = await storage.getUserTransactions(userId);
      res.json({ transactions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Instance Betting Routes
  // ============================================

  // Get active instance markets for a match
  app.get("/api/instance/markets/:matchId", async (req, res) => {
    try {
      const { matchId } = req.params;
      const sport = req.query.sport as string || 'cricket';
      const homeTeam = req.query.homeTeam as string;
      const awayTeam = req.query.awayTeam as string;

      instanceBettingService.checkAndCloseExpiredMarkets();
      instanceBettingService.clearExpiredMarketsForMatch(matchId);

      let markets = instanceBettingService.getActiveMarketsForMatch(matchId);

      if (markets.length === 0) {
        let currentOver: number | undefined;
        let currentBall: number | undefined;

        if (matchId.startsWith('cricket-')) {
          try {
            const cleanId = matchId.replace('cricket-', '');
            const matchInfo = await cricketApiService.getMatchInfo(cleanId);
            if (matchInfo.score && matchInfo.score.length > 0) {
              const latestInning = matchInfo.score[matchInfo.score.length - 1];
              currentOver = Math.floor(latestInning.o);
              currentBall = Math.round((latestInning.o - currentOver) * 10);
            }
          } catch {
            // Ignore errors, use random values
          }
        }

        markets = instanceBettingService.generateLiveInstanceMarkets(matchId, sport, homeTeam, awayTeam, currentOver, currentBall);
      }

      res.json({ markets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all active instance markets
  app.get("/api/instance/markets", async (req, res) => {
    try {
      instanceBettingService.checkAndCloseExpiredMarkets();
      const markets = instanceBettingService.getAllActiveMarkets();
      res.json({ markets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Place an instance bet
  app.post("/api/instance/bet", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { marketId, outcomeId, stake } = req.body;

      if (!marketId || !outcomeId || !stake) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const stakeNum = parseFloat(stake);
      const currentBalance = parseFloat(user.balance);

      if (stakeNum <= 0) {
        return res.status(400).json({ error: "Invalid stake amount" });
      }

      if (stakeNum > currentBalance) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      instanceBettingService.checkAndCloseExpiredMarkets();
      const markets = instanceBettingService.getAllActiveMarkets();
      const market = markets.find(m => m.id === marketId);

      if (!market || market.status !== 'OPEN') {
        return res.status(400).json({ error: "Market is closed or does not exist" });
      }

      // Latency guard: Reject bets on markets closing within 10 seconds
      const now = new Date();
      const closeTime = new Date(market.closeTime);
      const secondsRemaining = (closeTime.getTime() - now.getTime()) / 1000;
      
      if (secondsRemaining < 10) {
        return res.status(400).json({ 
          error: "Market closing soon - bet rejected to prevent exploitation",
          secondsRemaining: Math.max(0, Math.floor(secondsRemaining))
        });
      }

      const outcome = market.outcomes.find(o => o.id === outcomeId);
      if (!outcome) {
        return res.status(400).json({ error: "Outcome not found" });
      }

      const potentialProfit = stakeNum * (outcome.odds - 1);

      const bet = await storage.createBet({
        userId,
        matchId: market.matchId,
        marketId: market.id,
        runnerId: outcome.id,
        runnerName: outcome.name, // Store outcome name for settlement
        type: 'BACK',
        odds: outcome.odds.toString(),
        stake: stake,
        potentialProfit: potentialProfit.toString(),
      });

      const newBalance = currentBalance - stakeNum;
      await storage.updateUserBalance(userId, newBalance);

      await storage.createWalletTransaction({
        userId,
        amount: `-${stake}`,
        type: 'BET_PLACED',
        description: `Instance bet: ${market.name} - ${outcome.name}`,
      });

      res.json({ 
        bet,
        message: `Bet placed on ${outcome.name} @ ${outcome.odds}`,
        market: market.name,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Real-time score update endpoint (polling) - scores only, no market generation
  app.get("/api/live/realtime/:matchId", async (req, res) => {
    try {
      const { matchId } = req.params;

      if (matchId.startsWith('cricket-')) {
        const cleanId = matchId.replace('cricket-', '');
        const matchInfo = await cricketApiService.getMatchInfo(cleanId);

        let scoreHome: string | null = null;
        let scoreAway: string | null = null;
        let scoreDetails: string | null = null;
        let currentOver: number | null = null;
        let currentBall: number | null = null;

        let wicketsInOver = 0;
        let totalOvers = 20; // Default for T20
        
        if (matchInfo.score && matchInfo.score.length > 0) {
          const latestInning = matchInfo.score[matchInfo.score.length - 1];
          scoreHome = `${latestInning.r}/${latestInning.w}`;
          currentOver = Math.floor(latestInning.o);
          currentBall = Math.round((latestInning.o - currentOver) * 10);
          scoreDetails = matchInfo.status;
          wicketsInOver = 0; // Would need ball-by-ball data to track accurately
        }

        instanceBettingService.clearExpiredMarketsForMatch(matchId);

        // Check for critical moments and suspend/resume markets
        let marketsSuspended = false;
        let suspensionReason: string | null = null;
        
        if (currentOver !== null && currentBall !== null) {
          const criticalCheck = instanceBettingService.checkCriticalMoments(
            matchId,
            currentOver,
            currentBall,
            wicketsInOver,
            totalOvers
          );
          
          if (criticalCheck.isCritical) {
            instanceBettingService.suspendAllMarketsForMatch(matchId, criticalCheck.reason || 'Critical moment');
            marketsSuspended = true;
            suspensionReason = criticalCheck.reason;
          } else {
            instanceBettingService.resumeAllMarketsForMatch(matchId);
          }
        }

        res.json({
          matchId,
          scoreHome,
          scoreAway,
          scoreDetails,
          currentOver,
          currentBall,
          status: matchInfo.matchEnded ? 'FINISHED' : matchInfo.matchStarted ? 'LIVE' : 'UPCOMING',
          marketsSuspended,
          suspensionReason,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.json({
          matchId,
          message: 'Real-time updates available for cricket matches',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Casino Routes
  // ============================================
  
  // Get all active casino games
  app.get("/api/casino/games", async (req, res) => {
    try {
      const games = await casinoService.getGames();
      res.json({ games });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get user's casino history
  app.get("/api/casino/history", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const history = await casinoService.getUserHistory(user.id);
      res.json({ history });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Play slots
  app.post("/api/casino/slots/play", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { betAmount, clientSeed } = req.body;
      
      if (!betAmount || betAmount <= 0) {
        return res.status(400).json({ error: "Invalid bet amount" });
      }
      
      const result = await casinoService.playSlots(user.id, betAmount, clientSeed);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  // Play crash
  app.post("/api/casino/crash/play", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { betAmount, cashoutMultiplier, clientSeed } = req.body;
      
      if (!betAmount || betAmount <= 0) {
        return res.status(400).json({ error: "Invalid bet amount" });
      }
      
      if (!cashoutMultiplier || cashoutMultiplier < 1.01) {
        return res.status(400).json({ error: "Cashout multiplier must be at least 1.01" });
      }
      
      const result = await casinoService.playCrash(user.id, betAmount, cashoutMultiplier, clientSeed);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  // Play dice
  app.post("/api/casino/dice/play", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { betAmount, prediction, target, clientSeed } = req.body;
      
      if (!betAmount || betAmount <= 0) {
        return res.status(400).json({ error: "Invalid bet amount" });
      }
      
      if (!prediction || !['high', 'low'].includes(prediction)) {
        return res.status(400).json({ error: "Prediction must be 'high' or 'low'" });
      }
      
      if (!target || target < 2 || target > 99) {
        return res.status(400).json({ error: "Target must be between 2 and 99" });
      }
      
      const result = await casinoService.playDice(user.id, betAmount, prediction, target, clientSeed);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Play Andar Bahar
  app.post("/api/casino/andar-bahar/play", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { betAmount, choice, clientSeed } = req.body;
      
      if (!betAmount || betAmount <= 0) {
        return res.status(400).json({ error: "Invalid bet amount" });
      }
      
      if (!choice || !['andar', 'bahar'].includes(choice)) {
        return res.status(400).json({ error: "Choice must be 'andar' or 'bahar'" });
      }
      
      const result = await casinoService.playAndarBahar(user.id, betAmount, choice, clientSeed);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Play Teen Patti
  app.post("/api/casino/teen-patti/play", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { betAmount, clientSeed } = req.body;
      
      if (!betAmount || betAmount <= 0) {
        return res.status(400).json({ error: "Invalid bet amount" });
      }
      
      const result = await casinoService.playTeenPatti(user.id, betAmount, clientSeed);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Play Lucky 7
  app.post("/api/casino/lucky-7/play", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { betAmount, bet, clientSeed } = req.body;
      
      if (!betAmount || betAmount <= 0) {
        return res.status(400).json({ error: "Invalid bet amount" });
      }
      
      if (!bet || !['low', 'seven', 'high'].includes(bet)) {
        return res.status(400).json({ error: "Bet must be 'low', 'seven', or 'high'" });
      }
      
      const result = await casinoService.playLucky7(user.id, betAmount, bet, clientSeed);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Play Roulette
  app.post("/api/casino/roulette/play", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { betAmount, betType, betValue, clientSeed } = req.body;
      
      if (!betAmount || betAmount <= 0) {
        return res.status(400).json({ error: "Invalid bet amount" });
      }
      
      if (!betType || !betValue) {
        return res.status(400).json({ error: "Bet type and value are required" });
      }
      
      const result = await casinoService.playRoulette(user.id, betAmount, betType, betValue, clientSeed);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
  
  // Verify fairness
  app.get("/api/casino/verify/:roundId", async (req, res) => {
    try {
      const { roundId } = req.params;
      const verification = await casinoService.verifyFairness(roundId);
      res.json(verification);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  return httpServer;
}
