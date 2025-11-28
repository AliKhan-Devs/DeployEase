// server/routes/autoscale.js
import {
  EC2Client,
  CreateLaunchTemplateCommand,
  DescribeInstancesCommand,
  DescribeSubnetsCommand
} from "@aws-sdk/client-ec2";
import { AutoScalingClient, CreateAutoScalingGroupCommand } from "@aws-sdk/client-auto-scaling";
import {
  ElasticLoadBalancingV2Client,
  CreateLoadBalancerCommand,
  CreateTargetGroupCommand,
  CreateListenerCommand
} from "@aws-sdk/client-elastic-load-balancing-v2";

import { getAuthSession } from "@/lib/authSession";
import { createLogger } from "@/lib/utils/createLogger";
import { PrismaClient } from "@prisma/client";
import { generateUserDataScript } from "@/lib/utils/generateUserData";

const prisma = new PrismaClient();

export async function POST(req) {
  const session = await getAuthSession();
  if (!session) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { instanceId, minSize, maxSize } = await req.json();
  const log = await createLogger(session.user.id);

  // Fetch instance

  const instanceData = await prisma.instance.findUnique({
    where: { id: instanceId, userId: session.user.id },
  });

  if (!instanceData) {
    await log("❌ Instance not found.");
    return new Response(JSON.stringify({ error: "Instance not found" }), { status: 404 });
  }

  const ec2 = new EC2Client({
    region: instanceData.region,
    credentials: { accessKeyId: instanceData.accessKeyId, secretAccessKey: instanceData.secretAccessKey },
  });

  const asgClient = new AutoScalingClient({
    region: instanceData.region,
    credentials: { accessKeyId: instanceData.accessKeyId, secretAccessKey: instanceData.secretAccessKey },
  });

  const elbClient = new ElasticLoadBalancingV2Client({
    region: instanceData.region,
    credentials: { accessKeyId: instanceData.accessKeyId, secretAccessKey: instanceData.secretAccessKey },
  });

  await log("🔹 Auto-Scaling: starting workflow...");

  const shortId = instanceData.id.slice(0, 8);
  const name = `dep-${shortId}`;
  await log(`⚙️ Using name prefix: ${name}`);

  // 1️⃣ Describe original instance
  const desc = await ec2.send(new DescribeInstancesCommand({ InstanceIds: [instanceData.awsInstanceId] }));
  const awsInstance = desc.Reservations[0].Instances[0];
  await log("📌 Instance described successfully.");

  // 2️⃣ Detect valid public subnets
  const subnetData = await ec2.send(new DescribeSubnetsCommand({}));
  const publicSubnets = subnetData.Subnets.filter(
    (sub) => sub.MapPublicIpOnLaunch && sub.State === "available" && sub.AvailabilityZone
      && ["a", "b", "c"].some((suffix) => sub.AvailabilityZone.endsWith(suffix))
  );

  if (publicSubnets.length < 2) {
    await log("❌ ERROR: You need at least two public subnets in us-east-1a/b/c");
    return new Response(JSON.stringify({ error: "Insufficient public subnets" }), { status: 500 });
  }

  const chosenSubnets = publicSubnets.slice(0, 2).map((s) => s.SubnetId);
  await log(`✅ Using subnets: ${chosenSubnets.join(", ")}`);

  // 3️⃣ Generate UserData script dynamically
  const deploymentsOnInstance = await prisma.deployment.findMany({
    where: { instanceId: instanceData.id },
  });

  const userDataScript = generateUserDataScript(deploymentsOnInstance);

  // 4️⃣ Create Launch Template
  await log("📄 Creating Launch Template...");
  const launchTemplateResp = await ec2.send(
    new CreateLaunchTemplateCommand({
      LaunchTemplateName: `${name}-lt`,
      LaunchTemplateData: {
        ImageId: awsInstance.ImageId,
        InstanceType: awsInstance.InstanceType,
        KeyName: awsInstance.KeyName,
        SecurityGroupIds: awsInstance.SecurityGroups.map((sg) => sg.GroupId),
        UserData: Buffer.from(userDataScript).toString("base64"),
      },
    })
  );
  await log("✅ Launch Template created.");

  // 5️⃣ Create Target Group
  await log("🎯 Creating Target Group...");
  const targetGroupResp = await elbClient.send(
    new CreateTargetGroupCommand({
      Name: `${name}-tg`,
      Port: 80,
      Protocol: "HTTP",
      VpcId: awsInstance.VpcId,
      TargetType: "instance",
      HealthCheckProtocol: "HTTP",
      HealthCheckPath: "/",
    })
  );
  await log("✅ Target Group created.");

  // 6️⃣ Create Load Balancer
  await log("🖥️ Creating Load Balancer...");
  const lbResp = await elbClient.send(
    new CreateLoadBalancerCommand({
      Name: `${name}-alb`,
      Subnets: chosenSubnets,
      SecurityGroups: awsInstance.SecurityGroups.map((sg) => sg.GroupId),
      Scheme: "internet-facing",
      Type: "application",
      IpAddressType: "ipv4",
    })
  );
  await log("✅ Load Balancer created.");

  // 7️⃣ Create Listener
  await log("🔊 Creating Listener...");
  await elbClient.send(
    new CreateListenerCommand({
      LoadBalancerArn: lbResp.LoadBalancers[0].LoadBalancerArn,
      Protocol: "HTTP",
      Port: 80,
      DefaultActions: [{ Type: "forward", TargetGroupArn: targetGroupResp.TargetGroupArn }],
    })
  );
  await log("✅ Listener created.");

  // 8️⃣ Create Auto Scaling Group
  await log("📈 Creating Auto Scaling Group...");
  await asgClient.send(
    new CreateAutoScalingGroupCommand({
      AutoScalingGroupName: `${name}-asg`,
      LaunchTemplate: { LaunchTemplateId: launchTemplateResp.LaunchTemplate.LaunchTemplateId },
      MinSize: minSize,
      MaxSize: maxSize,
      TargetGroupARNs: [targetGroupResp.TargetGroupArn],
      VPCZoneIdentifier: chosenSubnets.join(","),
    })
  );
  await log("✅ Auto Scaling Group created.");

  const lbDns = lbResp.LoadBalancers[0].DNSName;

  await prisma.deployment.update({
    where: {instanceId: instanceData.id},
    data: { exposedUrl: lbDns, autoDeploy: true },
  });

  await log(`🚀 Auto Scaling Enabled! Public URL: ${lbDns}`);

  return new Response(JSON.stringify({ success: true, lbDns }));
}
