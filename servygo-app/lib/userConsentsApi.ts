import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

export type UserConsentType =
  | "terms"
  | "privacy"
  | "marketing"
  | "pricing_notice"
  | "liability_notice";

export type UserConsentSource =
  | "registration"
  | "legal_reacceptance"
  | "booking"
  | "account_settings";

export type UserConsentAction = "accepted" | "revoked";

type RecordUserConsentEventInput = {
  userId: string;
  consentType: UserConsentType;
  consentVersion?: string | null;
  action: UserConsentAction;
  source: UserConsentSource;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordUserConsentEvent({
  userId,
  consentType,
  consentVersion = null,
  action,
  source,
  userAgent,
  metadata,
}: RecordUserConsentEventInput): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const happenedAt = new Date().toISOString();
  const { error } = await supabase.from("user_consents").insert({
    user_id: userId,
    consent_type: consentType,
    consent_version: consentVersion,
    accepted_at: action === "accepted" ? happenedAt : null,
    revoked_at: action === "revoked" ? happenedAt : null,
    source,
    ip: null,
    user_agent: userAgent ?? null,
    metadata: metadata ?? {},
  });

  if (error) {
    throw error;
  }
}
