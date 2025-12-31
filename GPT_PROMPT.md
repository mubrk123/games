# Complete GPT Prompt for ProBetX Development

Copy everything below this line and paste it to GPT/Claude to continue development:

---

## SYSTEM CONTEXT

You are an expert full-stack developer working on ProBetX, a sports betting exchange platform inspired by 1XBet. The codebase is built with React + Express + PostgreSQL. Your task is to continue development from the current state to achieve 1XBet-level functionality.

---

## PROJECT OVERVIEW

**ProBetX** is a mobile-first sports betting exchange with:
- Real-time sports odds from The Odds API
- Live cricket matches from CricketData.org API
- Back/Lay exchange betting (like Betfair)
- Instance-based micro-betting (Next Ball, Next Over, Session)
- User wallets with balance and exposure tracking
- Admin dashboard for user and bet management

---

## CURRENT TECHNOLOGY STACK

### Frontend:
- **React 18** with **Vite** for fast builds
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for component library (dark theme)
- **Zustand** for client state management
- **React Query (TanStack)** for server data fetching
- **Wouter** for routing
- **Lucide React** for icons

### Backend:
- **Node.js + Express** REST API
- **TypeScript** throughout
- **Drizzle ORM** for type-safe PostgreSQL queries
- **Passport.js** for session-based authentication
- **bcrypt** for password hashing

### Database:
- **PostgreSQL** with the following tables:
  - `users` (id, username, passwordHash, role, balance, exposure, currency)
  - `matches` (id, sport, league, homeTeam, awayTeam, startTime, status, scores)
  - `markets` (id, matchId, name, status)
  - `runners` (id, marketId, name, backOdds, layOdds, volume)
  - `bets` (id, userId, matchId, marketId, runnerId, type, stake, odds, status)
  - `walletTransactions` (id, userId, type, amount, balance, description)

---

## CURRENT FILE STRUCTURE

```
probetx/
├── client/src/
│   ├── components/
│   │   ├── betting/
│   │   │   ├── MobileBetSlip.tsx      # Slide-up bet placement modal
│   │   │   ├── MobileOddsCard.tsx     # Match card with Back/Lay buttons + instance betting
│   │   │   ├── BetSlip.tsx            # Desktop bet slip
│   │   │   └── OddsCard.tsx           # Desktop match card
│   │   ├── layout/
│   │   │   ├── AppShell.tsx           # Main layout wrapper
│   │   │   ├── BottomNav.tsx          # Mobile bottom navigation
│   │   │   ├── MobileHeader.tsx       # Mobile header with wallet
│   │   │   └── Sidebar.tsx            # Desktop sidebar
│   │   └── ui/                        # shadcn/ui components
│   ├── pages/
│   │   ├── auth/login.tsx             # Login page
│   │   ├── auth/register.tsx          # Registration page
│   │   ├── admin.tsx                  # Admin dashboard
│   │   ├── casino.tsx                 # Casino placeholder
│   │   ├── dashboard.tsx              # Main sports betting page (home)
│   │   ├── match-detail.tsx           # Single match with instance betting
│   │   ├── my-bets.tsx                # User bet history
│   │   └── profile.tsx                # User profile
│   ├── lib/
│   │   ├── api.ts                     # API client with all HTTP methods
│   │   ├── store.ts                   # Zustand store definition
│   │   └── utils.ts                   # Utility functions
│   ├── hooks/use-mobile.ts            # Mobile detection hook
│   └── App.tsx                        # Route definitions
├── server/
│   ├── auth.ts                        # Passport.js configuration
│   ├── cricketApi.ts                  # CricketData.org API integration
│   ├── instanceBetting.ts             # Instance market generation service
│   ├── routes.ts                      # All API route handlers
│   ├── storage.ts                     # Database operations (IStorage interface)
│   ├── seed.ts                        # Demo data seeding
│   └── index.ts                       # Express server entry point
├── shared/
│   └── schema.ts                      # Drizzle database schema + TypeScript types
└── package.json
```

---

## CURRENT API ENDPOINTS

```
# Authentication
POST /api/auth/register     - Create new account
POST /api/auth/login        - Login (sets session cookie)
POST /api/auth/logout       - Logout
GET  /api/auth/me           - Get current authenticated user

# Matches & Betting
GET  /api/matches           - Get all matches with markets
GET  /api/matches/:id       - Get single match with markets
POST /api/bets              - Place a bet (requires auth)
GET  /api/bets/me           - Get user's bet history

# Live Data
GET  /api/live/sports       - Get available sports from Odds API
GET  /api/live/all          - Get live matches from Odds API
GET  /api/live/realtime/:id - Get real-time score updates for a match
GET  /api/cricket/current   - Get current cricket matches from CricketData.org

# Instance Betting
GET  /api/instance/markets/:matchId  - Get active instance markets for match
POST /api/instance/bets              - Place an instance bet
GET  /api/instance/markets           - Get all active instance markets

# Admin (requires ADMIN role)
GET   /api/admin/users              - Get all users
PATCH /api/admin/users/:id/balance  - Adjust user balance
PATCH /api/admin/bets/:id/settle    - Settle a bet (WON/LOST/VOID)
```

---

## WHAT'S CURRENTLY WORKING

1. **User Authentication**: Login/signup with sessions, password hashing
2. **Role-Based Access**: USER, ADMIN, AGENT roles with route protection
3. **Wallet System**: Balance tracking, exposure calculation, transaction history
4. **Back/Lay Betting**: Users can place Back or Lay bets on match outcomes
5. **Live Cricket Data**: Real matches from CricketData.org with live scores
6. **Real-time Updates**: 5-second polling for live match scores
7. **Instance Betting UI**: Next Ball, Next Over, Session markets displayed
8. **Mobile-First Design**: Bottom nav, slide-up bet slip, responsive layout
9. **Admin Dashboard**: User list, wallet adjustments, bet settlement

---

## WHAT'S NOT WORKING / INCOMPLETE

1. **Instance Betting Storage**: Markets stored in-memory, lost on server restart
2. **Automatic Settlement**: Bets must be manually settled by admin
3. **Real Exchange Matching**: Odds are synthetic, not peer-to-peer matched
4. **WebSocket Updates**: Using HTTP polling instead of push notifications
5. **Cashout**: No ability to close bets early
6. **Accumulators/Parlays**: Only single bets supported
7. **Payment Integration**: No deposits/withdrawals
8. **KYC Verification**: No identity verification
9. **Multi-Currency**: Only INR supported
10. **Casino Games**: Page exists but no real games

---

## ENVIRONMENT VARIABLES REQUIRED

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
SESSION_SECRET=your-random-secret-key
CRICKET_API_KEY=your-cricketdata-api-key
ODDS_API_KEY=your-theoddsapi-key
```

---

## TEST ACCOUNTS

```
Demo User: username=demo, password=demo123 (USER role, ₹10,000)
Admin: username=admin, password=admin123 (ADMIN role, ₹100,000)
```

---

## DEVELOPMENT COMMANDS

```bash
npm run dev        # Start development server (frontend + backend)
npm run db:push    # Push schema changes to database
npm run db:seed    # Seed demo data (users, matches)
npm run build      # Production build
```

---

## PHASE 1 TASKS - Core Infrastructure (Priority)

### 1.1 Add WebSocket Support
- Replace HTTP polling with WebSocket for real-time updates
- Use `ws` package for server, native WebSocket on client
- Push score updates, odds changes, bet confirmations

### 1.2 Persist Instance Markets to Database
- Create `instanceMarkets` and `instanceBets` tables in schema.ts
- Modify instanceBetting.ts to use database instead of in-memory Map
- Add proper market lifecycle (PENDING → OPEN → CLOSED → SETTLED)

### 1.3 Automatic Bet Settlement
- Create settlement service that checks match results
- When match ends, automatically settle all related bets
- Update user balances and exposure accordingly

### 1.4 Cashout Feature
- Add `/api/bets/:id/cashout` endpoint
- Calculate cashout value based on current odds vs original odds
- Allow partial cashout (percentage of stake)

### 1.5 Order Book Implementation
- Create order book system for peer-to-peer matching
- Match back bets against lay bets at same odds
- Implement order matching algorithm (price-time priority)

---

## PHASE 2 TASKS - Advanced Betting

### 2.1 Accumulator/Parlay Bets
- Allow users to combine multiple selections
- Calculate combined odds (multiply individual odds)
- New `accumulatorBets` table with leg references

### 2.2 Bet Builder
- Custom bet combinations within a match
- Example: "Team A to win AND over 2.5 goals"
- Price calculation for custom bets

### 2.3 More Sports Integration
- Fully utilize The Odds API for football, basketball, tennis
- Sport-specific market types
- Proper sports filtering on dashboard

### 2.4 Live Streaming
- Integrate streaming provider (Sportradar, IMG)
- Embed player in match detail page
- Sync stream with betting markets

### 2.5 Statistics & Form
- Match statistics display
- Team form guides (last 5 matches)
- Head-to-head records

---

## PHASE 3 TASKS - Business Features

### 3.1 Payment Gateway
- Stripe or Razorpay integration
- Deposit flow with payment methods
- Withdrawal requests with admin approval
- Transaction history

### 3.2 KYC/AML Verification
- Document upload (ID, address proof)
- Verification status (PENDING, VERIFIED, REJECTED)
- Limit withdrawals until verified

### 3.3 Multi-Currency
- Support USD, EUR, GBP, BTC
- Currency conversion rates
- User-selectable default currency

### 3.4 Bonus & Promotions
- Welcome bonus on first deposit
- Free bet credits
- Cashback offers
- Referral bonuses

### 3.5 Referral System
- Unique referral codes per user
- Commission on referee's losses
- Referral dashboard

---

## PHASE 4 TASKS - Scale & Compliance

### 4.1 Performance Optimization
- Database indexing
- Redis caching for odds
- CDN for static assets
- API rate limiting

### 4.2 Horizontal Scaling
- Stateless API servers
- Redis for session storage
- Database connection pooling

### 4.3 Responsible Gambling
- Deposit limits (daily/weekly/monthly)
- Self-exclusion periods
- Reality check notifications
- Cooling-off periods

### 4.4 Compliance
- Gambling license requirements
- Age verification
- Audit logging
- Reporting for regulators

### 4.5 Mobile App
- React Native app
- Push notifications
- Biometric authentication
- Offline bet slip

---

## CODE STYLE GUIDELINES

1. **TypeScript**: Use strict typing, avoid `any`
2. **Components**: Functional components with hooks
3. **Styling**: Tailwind CSS utility classes
4. **API**: RESTful conventions, proper HTTP status codes
5. **Error Handling**: Try-catch with meaningful error messages
6. **Database**: Use Drizzle ORM, never raw SQL
7. **State**: Zustand for client, React Query for server state
8. **Testing**: Add data-testid to interactive elements

---

## KEY DESIGN DECISIONS

1. **Mobile-First**: All components designed for mobile, then desktop
2. **Dark Theme**: Default dark theme, matches betting platform aesthetics
3. **Exchange Model**: Back/Lay betting like Betfair, not traditional bookmaker
4. **Real-Time Priority**: Live data is critical, must be fast and reliable
5. **Session Auth**: Cookies for simplicity, JWT for future mobile app

---

## IMPORTANT NOTES

1. **Instance Betting Service** (`server/instanceBetting.ts`):
   - Currently generates synthetic odds using probability algorithms
   - Markets expire after 60 seconds
   - Needs to be connected to real ball-by-ball event feeds for production

2. **Cricket API** (`server/cricketApi.ts`):
   - Uses CricketData.org free tier (limited requests)
   - Caches responses to reduce API calls
   - Live score updates have ~10 second delay

3. **Odds API** (`server/routes.ts`):
   - Provides multi-sport odds from various bookmakers
   - Rate limited, cache responses
   - Some sports may not have live events

4. **Wallet Logic**:
   - `balance` = available funds
   - `exposure` = potential loss from open bets
   - When placing bet: deduct from balance, add to exposure
   - When settling: update balance based on result, clear exposure

---

## EXAMPLE: How to Add a New Feature

### Adding WebSocket Support:

1. **Install ws package**:
```bash
npm install ws @types/ws
```

2. **Create WebSocket server** (`server/websocket.ts`):
```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

const clients = new Map<string, WebSocket>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  wss.on('connection', (ws, req) => {
    const userId = // extract from session
    clients.set(userId, ws);
    
    ws.on('close', () => clients.delete(userId));
  });
}

export function broadcast(event: string, data: any) {
  clients.forEach(ws => {
    ws.send(JSON.stringify({ event, data }));
  });
}
```

3. **Integrate with server** (`server/index.ts`):
```typescript
import { setupWebSocket } from './websocket';
// After createServer...
setupWebSocket(server);
```

4. **Client hook** (`client/src/hooks/use-websocket.ts`):
```typescript
import { useEffect } from 'react';

export function useWebSocket(onMessage: (event: string, data: any) => void) {
  useEffect(() => {
    const ws = new WebSocket(`wss://${window.location.host}/ws`);
    ws.onmessage = (e) => {
      const { event, data } = JSON.parse(e.data);
      onMessage(event, data);
    };
    return () => ws.close();
  }, []);
}
```

---

## START HERE

When continuing development, I recommend this order:

1. **First**: Add WebSocket for real-time updates (biggest UX improvement)
2. **Second**: Persist instance markets to database (reliability)
3. **Third**: Add automatic bet settlement (reduces admin work)
4. **Fourth**: Implement cashout (key user feature)
5. **Fifth**: Add payment integration (monetization)

Ask me to implement any of these features and I'll provide the complete code!

---

## QUESTIONS TO ASK BEFORE CODING

1. Which feature would you like me to implement first?
2. Do you have API keys for the services (Cricket API, Odds API)?
3. Should I prioritize mobile or desktop experience?
4. What payment methods do you need (cards, UPI, crypto)?
5. Which regions/countries will this serve (for compliance)?

---

END OF PROMPT
