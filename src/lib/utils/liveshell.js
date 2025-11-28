import { NodeSSH } from "node-ssh";
import { decryptSecret } from "./encryptDecrypt.js";
import prisma from "../prisma.js";

export default function setupLiveShell(io) {
  io.on("connection", (socket) => {
    console.log("Client connected for live shell");

    let sshSession = null;
    let sshStream = null;

    socket.on("start-ssh", async ({ instance }) => {
      sshSession = new NodeSSH();

      try {
        // fetch instance from DB
        const instance = await prisma.ec2Instance.findUnique({
          where: { id: instance.id },
        });

        const privateKey = decryptSecret(instance.keyMaterial);

        await sshSession.connect({
          host: instance.publicIp,
          username: instance.sshUsername || "ubuntu",
          privateKey,
        });

        socket.emit("ssh-log", "🔑 SSH Connected!\n");

        sshStream = await sshSession.requestShell();

        // Stream SSH output to frontend
        sshStream.on("data", (data) => {
          socket.emit("ssh-log", data.toString());
        });

        // Send user input to SSH
        socket.on("ssh-input", (input) => {
          if (sshStream) sshStream.write(input);
        });

        sshStream.on("close", () => {
          socket.emit("ssh-log", "\n🔌 SSH session closed");
          sshSession.dispose();
        });

      } catch (err) {
        socket.emit("ssh-log", `❌ SSH Error: ${err.message}`);
      }
    });

    socket.on("disconnect", () => {
      if (sshSession) sshSession.dispose();
      console.log("Client disconnected from live shell");
    });
  });
}
