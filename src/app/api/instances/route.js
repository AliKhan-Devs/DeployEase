import { getAuthSession } from "@/lib/authSession";
import { PrismaClient } from "@prisma/client";
import { getRedisClient } from "@/lib/redis/client";

const redis = getRedisClient();

const prisma = new PrismaClient();

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // check if instances are cached in Redis
  const cachedInstances = await redis.get(`instances:${session.user.id}`);
  if (cachedInstances) {
    console.log("Using cached instances data");
    return new Response(cachedInstances, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  const instances = await prisma.ec2Instance.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      deployments: {
        orderBy: { startedAt: "desc" },
      },
    },
  });

  // save instance in redis for faster access next time (TTL: 1 hour)
  await redis.set(
    `instances:${session.user.id}`,
    JSON.stringify(instances),
    "EX",
    60 * 60
  );

  return new Response(JSON.stringify(instances), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

