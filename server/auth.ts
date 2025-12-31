import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import type { Express } from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

// Session configuration
export function setupAuth(app: Express) {
  // Trust proxy for secure cookies behind reverse proxy
  app.set("trust proxy", 1);
  
  // Create PostgreSQL session store
  const PgStore = connectPgSimple(session);
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  app.use(
    session({
      store: new PgStore({
        pool,
        tableName: 'session',
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "probet-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
        httpOnly: true,
        secure: false, // Allow cookies over HTTP in development
        sameSite: "lax", // Required for cross-origin requests
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Local Strategy for username/password authentication
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Invalid username or password" });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  // Serialize user to session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

// Middleware to require authentication
export function requireAuth(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}

// Middleware to require admin role
export function requireAdmin(req: any, res: any, next: any) {
  if (req.isAuthenticated() && req.user.role === 'ADMIN') {
    return next();
  }
  res.status(403).json({ error: "Forbidden - Admin access required" });
}
