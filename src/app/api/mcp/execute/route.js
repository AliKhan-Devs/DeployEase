import { getAuthSession } from "@/lib/authSession";
import { cookies } from "next/headers";

import { executeMCPTool } from "@/lib/mcp/tools";

/**
 * Execute MCP tools directly from the dashboard
 * This bypasses the MCP protocol and calls tools directly
 */
export async function POST(req) {
  const session = await getAuthSession();
  
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json();
    const { tool, arguments: args } = body;

    if (!tool) {
      return new Response(JSON.stringify({ error: "Tool name is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Get session token for MCP tools
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("next-auth.session-token")?.value || 
                        cookieStore.get("__Secure-next-auth.session-token")?.value;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const config = {
      apiUrl,
      apiKey: null,
      sessionToken: sessionToken || null,
    };

    // Execute the tool
    const result = await executeMCPTool(tool, args || {}, config);

    return new Response(JSON.stringify({
      success: true,
      tool,
      result: result.content || result,
      isError: result.isError || false,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error executing MCP tool:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to execute tool",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

