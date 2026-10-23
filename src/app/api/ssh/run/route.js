import { getAuthSession } from "@/lib/authSession";
import { NodeSSH } from "node-ssh";
import { decryptSecret } from "@/lib/utils/encryptDecrypt";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function POST(req) {
  const session = await getAuthSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const { instanceId, command } = await req.json();
    if (!instanceId || !command) {
      return new Response(JSON.stringify({ error: "Instance ID and command are required" }), { status: 400 });
    }

    // Fetch instance details
    const instance = await prisma.ec2Instance.findUnique({ where: { awsInstanceId: instanceId } });
    if (!instance) return new Response(JSON.stringify({ error: "Instance not found" }), { status: 404 });

    const privateKey = decryptSecret(instance.keyMaterial);
    const ssh = new NodeSSH();

    await ssh.connect({
      host: instance.publicIp,
      username: instance.sshUsername || "ubuntu",
      privateKey,
    });

    const result = await ssh.execCommand(command);
    ssh.dispose();

    return new Response(JSON.stringify({ success: true, result }), { status: 200 });

  } catch (err) {
    console.error("SSH command error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
