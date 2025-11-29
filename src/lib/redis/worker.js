import { Worker } from "bullmq";

import prisma from "../prisma.js";
import { createLogger } from "../utils/createLogger.js";
import { getRedisClient } from "./client.js";
import { handleDeploymentRequest } from "../utils/deployments/handleDeploymentRequest.js";


const connection = getRedisClient();

const worker = new Worker(
  "deployments",
  async job => {
    try {
      const { userId, payload } = job.data;
      console.log(userId);
    const session = await prisma.user.findUnique({
      where: { id: userId }
    });
    console.log(session);
    const log = await createLogger(userId);
    
    console.log("Worker is running job:", job.id);

    await handleDeploymentRequest({
      session,
      body: payload,
      log
    });

    
    } catch (error) {
      console.log("error")
      console.log(error);
    }
  },
  {
    connection,
    // MUST ADD FOR ioredis+BullMQ
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  }
);

console.log("🚀 Worker started…");
