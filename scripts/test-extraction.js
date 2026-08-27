require('dotenv').config({path:'.env.local'});

function extractEmailFromResponse(raw) {
  let text = raw.trim();
  text = text.replace(/```[\w]*\n?/gm, "").replace(/```$/gm, "").trim();

  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      text = parsed.body || parsed.email || parsed.text || parsed.content || parsed.message || JSON.stringify(parsed);
    } catch {}
  }

  // Find LAST SUBJECT: marker
  const lastSubjectIdx = text.lastIndexOf("SUBJECT:");
  if (lastSubjectIdx < 0) return { subject: "", body: text.substring(0, 1500) };

  // Extract subject from the line
  const subjectLine = text.substring(lastSubjectIdx, text.indexOf("\n", lastSubjectIdx) || text.length);
  const subject = subjectLine.replace(/^SUBJECT:\s*/i, "").trim().replace(/^["']|["']$/g, "");

  // Everything after SUBJECT: line
  const afterSubject = text.substring(lastSubjectIdx + subjectLine.length);

  // Find the actual email — look for "Hi [Name]," greeting pattern
  // The email starts with a greeting and ends before reasoning resumes
  const greetingMatch = afterSubject.match(/(?:BODY:\s*\n\s*)?((?:Hi|Dear|Hello|Hey)\s+[A-Z][a-z]+[,.]?)/i);
  if (!greetingMatch) return { subject, body: afterSubject.substring(0, 500).trim() };

  const emailStart = afterSubject.indexOf(greetingMatch[0]);
  let emailContent = afterSubject.substring(emailStart).trim();

  // Remove optional BODY: prefix
  emailContent = emailContent.replace(/^BODY:\s*\n\s*/i, "");

  // Find where the email ends — look for reasoning patterns that follow the email
  // The email ends at the last sentence that ends with proper punctuation
  // before reasoning starts
  const reasoningPatterns = [
    /\n\s*(?:Check|Verify|Word count|Final|Let|Revised|I need|Wait|Actually|No |Ensure|The email|Note|\*\*|\d+\.)/i,
    /\n\s*I'll\s/i,
    /\n\s*So the\s/i,
    /\n\s*Actually,/i,
    /\n\s*Hmm,/i,
    /\n\s*Wait,/i,
    /\n\s*Draft:/i,
  ];

  let endIdx = emailContent.length;
  for (const pattern of reasoningPatterns) {
    const match = emailContent.match(pattern);
    if (match && match.index > 50) {
      endIdx = Math.min(endIdx, match.index);
    }
  }

  // Also trim at the last sentence that ends with proper punctuation
  const truncated = emailContent.substring(0, endIdx).trim();
  const lastPeriod = truncated.lastIndexOf(".");
  const lastExcl = truncated.lastIndexOf("!");
  const lastQuestion = truncated.lastIndexOf("?");
  const lastSentenceEnd = Math.max(lastPeriod, lastExcl, lastQuestion);

  if (lastSentenceEnd > 50) {
    emailContent = truncated.substring(0, lastSentenceEnd + 1).trim();
  } else {
    emailContent = truncated;
  }

  return { subject, body: emailContent };
}

async function test() {
  const tones = ["professional", "bold", "casual"];
  const investors = [
    { name: "Charlotte Powell", firm: "Unknown", type: "accelerator", fit: 89 },
    { name: "Adam Hernandez", firm: "Unknown", type: "angel_investor", fit: 89 },
    { name: "Julie Fisher", firm: "Unknown", type: "private_equity", fit: 89 },
  ];

  for (let i = 0; i < 3; i++) {
    const inv = investors[i];
    const tone = tones[i];
    const toneDesc = {
      professional: "Direct and business-like. Respect their time.",
      bold: "Confident and direct. Lead with the most compelling data point.",
      casual: "Conversational and relaxed. Like a smart introduction over coffee.",
    }[tone];

    console.log("\n" + "=".repeat(60));
    console.log("TEST " + (i+1) + ": " + inv.name + " | " + inv.type + " | Tone: " + tone);
    console.log("=".repeat(60));

    const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {"Content-Type":"application/json","Authorization":"Bearer "+process.env.NVIDIA_API_KEY_1},
      body: JSON.stringify({
        model: "nvidia/nemotron-3.5-lightning-30b-a3b",
        max_tokens: 2048,
        temperature: 0.7,
        messages: [
          {role:"system",content:"You write investor outreach emails.\n\nOUTPUT FORMAT:\nAfter all your analysis, end with exactly these two sections on separate lines:\nSUBJECT: your subject line here\nBODY:\nyour email body here\n\nEMAIL RULES:\n- Start with Hi [InvestorFirstName],\n- Start with something specific about the investor\n- Briefly say why you are reaching out\n- End with one low-pressure next step\n- Under 120 words\n- No signature block\n- Tone: " + toneDesc},
          {role:"user",content:"Write email to " + inv.name + " at " + inv.firm + "\nInvestor: " + inv.name + "\nFirm: " + inv.firm + "\nType: " + inv.type + "\nFit score: " + inv.fit + "%"}
        ]
      })
    });
    const d = await r.json();
    const raw = d.choices?.[0]?.message?.content || "";
    const result = extractEmailFromResponse(raw);

    console.log("Subject: " + result.subject);
    console.log("Body:\n" + result.body);
    console.log("Body length: " + result.body.length + " chars");

    const hasGreeting = /^Hi\s+/i.test(result.body);
    const hasForbidden = /I hope this email finds you well|I'm reaching out to explore|I believe there may be synergies|I'd love to connect and discuss|pitch deck|book a call/i.test(result.body);
    const wordCount = result.body.split(/\s+/).length;
    const isUnder120Words = wordCount < 120;
    const noChainOfThought = !/thinking process|analyze the request|chain of thought|\*\*\d+\.|Draft:/i.test(result.body);

    console.log("\nQuality checks:");
    console.log("  Has greeting: " + (hasGreeting ? "PASS" : "FAIL"));
    console.log("  No forbidden phrases: " + (!hasForbidden ? "PASS" : "FAIL"));
    console.log("  Under 120 words: " + (isUnder120Words ? "PASS (" + wordCount + " words)" : "FAIL (" + wordCount + " words)"));
    console.log("  No chain-of-thought: " + (noChainOfThought ? "PASS" : "FAIL"));
  }
}

test();
