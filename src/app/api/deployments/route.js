import { getAuthSession } from "@/lib/authSession";
import { PrismaClient } from "@prisma/client";
import { getRedisClient } from "@/lib/redis/client";

const redis = getRedisClient();

const prisma = new PrismaClient();

export async function GET(req) {
  const session = await getAuthSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get("instanceId") || undefined;

  // check if deployments are cached in Redis
  const cachedDeployments = await redis.get(`deployments:${userId}`);
  if (cachedDeployments) {
    console.log("Using cached deployments data");
    return new Response(cachedDeployments, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const deployments = await prisma.deployment.findMany({
    where: {
      userId: userId,
      ...(instanceId ? { instanceId } : {}),
    },
    orderBy: { startedAt: "desc" },
    include: {
      instance: true,
    },
  });

  // Save in cache for faster access next time
  await redis.set(`deployments:${userId}`, JSON.stringify(deployments));

  return new Response(JSON.stringify(deployments), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}