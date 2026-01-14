import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not defined");
}

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
});
