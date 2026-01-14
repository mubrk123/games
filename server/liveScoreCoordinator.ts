import { cricketApiService } from "./cricketApi";
import { realtimeHub } from "./realtimeHub";
import { redis } from "./redisClient";

interface LiveScoreState {
  over: number;
  ball: number;
  runs: number;
  wickets: number;
  inning: number;
  status: "LIVE" | "FINISHED";
  updatedAt: number;
}


class LiveScoreCoordinator {
  private poller: NodeJS.Timeout | null = null;
  private POLL_INTERVAL = 3000;
  private FAILURE_COOLDOWN_MS = 60_000;
  private failures = new Map<string, number>();

  start() {
    if (this.poller) return;

    this.poller = setInterval(() => this.poll(), this.POLL_INTERVAL);
    console.log("[LiveScoreCoordinator] Started");
  }

  stop() {
    if (this.poller) clearInterval(this.poller);
    this.poller = null;
    console.log("[LiveScoreCoordinator] Stopped");
  }

  async poll() {
    const activeMatches = realtimeHub.getActiveMatchSubscriptions();
    if (activeMatches.length === 0) return;

    for (const matchId of activeMatches) {
      const cleanId = matchId.replace("cricket-", "");

      const lastFail = this.failures.get(matchId);
      if (lastFail && Date.now() - lastFail < this.FAILURE_COOLDOWN_MS) {
        continue;
      }

      try {
        // Prefer BBB
        const bbb = await cricketApiService.getFantasyBallByBall(cleanId);

        if (bbb?.bpidata?.length) {
          const inning = bbb.bpidata.at(-1);
          const lastBall = inning.bowls.at(-1);
          const [over, ball] = lastBall.over.split(".").map(Number);

         const state: LiveScoreState = {
  over,
  ball,
  runs: inning.runs,
  wickets: inning.wickets,
  inning: bbb.bpidata.length,
  status: bbb.matchEnded ? "FINISHED" : "LIVE",
  updatedAt: Date.now(),
};


          await redis.set(`live:${matchId}`, JSON.stringify(state), "EX", 30);
          continue;
        }

        // Fallback (ONLY if BBB not available)
        const info = await cricketApiService.getMatchInfo(cleanId);
        if (!info?.score?.length) continue;

        const lastInning = info.score.at(-1);
        const overs = lastInning.o || 0;

       const state: LiveScoreState = {
  over: Math.floor(overs),
  ball: Math.round((overs - Math.floor(overs)) * 10),
  runs: lastInning.r,
  wickets: lastInning.w,
  inning: info.score.length,
  status: info.matchEnded ? "FINISHED" : "LIVE",
  updatedAt: Date.now(),
};

        await redis.set(`live:${matchId}`, JSON.stringify(state), "EX", 30);

      } catch {
        this.failures.set(matchId, Date.now());
      }
    }
  }

  async get(matchId: string): Promise<LiveScoreState | null> {
    const raw = await redis.get(`live:${matchId}`);
    return raw ? JSON.parse(raw) : null;
  }
}

export const liveScoreCoordinator = new LiveScoreCoordinator();
