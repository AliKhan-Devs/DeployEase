import { Queue } from "bullmq";
import { getRedisClient } from "./client";

const connection = getRedisClient();

// Deployment queue
export const deploymentQueue = new Queue("deployments", { connection });

