// Labels shared by server and browser code (no database imports here).
export const STAGES = ["new", "contacted", "booked", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export const VERDICTS = ["hot", "warm", "talk", "not_fit", "spam"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const STAGE_LABEL: Record<Stage, string> = { new: "New", contacted: "Contacted", booked: "Booked", won: "Won", lost: "Lost" };
export const VERDICT_LABEL: Record<Verdict, string> = { hot: "Hot", warm: "Warm", talk: "Needs a conversation", not_fit: "Not a fit", spam: "Spam" };
export const SEGMENT_LABEL: Record<string, string> = {
  healthcare_wellness: "Healthcare and wellness", home_services: "Home services", nonprofit: "Nonprofit",
  professional_services: "Professional services", retail_ecommerce: "Retail and e-commerce",
  restaurant_hospitality: "Restaurants and hospitality", other: "Other",
};
