// =============================================
// Campaign Follow-Up Sequence Service
// =============================================
// Manages multi-step drip campaigns for investor outreach.
// Handles creation, enrollment, scheduling, and execution.

import { createClient } from "@supabase/supabase-js";

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
// Supabase Client
// =============================================

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
  const supabase = getSupabase();

  // Create the sequence
  const { data: sequence, error: seqError } = await supabase
    .from("campaign_sequences")
    .insert({
      campaign_id: campaignId,
      user_id: userId,
      name: data.name,
      description: data.description,
      status: "draft",
      total_steps: data.steps.length,
      send_window_start: data.send_window_start || "09:00",
      send_window_end: data.send_window_end || "17:00",
      send_days: data.send_days || [1, 2, 3, 4, 5],
      stop_on_reply: data.stop_on_reply ?? true,
    })
    .select()
    .single();

  if (seqError || !sequence) {
    console.error("Failed to create sequence:", seqError);
    return null;
  }

  // Create the steps
  if (data.steps.length > 0) {
    const steps = data.steps.map((step, i) => ({
      sequence_id: sequence.id,
      step_number: step.step_number || i + 1,
      step_type: step.step_type,
      subject_template: step.subject_template,
      body_template: step.body_template,
      delay_days: step.delay_days,
      delay_hours: step.delay_hours,
      tone: step.tone || "professional",
      is_active: step.is_active,
    }));

    const { error: stepsError } = await supabase
      .from("campaign_sequence_steps")
      .insert(steps);

    if (stepsError) {
      console.error("Failed to create steps:", stepsError);
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
  const supabase = getSupabase();
  const { error } = await supabase
    .from("campaign_sequences")
    .update(updates)
    .eq("id", sequenceId);
  return !error;
}

// =============================================
// Delete Sequence
// =============================================

export async function deleteSequence(sequenceId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("campaign_sequences")
    .delete()
    .eq("id", sequenceId);
  return !error;
}

// =============================================
// Get Sequence with Steps
// =============================================

export async function getSequence(sequenceId: string): Promise<Sequence | null> {
  const supabase = getSupabase();

  const { data: sequence, error } = await supabase
    .from("campaign_sequences")
    .select("*")
    .eq("id", sequenceId)
    .single();

  if (error || !sequence) return null;

  const { data: steps } = await supabase
    .from("campaign_sequence_steps")
    .select("*")
    .eq("sequence_id", sequenceId)
    .order("step_number", { ascending: true });

  return { ...sequence, steps: steps || [] };
}

// =============================================
// Get Sequences for Campaign
// =============================================

export async function getCampaignSequences(
  campaignId: string
): Promise<Sequence[]> {
  const supabase = getSupabase();

  const { data: sequences } = await supabase
    .from("campaign_sequences")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (!sequences) return [];

  // Fetch steps for each sequence
  const sequencesWithSteps = await Promise.all(
    sequences.map(async (seq) => {
      const { data: steps } = await supabase
        .from("campaign_sequence_steps")
        .select("*")
        .eq("sequence_id", seq.id)
        .order("step_number", { ascending: true });
      return { ...seq, steps: steps || [] };
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
  const supabase = getSupabase();
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

  // Batch enroll
  const enrollments = investorIds.map((investorId) => ({
    sequence_id: sequenceId,
    investor_id: investorId,
    campaign_id: campaignId,
    user_id: userId,
    current_step: 0,
    status: "scheduled" as const,
    next_send_at: nextSendAt,
  }));

  // Insert in batches of 100
  for (let i = 0; i < enrollments.length; i += 100) {
    const batch = enrollments.slice(i, i + 100);
    const { error } = await supabase
      .from("campaign_sequence_enrollments")
      .upsert(batch, { onConflict: "sequence_id,investor_id" });

    if (error) {
      errors += batch.length;
    } else {
      enrolled += batch.length;
    }
  }

  // Update sequence enrollment count
  await supabase
    .from("campaign_sequences")
    .update({ total_enrolled: enrolled })
    .eq("id", sequenceId);

  return { enrolled, errors };
}

// =============================================
// Get Pending Sends
// =============================================

export async function getPendingSends(limit = 50): Promise<
  Array<Enrollment & { investor_email: string; investor_name: string; step: SequenceStep }>
> {
  const supabase = getSupabase();

  const { data: enrollments } = await supabase
    .from("campaign_sequence_enrollments")
    .select(`
      *,
      investors!inner(id, email, full_name, first_name, last_name),
      campaign_sequences!inner(id, stop_on_reply)
    `)
    .eq("status", "scheduled")
    .lte("next_send_at", new Date().toISOString())
    .limit(limit);

  if (!enrollments || enrollments.length === 0) return [];

  const results = [];

  for (const enrollment of enrollments) {
    const inv = enrollment.investors as any;
    const seq = enrollment.campaign_sequences as any;

    // Skip if investor has no email
    if (!inv?.email) {
      await supabase
        .from("campaign_sequence_enrollments")
        .update({ status: "skipped", stopped_reason: "no_email" })
        .eq("id", enrollment.id);
      continue;
    }

    // Check if investor replied (stop on reply)
    if (seq?.stop_on_reply) {
      const { data: replies } = await supabase
        .from("campaign_sequence_emails")
        .select("id")
        .eq("investor_id", enrollment.investor_id)
        .eq("status", "replied")
        .limit(1);

      if (replies && replies.length > 0) {
        await supabase
          .from("campaign_sequence_enrollments")
          .update({ status: "stopped", stopped_reason: "replied" })
          .eq("id", enrollment.id);
        continue;
      }
    }

    // Get the current step
    const nextStepNumber = enrollment.current_step + 1;
    const { data: step } = await supabase
      .from("campaign_sequence_steps")
      .select("*")
      .eq("sequence_id", enrollment.sequence_id)
      .eq("step_number", nextStepNumber)
      .eq("is_active", true)
      .single();

    if (!step) {
      // No more steps — sequence complete
      await supabase
        .from("campaign_sequence_enrollments")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", enrollment.id);
      continue;
    }

    results.push({
      ...enrollment,
      investor_email: inv.email,
      investor_name: inv.full_name || `${inv.first_name} ${inv.last_name}`,
      step,
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
  const supabase = getSupabase();

  // Get the user's email account
  const { data: account } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!account) {
    console.error("No email account connected");
    return false;
  }

  // Import and use the email sender
  const { sendEmail } = await import("@/lib/services/email/sender");

  const result = await sendEmail({
    userId,
    to: investorEmail,
    subject,
    bodyHtml,
  });

  if (!result.success) {
    console.error("Email send failed:", result.error);
    return false;
  }

  // Get investor_id from enrollment
  const { data: enrollment } = await supabase
    .from("campaign_sequence_enrollments")
    .select("investor_id, sequence_id, current_step")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) return false;

  // Log the sent email
  await supabase.from("campaign_sequence_emails").insert({
    enrollment_id: enrollmentId,
    step_id: step.id,
    investor_id: enrollment.investor_id,
    user_id: userId,
    subject,
    body_html: bodyHtml,
    from_address: account.email_address,
    to_address: investorEmail,
    message_id: result.messageId,
    status: "sent",
    ai_generated: true,
  });

  // Calculate next step
  const sequence = await getSequence(enrollment.sequence_id);
  const nextStepNumber = enrollment.current_step + 1;
  const totalSteps = sequence?.total_steps || 0;

  if (nextStepNumber >= totalSteps) {
    // Sequence complete
    await supabase
      .from("campaign_sequence_enrollments")
      .update({
        current_step: nextStepNumber,
        status: "completed",
        last_sent_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq("id", enrollmentId);

    // Update sequence completed count
    try {
      await supabase.rpc("increment_counter", {
        table_name: "campaign_sequences",
        column_name: "total_completed",
        row_id: enrollment.sequence_id,
      });
    } catch {
      // Fallback: direct update
      await supabase
        .from("campaign_sequences")
        .update({ total_completed: (sequence?.total_completed || 0) + 1 })
        .eq("id", enrollment.sequence_id);
    }
  } else {
    // Schedule next step
    const nextStep = sequence?.steps?.find((s) => s.step_number === nextStepNumber + 1);
    const nextSendAt = calculateNextSendTime(
      nextStep?.delay_days || 3,
      nextStep?.delay_hours || 0,
      sequence?.send_window_start,
      sequence?.send_window_end,
      sequence?.send_days
    );

    await supabase
      .from("campaign_sequence_enrollments")
      .update({
        current_step: nextStepNumber,
        status: "scheduled",
        last_sent_at: new Date().toISOString(),
        next_send_at: nextSendAt,
      })
      .eq("id", enrollmentId);
  }

  // Also log in email_messages for the outreach tracking system
  await supabase.from("email_messages").insert({
    user_id: userId,
    investor_id: enrollment.investor_id,
    direction: "outbound",
    subject,
    body_html: bodyHtml,
    from_address: account.email_address,
    to_address: investorEmail,
    status: "sent",
    sent_at: new Date().toISOString(),
    message_id: result.messageId,
    ai_generated: true,
  });

  return true;
}

// =============================================
// Get Sequence Stats
// =============================================

export async function getSequenceStats(
  sequenceId: string
): Promise<SequenceStats> {
  const supabase = getSupabase();

  const { data: enrollments } = await supabase
    .from("campaign_sequence_enrollments")
    .select("id, status, stopped_reason")
    .eq("sequence_id", sequenceId);

  const { count: emailsSent } = await supabase
    .from("campaign_sequence_emails")
    .select("id", { count: "exact", head: true })
    .eq("enrollment_id", "") // Will be replaced
    .eq("investor_id", ""); // Placeholder

  // Count emails for this sequence's enrollments
  const enrollmentIds = (enrollments || []).map((e) => e.id);
  let totalEmails = 0;
  if (enrollmentIds.length > 0) {
    const { count } = await supabase
      .from("campaign_sequence_emails")
      .select("id", { count: "exact", head: true })
      .in("enrollment_id", enrollmentIds);
    totalEmails = count || 0;
  }

  const stats: SequenceStats = {
    totalEnrolled: enrollments?.length || 0,
    activeNow: enrollments?.filter((e) => e.status === "scheduled").length || 0,
    completed: enrollments?.filter((e) => e.status === "completed").length || 0,
    replied: enrollments?.filter((e) => e.status === "stopped" && (e as any).stopped_reason === "replied").length || 0,
    bounced: enrollments?.filter((e) => e.status === "stopped" && (e as any).stopped_reason === "bounced").length || 0,
    emailsSent: totalEmails,
  };

  return stats;
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

    // Find next valid day
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
