import "dotenv/config";
import { storage, db } from "./storage";
import { casinoGames } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function seed() {
  console.log("🌱 Starting database seeding...");

  try {
    // Create super admin user
    const superAdminExists = await storage.getUserByUsername("superadmin");
    if (!superAdminExists) {
      const hashedPassword = await bcrypt.hash("superadmin123", 10);
      const superAdmin = await storage.createUser({
        username: "superadmin",
        password: hashedPassword,
        role: "SUPER_ADMIN",
        balance: "1000000",
      });

      await storage.createWalletTransaction({
        userId: superAdmin.id,
        amount: "1000000",
        type: "CREDIT",
        description: "Initial super admin balance",
      });

      console.log(
        "✅ Super Admin created (username: superadmin, password: superadmin123)",
      );
    } else {
      console.log("ℹ️  Super Admin already exists");
    }

    // Create admin user (created by super admin for demo)
    const adminExists = await storage.getUserByUsername("admin");
    if (!adminExists) {
      const superAdmin = await storage.getUserByUsername("superadmin");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const admin = await storage.createUser({
        username: "admin",
        password: hashedPassword,
        role: "ADMIN",
        balance: "100000",
        createdById: superAdmin?.id,
      });

      await storage.createWalletTransaction({
        userId: admin.id,
        amount: "100000",
        type: "CREDIT",
        description: "Initial admin balance from Super Admin",
        sourceUserId: superAdmin?.id,
      });

      console.log(
        "✅ Admin user created (username: admin, password: admin123)",
      );
    } else {
      console.log("ℹ️  Admin user already exists");
    }

    // Create demo user (created by admin for demo)
    const userExists = await storage.getUserByUsername("demo");
    if (!userExists) {
      const admin = await storage.getUserByUsername("admin");
      const hashedPassword = await bcrypt.hash("demo123", 10);
      const user = await storage.createUser({
        username: "demo",
        password: hashedPassword,
        role: "USER",
        balance: "10000",
        createdById: admin?.id,
      });

      await storage.createWalletTransaction({
        userId: user.id,
        amount: "10000",
        type: "CREDIT",
        description: "Initial balance from Admin",
        sourceUserId: admin?.id,
      });

      console.log("✅ Demo user created (username: demo, password: demo123)");
    } else {
      console.log("ℹ️  Demo user already exists");
    }

    // Get existing matches
    const existingMatches = await storage.getAllMatches();

    if (existingMatches.length === 0) {
      // Create sample cricket matches
      const match1 = await storage.createMatch({
        sport: "cricket",
        league: "IPL 2025",
        homeTeam: "Mumbai Indians",
        awayTeam: "Chennai Super Kings",
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        status: "LIVE",
        scoreHome: "185/4",
        scoreAway: "0/0",
        scoreDetails: "Mumbai Indians: 185/4 (18.2 overs)",
      });

      // Create match winner market
      const market1 = await storage.createMarket({
        matchId: match1.id,
        name: "Match Winner",
        status: "OPEN",
      });

      await storage.createRunner({
        marketId: market1.id,
        name: "Mumbai Indians",
        backOdds: "1.85",
        layOdds: "1.87",
        volume: 125000,
      });

      await storage.createRunner({
        marketId: market1.id,
        name: "Chennai Super Kings",
        backOdds: "2.10",
        layOdds: "2.12",
        volume: 98000,
      });

      console.log(
        "✅ Created cricket match: Mumbai Indians vs Chennai Super Kings",
      );

      // Create another match
      const match2 = await storage.createMatch({
        sport: "cricket",
        league: "IPL 2025",
        homeTeam: "Royal Challengers Bangalore",
        awayTeam: "Kolkata Knight Riders",
        startTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        status: "UPCOMING",
      });

      const market2 = await storage.createMarket({
        matchId: match2.id,
        name: "Match Winner",
        status: "OPEN",
      });

      await storage.createRunner({
        marketId: market2.id,
        name: "Royal Challengers Bangalore",
        backOdds: "1.95",
        layOdds: "1.97",
        volume: 85000,
      });

      await storage.createRunner({
        marketId: market2.id,
        name: "Kolkata Knight Riders",
        backOdds: "1.95",
        layOdds: "1.97",
        volume: 87000,
      });

      console.log(
        "✅ Created cricket match: Royal Challengers Bangalore vs Kolkata Knight Riders",
      );

      // Football match
      const match3 = await storage.createMatch({
        sport: "football",
        league: "Premier League",
        homeTeam: "Manchester United",
        awayTeam: "Liverpool",
        startTime: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
        status: "UPCOMING",
      });

      const market3 = await storage.createMarket({
        matchId: match3.id,
        name: "Match Winner",
        status: "OPEN",
      });

      await storage.createRunner({
        marketId: market3.id,
        name: "Manchester United",
        backOdds: "2.80",
        layOdds: "2.85",
        volume: 150000,
      });

      await storage.createRunner({
        marketId: market3.id,
        name: "Draw",
        backOdds: "3.20",
        layOdds: "3.25",
        volume: 95000,
      });

      await storage.createRunner({
        marketId: market3.id,
        name: "Liverpool",
        backOdds: "2.40",
        layOdds: "2.42",
        volume: 175000,
      });

      console.log("✅ Created football match: Manchester United vs Liverpool");
    } else {
      console.log(
        `ℹ️  ${existingMatches.length} matches already exist in database`,
      );
    }

    // Seed casino games - add missing ones
    const existingCasinoGames = await db.select().from(casinoGames);
    const existingSlugs = new Set(existingCasinoGames.map((g) => g.slug));

    const allGames = [
      {
        name: "Classic Slots",
        slug: "classic-slots",
        type: "slots" as const,
        description: "Spin the reels and match symbols to win big!",
        minBet: "10",
        maxBet: "10000",
        houseEdge: "0.03",
      },
      {
        name: "Crash",
        slug: "crash",
        type: "crash" as const,
        description: "Cash out before the multiplier crashes!",
        minBet: "10",
        maxBet: "10000",
        houseEdge: "0.03",
      },
      {
        name: "Dice",
        slug: "dice",
        type: "dice" as const,
        description:
          "Predict if the roll will be higher or lower than your target.",
        minBet: "10",
        maxBet: "10000",
        houseEdge: "0.03",
      },
      {
        name: "Andar Bahar",
        slug: "andar-bahar",
        type: "andar_bahar" as const,
        description:
          "Classic Indian card game. Bet on which side the matching card appears!",
        minBet: "10",
        maxBet: "10000",
        houseEdge: "0.05",
      },
      {
        name: "Teen Patti",
        slug: "teen-patti",
        type: "teen_patti" as const,
        description: "Indian 3-card poker. Beat the dealer with the best hand!",
        minBet: "10",
        maxBet: "10000",
        houseEdge: "0.03",
      },
      {
        name: "Lucky 7",
        slug: "lucky-7",
        type: "lucky_7" as const,
        description:
          "Predict if the card will be lower than 7, exactly 7, or higher!",
        minBet: "10",
        maxBet: "10000",
        houseEdge: "0.03",
      },
      {
        name: "Roulette",
        slug: "roulette",
        type: "roulette" as const,
        description:
          "Classic European roulette. Bet on numbers, colors, or ranges!",
        minBet: "10",
        maxBet: "10000",
        houseEdge: "0.027",
      },
      {
        name: "Blackjack",
        slug: "blackjack",
        type: "blackjack" as const,
        description: "Beat the dealer with a hand closer to 21 without going over!",
        minBet: "10",
        maxBet: "10000",
        houseEdge: "0.005",
      },
      {
        name: "Hi-Lo",
        slug: "hi-lo",
        type: "hi_lo" as const,
        description: "Predict if the next card will be higher or lower!",
        minBet: "10",
        maxBet: "10000",
        houseEdge: "0.03",
      },
      {
        name: "Dragon Tiger",
        slug: "dragon-tiger",
        type: "dragon_tiger" as const,
        description: "Fast-paced card game. Bet on Dragon, Tiger, or Tie!",
        minBet: "10",
        maxBet: "10000",
        houseEdge: "0.035",
      },
      {
        name: "Plinko",
        slug: "plinko",
        type: "plinko" as const,
        description: "Drop the ball and watch it bounce to multiply your bet!",
        minBet: "10",
        maxBet: "10000",
        houseEdge: "0.01",
      },
      {
        name: "Wheel of Fortune",
        slug: "wheel-of-fortune",
        type: "wheel" as const,
        description: "Spin the wheel and win up to 50x your bet!",
        minBet: "10",
        maxBet: "10000",
        houseEdge: "0.05",
      },
      {
        name: "Mines",
        slug: "mines",
        type: "mines" as const,
        description: "Reveal gems and avoid mines to multiply your winnings!",
        minBet: "10",
        maxBet: "10000",
        houseEdge: "0.01",
      },
    ];

    const missingGames = allGames.filter((g) => !existingSlugs.has(g.slug));

    if (missingGames.length > 0) {
      for (const game of missingGames) {
        await db.insert(casinoGames).values(game as any);
      }
      console.log(
        `✅ Added ${missingGames.length} new casino games: ${missingGames.map((g) => g.name).join(", ")}`,
      );
    } else {
      console.log(
        `ℹ️  All ${existingCasinoGames.length} casino games already exist`,
      );
    }

    console.log("\n🎉 Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
