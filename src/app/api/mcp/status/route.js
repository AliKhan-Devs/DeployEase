import { getAuthSession } from "@/lib/authSession";

/**
 * Check AI provider status
 * Returns which AI provider is configured
 */
export async function GET() {
  const session = await getAuthSession();
  
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  let provider = null;
  let providerName = null;

  if (openaiApiKey) {
    provider = "openai";
    providerName = "OpenAI (GPT)";
  } else if (anthropicApiKey) {
    provider = "anthropic";
    providerName = "Anthropic (Claude)";
  } else if (geminiApiKey) {
    provider = "gemini";
    providerName = "Google Gemini";
  } else {
    provider = "fallback";
    providerName = "Rule-based (No API Key)";
  }

  return new Response(JSON.stringify({
    success: true,
    provider,
    providerName,
    hasApiKey: !!openaiApiKey || !!anthropicApiKey || !!geminiApiKey,
    message: provider === "fallback" 
      ? "Using rule-based AI. Add OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY to your .env for enhanced AI capabilities."
      : `Using ${providerName} for AI responses.`,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}


