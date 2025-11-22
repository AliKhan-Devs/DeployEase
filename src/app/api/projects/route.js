import prisma from "@/lib/prisma";
import { getAuthSession } from "@/lib/authSession";
import { NextResponse } from "next/server";

export async function POST(req) {
  const session = await getAuthSession();
  if (!session) return NextResponse.error("Unauthorized", { status: 401 });

  const { name, repoUrl } = await req.json();

  const project = await prisma.project.create({
    data: {
      name,
      repoUrl,
      user: { connect: { email: session.user.email } },
    },
  });

  return NextResponse.json(project);
}

export async function GET() {
  const projects = await prisma.project.findMany();
  return NextResponse.json(projects);
}
