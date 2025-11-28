// src/app/api/increase-volume/route.js
import {
  EC2Client,
  DescribeInstancesCommand,
  ModifyVolumeCommand,
  DescribeVolumesCommand
} from "@aws-sdk/client-ec2";
import {
  SSMClient,
  SendCommandCommand,
  ListCommandInvocationsCommand
} from "@aws-sdk/client-ssm";
import { getAuthSession } from "@/lib/authSession";
import { createLogger } from "@/lib/utils/createLogger";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const session = await getAuthSession();

    if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const { instanceId, additionalGB } = await req.json();

    if (!deploymentId || !additionalGB) return new Response(JSON.stringify({ error: "deploymentId and additionalGB required" }), { status: 400 });
    if (isNaN(additionalGB) || additionalGB < 1) return new Response(JSON.stringify({ error: "additionalGB must be a positive number" }), { status: 400 });

    const log = await createLogger(session.user.id);
    await log(`🔹 Increase Volume Workflow started for Deployment: ${deploymentId}`);

    // Fetch instance
    const instance = await prisma.ec2Instance.findUnique({
      where: { id: instanceId },
    });
    
    if (!instance) {
      await log("❌ Instance not found.");
      return new Response(JSON.stringify({ error: "Instance not found" }), { status: 404 });
    }
    

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
    const desc = await ec2.send(new DescribeInstancesCommand({ InstanceIds: [instance.awsInstanceId] }));
    const awsInstance = desc.Reservations?.[0]?.Instances?.[0];
    if (!awsInstance) return new Response(JSON.stringify({ error: "AWS instance not found" }), { status: 404 });

    const rootDeviceName = awsInstance.RootDeviceName;
    const blockMapping = awsInstance.BlockDeviceMappings.find(b => b.DeviceName === rootDeviceName);
    if (!blockMapping || !blockMapping.Ebs) return new Response(JSON.stringify({ error: "Root volume not found" }), { status: 500 });

    const volumeId = blockMapping.Ebs.VolumeId;
    const volInfo = await ec2.send(new DescribeVolumesCommand({ VolumeIds: [volumeId] }));
    const currentSize = volInfo.Volumes?.[0]?.Size;
    if (!currentSize) return new Response(JSON.stringify({ error: "Unable to read volume size" }), { status: 500 });

    await log(`✅ Root volume found: ${volumeId}, current size: ${currentSize} GB`);

    // --- STEP 1: Modify volume
    const newSize = currentSize + Number(additionalGB);
    await log(`📈 Requesting volume resize: ${currentSize} → ${newSize} GB`);
    await ec2.send(new ModifyVolumeCommand({ VolumeId: volumeId, Size: newSize }));

    // --- STEP 2: Wait for volume resize to reflect
    let ready = false;
    let attempts = 0;
    while (!ready && attempts < 20) {
      attempts++;
      const volState = await ec2.send(new DescribeVolumesCommand({ VolumeIds: [volumeId] }));
      const state = volState.Volumes[0].State;
      const updatedSize = volState.Volumes[0].Size;
      if (state === "in-use" && updatedSize === newSize) ready = true;
      else await new Promise(r => setTimeout(r, 5000));
    }
    if (!ready) await log("⚠️ Volume resize not reflected after max retries.");
    else await log("✅ Volume modified successfully on AWS");

    // --- STEP 3: Expand filesystem via SSM ---
    // Detect root partition dynamically
    const filesystemCmd = [
      "sudo apt-get update -y && sudo apt-get install -y cloud-guest-utils",
      "ROOT_DEV=$(findmnt -n -o SOURCE /)",
      "sudo growpart ${ROOT_DEV%?} 1 || true",
      "sudo resize2fs ${ROOT_DEV} || sudo xfs_growfs / || true",
      "df -h /"
    ];

    const sendCmd = await ssm.send(new SendCommandCommand({
      DocumentName: "AWS-RunShellScript",
      Targets: [{ Key: "InstanceIds", Values: [instance.awsInstanceId] }],
      Parameters: { commands: filesystemCmd },
    }));

    const commandId = sendCmd.Command?.CommandId;
    let filesystemExpanded = false;

    // Poll SSM for command completion
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const invoc = await ssm.send(new ListCommandInvocationsCommand({
        CommandId: commandId,
        InstanceId: instance.awsInstanceId,
        Details: true
      }));

      const output = invoc.CommandInvocations?.[0]?.CommandPlugins?.map(p => p.Output).join("\n") || "";
      if (output.includes(`${newSize}G`) || output.includes(`${currentSize + additionalGB}G`)) {
        filesystemExpanded = true;
        break;
      }
    }

    await log(filesystemExpanded
      ? "✅ Filesystem successfully expanded."
      : "⚠️ Filesystem expansion may have failed.");

    return new Response(JSON.stringify({
      success: true,
      volumeId,
      previousSize: currentSize,
      newSize,
      filesystemExpanded,
      message: filesystemExpanded
        ? "Volume increased & filesystem expanded successfully."
        : "Volume increased but filesystem expansion may have failed."
    }), { status: 200 });

  } catch (err) {
    console.error("Increase Volume Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: err.message }), { status: 500 });
  }
}
