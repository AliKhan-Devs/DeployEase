import { getAuthSession } from "@/lib/authSession";
import { cookies } from "next/headers";

/**
 * Get MCP configuration for the current user
 * Returns session token and API URL for MCP server setup
 */
export async function GET() {
  const session = await getAuthSession();
  
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Get session token from cookies
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("next-auth.session-token")?.value || 
                        cookieStore.get("__Secure-next-auth.session-token")?.value;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const mcpServerPath = process.env.MCP_SERVER_PATH || "./mcp-server";

    return new Response(JSON.stringify({
      success: true,
      config: {
        apiUrl,
        sessionToken: sessionToken || null,
        mcpServerPath,
        hasSessionToken: !!sessionToken,
      },
      instructions: {
        mcpServerUrl: `${apiUrl.replace(/\/$/, "")}/api`,
        setupGuide: "See the MCP Integration page for detailed setup instructions",
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error getting MCP config:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to retrieve MCP configuration",
      details: error.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

