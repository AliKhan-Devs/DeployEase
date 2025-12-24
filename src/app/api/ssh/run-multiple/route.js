import { getAuthSession } from "@/lib/authSession";
import { NodeSSH } from "node-ssh";
import { decryptSecret } from "@/lib/utils/encryptDecrypt";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Execute multiple SSH commands in sequence on an EC2 instance
 * This allows for complex operations that require multiple steps
 */
export async function POST(req) {
  const session = await getAuthSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { instanceId, commands } = await req.json();
    if (!instanceId || !Array.isArray(commands) || commands.length === 0) {
      return new Response(JSON.stringify({ error: "Instance ID and commands array are required" }), { status: 400 });
    }

    // Fetch instance details
    const instance = await prisma.ec2Instance.findUnique({ where: { awsInstanceId: instanceId } });
    if (!instance) {
      return new Response(JSON.stringify({ error: "Instance not found" }), { status: 404 });
    }

    const privateKey = decryptSecret(instance.keyMaterial);
    const ssh = new NodeSSH();

    await ssh.connect({
      host: instance.publicIp,
      username: instance.sshUsername || "ubuntu",
      privateKey,
    });

    const results = [];
    let hasError = false;

    // Execute commands in sequence
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      try {
        const result = await ssh.execCommand(command, {
          cwd: "/home/ubuntu", // Default working directory
        });

        results.push({
          command,
          index: i,
          stdout: result.stdout || "",
          stderr: result.stderr || "",
          code: result.code || 0,
        });

        // If a command fails, we can optionally stop or continue
        if (result.code !== 0) {
          hasError = true;
          // For critical operations, you might want to break here
          // For now, we continue to gather all results
        }
      } catch (err) {
        results.push({
          command,
          index: i,
          stdout: "",
          stderr: err.message,
          code: 1,
        });
        hasError = true;
      }
    }

    ssh.dispose();

    return new Response(
      JSON.stringify({
        success: !hasError,
        results,
        summary: {
          total: commands.length,
          succeeded: results.filter((r) => r.code === 0).length,
          failed: results.filter((r) => r.code !== 0).length,
        },
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("SSH multi-command error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

