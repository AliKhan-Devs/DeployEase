// import { AuthorizeSecurityGroupIngressCommand, CreateKeyPairCommand, CreateSecurityGroupCommand, DeleteKeyPairCommand, DeleteSecurityGroupCommand, DescribeInstancesCommand, RunInstancesCommand, TerminateInstancesCommand } from "@aws-sdk/client-ec2";

// import { encryptSecret } from "../encryptDecrypt";
// import { PrismaClient } from "@prisma/client";
// import { buildIpPermissions } from "../helpers";

// const prisma = new PrismaClient();


// const DEFAULT_AMI = process.env.DEPLOYEASE_UBUNTU_AMI || "ami-0ecb62995f68bb549";



// export async function createEc2Instance({ ec2Client, userId, region, instanceType, log, accessKeyId, secretAccessKey }) {
//     let instanceId = null;
//     let sgName = null;
//     let sgId = null;
//     let keyName = null;
//     let privateKey = null;
  
//     try {
//       keyName = `deployease-key-${Date.now()}`;
//       await log(`🔐 Creating key pair ${keyName}`);
//       const keyPair = await ec2Client.send(new CreateKeyPairCommand({ KeyName: keyName }));
//       privateKey = keyPair.KeyMaterial;
  
//       sgName = `deployease-sg-${Date.now()}`;
//       await log(`🔒 Creating security group ${sgName}`);
//       const sgResponse = await ec2Client.send(
//         new CreateSecurityGroupCommand({
//           GroupName: sgName,
//           Description: "Security group for DeployEase multi-app instance",
//         })
//       );
//       sgId = sgResponse.GroupId;
  
//       await log("🔓 Authorizing ingress for ports 22, 80");
//       await ec2Client.send(
//         new AuthorizeSecurityGroupIngressCommand({
//           GroupId: sgId,
//           IpPermissions: buildIpPermissions([22, 80]),
//         })
//       );
  
//       await log("🖥️ Launching EC2 instance...");
//       const runData = await ec2Client.send(
//         new RunInstancesCommand({
//           ImageId: DEFAULT_AMI,
//           InstanceType: instanceType || "t3.micro",
//           MinCount: 1,
//           MaxCount: 1,
//           KeyName: keyName,
//           SecurityGroupIds: [sgId],
//         })
//       );
//       instanceId = runData.Instances?.[0]?.InstanceId;
//       if (!instanceId) {
//         throw new Error("Failed to retrieve instance ID from AWS response.");
//       }
//       await log(`✅ EC2 instance launched: ${instanceId}`);
//       await log("⏳ Waiting for public IP...");
//       await new Promise(resolve => setTimeout(resolve, 5000)); // 5s
//       let publicIp = null;
//       for (let attempt = 0; attempt < 60 && !publicIp; attempt++) {
//         const description = await ec2Client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
//         publicIp = description.Reservations?.[0]?.Instances?.[0]?.PublicIpAddress;
//         if (!publicIp) {
//           await new Promise((resolve) => setTimeout(resolve, 5000));
//         }
//       }

      

//       if (!publicIp) throw new Error("Timed out waiting for public IP address.");
//       await log(`🌍 Public IP acquired: ${publicIp}`);
  
//       await log("🕒 Allowing instance to finish boot sequence (30s)...");
//       await new Promise((resolve) => setTimeout(resolve, 30000));
  
//       const instanceRecord = await prisma.ec2Instance.create({
//         data: {
//           userId,
//           awsInstanceId: instanceId,
//           publicIp,
//           region,
//           instanceType: instanceType || "t3.micro",
//           securityGroupId: sgId || undefined,
//           securityGroupName: sgName,
//           keyPairName: keyName,
//           keyMaterial: encryptSecret(privateKey),
//           accessKeyId: encryptSecret(accessKeyId),
//           secretAccessKey: encryptSecret(secretAccessKey),
//         },
//       });
  
//       return { instanceRecord, privateKey };
//     } catch (err) {
//       console.error("Error during EC2 instance creation:", err);
//       await log("⚠️ Instance creation failed. Rolling back resources...");
//       if (instanceId) {
//         await log(`🛑 Terminating instance ${instanceId}`);
//         await ec2Client.send(new TerminateInstancesCommand({ InstanceIds: [instanceId] }));
//       }
//       if (sgId) {
//         await log(`🧹 Deleting security group ${sgName}`);
//         await ec2Client.send(new DeleteSecurityGroupCommand({ GroupId: sgId }));
//       } else if (sgName) {
//         await ec2Client.send(new DeleteSecurityGroupCommand({ GroupName: sgName })).catch(() => { });
//       }
//       if (keyName) {
//         await log(`🗝️ Deleting key pair ${keyName}`);
//         await ec2Client.send(new DeleteKeyPairCommand({ KeyName: keyName }));
//       }
//       throw err;
//     }
//   }
  

import {
  AuthorizeSecurityGroupIngressCommand,
  CreateKeyPairCommand,
  CreateSecurityGroupCommand,
  DeleteKeyPairCommand,
  DeleteSecurityGroupCommand,
  DescribeInstancesCommand,
  RunInstancesCommand,
  TerminateInstancesCommand,
  AssociateIamInstanceProfileCommand,
} from "@aws-sdk/client-ec2";

import {
  IAMClient,
  CreateRoleCommand,
  GetRoleCommand,
  AttachRolePolicyCommand,
  AddRoleToInstanceProfileCommand,
  CreateInstanceProfileCommand,
  GetInstanceProfileCommand,
} from "@aws-sdk/client-iam";

import { encryptSecret } from "../encryptDecrypt";
import { PrismaClient } from "@prisma/client";
import { buildIpPermissions } from "../helpers";

const prisma = new PrismaClient();
const DEFAULT_AMI = process.env.DEPLOYEASE_UBUNTU_AMI || "ami-0ecb62995f68bb549";
const SSM_ROLE_NAME = "DeployEase-EC2-SSM-Role";
const SSM_PROFILE_NAME = "DeployEase-EC2-SSM-Instance-Profile";

// ✅ Ensure SSM IAM Role + Instance Profile exists
async function ensureSsmIamResources({ region, accessKeyId, secretAccessKey, log }) {
  const iamClient = new IAMClient({ region, credentials: { accessKeyId, secretAccessKey } });

  await log("🔍 Checking IAM Role & Instance Profile for SSM...");

  let roleExists = true;
  try {
    await iamClient.send(new GetRoleCommand({ RoleName: SSM_ROLE_NAME }));
  } catch {
    roleExists = false;
  }

  if (!roleExists) {
    await log("🆕 Creating IAM Role for SSM...");
    await iamClient.send(
      new CreateRoleCommand({
        RoleName: SSM_ROLE_NAME,
        AssumeRolePolicyDocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { Service: "ec2.amazonaws.com" },
              Action: "sts:AssumeRole",
            },
          ],
        }),
      })
    );

    await log("📎 Attaching SSM policies...");
    const policies = [
      "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
      "arn:aws:iam::aws:policy/AmazonSSMFullAccess",
      "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
    ];
    for (const policy of policies) {
      await iamClient.send(new AttachRolePolicyCommand({ RoleName: SSM_ROLE_NAME, PolicyArn: policy }));
    }
  }

  let profileExists = true;
  try {
    await iamClient.send(new GetInstanceProfileCommand({ InstanceProfileName: SSM_PROFILE_NAME }));
  } catch {
    profileExists = false;
  }

  if (!profileExists) {
    await log("🧩 Creating Instance Profile...");
    await iamClient.send(new CreateInstanceProfileCommand({ InstanceProfileName: SSM_PROFILE_NAME }));

    await log("🔗 Adding Role to Instance Profile...");
    await iamClient.send(new AddRoleToInstanceProfileCommand({
      InstanceProfileName: SSM_PROFILE_NAME,
      RoleName: SSM_ROLE_NAME,
    }));
  }

  await log("✅ SSM IAM Role & Profile ready");
  return { roleName: SSM_ROLE_NAME, profileName: SSM_PROFILE_NAME };
}

// ✅ Create EC2 instance + attach SSM IAM profile
export async function createEc2Instance({
  ec2Client,
  userId,
  region,
  instanceType,
  accessKeyId,
  secretAccessKey,
  log,
}) {
  let instanceId = null;
  let keyName = null;
  let sgId = null;
  let sgName = null;
  let privateKey = null;

  try {
    // 1️⃣ Ensure IAM Role + Instance Profile exists
    const { profileName } = await ensureSsmIamResources({ region, accessKeyId, secretAccessKey, log });

    // 2️⃣ Create Key Pair
    keyName = `deployease-key-${Date.now()}`;
    await log(`🔐 Creating key pair: ${keyName}`);
    const keyPair = await ec2Client.send(new CreateKeyPairCommand({ KeyName: keyName }));
    privateKey = keyPair.KeyMaterial;

    // 3️⃣ Create Security Group
    sgName = `deployease-sg-${Date.now()}`;
    await log(`🔒 Creating security group: ${sgName}`);
    const sgData = await ec2Client.send(new CreateSecurityGroupCommand({
      GroupName: sgName,
      Description: "Security group for DeployEase instance",
    }));
    sgId = sgData.GroupId;

    await log("🔓 Allowing ingress ports 22 and 80");
    await ec2Client.send(new AuthorizeSecurityGroupIngressCommand({
      GroupId: sgId,
      IpPermissions: buildIpPermissions([22, 80]),
    }));

    // 4️⃣ Launch EC2
    await log("🖥️ Launching instance...");
    const runRes = await ec2Client.send(new RunInstancesCommand({
      ImageId: DEFAULT_AMI,
      InstanceType: instanceType || "t3.micro",
      MinCount: 1,
      MaxCount: 1,
      KeyName: keyName,
      SecurityGroupIds: [sgId],
    }));
    instanceId = runRes.Instances?.[0]?.InstanceId;
    if (!instanceId) throw new Error("Could not get instance ID");
    await log(`✅ Instance launched: ${instanceId}`);

    // 5️⃣ Wait until instance is running
    await log("⏳ Waiting for instance to enter 'running' state...");
    let state = null;
    for (let i = 0; i < 60 && state !== "running"; i++) {
      const desc = await ec2Client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
      state = desc.Reservations?.[0]?.Instances?.[0]?.State?.Name;
      if (state !== "running") await new Promise(r => setTimeout(r, 5000));
    }
    if (state !== "running") throw new Error("Instance did not enter 'running' state in time");

    // 6️⃣ Attach IAM Instance Profile
    await log("📎 Attaching IAM Instance Profile for SSM...");
    await ec2Client.send(new AssociateIamInstanceProfileCommand({
      InstanceId: instanceId,
      IamInstanceProfile: { Name: profileName },
    }));

    // 7️⃣ Wait for Public IP
    await log("⏳ Waiting for Public IP...");
    let publicIp = null;
    for (let i = 0; i < 60 && !publicIp; i++) {
      const desc = await ec2Client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
      publicIp = desc.Reservations?.[0]?.Instances?.[0]?.PublicIpAddress || null;
      if (!publicIp) await new Promise(r => setTimeout(r, 5000));
    }
    if (!publicIp) throw new Error("Public IP timeout");
    await log(`🌍 Public IP: ${publicIp}`);

    // 8️⃣ Save DB
    const instanceRecord = await prisma.ec2Instance.create({
      data: {
        userId,
        awsInstanceId: instanceId,
        publicIp,
        region,
        instanceType: instanceType || "t3.micro",
        securityGroupId: sgId,
        securityGroupName: sgName,
        keyPairName: keyName,
        keyMaterial: encryptSecret(privateKey),
        accessKeyId: encryptSecret(accessKeyId),
        secretAccessKey: encryptSecret(secretAccessKey),
      },
    });

    await log("🎉 EC2 ready with SSM enabled!");
    return { instanceRecord, privateKey };
  } catch (err) {
    await log(`❌ Error: ${err.message}`);
    console.error(err);

    // Cleanup
    if (instanceId) {
      await log(`🛑 Terminating instance ${instanceId}`);
      await ec2Client.send(new TerminateInstancesCommand({ InstanceIds: [instanceId] }));
    }
    if (sgId) {
      await log(`🧹 Deleting SG: ${sgName}`);
      await ec2Client.send(new DeleteSecurityGroupCommand({ GroupId: sgId }));
    }
    if (keyName) {
      await log(`🗝️ Deleting key pair: ${keyName}`);
      await ec2Client.send(new DeleteKeyPairCommand({ KeyName: keyName }));
    }

    throw err;
  }
}
