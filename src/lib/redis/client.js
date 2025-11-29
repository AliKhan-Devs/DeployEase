import Redis from "ioredis";

let redisClient;

export function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL);
  }
  return redisClient;
}
