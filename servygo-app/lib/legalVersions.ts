export const LEGAL_VERSIONS = {
  terms: "regulamin_1.0",
  privacy: "polityka_prywatnosci_1.0",
  pricingNotice: "pricing_notice_1.0",
  liabilityNotice: "liability_notice_1.0",
  workshopPilot: "workshop_pilot_1.0",
} as const;

export type LegalVersionKey = keyof typeof LEGAL_VERSIONS;
export type LegalVersionValue = (typeof LEGAL_VERSIONS)[LegalVersionKey];
