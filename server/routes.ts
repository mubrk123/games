import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireAdmin } from "./auth";
import passport from "passport";
import bcrypt from "bcrypt";
import { insertUserSchema, insertBetSchema } from "@shared/schema";
import { oddsApiService, POPULAR_SPORTS } from "./oddsApi";

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
  
  // Get available sports
  app.get("/api/live/sports", requireAuth, async (req, res) => {
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

  // Get live events with odds for a specific sport
  app.get("/api/live/odds/:sportKey", requireAuth, async (req, res) => {
    try {
      const { sportKey } = req.params;
      const events = await oddsApiService.getOdds(sportKey);
      
      // Convert to our match format
      const matches = events.map(event => oddsApiService.convertToMatch(event));
      
      res.json({ matches });
    } catch (error: any) {
      console.error(`Failed to fetch odds for ${req.params.sportKey}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all live events across popular sports
  app.get("/api/live/all", requireAuth, async (req, res) => {
    try {
      const allMatches: any[] = [];
      
      // Use the exported POPULAR_SPORTS list (limit to first 6 to avoid API rate limits)
      const sportsToFetch = POPULAR_SPORTS.slice(0, 6);
      
      const results = await Promise.allSettled(
        sportsToFetch.map(async (sportKey) => {
          try {
            const events = await oddsApiService.getOdds(sportKey);
            return events.map(event => oddsApiService.convertToMatch(event));
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

      // Create the bet
      const bet = await storage.createBet({
        ...parsed,
        userId,
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

  return httpServer;
}
