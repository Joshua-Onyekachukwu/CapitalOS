/**
 * NVIDIA NIM API Key Rotation
 *
 * Manages a pool of API keys with round-robin rotation.
 * If a key hits rate limits, it's skipped and the next key is used.
 * Keys are NEVER exposed to the client bundle — server-side only.
 */

const BASE_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";

// Collect all valid keys from env (server-side only)
function getKeyPool(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`NVIDIA_API_KEY_${i}`];
    if (key && key.startsWith("nvapi-")) {
      keys.push(key);
    }
  }
  return keys;
}

// Round-robin state (module-level, survives across calls in same server instance)
let currentIndex = 0;
const rateLimitedKeys = new Map<string, number>(); // key -> retry-after timestamp

/**
 * Get the next available API key using round-robin rotation.
 * Skips keys that are currently rate-limited.
 */
export function getNextApiKey(): string {
  const keys = getKeyPool();

  if (keys.length === 0) {
    throw new Error(
      "No NVIDIA API keys configured. Add NVIDIA_API_KEY_1 through NVIDIA_API_KEY_N to .env.local"
    );
  }

  const now = Date.now();
  const totalKeys = keys.length;

  // Try all keys, starting from current index
  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const key = keys[currentIndex % totalKeys];
    currentIndex = (currentIndex + 1) % totalKeys;

    // Check if this key is rate-limited
    const retryAfter = rateLimitedKeys.get(key);
    if (retryAfter && now < retryAfter) {
      continue; // Skip, try next
    }

    // Clean up expired rate limit entries
    if (retryAfter && now >= retryAfter) {
      rateLimitedKeys.delete(key);
    }

    return key;
  }

  // All keys are rate-limited — return the one with the earliest retry
  let earliestRetry = Infinity;
  let bestKey = keys[0];

  for (const key of keys) {
    const retryAfter = rateLimitedKeys.get(key) ?? 0;
    if (retryAfter < earliestRetry) {
      earliestRetry = retryAfter;
      bestKey = key;
    }
  }

  return bestKey;
}

/**
 * Mark a key as rate-limited. Will be skipped for the specified duration.
 */
export function markKeyRateLimited(key: string, retryAfterMs: number = 60_000): void {
  rateLimitedKeys.set(key, Date.now() + retryAfterMs);
}

/**
 * Get the base URL for NVIDIA NIM API calls.
 */
export function getBaseUrl(): string {
  return BASE_URL;
}

/**
 * Get the number of available keys in the pool.
 */
export function getKeyCount(): number {
  return getKeyPool().length;
}
