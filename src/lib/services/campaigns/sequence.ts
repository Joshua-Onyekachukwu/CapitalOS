// =============================================
// Campaign Follow-Up Sequence Service
// =============================================
// Manages multi-step drip campaigns for investor outreach.
// Handles creation, enrollment, scheduling, and execution.

import { query } from "@/lib/db";

// =============================================
// Types
// =============================================

export interface SequenceStep {
  id?: string;
  sequence_id?: string;
  step_number: number;
  step_type: "initial" | "follow_up" | "breakup" | "custom";
  subject_template: string;
  body_template: string;
  delay_days: number;
  delay_hours: number;
  tone: string;
  is_active: boolean;
}

export interface Sequence {
  id?: string;
  campaign_id: string;
  user_id: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "paused" | "completed" | "cancelled";
  total_steps: number;
  total_enrolled: number;
  total_completed: number;
  total_replies: number;
  send_window_start?: string;
  send_window_end?: string;
  send_days?: number[];
  stop_on_reply: boolean;
  steps?: SequenceStep[];
  created_at?: string;
}

export interface Enrollment {
  id?: string;
  sequence_id: string;
  investor_id: string;
  campaign_id: string;
  user_id: string;
  current_step: number;
  status: string;
  next_send_at?: string;
  last_sent_at?: string;
  completed_at?: string;
  stopped_reason?: string;
}

export interface SequenceStats {
  totalEnrolled: number;
  activeNow: number;
  completed: number;
  replied: number;
  bounced: number;
  emailsSent: number;
}

// =============================================
// Create Sequence
// =============================================

export async function createSequence(
  campaignId: string,
  userId: string,
  data: {
    name: string;
    description?: string;
    steps: Omit<SequenceStep, "id" | "sequence_id">[];
    send_window_start?: string;
    send_window_end?: string;
    send_days?: number[];
    stop_on_reply?: boolean;
  }
): Promise<Sequence | null> {
  // Create the sequence
  const rows = await query<any>(
    `INSERT INTO campaign_sequences (campaign_id, user_id, name, description, status, total_steps, send_window_start, send_window_end, send_days, stop_on_reply)
     VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      campaignId,
      userId,
      data.name,
      data.description,
      data.steps.length,
      data.send_window_start || "09:00",
      data.send_window_end || "17:00",
      data.send_days || [1, 2, 3, 4, 5],
      data.stop_on_reply ?? true,
    ]
  );

  if (!rows.length) {
    console.error("Failed to create sequence");
    return null;
  }

  const sequence = rows[0];

  // Create the steps
  if (data.steps.length > 0) {
    for (const step of data.steps) {
      const stepNumber = step.step_number || data.steps.indexOf(step) + 1;
      await query(
        `INSERT INTO campaign_sequence_steps (sequence_id, step_number, step_type, subject_template, body_template, delay_days, delay_hours, tone, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          sequence.id,
          stepNumber,
          step.step_type,
          step.subject_template,
          step.body_template,
          step.delay_days,
          step.delay_hours,
          step.tone || "professional",
          step.is_active,
        ]
      );
    }
  }

  return { ...sequence, steps: data.steps };
}

// =============================================
// Update Sequence
// =============================================

export async function updateSequence(
  sequenceId: string,
  updates: Partial<Sequence>
): Promise<boolean> {
  const setClauses: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (key === "steps" || key === "id") continue;
    setClauses.push(`${key} = $${paramIdx++}`);
    params.push(value);
  }

  if (setClauses.length === 0) return true;

  params.push(sequenceId);
  await query(
    `UPDATE campaign_sequences SET ${setClauses.join(", ")} WHERE id = $${paramIdx}`,
    params
  );
  return true;
}

// =============================================
// Delete Sequence
// =============================================

export async function deleteSequence(sequenceId: string): Promise<boolean> {
  await query(`DELETE FROM campaign_sequences WHERE id = $1`, [sequenceId]);
  return true;
}

// =============================================
// Get Sequence with Steps
// =============================================

export async function getSequence(sequenceId: string): Promise<Sequence | null> {
  const sequences = await query<any>(
    `SELECT * FROM campaign_sequences WHERE id = $1`,
    [sequenceId]
  );

  if (!sequences.length) return null;

  const steps = await query<SequenceStep>(
    `SELECT * FROM campaign_sequence_steps WHERE sequence_id = $1 ORDER BY step_number ASC`,
    [sequenceId]
  );

  return { ...sequences[0], steps };
}

// =============================================
// Get Sequences for Campaign
// =============================================

export async function getCampaignSequences(
  campaignId: string
): Promise<Sequence[]> {
  const sequences = await query<any>(
    `SELECT * FROM campaign_sequences WHERE campaign_id = $1 ORDER BY created_at ASC`,
    [campaignId]
  );

  // Fetch steps for each sequence
  const sequencesWithSteps = await Promise.all(
    sequences.map(async (seq) => {
      const steps = await query<SequenceStep>(
        `SELECT * FROM campaign_sequence_steps WHERE sequence_id = $1 ORDER BY step_number ASC`,
        [seq.id]
      );
      return { ...seq, steps };
    })
  );

  return sequencesWithSteps;
}

// =============================================
// Enroll Investors in Sequence
// =============================================

export async function enrollInvestors(
  sequenceId: string,
  investorIds: string[],
  campaignId: string,
  userId: string
): Promise<{ enrolled: number; errors: number }> {
  let enrolled = 0;
  let errors = 0;

  // Get the sequence to calculate first send time
  const sequence = await getSequence(sequenceId);
  if (!sequence || !sequence.steps || sequence.steps.length === 0) {
    return { enrolled: 0, errors: investorIds.length };
  }

  const firstStep = sequence.steps[0];
  const nextSendAt = calculateNextSendTime(
    firstStep.delay_days,
    firstStep.delay_hours,
    sequence.send_window_start,
    sequence.send_window_end,
    sequence.send_days
  );

  // Batch enroll in groups of 100
  for (let i = 0; i < investorIds.length; i += 100) {
    const batch = investorIds.slice(i, i + 100);

    for (const investorId of batch) {
      try {
        await query(
          `INSERT INTO campaign_sequence_enrollments (sequence_id, investor_id, campaign_id, user_id, current_step, status, next_send_at)
           VALUES ($1, $2, $3, $4, 0, 'scheduled', $5)
           ON CONFLICT (sequence_id, investor_id) DO UPDATE SET status = 'scheduled', next_send_at = $5`,
          [sequenceId, investorId, campaignId, userId, nextSendAt]
        );
        enrolled++;
      } catch {
        errors++;
      }
    }
  }

  // Update sequence enrollment count
  await query(
    `UPDATE campaign_sequences SET total_enrolled = $1 WHERE id = $2`,
    [enrolled, sequenceId]
  );

  return { enrolled, errors };
}

// =============================================
// Get Pending Sends
// =============================================

export async function getPendingSends(limit = 50): Promise<
  Array<Enrollment & { investor_email: string; investor_name: string; step: SequenceStep }>
> {
  const enrollments = await query<any>(
    `SELECT e.*, i.email AS investor_email, i.full_name AS investor_name, i.first_name, i.last_name,
            cs.stop_on_reply
     FROM campaign_sequence_enrollments e
     INNER JOIN investors i ON e.investor_id = i.id
     INNER JOIN campaign_sequences cs ON e.sequence_id = cs.id
     WHERE e.status = 'scheduled' AND e.next_send_at <= NOW()
     LIMIT $1`,
    [limit]
  );

  if (!enrollments.length) return [];

  const results: Array<Enrollment & { investor_email: string; investor_name: string; step: SequenceStep }> = [];

  for (const enrollment of enrollments) {
    // Skip if investor has no email
    if (!enrollment.investor_email) {
      await query(
        `UPDATE campaign_sequence_enrollments SET status = 'skipped', stopped_reason = 'no_email' WHERE id = $1`,
        [enrollment.id]
      );
      continue;
    }

    // Check if investor replied (stop on reply)
    if (enrollment.stop_on_reply) {
      const replies = await query<any>(
        `SELECT id FROM campaign_sequence_emails WHERE investor_id = $1 AND status = 'replied' LIMIT 1`,
        [enrollment.investor_id]
      );

      if (replies.length > 0) {
        await query(
          `UPDATE campaign_sequence_enrollments SET status = 'stopped', stopped_reason = 'replied' WHERE id = $1`,
          [enrollment.id]
        );
        continue;
      }
    }

    // Get the current step
    const nextStepNumber = enrollment.current_step + 1;
    const steps = await query<SequenceStep>(
      `SELECT * FROM campaign_sequence_steps WHERE sequence_id = $1 AND step_number = $2 AND is_active = true`,
      [enrollment.sequence_id, nextStepNumber]
    );

    if (!steps.length) {
      // No more steps — sequence complete
      await query(
        `UPDATE campaign_sequence_enrollments SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [enrollment.id]
      );
      continue;
    }

    results.push({
      ...enrollment,
      investor_name: enrollment.full_name || `${enrollment.first_name || ""} ${enrollment.last_name || ""}`.trim(),
      step: steps[0],
    });
  }

  return results;
}

// =============================================
// Execute Send
// =============================================

export async function executeSend(
  enrollmentId: string,
  step: SequenceStep,
  investorEmail: string,
  investorName: string,
  userId: string,
  subject: string,
  bodyHtml: string
): Promise<boolean> {
  // Get the user's email account from CockroachDB
  const accounts = await query<any>(
    `SELECT * FROM email_accounts WHERE user_id = $1 AND is_active = true LIMIT 1`,
    [userId]
  );

  if (!accounts.length) {
    console.error("No email account connected");
    return false;
  }

  const account = accounts[0];

  // Import and use the email sender
  const { sendEmail } = await import("@/lib/services/email/sender");

  const result = await sendEmail({
    userId,
    to: investorEmail,
    subject,
    bodyHtml,
    enableTracking: true,
  });

  if (!result.success) {
    console.error("Email send failed:", result.error);
    return false;
  }

  // Get investor_id from enrollment
  const enrollments = await query<any>(
    `SELECT investor_id, sequence_id, current_step FROM campaign_sequence_enrollments WHERE id = $1`,
    [enrollmentId]
  );

  if (!enrollments.length) return false;

  const enrollment = enrollments[0];

  // Log the sent email
  await query(
    `INSERT INTO campaign_sequence_emails (enrollment_id, step_id, investor_id, user_id, subject, body_html, from_address, to_address, message_id, status, ai_generated)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'sent', true)`,
    [
      enrollmentId,
      step.id,
      enrollment.investor_id,
      userId,
      subject,
      bodyHtml,
      account.email_address,
      investorEmail,
      result.messageId,
    ]
  );

  // Calculate next step
  const sequence = await getSequence(enrollment.sequence_id);
  const nextStepNumber = enrollment.current_step + 1;
  const totalSteps = sequence?.total_steps || 0;

  if (nextStepNumber >= totalSteps) {
    // Sequence complete
    await query(
      `UPDATE campaign_sequence_enrollments SET current_step = $1, status = 'completed', last_sent_at = NOW(), completed_at = NOW() WHERE id = $2`,
      [nextStepNumber, enrollmentId]
    );

    // Update sequence completed count
    await query(
      `UPDATE campaign_sequences SET total_completed = $1 WHERE id = $2`,
      [(sequence?.total_completed || 0) + 1, enrollment.sequence_id]
    );
  } else {
    // Schedule next step
    const nextSteps = await query<SequenceStep>(
      `SELECT * FROM campaign_sequence_steps WHERE sequence_id = $1 AND step_number = $2`,
      [enrollment.sequence_id, nextStepNumber + 1]
    );
    const nextStep = nextSteps[0];

    const nextSendAt = calculateNextSendTime(
      nextStep?.delay_days || 3,
      nextStep?.delay_hours || 0,
      sequence?.send_window_start,
      sequence?.send_window_end,
      sequence?.send_days
    );

    await query(
      `UPDATE campaign_sequence_enrollments SET current_step = $1, status = 'scheduled', last_sent_at = NOW(), next_send_at = $2 WHERE id = $3`,
      [nextStepNumber, nextSendAt, enrollmentId]
    );
  }

  // Also log in email_messages for the outreach tracking system
  await query(
    `INSERT INTO email_messages (user_id, investor_id, direction, subject, body_html, from_address, to_address, status, sent_at, message_id, ai_generated)
     VALUES ($1, $2, 'outbound', $3, $4, $5, $6, 'sent', NOW(), $7, true)`,
    [
      userId,
      enrollment.investor_id,
      subject,
      bodyHtml,
      account.email_address,
      investorEmail,
      result.messageId,
    ]
  );

  return true;
}

// =============================================
// Get Sequence Stats
// =============================================

export async function getSequenceStats(
  sequenceId: string
): Promise<SequenceStats> {
  const enrollments = await query<any>(
    `SELECT id, status, stopped_reason FROM campaign_sequence_enrollments WHERE sequence_id = $1`,
    [sequenceId]
  );

  // Count emails for this sequence's enrollments
  const enrollmentIds = enrollments.map((e) => e.id);
  let totalEmails = 0;

  if (enrollmentIds.length > 0) {
    const placeholders = enrollmentIds.map((_, i) => `$${i + 1}`).join(", ");
    const emailCount = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM campaign_sequence_emails WHERE enrollment_id IN (${placeholders})`,
      enrollmentIds
    );
    totalEmails = parseInt(emailCount[0]?.count || "0");
  }

  return {
    totalEnrolled: enrollments.length,
    activeNow: enrollments.filter((e) => e.status === "scheduled").length,
    completed: enrollments.filter((e) => e.status === "completed").length,
    replied: enrollments.filter((e) => e.status === "stopped" && e.stopped_reason === "replied").length,
    bounced: enrollments.filter((e) => e.status === "stopped" && e.stopped_reason === "bounced").length,
    emailsSent: totalEmails,
  };
}

// =============================================
// Helpers
// =============================================

function calculateNextSendTime(
  delayDays: number,
  delayHours: number,
  windowStart?: string,
  windowEnd?: string,
  sendDays?: number[]
): string {
  const now = new Date();
  let nextTime = new Date(now.getTime() + delayDays * 86400000 + delayHours * 3600000);

  // Apply send window
  if (windowStart && sendDays && sendDays.length > 0) {
    const [startHour, startMin] = windowStart.split(":").map(Number);

    for (let i = 0; i < 14; i++) {
      const checkDate = new Date(nextTime.getTime() + i * 86400000);
      const dayOfWeek = checkDate.getDay(); // 0=Sun, 1=Mon...
      const mappedDay = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert to 1=Mon, 7=Sun

      if (sendDays.includes(mappedDay)) {
        nextTime = new Date(checkDate);
        nextTime.setHours(startHour, startMin, 0, 0);
        break;
      }
    }
  }

  return nextTime.toISOString();
}

// =============================================
// Default Sequence Templates
// =============================================

export const DEFAULT_SEQUENCE_TEMPLATES: Array<{
  name: string;
  description: string;
  steps: Omit<SequenceStep, "id" | "sequence_id">[];
}> = [
  {
    name: "Standard 3-Touch",
    description: "Initial email + 2 follow-ups over 7 days",
    steps: [
      {
        step_number: 1,
        step_type: "initial",
        subject_template: "Introduction — {{company_name}}",
        body_template: "Hi {{investor_name}},\n\nI'm reaching out because I believe {{company_name}} would be a great fit for your investment thesis.\n\n{{personal_note}}\n\nI'd love to share more about what we're building. Would you be open to a brief conversation?\n\nBest,\n{{sender_name}}",
        delay_days: 0,
        delay_hours: 0,
        tone: "professional",
        is_active: true,
      },
      {
        step_number: 2,
        step_type: "follow_up",
        subject_template: "Following up — {{company_name}}",
        body_template: "Hi {{investor_name}},\n\nJust following up on my previous email. I understand you're busy, so I'll keep this brief.\n\n{{follow_up_note}}\n\nHappy to send over our deck if you're interested.\n\nBest,\n{{sender_name}}",
        delay_days: 3,
        delay_hours: 0,
        tone: "friendly",
        is_active: true,
      },
      {
        step_number: 3,
        step_type: "breakup",
        subject_template: "Last note — {{company_name}}",
        body_template: "Hi {{investor_name}},\n\nI know things get busy, so this will be my last email on this.\n\nIf the timing isn't right, no worries at all. I'll keep you updated on our progress.\n\nIf you'd like to connect, my door is always open.\n\nAll the best,\n{{sender_name}}",
        delay_days: 4,
        delay_hours: 0,
        tone: "casual",
        is_active: true,
      },
    ],
  },
  {
    name: "Warm Introduction",
    description: "Gentle 4-touch sequence over 14 days",
    steps: [
      {
        step_number: 1,
        step_type: "initial",
        subject_template: "{{company_name}} — thought you'd be interested",
        body_template: "Hi {{investor_name}},\n\nI came across your work at {{firm_name}} and thought {{company_name}} might be interesting to you.\n\n{{personal_note}}\n\nWould you be open to learning more?\n\nCheers,\n{{sender_name}}",
        delay_days: 0,
        delay_hours: 0,
        tone: "warm",
        is_active: true,
      },
      {
        step_number: 2,
        step_type: "follow_up",
        subject_template: "Quick update on {{company_name}}",
        body_template: "Hi {{investor_name}},\n\nWanted to share a quick update on what we've been building.\n\n{{follow_up_note}}\n\nLet me know if you'd like to chat.\n\nBest,\n{{sender_name}}",
        delay_days: 4,
        delay_hours: 0,
        tone: "professional",
        is_active: true,
      },
      {
        step_number: 3,
        step_type: "follow_up",
        subject_template: "{{company_name}} — traction update",
        body_template: "Hi {{investor_name}},\n\nQuick traction update:\n\n{{traction_bullets}}\n\nHappy to dive deeper if you're interested.\n\nBest,\n{{sender_name}}",
        delay_days: 5,
        delay_hours: 0,
        tone: "professional",
        is_active: true,
      },
      {
        step_number: 4,
        step_type: "breakup",
        subject_template: "Closing the loop",
        body_template: "Hi {{investor_name}},\n\nI don't want to take up more of your time, so this will be my last note.\n\nIf the timing changes, I'd love to reconnect. Wishing you and {{firm_name}} continued success.\n\nAll the best,\n{{sender_name}}",
        delay_days: 5,
        delay_hours: 0,
        tone: "casual",
        is_active: true,
      },
    ],
  },
  {
    name: "Direct & Bold",
    description: "Short, punchy 2-touch sequence",
    steps: [
      {
        step_number: 1,
        step_type: "initial",
        subject_template: "{{company_name}} — {{one_liner}}",
        body_template: "Hi {{investor_name}},\n\n{{one_liner}}\n\n{{personal_note}}\n\nWorth a 15-minute call?\n\n{{sender_name}}",
        delay_days: 0,
        delay_hours: 0,
        tone: "bold",
        is_active: true,
      },
      {
        step_number: 2,
        step_type: "follow_up",
        subject_template: "Re: {{company_name}}",
        body_template: "Hi {{investor_name}},\n\nBumping this up. We're {{traction_highlight}} and looking for the right partner.\n\n15 minutes — that's all I ask.\n\n{{sender_name}}",
        delay_days: 5,
        delay_hours: 0,
        tone: "bold",
        is_active: true,
      },
    ],
  },
];
