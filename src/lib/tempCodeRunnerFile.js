// lib/socket.js
import { Server } from "socket.io";

let io;

export function initIO(server) {
  if (!io) {
    io = new Server(server, { cors: { origin: "*" } });
    io.on("connection", (socket) => {
      console.log("New client connected:", socket.id);
      socket.on("join-room", (userId) => socket.join(userId));
    });
  }
  return io;
}

export function getIO() {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}
