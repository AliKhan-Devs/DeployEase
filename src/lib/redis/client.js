import Redis from "ioredis";

let redisClient;

export function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null, // required for BullMQ
      enableOfflineQueue: true,   // optional, recommended for queues
    });
  }
  return redisClient;
}
