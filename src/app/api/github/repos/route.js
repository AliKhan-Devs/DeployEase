import { getAuthSession } from "@/lib/authSession";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// Redis imports
import { getRedisClient } from "@/lib/redis/client";
const redis = getRedisClient();

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  // Try to find user in DB
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: session.user.id },
        { email: session.user.email ?? undefined },
      ],
    },
  });

  if (!user) return new Response("User not found in database", { status: 404 });
  if (!user.githubUsername) return new Response("GitHub username not found", { status: 400 });

  // ==============================
  // 1️⃣ Redis caching for repositories
  // ==============================
  const cacheKey = `github:repos:${user.githubUsername}`;
  const cachedData = await redis.get(cacheKey);

  if (cachedData) {
   
    // Return cached repositories immediately
    return NextResponse.json(JSON.parse(cachedData));
  }

  // ==============================
  // 2️⃣ Fetch from GitHub if cache miss
  // ==============================
  
  const res = await fetch(`https://api.github.com/users/${user.githubUsername}/repos`);
  const data = await res.json();

  if (!Array.isArray(data)) {
    return new Response(JSON.stringify({ error: "Invalid GitHub response", data }), {
      status: 500,
    });
  }

  // ==============================
  // 3️⃣ Cache the response in Redis (TTL: 10 minutes)
  // ==============================
  await redis.set(cacheKey, JSON.stringify(data), "EX", 600);

  return NextResponse.json(data);
}
