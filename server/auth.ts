import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import type { Express, RequestHandler } from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";

let sessionMiddleware: RequestHandler;

export function getSessionMiddleware(): RequestHandler {
  return sessionMiddleware;
}

export function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  
  const PgStore = connectPgSimple(session);
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  sessionMiddleware = session({
    store: new PgStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "probet-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    },
  });

  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  // Local Strategy for username/password authentication
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`[Auth] Login attempt for username: "${username}"`);
        const user = await storage.getUserByUsername(username);
        if (!user) {
          console.log(`[Auth] User not found: "${username}"`);
          return done(null, false, { message: "Invalid username or password" });
        }

        console.log(`[Auth] User found: ${user.username}, role: ${user.role}`);
        const isValid = await bcrypt.compare(password, user.password);
        console.log(`[Auth] Password valid: ${isValid}`);
        if (!isValid) {
          return done(null, false, { message: "Invalid username or password" });
        }

        return done(null, user);
      } catch (error) {
        console.log(`[Auth] Error:`, error);
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

// Middleware to require admin or super admin role
export function requireAdmin(req: any, res: any, next: any) {
  if (req.isAuthenticated() && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN')) {
    return next();
  }
  res.status(403).json({ error: "Forbidden - Admin access required" });
}

// Middleware to require super admin role only
export function requireSuperAdmin(req: any, res: any, next: any) {
  if (req.isAuthenticated() && req.user.role === 'SUPER_ADMIN') {
    return next();
  }
  res.status(403).json({ error: "Forbidden - Super Admin access required" });
}
