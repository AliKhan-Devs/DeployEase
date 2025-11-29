import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authSession";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await getAuthSession();

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // --------------------
    // DEPLOYMENTS ANALYTICS
    // --------------------
    const totalDeployments = await prisma.deployment.count({
      where: { userId },
    });

    const successfulDeployments = await prisma.deployment.count({
      where: { userId, status: "SUCCESS" },
    });

    const failedDeployments = await prisma.deployment.count({
      where: { userId, status: "FAILED" },
    });

    const runningDeployments = await prisma.deployment.count({
      where: { userId, status: "RUNNING" },
    });

    const lastDeployment = await prisma.deployment.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const recentDeployments = await prisma.deployment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // --------------------
    // EC2 ANALYTICS
    // --------------------
    const totalEC2Instances = await prisma.ec2Instance.count({
      where: { userId },
    });

    const activeEC2Instances = await prisma.ec2Instance.count({
      where: { 
        userId,
        publicIp: { not: null } 
      },
    });

    return NextResponse.json({
      success: true,
      analytics: {
        deployments: {
          total: totalDeployments,
          success: successfulDeployments,
          failed: failedDeployments,
          running: runningDeployments,
          lastDeployment,
          recentDeployments,
        },
        ec2: {
          total: totalEC2Instances,
          active: activeEC2Instances,
        },
      },
    });
  } catch (error) {
    console.log("Analytics API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
