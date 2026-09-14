import type { AIProvider } from "./types";
import { MockAIProvider } from "./mockProvider";
import { ClaudeAIProvider } from "./claudeProvider";

let cached: AIProvider | null = null;

// Config-driven provider selection (FR-14.1/14.2): no application code is
// coupled to a specific provider/model identifier. Defaults to the mock
// provider until ANTHROPIC_API_KEY is set, per the walking-skeleton scope.
export function getAIProvider(): AIProvider {
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  cached = apiKey ? new ClaudeAIProvider(apiKey) : new MockAIProvider();
  return cached;
}
