import { Queue, Worker } from "bullmq";
import { getRedisClient } from "./client";
import { handleDeploymentRequest } from "../utils/deployments/handleDeploymentRequest";

const connection = getRedisClient();

// Deployment queue
export const deploymentQueue = new Queue("deployments", { connection });

// Worker to process deployments
export const deploymentWorker = new Worker("deployments", async job => {
  const { session, body, log } = job.data;
  await handleDeploymentRequest({ session, body, log });
}, { connection });
