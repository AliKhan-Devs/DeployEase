import { getAuthSession } from "@/lib/authSession";
import { createLogger } from "@/lib/utils/createLogger";
import { handleDeploymentRequest } from "@/lib/utils/deployments/handleDeploymentRequest";
import { handleRedeploy } from "@/lib/utils/deployments/handleRedploy";
import { defaultEntryPoint, handleEnvUpdate } from "@/lib/utils/helpers";

// Redis imports
import { getSession, setSession } from "@/lib/redis/sessionCache";
import { deploymentQueue } from "@/lib/redis/queues";

const ACTIONS = {
  DEPLOY: "deploy",
  UPDATE_ENV: "update-env",
  REDEPLOY: "redeploy",
  CREATE_LB: "create-lb",
};

export async function POST(req) {
  const body = await req.json();
  const action = body.action || ACTIONS.DEPLOY;


  // Session caching with Redis
  // Instead of hitting DB/session store every request,
  // we first try to get session from Redis


  let session = await getSession(req.headers.get("user-id")); // assuming user-id is sent in headers
  if (!session) {

    // if not in cache, fallback to actual auth check
    session = await getAuthSession();
    if (!session) return new Response("Unauthorized", { status: 401 });

    // store session in Redis for faster access next time (TTL: 1 hour)
    await setSession(session.user.id, session);
  }



  const log = await createLogger(session.user.id);

  switch (action) {
    case ACTIONS.DEPLOY:

      // Asynchronous deployment queue
     
      // Instead of running deployment synchronously (blocking API),
      // we push it to BullMQ queue stored in Redis
      const job = await deploymentQueue.add("deployApp", {
  userId: session.user.id,
  projectId: body.projectId,
  action: body.action,
  payload: body,
});


      // Return immediately with job ID so frontend can track status
      return new Response(
        JSON.stringify({
          message: "Deployment queued successfully",
          deploymentId: job.id,
        }),
        { status: 200 }
      );

    case ACTIONS.UPDATE_ENV:
      // ==============================
      // 3️⃣ Environment update (could cache envs in Redis later)
      // ==============================
      return handleEnvUpdate({ session, body, log });

    case ACTIONS.REDEPLOY:
      // ==============================
      // 4️⃣ Redeploy can also be queued later if needed
      // ==============================
      return handleRedeploy({ session, body, log });

    case ACTIONS.CREATE_LB:
      return handleCreateLoadBalancer({ session, body, log });

    default:
      return new Response(
        JSON.stringify({ error: `Unsupported action: ${action}` }),
        { status: 400 }
      );
  }
}
