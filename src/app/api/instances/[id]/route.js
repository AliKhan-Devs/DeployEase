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
    console.log(`🧹 Deleting Instance: ${id}`);

    // 1️⃣ Find the deployment record
    const instance = await prisma.ec2Instance.findUnique({
      where: { id: id },
    });
    
    
    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    // Check if user owns this deployment
    if (instance.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Extract AWS credentials from body (or from your secure storage)
   const region = instance.region;
    const accessKeyId = instance.accessKeyId;
    const secretAccessKey = instance.secretAccessKey;

    // Check if AWS credentials and region are provided
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
    if (instance) {
      await ec2Client.send(
        new TerminateInstancesCommand({
          InstanceIds: [instance.awsInstanceId],
        })
      );
      console.log(`🛑 EC2 instance terminated: ${instance.awsInstanceId}`);
    }

    // 4️⃣ Delete the Key Pair
    if (instance.keyPairName) {
      await ec2Client.send(
        new DeleteKeyPairCommand({ KeyName: instance.keyPairName })
      );
      console.log(`🗝️ Key pair deleted: ${instance.keyPairName}`);
    }

    // (Optional) — Security group deletion can be added later if tracked in DB.

    // 5️⃣ Delete the record from DB and also delte the relvent deployments record
    await prisma.ec2Instance.delete({ where: { id: id } });
   

    console.log(`🧹 Instance record removed: ${id}`);

    return NextResponse.json({
      success: true,
      message: "Instance deleted successfully!",
    });
  } catch (err) {
    console.error("❌ Error deleting instance:", err);
    console.log(err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}


// get instance by id 
export async function GET(req, { params }) {
  const { id } = await params;
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1️⃣ Find the deployment record
    const instance = await prisma.ec2Instance.findUnique({
      where: { id: id },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    // Check if user owns this instance
    if (instance.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(instance);
  } catch (err) {
    console.error("❌ Error getting instance:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );  
  }}