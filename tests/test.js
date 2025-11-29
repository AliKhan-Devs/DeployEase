// src/lib/redis/testTask.js
export async function exampleTask({ userId, payload, log }) {
  return new Promise(async (resolve, reject) => {
    try {
       console.log(`Starting example task for user ${userId}...`);
      
      // Simulate a delay
      await new Promise(res => setTimeout(res, 2000));
      
       console.log(`Processing payload: ${JSON.stringify(payload)}`);
      
      // Simulate another delay
      await new Promise(res => setTimeout(res, 2000));
      
       console.log("Example task completed successfully!");
      resolve("Success");
    } catch (err) {
       console.log(`Error in example task: ${err.message || err}`);
      reject(err);
    }
  });
}
