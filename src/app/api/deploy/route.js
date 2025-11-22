import { getAuthSession } from "@/lib/authSession";
import { createLogger } from "@/lib/utils/createLogger";
import { handleDeploymentRequest } from "@/lib/utils/deployments/handleDeploymentRequest";
import { handleRedeploy } from "@/lib/utils/deployments/handleRedploy";
import { handleEnvUpdate } from "@/lib/utils/helpers";


const ACTIONS = {
  DEPLOY: "deploy",
  UPDATE_ENV: "update-env",
  REDEPLOY: "redeploy",
};

export async function POST(req) {
  const session = await getAuthSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const log = await createLogger(session.user.id);
  const body = await req.json();
  const action = body.action || ACTIONS.DEPLOY;

  switch (action) {
    case ACTIONS.DEPLOY:
      return handleDeploymentRequest({ session, body, log });
    case ACTIONS.UPDATE_ENV:
      return handleEnvUpdate({ session, body, log });
    case ACTIONS.REDEPLOY:
      return handleRedeploy({ session, body, log });
    default:
      return new Response(JSON.stringify({ error: `Unsupported action: ${action}` }), { status: 400 });
  }
}



