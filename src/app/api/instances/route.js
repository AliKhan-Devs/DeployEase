import { getAuthSession } from "@/lib/authSession";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
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

  return new Response(JSON.stringify(instances), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

