import { storage, db } from "./storage";
import { casinoGames } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function seed() {
  console.log("🌱 Starting database seeding...");

  try {
    // Create admin user
    const adminExists = await storage.getUserByUsername("admin");
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const admin = await storage.createUser({
        username: "admin",
        password: hashedPassword,
        role: "ADMIN",
        balance: "100000",
      });
      
      await storage.createWalletTransaction({
        userId: admin.id,
        amount: "100000",
        type: "CREDIT",
        description: "Initial admin balance",
      });
      
      console.log("✅ Admin user created (username: admin, password: admin123)");
    } else {
      console.log("ℹ️  Admin user already exists");
    }

    // Create demo user
    const userExists = await storage.getUserByUsername("demo");
    if (!userExists) {
      const hashedPassword = await bcrypt.hash("demo123", 10);
      const user = await storage.createUser({
        username: "demo",
        password: hashedPassword,
        role: "USER",
        balance: "10000",
      });
      
      await storage.createWalletTransaction({
        userId: user.id,
        amount: "10000",
        type: "CREDIT",
        description: "Initial balance",
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

      console.log("✅ Created cricket match: Mumbai Indians vs Chennai Super Kings");

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

      console.log("✅ Created cricket match: Royal Challengers Bangalore vs Kolkata Knight Riders");

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
      console.log(`ℹ️  ${existingMatches.length} matches already exist in database`);
    }

    // Seed casino games
    const existingCasinoGames = await db.select().from(casinoGames);
    
    if (existingCasinoGames.length === 0) {
      await db.insert(casinoGames).values([
        {
          name: "Classic Slots",
          slug: "classic-slots",
          type: "slots",
          description: "Spin the reels and match symbols to win big!",
          minBet: "10",
          maxBet: "10000",
          houseEdge: "0.03",
        },
        {
          name: "Crash",
          slug: "crash",
          type: "crash",
          description: "Cash out before the multiplier crashes!",
          minBet: "10",
          maxBet: "10000",
          houseEdge: "0.03",
        },
        {
          name: "Dice",
          slug: "dice",
          type: "dice",
          description: "Predict if the roll will be higher or lower than your target.",
          minBet: "10",
          maxBet: "10000",
          houseEdge: "0.03",
        },
      ]);
      console.log("✅ Created casino games: Slots, Crash, Dice");
    } else {
      console.log(`ℹ️  ${existingCasinoGames.length} casino games already exist`);
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
