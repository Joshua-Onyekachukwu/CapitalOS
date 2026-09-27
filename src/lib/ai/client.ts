/**
 * NVIDIA NIM AI Client
 *
 * Main client for AI operations in Capital OS.
 * Handles key rotation, retry logic, timeout, and model selection.
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
  /** Per-attempt timeout in ms (default 45s). */
  timeoutMs?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 45_000;

/**
 * Nemotron 3.5 "lightning" models emit reasoning traces by default, which
 * both inflates latency and can silently consume the whole token budget
 * before producing any visible content. Disable thinking for these models —
 * the app's tasks (classification, scoring, short drafting) don't need it.
 */
function buildRequestBody(model: string, config: { maxTokens: number; temperature: number }, allMessages: ChatMessage[]) {
  const body: Record<string, unknown> = {
    model,
    messages: allMessages,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    stream: false,
  };
  if (model.startsWith("nvidia/nemotron-3.5")) {
    body.chat_template_kwargs = { thinking: false };
  }
  return body;
}

async function callModel(
  baseUrl: string,
  apiKey: string,
  model: string,
  allMessages: ChatMessage[],
  config: { maxTokens: number; temperature: number },
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildRequestBody(model, config, allMessages)),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function parseChatResponse(data: {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}, fallbackModel: string): ChatResponse {
  const choice = data.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error("Empty response from NVIDIA API");
  }
  return {
    content: choice.message.content,
    model: data.model || fallbackModel,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}

/**
 * Send a chat completion request to NVIDIA NIM API.
 * Automatically rotates keys, retries on rate limits, times out hung
 * requests, and falls back to the task's fallback model on the last attempt.
 */
export async function chatCompletion({
  task,
  systemPrompt,
  messages,
  maxRetries = MAX_RETRIES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
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

    // On the final attempt, switch to the fallback model (if configured) —
    // the primary model may be end-of-life or unavailable on this account.
    const model =
      config.fallbackModel && attempt === maxRetries - 1
        ? config.fallbackModel
        : config.model;

    try {
      const response = await callModel(
        baseUrl,
        apiKey,
        model,
        allMessages,
        config,
        attempt === maxRetries - 1 ? Math.min(timeoutMs, 20_000) : timeoutMs
      );

      // Handle rate limiting
      if (response.status === 429) {
        markKeyRateLimited(apiKey, 60_000);
        lastError = new Error(`Rate limited on key (attempt ${attempt + 1}/${maxRetries})`);

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
        }
        continue;
      }

      // Handle other errors
      if (!response.ok) {
        const errorBody = await response.text();
        lastError = new Error(`NVIDIA API error ${response.status} (${model}): ${errorBody.slice(0, 300)}`);

        // Don't retry on auth errors (401, 403)
        if (response.status === 401 || response.status === 403) {
          throw lastError;
        }

        // 404 (model unavailable on this account), 410 (end of life),
        // 503 (temporarily unavailable) -> next attempt uses the other model
        continue;
      }

      const data = await response.json();
      return parseChatResponse(data, model);
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
