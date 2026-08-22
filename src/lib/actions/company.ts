"use server";

import { createClient } from "@/lib/supabase/server";

// =============================================
// Types
// =============================================

export interface CompanyProfile {
  id: string;
  userId: string;
  companyName: string | null;
  websiteUrl: string | null;
  industry: string | null;
  location: string | null;
  companyStage: string | null;
  businessModel: string | null;
  oneLiner: string | null;
  description: string | null;
  differentiator: string | null;
  targetCustomer: string | null;
  currentlyRaising: boolean;
  fundingAmount: number | null;
  roundType: string | null;
  targetInvestorGeographies: string[];
  hasPitchDeck: boolean;
  mrr: number | null;
  arr: number | null;
  customerCount: number | null;
  growthRate: string | null;
  milestones: string[];
  employeeCount: number | null;
  onboardingCompleted: boolean;
  onboardingStep: number;
  readinessScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  companyId: string;
  name: string;
  title: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  isFounder: boolean;
}

export interface CompanyDocument {
  id: string;
  companyId: string;
  documentType: string;
  fileName: string;
  fileUrl: string | null;
  fileSize: number | null;
  createdAt: string;
}

// =============================================
// Get or Create Company Profile
// =============================================

export async function getOrCreateCompanyProfile(): Promise<CompanyProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Try to get existing profile
  const { data: existing } = await supabase
    .from("company_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return mapProfile(existing);
  }

  // Create new profile
  const { data: newProfile, error } = await supabase
    .from("company_profiles")
    .insert({ user_id: user.id })
    .select("*")
    .single();

  if (error || !newProfile) return null;
  return mapProfile(newProfile);
}

// =============================================
// Update Company Profile
// =============================================

export async function updateCompanyProfile(
  updates: Partial<Omit<CompanyProfile, "id" | "userId" | "createdAt" | "updatedAt" | "readinessScore">>
): Promise<CompanyProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Ensure profile exists
  const profile = await getOrCreateCompanyProfile();
  if (!profile) return null;

  // Map camelCase to snake_case for Supabase
  const dbUpdates: Record<string, unknown> = {};
  if (updates.companyName !== undefined) dbUpdates.company_name = updates.companyName;
  if (updates.websiteUrl !== undefined) dbUpdates.website_url = updates.websiteUrl;
  if (updates.industry !== undefined) dbUpdates.industry = updates.industry;
  if (updates.location !== undefined) dbUpdates.location = updates.location;
  if (updates.companyStage !== undefined) dbUpdates.company_stage = updates.companyStage;
  if (updates.businessModel !== undefined) dbUpdates.business_model = updates.businessModel;
  if (updates.oneLiner !== undefined) dbUpdates.one_liner = updates.oneLiner;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.differentiator !== undefined) dbUpdates.differentiator = updates.differentiator;
  if (updates.targetCustomer !== undefined) dbUpdates.target_customer = updates.targetCustomer;
  if (updates.currentlyRaising !== undefined) dbUpdates.currently_raising = updates.currentlyRaising;
  if (updates.fundingAmount !== undefined) dbUpdates.funding_amount = updates.fundingAmount;
  if (updates.roundType !== undefined) dbUpdates.round_type = updates.roundType;
  if (updates.targetInvestorGeographies !== undefined) dbUpdates.target_investor_geographies = updates.targetInvestorGeographies;
  if (updates.hasPitchDeck !== undefined) dbUpdates.has_pitch_deck = updates.hasPitchDeck;
  if (updates.mrr !== undefined) dbUpdates.mrr = updates.mrr;
  if (updates.arr !== undefined) dbUpdates.arr = updates.arr;
  if (updates.customerCount !== undefined) dbUpdates.customer_count = updates.customerCount;
  if (updates.growthRate !== undefined) dbUpdates.growth_rate = updates.growthRate;
  if (updates.milestones !== undefined) dbUpdates.milestones = updates.milestones;
  if (updates.employeeCount !== undefined) dbUpdates.employee_count = updates.employeeCount;
  if (updates.onboardingCompleted !== undefined) dbUpdates.onboarding_completed = updates.onboardingCompleted;
  if (updates.onboardingStep !== undefined) dbUpdates.onboarding_step = updates.onboardingStep;

  // Calculate readiness score
  dbUpdates.readiness_score = calculateReadinessScore({ ...profile, ...updates });

  const { data, error } = await supabase
    .from("company_profiles")
    .update(dbUpdates)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) return null;
  return mapProfile(data);
}

// =============================================
// Team Members
// =============================================

export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const profile = await getOrCreateCompanyProfile();
  if (!profile) return [];

  const { data } = await supabase
    .from("company_team_members")
    .select("*")
    .eq("company_id", profile.id)
    .order("is_founder", { ascending: false });

  return (data || []).map((m) => ({
    id: m.id,
    companyId: m.company_id,
    name: m.name,
    title: m.title,
    linkedinUrl: m.linkedin_url,
    bio: m.bio,
    isFounder: m.is_founder,
  }));
}

export async function addTeamMember(member: {
  name: string;
  title?: string;
  linkedinUrl?: string;
  bio?: string;
  isFounder?: boolean;
}): Promise<TeamMember | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getOrCreateCompanyProfile();
  if (!profile) return null;

  const { data, error } = await supabase
    .from("company_team_members")
    .insert({
      company_id: profile.id,
      name: member.name,
      title: member.title || null,
      linkedin_url: member.linkedinUrl || null,
      bio: member.bio || null,
      is_founder: member.isFounder || false,
    })
    .select("*")
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    name: data.name,
    title: data.title,
    linkedinUrl: data.linkedin_url,
    bio: data.bio,
    isFounder: data.is_founder,
  };
}

export async function removeTeamMember(memberId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("company_team_members")
    .delete()
    .eq("id", memberId);

  return !error;
}

// =============================================
// Documents
// =============================================

export async function getCompanyDocuments(): Promise<CompanyDocument[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const profile = await getOrCreateCompanyProfile();
  if (!profile) return [];

  const { data } = await supabase
    .from("company_documents")
    .select("*")
    .eq("company_id", profile.id)
    .order("created_at", { ascending: false });

  return (data || []).map((d) => ({
    id: d.id,
    companyId: d.company_id,
    documentType: d.document_type,
    fileName: d.file_name,
    fileUrl: d.file_url,
    fileSize: d.file_size,
    createdAt: d.created_at,
  }));
}

export async function addCompanyDocument(doc: {
  documentType: string;
  fileName: string;
  fileUrl?: string;
  fileSize?: number;
}): Promise<CompanyDocument | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await getOrCreateCompanyProfile();
  if (!profile) return null;

  const { data, error } = await supabase
    .from("company_documents")
    .insert({
      company_id: profile.id,
      document_type: doc.documentType,
      file_name: doc.fileName,
      file_url: doc.fileUrl || null,
      file_size: doc.fileSize || null,
    })
    .select("*")
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    documentType: data.document_type,
    fileName: data.file_name,
    fileUrl: data.file_url,
    fileSize: data.file_size,
    createdAt: data.created_at,
  };
}

// =============================================
// Readiness Score Calculation
// =============================================

function calculateReadinessScore(profile: Partial<CompanyProfile>): number {
  let score = 0;
  const weights = {
    companyName: 10,
    industry: 10,
    companyStage: 10,
    oneLiner: 10,
    differentiator: 10,
    targetCustomer: 10,
    currentlyRaising: 5,
    fundingAmount: 5,
    roundType: 5,
    mrr: 5,
    customerCount: 5,
    employeeCount: 5,
    hasPitchDeck: 10,
  };

  if (profile.companyName) score += weights.companyName;
  if (profile.industry) score += weights.industry;
  if (profile.companyStage) score += weights.companyStage;
  if (profile.oneLiner) score += weights.oneLiner;
  if (profile.differentiator) score += weights.differentiator;
  if (profile.targetCustomer) score += weights.targetCustomer;
  if (profile.currentlyRaising) score += weights.currentlyRaising;
  if (profile.fundingAmount) score += weights.fundingAmount;
  if (profile.roundType) score += weights.roundType;
  if (profile.mrr) score += weights.mrr;
  if (profile.customerCount) score += weights.customerCount;
  if (profile.employeeCount) score += weights.employeeCount;
  if (profile.hasPitchDeck) score += weights.hasPitchDeck;

  return Math.min(100, score);
}

// =============================================
// Helpers
// =============================================

function mapProfile(row: Record<string, unknown>): CompanyProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    companyName: row.company_name as string | null,
    websiteUrl: row.website_url as string | null,
    industry: row.industry as string | null,
    location: row.location as string | null,
    companyStage: row.company_stage as string | null,
    businessModel: row.business_model as string | null,
    oneLiner: row.one_liner as string | null,
    description: row.description as string | null,
    differentiator: row.differentiator as string | null,
    targetCustomer: row.target_customer as string | null,
    currentlyRaising: row.currently_raising as boolean,
    fundingAmount: row.funding_amount as number | null,
    roundType: row.round_type as string | null,
    targetInvestorGeographies: (row.target_investor_geographies as string[]) || [],
    hasPitchDeck: row.has_pitch_deck as boolean,
    mrr: row.mrr as number | null,
    arr: row.arr as number | null,
    customerCount: row.customer_count as number | null,
    growthRate: row.growth_rate as string | null,
    milestones: (row.milestones as string[]) || [],
    employeeCount: row.employee_count as number | null,
    onboardingCompleted: row.onboarding_completed as boolean,
    onboardingStep: row.onboarding_step as number,
    readinessScore: row.readiness_score as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
