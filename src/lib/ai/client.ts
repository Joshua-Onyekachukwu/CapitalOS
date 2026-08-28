/**
 * NVIDIA NIM AI Client
 *
 * Main client for AI operations in Capital OS.
 * Handles key rotation, retry logic, and model selection.
 *
 * Server-side only — keys are never exposed to the client bundle.
 */

import { getNextApiKey, markKeyRateLimited, getBaseUrl } from "./keys";
import { getModelConfig, type AiTask } from "./models";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface AiClientOptions {
  task: AiTask;
  systemPrompt?: string;
  messages: ChatMessage[];
  maxRetries?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Send a chat completion request to NVIDIA NIM API.
 * Automatically rotates keys and retries on rate limits.
 */
export async function chatCompletion({
  task,
  systemPrompt,
  messages,
  maxRetries = MAX_RETRIES,
}: AiClientOptions): Promise<ChatResponse> {
  const config = getModelConfig(task);
  const baseUrl = getBaseUrl();

  // Prepend system prompt if provided
  const allMessages = systemPrompt
    ? [{ role: "system" as const, content: systemPrompt }, ...messages]
    : messages;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = getNextApiKey();

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: allMessages,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          stream: false,
        }),
      });

      // Handle rate limiting
      if (response.status === 429) {
        markKeyRateLimited(apiKey, 60_000);
        lastError = new Error(`Rate limited on key (attempt ${attempt + 1}/${maxRetries})`);

        // Wait before retrying with next key
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
        }
        continue;
      }

      // Handle other errors
      if (!response.ok) {
        const errorBody = await response.text();
        lastError = new Error(`NVIDIA API error ${response.status}: ${errorBody}`);

        // On 410 (model gone) or 503 (unavailable), try fallback model
        if ((response.status === 410 || response.status === 503) && config.fallbackModel && attempt === maxRetries - 1) {
          try {
            const fallbackResponse = await fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: config.fallbackModel,
                messages: allMessages,
                max_tokens: config.maxTokens,
                temperature: config.temperature,
                stream: false,
              }),
            });
            if (fallbackResponse.ok) {
              const fallbackData = await fallbackResponse.json();
              const fallbackChoice = fallbackData.choices?.[0];
              if (fallbackChoice?.message?.content) {
                return {
                  content: fallbackChoice.message.content,
                  model: config.fallbackModel,
                  usage: {
                    promptTokens: fallbackData.usage?.prompt_tokens ?? 0,
                    completionTokens: fallbackData.usage?.completion_tokens ?? 0,
                    totalTokens: fallbackData.usage?.total_tokens ?? 0,
                  },
                };
              }
            }
          } catch { /* fallback also failed */ }
        }

        // Don't retry on auth errors (401, 403)
        if (response.status === 401 || response.status === 403) {
          throw lastError;
        }

        continue;
      }

      // Parse successful response
      const data = await response.json();
      const choice = data.choices?.[0];

      if (!choice?.message?.content) {
        throw new Error("Empty response from NVIDIA API");
      }

      return {
        content: choice.message.content,
        model: data.model || config.model,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-retryable errors
      if (
        lastError.message.includes("401") ||
        lastError.message.includes("403") ||
        lastError.message.includes("No NVIDIA API keys")
      ) {
        throw lastError;
      }

      // Wait before retrying
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("All retry attempts exhausted");
}

/**
 * Convenience function for simple single-prompt AI calls.
 */
export async function aiComplete(
  task: AiTask,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const response = await chatCompletion({
    task,
    systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content;
}

/**
 * Check if NVIDIA API is configured and available.
 */
export function isAiConfigured(): boolean {
  try {
    // Access env on server side
    for (let i = 1; i <= 5; i++) {
      const key = process.env[`NVIDIA_API_KEY_${i}`];
      if (key && key.startsWith("nvapi-")) return true;
    }
    return false;
  } catch {
    return false;
  }
}
