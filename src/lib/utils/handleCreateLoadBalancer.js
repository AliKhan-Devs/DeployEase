import { ElasticLoadBalancingV2Client, CreateLoadBalancerCommand, CreateTargetGroupCommand, RegisterTargetsCommand, CreateListenerCommand } from "@aws-sdk/client-elastic-load-balancing-v2";

export async function handleCreateLoadBalancer({ session, body, log }) {
  const { accessKeyId, secretAccessKey, region, name, instanceIds = [] } = body;
  const elbClient = new ElasticLoadBalancingV2Client({ region, credentials: { accessKeyId, secretAccessKey } });

  await log(`🔹 Creating ELB: ${name}...`);
  
  const lbResp = await elbClient.send(new CreateLoadBalancerCommand({
    Name: name,
    Subnets: body.subnets, // user must pass public subnets
    SecurityGroups: body.securityGroups,
    Scheme: "internet-facing",
    Type: "application",
    IpAddressType: "ipv4",
  }));

  const targetGroupResp = await elbClient.send(new CreateTargetGroupCommand({
    Name: `${name}-tg`,
    Port: 80,
    Protocol: "HTTP",
    VpcId: body.vpcId,
    TargetType: "instance",
  }));

  if (instanceIds.length) {
    await elbClient.send(new RegisterTargetsCommand({
      TargetGroupArn: targetGroupResp.TargetGroupArn,
      Targets: instanceIds.map(id => ({ Id: id, Port: 80 })),
    }));
  }

  await elbClient.send(new CreateListenerCommand({
    LoadBalancerArn: lbResp.LoadBalancers[0].LoadBalancerArn,
    Protocol: "HTTP",
    Port: 80,
    DefaultActions: [{ Type: "forward", TargetGroupArn: targetGroupResp.TargetGroupArn }]
  }));

  return new Response(JSON.stringify({ success: true, lbDns: lbResp.LoadBalancers[0].DNSName }));
}
