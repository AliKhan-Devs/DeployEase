import http from "http";
import express from "express";
import { Server } from "socket.io";
import { NodeSSH } from "node-ssh";
import setupLiveShell from "./src/lib/utils/liveshell.js";
const app = express();
const server = http.createServer(app);

// ✅ Add JSON body parser
app.use(express.json());

// ✅ Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ✅ Setup live SSH shell
setupLiveShell(io);

// ✅ Socket.IO connection
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Join a room for this user
  socket.on("join-room", (userId) => {
    socket.join(userId);
    console.log(`Socket ${socket.id} joined room ${userId}`);
  });

  // Receive logs from backend or frontend via socket
  socket.on("deploy-log", ({ userId, msg }) => {
    io.to(userId).emit("deploy-log", msg);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });

  // ✅ New endpoint: live PM2 log tail
  socket.on("start-live-tail", async (deployment) => {
    const ssh = new NodeSSH();
    try {
      await ssh.connect({
        host: deployment.ec2PublicIp,
        username: deployment.sshUsername || "ubuntu",
        privateKey: deployment.keyMaterial,
      });

      console.log("🔌 SSH connected for live tail");

      // Execute PM2 logs with streaming
      ssh.exec(`pm2 logs index.js --lines 100 --raw`, [], {
        onStdout(chunk) {
          socket.emit("live-log", chunk.toString());
        },
        onStderr(chunk) {
          socket.emit("live-log", chunk.toString());
        },
      }).then(() => {
        console.log("Live tail session ended");
      });

      // Clean up when socket disconnects
      socket.on("disconnect", () => {
        try {
          ssh.dispose();
          console.log("SSH session disposed for live tail");
        } catch (err) {
          console.warn("Failed to dispose SSH session:", err.message);
        }
      });

    } catch (err) {
      socket.emit("live-log", `❌ SSH Error: ${err.message}`);
    }
  });
});

// ✅ Basic HTTP route
app.get("/", (req, res) => res.send("Socket.IO server is running"));

// ✅ HTTP endpoint to receive logs from API route
app.post("/deploy-log", (req, res) => {
  const { userId, msg } = req.body;

  if (!userId || !msg) {
    return res.status(400).send({ error: "userId and msg are required" });
  }

  io.to(userId).emit("deploy-log", msg);
  res.send({ ok: true });
});

// ✅ Start server
const PORT = process.env.SOCKET_PORT || 4000;
server.listen(PORT, () => console.log(`Socket.IO server running on port ${PORT}`));
