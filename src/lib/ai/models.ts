/**
 * NVIDIA NIM Model Configuration
 *
 * Different models for different tasks. Each model is optimized
 * for specific use cases within the Capital OS platform.
 */

export type AiTask =
  | "investor_matching"
  | "investor_scoring"
  | "email_drafting"
  | "research_summary"
  | "fit_analysis"
  | "pipeline_analysis"
  | "query_parsing";

interface ModelConfig {
  model: string;
  fallbackModel?: string;
  maxTokens: number;
  temperature: number;
  description: string;
}

/**
 * Model assignments per task.
 * Uses NVIDIA NIM-hosted models for inference.
 */
const MODEL_CONFIG: Record<AiTask, ModelConfig> = {
  // Investor matching — needs fast, accurate classification
  investor_matching: {
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    fallbackModel: "nvidia/nemotron-3-super-120b-a12b",
    maxTokens: 2048,
    temperature: 0.1,
    description: "High-accuracy investor-startup matching",
  },

  // Investor scoring — structured scoring with reasoning
  investor_scoring: {
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    fallbackModel: "nvidia/nemotron-3-super-120b-a12b",
    maxTokens: 4096,
    temperature: 0.2,
    description: "Multi-factor investor scoring with explanations",
  },

  // Email drafting — using Nemotron Lightning
  // Reduced to 512 tokens — forces concise output, reduces latency by ~60%
  // The prompt already constrains to 120 words, no need for 2048 tokens
  email_drafting: {
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    fallbackModel: "nvidia/nemotron-3-super-120b-a12b",
    maxTokens: 512,
    temperature: 0.7,
    description: "Personalized outreach email generation",
  },

  // Research summarization — condensing large amounts of data
  research_summary: {
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    fallbackModel: "nvidia/nemotron-3-super-120b-a12b",
    maxTokens: 2048,
    temperature: 0.3,
    description: "Investor research and profile summarization",
  },

  // Fit analysis — explaining why an investor matches
  fit_analysis: {
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    fallbackModel: "nvidia/nemotron-3-super-120b-a12b",
    maxTokens: 2048,
    temperature: 0.2,
    description: "Detailed investor-startup fit explanations",
  },

  // Query parsing — turn a founder's natural-language search into structured
  // filters. Tiny structured output, latency-critical (user is waiting).
  query_parsing: {
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    fallbackModel: "nvidia/nemotron-3-super-120b-a12b",
    maxTokens: 256,
    temperature: 0,
    description: "Parse natural-language investor search into structured filters",
  },

  // Pipeline analysis — strategic insights on fundraising progress
  pipeline_analysis: {
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    fallbackModel: "nvidia/nemotron-3-super-120b-a12b",
    maxTokens: 2048,
    temperature: 0.3,
    description: "Fundraising pipeline strategy and analytics",
  },
};

/**
 * Get model configuration for a specific task.
 */
export function getModelConfig(task: AiTask): ModelConfig {
  return MODEL_CONFIG[task];
}

/**
 * Get all available tasks and their descriptions.
 */
export function getAvailableTasks(): Array<{ task: AiTask; description: string }> {
  return Object.entries(MODEL_CONFIG).map(([task, config]) => ({
    task: task as AiTask,
    description: config.description,
  }));
}
