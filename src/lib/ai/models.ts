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
  | "pipeline_analysis";

interface ModelConfig {
  model: string;
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
    model: "nvidia/llama-3.3-nemotron-super-49b-v1",
    maxTokens: 2048,
    temperature: 0.1,
    description: "High-accuracy investor-startup matching",
  },

  // Investor scoring — structured scoring with reasoning
  investor_scoring: {
    model: "nvidia/llama-3.3-nemotron-super-49b-v1",
    maxTokens: 4096,
    temperature: 0.2,
    description: "Multi-factor investor scoring with explanations",
  },

  // Email drafting — needs creative, natural language
  email_drafting: {
    model: "nvidia/llama-3.3-nemotron-super-49b-v1",
    maxTokens: 2048,
    temperature: 0.7,
    description: "Personalized outreach email generation",
  },

  // Research summarization — condensing large amounts of data
  research_summary: {
    model: "nvidia/llama-3.3-nemotron-super-49b-v1",
    maxTokens: 4096,
    temperature: 0.3,
    description: "Investor research and profile summarization",
  },

  // Fit analysis — explaining why an investor matches
  fit_analysis: {
    model: "nvidia/llama-3.3-nemotron-super-49b-v1",
    maxTokens: 2048,
    temperature: 0.2,
    description: "Detailed investor-startup fit explanations",
  },

  // Pipeline analysis — strategic insights on fundraising progress
  pipeline_analysis: {
    model: "nvidia/llama-3.3-nemotron-super-49b-v1",
    maxTokens: 4096,
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
