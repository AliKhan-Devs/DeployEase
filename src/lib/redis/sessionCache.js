import { getRedisClient } from "./client";

const redis = getRedisClient();

export async function setSession(userId, sessionData, ttlSeconds = 3600) {
  await redis.set(`session:${userId}`, JSON.stringify(sessionData), "EX", ttlSeconds);
}

export async function getSession(userId) {
  const data = await redis.get(`session:${userId}`);
  return data ? JSON.parse(data) : null;
}

export async function deleteSession(userId) {
  await redis.del(`session:${userId}`);
}
