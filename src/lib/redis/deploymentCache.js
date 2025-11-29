import { getRedisClient } from "./client";
const redis = getRedisClient();

export async function setDeploymentStatus(deploymentId, status) {
  await redis.hset(`deployment:${deploymentId}`, "status", status, "timestamp", Date.now());
}

export async function getDeploymentStatus(deploymentId) {
  const data = await redis.hgetall(`deployment:${deploymentId}`);
  return Object.keys(data).length ? data : null;
}
