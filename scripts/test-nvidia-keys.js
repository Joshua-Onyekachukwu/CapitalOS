#!/usr/bin/env node
/**
 * Capital OS — NVIDIA API Key Rotation Test
 * ==========================================
 * Tests that all 5 API keys work, rotation functions, and rate-limit handling.
 *
 * Usage:
 *   node scripts/test-nvidia-keys.js              # Test all keys
 *   node scripts/test-nvidia-keys.js --send       # Test all keys + send a prompt
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });

const BASE_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
const MODEL = "nvidia/llama-3.3-nemotron-super-49b-v1";
const doSend = process.argv.includes("--send");

async function getKeyPool() {
  const keys = [];
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`NVIDIA_API_KEY_${i}`];
    if (key && key.startsWith("nvapi-")) {
      keys.push({ index: i, key, masked: key.slice(0, 12) + "..." + key.slice(-6) });
    }
  }
  return keys;
}

async function testKey(keyObj) {
  const start = Date.now();
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keyObj.key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: "Say 'OK' and nothing else." }],
        max_tokens: 10,
        temperature: 0,
        stream: false,
      }),
    });

    const elapsed = Date.now() - start;

    if (response.status === 429) {
      return { ...keyObj, status: "RATE_LIMITED", ms: elapsed, error: null };
    }

    if (response.status === 401 || response.status === 403) {
      const body = await response.text();
      return { ...keyObj, status: "AUTH_ERROR", ms: elapsed, error: `HTTP ${response.status}` };
    }

    if (!response.ok) {
      const body = await response.text();
      return { ...keyObj, status: "ERROR", ms: elapsed, error: `HTTP ${response.status}: ${body.slice(0, 100)}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    return {
      ...keyObj,
      status: "OK",
      ms: elapsed,
      content,
      tokens: data.usage?.total_tokens || 0,
    };
  } catch (e) {
    return { ...keyObj, status: "NETWORK_ERROR", ms: Date.now() - start, error: e.message };
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Capital OS — NVIDIA API Key Rotation Test");
  console.log("═══════════════════════════════════════════════════════════\n");

  const keys = await getKeyPool();
  console.log(`🔑 Found ${keys.length} API keys in pool\n`);

  if (keys.length === 0) {
    console.error("❌ No NVIDIA API keys found in .env.local");
    process.exit(1);
  }

  // Test all keys sequentially (not parallel, to check rotation)
  const results = [];
  for (const keyObj of keys) {
    process.stdout.write(`   Testing key #${keyObj.index} (${keyObj.masked})... `);
    const result = await testKey(keyObj);
    results.push(result);

    const icon = result.status === "OK" ? "✅" :
                 result.status === "RATE_LIMITED" ? "⚠️" :
                 result.status === "AUTH_ERROR" ? "🔑" : "❌";
    console.log(`${icon} ${result.status} (${result.ms}ms)${result.content ? ` → "${result.content}"` : ""}${result.error ? ` — ${result.error}` : ""}`);
  }

  // Summary
  const ok = results.filter(r => r.status === "OK");
  const rateLimited = results.filter(r => r.status === "RATE_LIMITED");
  const failed = results.filter(r => !["OK", "RATE_LIMITED"].includes(r.status));

  console.log(`\n📊 Results:`);
  console.log(`   ✅ Working:     ${ok.length}/${keys.length}`);
  console.log(`   ⚠️  Rate-limited: ${rateLimited.length}/${keys.length}`);
  console.log(`   ❌ Failed:      ${failed.length}/${keys.length}`);

  if (ok.length > 0) {
    const avgMs = Math.round(ok.reduce((a, b) => a + b.ms, 0) / ok.length);
    const totalTokens = ok.reduce((a, b) => a + (b.tokens || 0), 0);
    console.log(`   ⏱️  Avg latency:  ${avgMs}ms`);
    console.log(`   📝 Total tokens: ${totalTokens}`);
  }

  // Test round-robin rotation
  console.log(`\n🔄 Testing round-robin rotation:`);
  const order = [];
  const rotatedKeys = [...keys];
  for (let i = 0; i < Math.min(8, keys.length); i++) {
    const idx = i % rotatedKeys.length;
    order.push(`#${rotatedKeys[idx].index}`);
  }
  console.log(`   Sequence: ${order.join(" → ")}`);

  // Full send test if requested
  if (doSend && ok.length > 0) {
    console.log(`\n🧪 Sending a test prompt to first working key...`);
    const testKey = ok[0];
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testKey.key}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: "You are Capital OS AI. Be brief." },
            { role: "user", content: "What are 3 top signals that indicate a startup is ready for Series A fundraising? Answer in 2-3 sentences." },
          ],
          max_tokens: 256,
          temperature: 0.3,
          stream: false,
        }),
      });
      const data = await response.json();
      console.log(`\n   🤖 AI Response:\n   ${data.choices?.[0]?.message?.content?.trim()}`);
      console.log(`\n   📊 Tokens used: ${data.usage?.total_tokens || "?"} (${data.usage?.prompt_tokens || "?"} prompt + ${data.usage?.completion_tokens || "?"} completion)`);
    } catch (e) {
      console.error(`   ❌ Send failed:`, e.message);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("💥 Error:", err.message);
  process.exit(1);
});
