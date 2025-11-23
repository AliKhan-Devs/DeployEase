// src/app/api/increase-volume/route.js
import { EC2Client, DescribeInstancesCommand, ModifyVolumeCommand, DescribeVolumesCommand } from "@aws-sdk/client-ec2";
import { SSMClient, SendCommandCommand } from "@aws-sdk/client-ssm";
import { getAuthSession } from "@/lib/authSession";
import { createLogger } from "@/lib/utils/createLogger";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req) {
     
  const session = await getAuthSession();
  if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { deploymentId, additionalGB } = await req.json();
  if (!deploymentId || !additionalGB) return new Response(JSON.stringify({ error: "deploymentId and additionalGB required" }), { status: 400 });

  const log = await createLogger(session.user.id);
  await log(`🔹 Increase Volume Workflow started for Deployment: ${deploymentId}`);

  // Fetch deployment + instance
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: { instance: true },
  });

  if (!deployment || !deployment.instance) {
    await log("❌ Deployment or instance not found.");
    return new Response(JSON.stringify({ error: "Deployment or instance not found" }), { status: 404 });
  }

  const instance = deployment.instance;
  
  // AWS clients
  const ec2 = new EC2Client({
    region: instance.region,
    credentials: { accessKeyId: instance.accessKeyId, secretAccessKey: instance.secretAccessKey },
  });

  const ssm = new SSMClient({
    region: instance.region,
    credentials: { accessKeyId: instance.accessKeyId, secretAccessKey: instance.secretAccessKey },
  });

  await log(`📌 Describing instance: ${instance.awsInstanceId}`);

  // Get the root volume
  const desc = await ec2.send(new DescribeInstancesCommand({ InstanceIds: [instance.awsInstanceId] }));
  const awsInstance = desc.Reservations[0].Instances[0];
  const rootDeviceName = awsInstance.RootDeviceName;
  const blockMapping = awsInstance.BlockDeviceMappings.find(b => b.DeviceName === rootDeviceName);
  const volumeId = blockMapping.Ebs.VolumeId;
  const currentSize = blockMapping.Ebs.VolumeSize;

  await log(`✅ Root volume found: ${volumeId}, current size: ${currentSize} GB`);

  // Increase volume size
  const newSize = currentSize + additionalGB;
  await ec2.send(new ModifyVolumeCommand({ VolumeId: volumeId, Size: newSize }));
  await log(`📈 Volume modification requested: new size ${newSize} GB`);

  // Wait until volume is available with the new size
  let volumeReady = false;
  while (!volumeReady) {
    const volDesc = await ec2.send(new DescribeVolumesCommand({ VolumeIds: [volumeId] }));
    const state = volDesc.Volumes[0].State;
    const sizeNow = volDesc.Volumes[0].Size;
    if (state === "available" && sizeNow === newSize) volumeReady = true;
    else await new Promise(r => setTimeout(r, 5000));
  }

  await log("✅ Volume modified successfully on AWS");

  // Automatically expand filesystem via SSM
  const filesystemCmd = `
    sudo growpart ${rootDeviceName.replace("/dev/xv", "/dev/nvme")} 1
    sudo resize2fs ${rootDeviceName.replace("/dev/xv", "/dev/nvme")}1
  `;

  await ssm.send(
    new SendCommandCommand({
      DocumentName: "AWS-RunShellScript",
      Targets: [{ Key: "InstanceIds", Values: [instance.awsInstanceId] }],
      Parameters: { commands: [filesystemCmd] },
    })
  );

  await log("🚀 Filesystem expansion command sent to instance via SSM");

  return new Response(JSON.stringify({
    success: true,
    volumeId,
    previousSize: currentSize,
    newSize,
    message: "Volume increased and filesystem expansion triggered automatically."
  }));
}
