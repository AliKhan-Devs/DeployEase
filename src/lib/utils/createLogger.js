
const SOCKET_URL = process.env.SOCKET_URL || "http://localhost:4000";

export async function createLogger(userId) {
    return async (msg, delay = 0) => {
      try {
        console.log(msg);
        await fetch(`${SOCKET_URL}/deploy-log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, msg }),
        });
      } catch (err) {
        console.error("Failed to send log to socket server:", err?.message || err);
      }
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    };
  }


