import { getAuthSession } from "@/lib/authSession";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getRedisClient } from "@/lib/redis/client";
import { encryptSecret } from "@/lib/utils/encryptDecrypt";

const prisma = new PrismaClient();
const redis = getRedisClient();

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cacheKey = `user-details:${session.user.id}`;
    const cachedUser = await redis.get(cacheKey);

    if (cachedUser) {
      return NextResponse.json(JSON.parse(cachedUser));
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await redis.set(cacheKey, JSON.stringify(user));
    return NextResponse.json(user);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch user info" },
      { status: 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    const updateData = {};

    // Encrypt AWS keys if provided
    if (data.awsAccessKeyId) {
      updateData.awsAccessKeyId = encryptSecret(data.awsAccessKeyId);
    }
    if (data.awsSecretAccessKey) {
      updateData.awsSecretAccessKey = encryptSecret(data.awsSecretAccessKey);
    }

    // Add other fields dynamically
    Object.keys(data).forEach((key) => {
      if (!["awsAccessKeyId", "awsSecretAccessKey"].includes(key)) {
        updateData[key] = data[key];
      }
    });

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    await redis.del(`user-details:${session.user.id}`);

    return NextResponse.json(updatedUser);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to update user info" },
      { status: 500 }
    );
  }
}
