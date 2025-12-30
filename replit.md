# ProBetX - Sports Betting Exchange & Casino Platform

## Overview

ProBetX is a full-stack sports betting exchange and casino platform built with React, Express, and PostgreSQL. The application supports real-time odds display, Back/Lay betting, live match simulation, casino games, role-based access control (User/Admin), wallet management, and administrative functions including user management and risk monitoring.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with Vite for fast development and builds
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style, dark theme)
- **State Management**: Zustand for client-side state with localStorage persistence
- **Routing**: Wouter for lightweight client-side routing
- **Data Fetching**: TanStack React Query for server state management and caching
- **Visualization**: Recharts for admin dashboard charts

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **API Design**: RESTful endpoints under `/api/` prefix
- **Authentication**: Passport.js with local strategy, session-based auth using express-session
- **Password Security**: bcrypt for password hashing
- **Build System**: esbuild for server bundling, Vite for client builds

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit for database migrations (`db:push` command)
- **Session Storage**: Express sessions (configured for production security)

### Key Entities
- **Users**: Role-based (USER, ADMIN, AGENT) with balance and exposure tracking
- **Matches**: Sports events with status (LIVE, UPCOMING, FINISHED)
- **Markets**: Betting markets within matches (OPEN, SUSPENDED, CLOSED)
- **Runners**: Selections within markets with back/lay odds
- **Bets**: User bets with type (BACK/LAY) and status (OPEN, WON, LOST, VOID)
- **Wallet Transactions**: Credit/debit history for user balances

### Authentication Flow
1. User submits credentials to `/api/auth/login`
2. Passport validates against database with bcrypt comparison
3. Session created and serialized with user ID
4. Protected routes use `requireAuth` and `requireAdmin` middleware
5. Client stores user state in Zustand and checks auth on app load

### Project Structure
```
├── client/src/           # React frontend
│   ├── components/       # UI components (shadcn/ui + custom)
│   ├── pages/            # Route pages (dashboard, casino, admin, auth)
│   ├── lib/              # Utilities, store, API client
│   └── hooks/            # Custom React hooks
├── server/               # Express backend
│   ├── routes.ts         # API route definitions
│   ├── storage.ts        # Database operations via Drizzle
│   ├── auth.ts           # Authentication setup
│   └── seed.ts           # Database seeding
├── shared/               # Shared code between client/server
│   └── schema.ts         # Drizzle database schema
└── migrations/           # Database migration files
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database (connection via `DATABASE_URL` environment variable)
- **Drizzle ORM**: Type-safe database queries and schema management

### Authentication & Security
- **Passport.js**: Authentication middleware with local strategy
- **bcrypt**: Password hashing (10 salt rounds)
- **express-session**: Server-side session management

### UI Components
- **Radix UI**: Headless component primitives (dialogs, dropdowns, tabs, etc.)
- **shadcn/ui**: Pre-built component library built on Radix
- **Lucide React**: Icon library

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server-side bundling
- **TypeScript**: Full type safety across the stack

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption (defaults to development value)