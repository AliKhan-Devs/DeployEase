import { AuthorizeSecurityGroupIngressCommand, CreateKeyPairCommand, CreateSecurityGroupCommand, DeleteKeyPairCommand, DeleteSecurityGroupCommand, DescribeInstancesCommand, RunInstancesCommand, TerminateInstancesCommand } from "@aws-sdk/client-ec2";

import { encryptSecret } from "../encryptDecrypt";
import { PrismaClient } from "@prisma/client";
import { buildIpPermissions } from "../helpers";

const prisma = new PrismaClient();


const DEFAULT_AMI = process.env.DEPLOYEASE_UBUNTU_AMI || "ami-0ecb62995f68bb549";



export async function createEc2Instance({ ec2Client, userId, region, instanceType, log, accessKeyId, secretAccessKey }) {
    let instanceId = null;
    let sgName = null;
    let sgId = null;
    let keyName = null;
    let privateKey = null;
  
    try {
      keyName = `deployease-key-${Date.now()}`;
      await log(`🔐 Creating key pair ${keyName}`);
      const keyPair = await ec2Client.send(new CreateKeyPairCommand({ KeyName: keyName }));
      privateKey = keyPair.KeyMaterial;
  
      sgName = `deployease-sg-${Date.now()}`;
      await log(`🔒 Creating security group ${sgName}`);
      const sgResponse = await ec2Client.send(
        new CreateSecurityGroupCommand({
          GroupName: sgName,
          Description: "Security group for DeployEase multi-app instance",
        })
      );
      sgId = sgResponse.GroupId;
  
      await log("🔓 Authorizing ingress for ports 22, 80");
      await ec2Client.send(
        new AuthorizeSecurityGroupIngressCommand({
          GroupId: sgId,
          IpPermissions: buildIpPermissions([22, 80]),
        })
      );
  
      await log("🖥️ Launching EC2 instance...");
      const runData = await ec2Client.send(
        new RunInstancesCommand({
          ImageId: DEFAULT_AMI,
          InstanceType: instanceType || "t3.micro",
          MinCount: 1,
          MaxCount: 1,
          KeyName: keyName,
          SecurityGroupIds: [sgId],
        })
      );
      instanceId = runData.Instances?.[0]?.InstanceId;
      if (!instanceId) {
        throw new Error("Failed to retrieve instance ID from AWS response.");
      }
      await log(`✅ EC2 instance launched: ${instanceId}`);
      await log("⏳ Waiting for public IP...");
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5s
      let publicIp = null;
      for (let attempt = 0; attempt < 60 && !publicIp; attempt++) {
        const description = await ec2Client.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] }));
        publicIp = description.Reservations?.[0]?.Instances?.[0]?.PublicIpAddress;
        if (!publicIp) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      

      if (!publicIp) throw new Error("Timed out waiting for public IP address.");
      await log(`🌍 Public IP acquired: ${publicIp}`);
  
      await log("🕒 Allowing instance to finish boot sequence (30s)...");
      await new Promise((resolve) => setTimeout(resolve, 30000));
  
      const instanceRecord = await prisma.ec2Instance.create({
        data: {
          userId,
          awsInstanceId: instanceId,
          publicIp,
          region,
          instanceType: instanceType || "t3.micro",
          securityGroupId: sgId || undefined,
          securityGroupName: sgName,
          keyPairName: keyName,
          keyMaterial: encryptSecret(privateKey),
          accessKeyId: encryptSecret(accessKeyId),
          secretAccessKey: encryptSecret(secretAccessKey),
        },
      });
  
      return { instanceRecord, privateKey };
    } catch (err) {
      console.error("Error during EC2 instance creation:", err);
      await log("⚠️ Instance creation failed. Rolling back resources...");
      if (instanceId) {
        await log(`🛑 Terminating instance ${instanceId}`);
        await ec2Client.send(new TerminateInstancesCommand({ InstanceIds: [instanceId] }));
      }
      if (sgId) {
        await log(`🧹 Deleting security group ${sgName}`);
        await ec2Client.send(new DeleteSecurityGroupCommand({ GroupId: sgId }));
      } else if (sgName) {
        await ec2Client.send(new DeleteSecurityGroupCommand({ GroupName: sgName })).catch(() => { });
      }
      if (keyName) {
        await log(`🗝️ Deleting key pair ${keyName}`);
        await ec2Client.send(new DeleteKeyPairCommand({ KeyName: keyName }));
      }
      throw err;
    }
  }
  