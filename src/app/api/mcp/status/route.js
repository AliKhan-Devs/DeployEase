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

  // Return all available providers so user can choose
  const availableProviders = [];
  
  if (openaiApiKey) {
    availableProviders.push({
      id: "openai",
      name: "OpenAI",
      displayName: "GPT-4o-mini (OpenAI)",
      icon: "🤖",
    });
  }
  
  if (anthropicApiKey) {
    availableProviders.push({
      id: "anthropic",
      name: "Anthropic",
      displayName: "Claude (Anthropic)",
      icon: "🧠",
    });
  }
  
  if (geminiApiKey) {
    availableProviders.push({
      id: "gemini",
      name: "Google",
      displayName: "Gemini (Google)",
      icon: "✨",
    });
  }

  // Fallback if no providers
  if (availableProviders.length === 0) {
    availableProviders.push({
      id: "fallback",
      name: "Fallback",
      displayName: "Rule-based (No API Key)",
      icon: "⚙️",
    });
  }

  // Default provider (first available, or fallback)
  const defaultProvider = availableProviders[0];

  return new Response(JSON.stringify({
    success: true,
    providers: availableProviders,
    defaultProvider: defaultProvider.id,
    hasApiKey: !!openaiApiKey || !!anthropicApiKey || !!geminiApiKey,
    message: availableProviders.length > 1
      ? `Multiple AI providers available. Choose your preferred model.`
      : availableProviders[0].id === "fallback"
        ? "Using rule-based AI. Add OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY to your .env for enhanced AI capabilities."
        : `Using ${defaultProvider.displayName} for AI responses.`,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}


