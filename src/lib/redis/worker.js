import { Worker } from "bullmq";

import prisma from "../prisma.js";
import { createLogger } from "../utils/createLogger.js";
import { getRedisClient } from "./client.js";
import { handleDeploymentRequest } from "../utils/deployments/handleDeploymentRequest.js";
import { exampleTask } from "../../../tests/test.js";


const connection = getRedisClient();

const worker = new Worker(
  "deployments",
  async job => {
    try {
      const { userId, payload } = job.data;
      console.log("Worker processing job:", job.id, "for user:", userId);
      
      // Fetch user from database
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      console.log("Payload:", payload);
      const log = await createLogger(userId);
      
      console.log("Worker is running job:", job.id);

      // Pass user object as session (handleDeploymentRequest will extract id)
      const result = await handleDeploymentRequest({
        session: user, // Pass user object, function will handle it
        body: payload,
        log
      });

      console.log("Deployment completed successfully:", result);

      // Run example task if needed (you can remove this if not needed)
      // await exampleTask({ userId, payload, log });

    } catch (error) {
      console.error("Worker error:", error);
      console.error("Error stack:", error.stack);
      // Re-throw to mark job as failed in BullMQ
      throw error;
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
