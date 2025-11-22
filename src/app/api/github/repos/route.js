import { getAuthSession } from "@/lib/authSession";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({message: "Unauthorized"}, { status: 401 });

  // Try to find the user using GitHub ID (fallback: email)
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: session.user.id },      // GitHub ID from NextAuth token
        { email: session.user.email ?? undefined },
      ],
    },
  });

  if (!user) {
    return new Response("User not found in database", { status: 404 });
  }

  if (!user.githubUsername) {
    return new Response("GitHub username not found", { status: 400 });
  }

  // Fetch repositories
  const res = await fetch(`https://api.github.com/users/${user.githubUsername}/repos`);
  const data = await res.json();

  if (!Array.isArray(data)) {
    return new Response(JSON.stringify({ error: "Invalid GitHub response", data }), {
      status: 500,
    });
  }

  return Response.json(data);
}
