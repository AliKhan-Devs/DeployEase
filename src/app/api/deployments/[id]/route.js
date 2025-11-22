import { NextResponse } from "next/server";
import { EC2Client, TerminateInstancesCommand, DeleteKeyPairCommand } from "@aws-sdk/client-ec2";
import { PrismaClient } from "@prisma/client";
import { getAuthSession } from "@/lib/authSession";

const prisma = new PrismaClient();

export async function DELETE(req, { params }) {
   
  const { id } = await params;
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log(`🧹 Deleting deployment: ${id}`);
    // 1️⃣ Find the deployment record
    const deployment = await prisma.deployment.findUnique({
      where: { id: id },
    });

    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    // Check if user owns this deployment
    if (deployment.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Extract AWS credentials from body (or from your secure storage)
    const { accessKeyId, secretAccessKey, region } = await req.json();

    if (!accessKeyId || !secretAccessKey || !region) {
      return NextResponse.json(
        { error: "AWS credentials and region are required" },
        { status: 400 }
      );
    }

    // 2️⃣ Initialize EC2 client
    const ec2Client = new EC2Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });

    // 3️⃣ Terminate the EC2 instance
    if (deployment.ec2InstanceId) {
      await ec2Client.send(
        new TerminateInstancesCommand({
          InstanceIds: [deployment.ec2InstanceId],
        })
      );
      console.log(`🛑 EC2 instance terminated: ${deployment.ec2InstanceId}`);
    }

    // 4️⃣ Delete the Key Pair
    if (deployment.keyPairName) {
      await ec2Client.send(
        new DeleteKeyPairCommand({ KeyName: deployment.keyPairName })
      );
      console.log(`🗝️ Key pair deleted: ${deployment.keyPairName}`);
    }

    // (Optional) — Security group deletion can be added later if tracked in DB.

    // 5️⃣ Delete the record from DB
    await prisma.deployment.delete({
      where: { id:id },
    });

    console.log(`🧹 Deployment record removed: ${id}`);

    return NextResponse.json({
      success: true,
      message: "Deployment deleted successfully!",
    });
  } catch (err) {
    console.error("❌ Error deleting deployment:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}


// get deployment by id 
export async function GET(req, { params }) {
  const { id } = await params;
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1️⃣ Find the deployment record
    const deployment = await prisma.deployment.findUnique({
      where: { id: id },
    });

    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    // Check if user owns this deployment
    if (deployment.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(deployment);
  } catch (err) {
    console.error("❌ Error getting deployment:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );  
  }}