# ProBetX - Sports Betting Exchange Platform

## Overview

ProBetX is a full-stack, mobile-first sports betting exchange platform inspired by 1XBet, built with React, Express, and PostgreSQL. It features real-time odds display, Back/Lay exchange betting, live cricket coverage, instance-based micro-betting (ball-by-ball, over-by-over), role-based access control, wallet management, and admin tools.

---

## Current Implementation Status

### Completed Features ✅

| Feature | Description | Files |
|---------|-------------|-------|
| **User Authentication** | Login/signup with bcrypt password hashing, session-based auth | `server/auth.ts`, `client/src/pages/auth/` |
| **Role System** | USER, ADMIN, AGENT roles with route protection | `shared/schema.ts`, `server/routes.ts` |
| **Wallet System** | Balance tracking, exposure calculation, transaction history | `shared/schema.ts`, `server/storage.ts` |
| **Back/Lay Betting** | Traditional exchange-style betting on match outcomes | `server/routes.ts`, `client/src/components/betting/` |
| **Live Cricket** | Real matches from CricketData.org API with live scores | `server/cricketApi.ts` |
| **Real-time Updates** | 5-second polling for live match scores | `client/src/pages/match-detail.tsx` |
| **Instance Betting** | Next Ball, Next Over, Session markets with auto-close | `server/instanceBetting.ts` |
| **Mobile-First UI** | Bottom nav, touch-friendly components, responsive design | `client/src/components/layout/` |
| **Admin Dashboard** | User management, risk monitoring, wallet adjustments | `client/src/pages/admin.tsx` |
| **Sports Odds API** | Multi-sport odds integration via The Odds API | `server/routes.ts` |

### Partially Implemented ⚠️

| Feature | Current State | Needed |
|---------|---------------|--------|
| Instance Betting | In-memory storage, 60s expiry | Persist to DB, auto-settlement |
| Quick Bet Flow | Navigates to detail page | Direct bet placement from cards |
| Multi-Sport | API integrated | Show non-cricket sports properly |
| Casino | Page exists | Real games not implemented |

### Not Implemented ❌

- Real peer-to-peer order book matching
- WebSocket push updates (uses polling)
- Cashout functionality
- Accumulator/Parlay bets
- Payment gateway integration
- KYC verification
- Multi-currency support
- Bonus/promotion engine
- Live streaming
- Push notifications

---

## Technical Architecture

### Frontend Stack

```
React 18 + Vite + TypeScript
├── Tailwind CSS - Utility-first styling
├── shadcn/ui - Pre-built accessible components (dark theme)
├── Zustand - Client state management with localStorage persistence
├── React Query - Server state, caching, polling
├── Wouter - Lightweight routing
├── Lucide React - Icons
└── Recharts - Admin dashboard charts
```

### Backend Stack

```
Node.js + Express + TypeScript
├── Drizzle ORM - Type-safe PostgreSQL queries
├── Passport.js - Session-based authentication
├── bcrypt - Password hashing (10 rounds)
├── express-session - Session management
└── esbuild - Server bundling
```

### Database Schema (PostgreSQL)

```typescript
// shared/schema.ts - Key Tables

users: {
  id: uuid, username, passwordHash, role (USER|ADMIN|AGENT),
  balance: decimal, exposure: decimal, currency, createdAt
}

matches: {
  id: uuid, sport, league, homeTeam, awayTeam, startTime,
  status (UPCOMING|LIVE|FINISHED), scoreHome, scoreAway, scoreDetails
}

markets: {
  id: uuid, matchId (FK), name, status (OPEN|SUSPENDED|CLOSED)
}

runners: {
  id: uuid, marketId (FK), name, backOdds, layOdds, volume
}

bets: {
  id: uuid, oddsType (BACK|LAY), userId, matchId, marketId, runnerId,
  stake, odds, potentialWin, status (OPEN|WON|LOST|VOID), createdAt
}

walletTransactions: {
  id: uuid, oddsType (CREDIT|DEBIT), userId, amount, balance, description, createdAt
}
```

### API Endpoints

```
Authentication:
POST /api/auth/register - Create account
POST /api/auth/login - Login
POST /api/auth/logout - Logout
GET  /api/auth/me - Current user

Betting:
GET  /api/matches - All matches
GET  /api/matches/:id - Single match with markets
POST /api/bets - Place a bet
GET  /api/bets/me - User's bet history

Live Data:
GET  /api/live/sports - Available sports from Odds API
GET  /api/live/all - Live matches from Odds API
GET  /api/live/realtime/:matchId - Real-time score updates
GET  /api/cricket/current - Current cricket matches

Instance Betting:
GET  /api/instance/markets/:matchId - Active instance markets
POST /api/instance/bets - Place instance bet
GET  /api/instance/markets - All active markets

Admin:
GET  /api/admin/users - All users
PATCH /api/admin/users/:id/balance - Adjust balance
PATCH /api/admin/bets/:id/settle - Settle a bet
```

### Project Structure

```
probetx/
├── client/
│   └── src/
│       ├── components/
│       │   ├── betting/
│       │   │   ├── MobileBetSlip.tsx    # Slide-up bet placement
│       │   │   ├── MobileOddsCard.tsx   # Match card with odds
│       │   │   ├── BetSlip.tsx          # Desktop bet slip
│       │   │   └── OddsCard.tsx         # Desktop match card
│       │   ├── layout/
│       │   │   ├── AppShell.tsx         # Main layout wrapper
│       │   │   ├── BottomNav.tsx        # Mobile navigation
│       │   │   ├── MobileHeader.tsx     # Mobile header
│       │   │   └── Sidebar.tsx          # Desktop sidebar
│       │   └── ui/                      # shadcn/ui components
│       ├── pages/
│       │   ├── auth/
│       │   │   ├── login.tsx
│       │   │   └── register.tsx
│       │   ├── admin.tsx                # Admin dashboard
│       │   ├── casino.tsx               # Casino placeholder
│       │   ├── dashboard.tsx            # Main sports page
│       │   ├── match-detail.tsx         # Match with instance betting
│       │   ├── my-bets.tsx              # Bet history
│       │   └── profile.tsx              # User profile
│       ├── lib/
│       │   ├── api.ts                   # API client with all methods
│       │   ├── store.ts                 # Zustand store
│       │   └── utils.ts                 # Utilities
│       ├── hooks/
│       │   └── use-mobile.ts            # Mobile detection
│       └── App.tsx                      # Routes
├── server/
│   ├── auth.ts                          # Passport configuration
│   ├── cricketApi.ts                    # CricketData.org integration
│   ├── instanceBetting.ts               # Instance market service
│   ├── routes.ts                        # All API routes
│   ├── storage.ts                       # Database operations
│   ├── seed.ts                          # Demo data seeding
│   └── index.ts                         # Server entry point
├── shared/
│   └── schema.ts                        # Drizzle schema + types
└── migrations/                          # Database migrations
```

---

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SESSION_SECRET=your-secret-key
CRICKET_API_KEY=your-cricketdata-api-key
ODDS_API_KEY=your-theoddsapi-key
```

---

## Instance Betting System (Current Implementation)

### How It Works:

1. **Market Generation** (`server/instanceBetting.ts`):
   - Creates micro-markets for live cricket: Next Ball, Next Over, Session
   - Markets stored in-memory with 60-second expiry
   - Outcomes: 0 runs, 1 run, 2 runs, 4 runs, 6 runs, Wicket

2. **Market Lifecycle**:
   - Created when user views live match
   - Auto-closes after 60 seconds
   - New markets generated when previous ones expire

3. **Current Limitations**:
   - In-memory only (lost on server restart)
   - No automatic settlement
   - Synthetic odds (not real exchange matching)
   - Timer-based, not event-based

### 1XBet Comparison:

| Aspect | Current ProBetX | 1XBet |
|--------|-----------------|-------|
| Market Creation | Timer-based | Ball-by-ball events |
| Odds Source | Algorithm | Real-time exchange |
| Settlement | Manual | Automatic from feed |
| Storage | In-memory | Persistent DB |
| Updates | HTTP polling | WebSocket push |

---

## Default Test Accounts

```
Demo User: demo / demo123 (USER role, ₹10,000 balance)
Admin: admin / admin123 (ADMIN role, ₹100,000 balance)
```

---

## Commands

```bash
npm run dev          # Start development server
npm run db:push      # Push schema changes to database
npm run db:seed      # Seed demo data
npm run build        # Production build
```

---

## What's Needed for 1XBet Parity

### Phase 1: Core Infrastructure
1. WebSocket server for real-time push updates
2. Persist instance markets to PostgreSQL
3. Automatic bet settlement via result feeds
4. Cashout functionality
5. Order book with peer-to-peer matching

### Phase 2: Advanced Betting
1. Accumulator/parlay bet support
2. Bet builder feature
3. More sports (football, basketball, tennis)
4. Live streaming integration
5. Statistics and form guides

### Phase 3: Business Features
1. Payment gateway (Stripe/Razorpay)
2. KYC/AML verification
3. Multi-currency wallets
4. Bonus and promotion engine
5. Referral system

### Phase 4: Scale & Compliance
1. Horizontal scaling
2. Gambling license compliance
3. Responsible gambling features
4. Mobile app (React Native)
5. CDN and performance optimization

---

## User Preferences

- Preferred communication style: Simple, everyday language
- Mobile-first design priority
- Dark theme UI
- Real-time updates essential
