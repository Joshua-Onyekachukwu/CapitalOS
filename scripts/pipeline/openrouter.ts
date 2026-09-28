/**
 * OpenRouter client for pipeline qualification.
 *
 * Model routing strategy (two-tier):
 *   - TIER1 (cheap/fast): binary "is this an investor entity?" + coarse type
 *     classification over raw extracted text. ~90% of records exit here with
 *     no expensive calls.
 *   - TIER2 (capable): deep qualification — thesis extraction, evidence
 *     attribution, stage/sector disambiguation, check-size interpretation —
 *     only for records that pass TIER1 and have rich text worth analyzing.
 *
 * Every call is metered (tokens + USD) and returned to the caller so stage
 * metrics roll up real costs. Fallback chain per tier; 429/5xx retries with
 * exponential backoff; structured JSON outputs enforced by prompt + parse
 * validation (OpenRouter does not universally support response_format across
 * providers, so we validate defensively).
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const TIER1_MODELS = ["meta-llama/llama-3.1-8b-instruct", "google/gemini-flash-1.5"];
const TIER2_MODELS = ["anthropic/claude-3.5-haiku", "openai/gpt-4o-mini"];

/** $/1M tokens (prompt, completion) — kept here for cost accounting. */
export const MODEL_PRICES: Record<string, [number, number]> = {
  "meta-llama/llama-3.1-8b-instruct": [0.06, 0.06],
  "google/gemini-flash-1.5": [0.075, 0.3],
  "anthropic/claude-3.5-haiku": [0.8, 4],
  "openai/gpt-4o-mini": [0.15, 0.6],
};

export interface AiUsage {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
}

export interface AiResult<T> {
  data: T;
  usage: AiUsage;
}

interface RawResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

function priceFor(model: string, pt: number, ct: number): number {
  const [pp, cp] = MODEL_PRICES[model] || [0.15, 0.6];
  return (pt / 1e6) * pp + (ct / 1e6) * cp;
}

async function callOnce(
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  timeoutMs: number
): Promise<{ content: string; usage: AiUsage }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        // OpenRouter attribution headers (optional but recommended)
        "HTTP-Referer": "https://capital-os-nine.vercel.app",
        "X-Title": "Capital OS Investor Pipeline",
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.1 }),
    });
    const body = (await res.json()) as RawResponse;
    if (!res.ok || body.error) {
      throw new Error(`openrouter ${res.status}: ${body.error?.message || res.statusText}`);
    }
    const content = body.choices?.[0]?.message?.content || "";
    const pt = body.usage?.prompt_tokens || 0;
    const ct = body.usage?.completion_tokens || 0;
    return {
      content,
      usage: { model, prompt_tokens: pt, completion_tokens: ct, cost_usd: priceFor(model, pt, ct) },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callTier(
  models: string[],
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  timeoutMs = 45_000
): Promise<{ content: string; usage: AiUsage }> {
  let lastErr: Error | null = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await callOnce(model, messages, maxTokens, timeoutMs);
      } catch (err: any) {
        lastErr = err;
        const retriable = /429|5\d\d|timeout|abort/i.test(err?.message || "");
        if (!retriable || attempt === 1) break;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    // fall through to next model in the chain
  }
  throw lastErr || new Error("all models failed");
}

/** Extract the first JSON object from a model response (tolerates fences). */
function parseJson<T>(content: string): T {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1] : content;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in model output");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export interface Tier1Verdict {
  is_investor_entity: boolean;
  investor_type: string | null;
  reason: string;
}

const TIER1_SYSTEM = `You classify raw business records for a fundraising platform.
Decide whether the record describes an entity that INVESTS in companies or startups
(VC fund, angel, family office, corporate VC, accelerator, micro-VC, growth/PE fund,
government or university fund). Registered investment advisers that only manage money
for private clients may still count if they plausibly back startups.
Respond with ONLY JSON: {"is_investor_entity": boolean, "investor_type": string|null, "reason": "max 15 words"}`;

export async function tier1Classify(
  name: string,
  blurb: string
): Promise<AiResult<Tier1Verdict> | null> {
  try {
    const { content, usage } = await callTier(
      TIER1_MODELS,
      [
        { role: "system", content: TIER1_SYSTEM },
        { role: "user", content: `NAME: ${name}\n\nRECORD TEXT: ${blurb.slice(0, 1200)}` },
      ],
      200
    );
    const data = parseJson<Tier1Verdict>(content);
    return { data, usage };
  } catch (err) {
    console.error("[openrouter] tier1 failed:", (err as Error).message);
    return null;
  }
}

export interface Tier2Qualification {
  stages: string[];
  sectors: string[];
  thesis: string | null;
  check_size_text: string | null;
  portfolio_companies: string[];
  startup_focus: boolean;
  evidence_quotes: { claim: string; quote: string }[];
  confidence: number;
}

const TIER2_SYSTEM = `You are an investor-intelligence analyst. From the provided text about an
investment firm, extract structured facts. EVERY claim must be supported by a quote from the
text — never invent facts. If the text does not mention something, leave it null/empty.
Respond with ONLY JSON:
{"stages": ["pre_seed"|"seed"|"series_a"|"series_b"|"series_c_plus"|"growth"|"late_stage"],
 "sectors": [lowercase sector tags],
 "thesis": "one sentence or null",
 "check_size_text": "exact quoted text or null",
 "portfolio_companies": ["names"],
 "startup_focus": boolean,
 "evidence_quotes": [{"claim": "...", "quote": "..."}],
 "confidence": 0.0-1.0}`;

export async function tier2Qualify(
  name: string,
  blurb: string
): Promise<AiResult<Tier2Qualification> | null> {
  try {
    const { content, usage } = await callTier(
      TIER2_MODELS,
      [
        { role: "system", content: TIER2_SYSTEM },
        { role: "user", content: `FIRM: ${name}\n\nTEXT: ${blurb.slice(0, 6000)}` },
      ],
      1200,
      60_000
    );
    const data = parseJson<Tier2Qualification>(content);
    return { data, usage };
  } catch (err) {
    console.error("[openrouter] tier2 failed:", (err as Error).message);
    return null;
  }
}
