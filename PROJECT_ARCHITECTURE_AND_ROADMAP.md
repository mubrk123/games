# Project Architecture, State, and Future Roadmap

## 1. Project Overview
**ProBetX** is a high-fidelity frontend mockup of a Sports Betting Exchange and Casino platform. It is designed to demonstrate the complete user journey and admin workflows without relying on a functional backend server during the design phase.

**Current Capabilities:**
*   **Sports Exchange:** Real-time odds display, Back/Lay betting, Live match simulation.
*   **Casino:** Lobby interface for game selection.
*   **User System:** Role-based access (User vs. Admin), client-side wallet, bet history.
*   **Admin Panel:** User management, manual fund credits, global risk monitoring.

---

## 2. Current Architecture (Mockup Mode)

The application runs entirely in the browser (Client-Side). It mimics a server-client architecture using `Zustand` for state management and local storage for persistence.

### **Frontend Stack:**
*   **Framework:** React 18 (Vite)
*   **Styling:** Tailwind CSS + Shadcn UI (Custom "Dark Future" Theme)
*   **State Management:** Zustand (Acts as the client-side database)
*   **Routing:** Wouter
*   **Visualization:** Recharts (Admin charts)

### **Conceptual Diagram:**
```
[User Browser]
   |
   +-- [React App]
         |
         +-- [Store (Zustand)] <---- Central "Database"
         |      |
         |      +-- [Users Array] (Stores accounts & balances)
         |      +-- [Bets Array]  (Stores all transactions)
         |      +-- [Matches Array] (Stores live market data)
         |
         +-- [MockSocketService] --> Emits fake "odds_update" events
                  |
                  v
         [Updates Store Real-time]
```

---

## 3. Assumptions & "Mock" Layers

To make this functional without a backend, I made several critical assumptions and built simulation layers. **These are the parts you must replace later.**

### **A. The Database (Replaced by `client/src/lib/store.ts`)**
*   **Current:** All data (users, bets, balances) is stored in a Javascript array inside `store.ts`. It saves to `localStorage` so data survives a refresh.
*   **Future:** This must be replaced by a real database (PostgreSQL/MongoDB).
*   **Action:** When you build the backend, you will remove the `users` array from the store and instead fetch data via API calls (`fetch('/api/users')`).

### **B. The Live Odds Feed (Replaced by `client/src/lib/mockData.ts`)**
*   **Current:** A class called `MockSocketService` generates random numbers every 2 seconds to simulate market movement.
*   **Future:** You cannot calculate odds yourself. You must buy them.
*   **Action:** Replace `MockSocketService` with a real `socket.io-client` connection to your backend. Your backend will subscribe to a provider like **SportRadar**, **Betfair API**, or **BetGenius**.

### **C. Wallet Transactions**
*   **Current:** The frontend simply does `user.balance -= stake`. This is insecure for production.
*   **Future:** The frontend should send a request: `POST /api/bet`. The server handles the deduction transactionally.

---

## 4. Hardcoded Files & Logic (What to Change)

1.  **`client/src/lib/mockData.ts`**
    *   **What it is:** Contains the initial `MOCK_MATCHES` (IPL, Premier League) and the `MockSocketService`.
    *   **Action:** Delete the hardcoded matches. Fetch them from your API. Delete the `startSimulation()` call.

2.  **`client/src/lib/store.ts`**
    *   **What it is:** The brain of the mockup. It handles `login`, `register`, `placeBet` logic synchronously.
    *   **Action:** Refactor all "Actions" to be async API calls.
    *   *Example:*
        ```typescript
        // Current
        login: (username) => { set({ user: ... }) }

        // Future
        login: async (username, password) => {
            const res = await fetch('/api/login', ...);
            set({ user: await res.json() });
        }
        ```

3.  **`client/src/components/betting/OddsCard.tsx`**
    *   **What it is:** It listens to the store for odds updates.
    *   **Action:** This component is actually **Production Ready**. It listens to the store. As long as your store gets updated (by socket or mock), this component works fine.

---

## 5. Future Roadmap (How to Graduate to Full Stack)

To make this a real, money-handling platform, follow this exact sequence:

### **Phase 1: Backend Setup**
1.  Initialize a **Node.js/Express** server (already scaffolded in `server/`).
2.  Set up **PostgreSQL** database.
3.  Create Schema: `Users`, `Wallets`, `Bets`, `Transactions`, `Matches`.

### **Phase 2: Authentication**
1.  Implement **JWT (JSON Web Tokens)**.
2.  Replace the mock login page with real API calls.
3.  Secure the `/admin` routes on the server side (Middleware).

### **Phase 3: The Odds Feed (Critical)**
1.  Sign up for a sports data provider (e.g., **TheRundown**, **OddsBlaze**, or **Betfair Developer Program**).
2.  Create a "Worker" process on your server that connects to their WebSocket.
3.  When the provider sends an update, your server should broadcast it to your frontend clients via **Socket.io**.

### **Phase 4: Wallet & Betting Engine**
1.  Move the `placeBet` logic from `store.ts` to a server-side controller.
2.  Implement ACID transactions: *Check Balance -> Lock Funds -> Create Bet -> Update Exposure*.
3.  Implement **Result Settlement**:
    *   Server receives "Match Finished" signal from Provider.
    *   Server finds all bets for that match.
    *   Server calculates winners and credits wallets.

---

## 6. Prompt for Future AI

If you hand this project to another AI or Developer, copy-paste this prompt:

> "I have a complete React frontend for a betting exchange. It currently uses a local mock store (Zustand) and simulated odds data.
>
> **Your Job:**
> 1. Keep the UI exactly as it is (it is fully responsive and styled).
> 2. Connect it to a real Node.js/Express backend.
> 3. Replace the `MockSocketService` in `mockData.ts` with a real Socket.io client that listens for odds updates.
> 4. Replace the local `users` array in `store.ts` with API calls to a PostgreSQL database.
> 5. Implement the `placeBet` API endpoint that handles wallet deductions transactionally.
>
> The frontend architecture is decoupled: The components only read from the Store. You only need to change how the Store gets its data (API vs. Local Array)."

