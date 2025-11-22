import { NodeSSH } from "node-ssh";
import { decryptSecret } from "./encryptDecrypt.js";
import prisma from "../prisma.js";

export default function setupLiveShell(io) {
  io.on("connection", (socket) => {
    console.log("Client connected for live shell");

    let sshSession = null;
    let sshStream = null;

    socket.on("start-ssh", async ({ deployment }) => {
      sshSession = new NodeSSH();

      try {
        // fetch deployment from DB
        const dep = await prisma.deployment.findUnique({
          where: { id: deployment.id },
          include: { instance: true } // include EC2 instance info
        });

        if (!dep) throw new Error("Deployment not found");
        if (!dep.instance?.publicIp) throw new Error("Deployment has no public IP");

        const privateKey = decryptSecret(dep.instance.keyMaterial);

        await sshSession.connect({
          host: dep.instance.publicIp,
          username: dep.instance.sshUsername || "ubuntu",
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
