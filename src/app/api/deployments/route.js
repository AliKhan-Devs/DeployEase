import { getAuthSession } from "@/lib/authSession";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req) {
  const session = await getAuthSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get("instanceId") || undefined;

  const deployments = await prisma.deployment.findMany({
    where: {
      userId: session.user.id,
      ...(instanceId ? { instanceId } : {}),
    },
    orderBy: { startedAt: "desc" },
    include: {
      instance: true,
    },
  });

  return new Response(JSON.stringify(deployments), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}