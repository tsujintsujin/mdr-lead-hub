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

// Readable values for form answers (same wording n8n uses in Slack and email).
export const ANSWER_VALUE: Record<string, Record<string, string>> = {
  "practice_type": {
    "chiropractic": "Chiropractic",
    "physical_therapy": "Physical therapy",
    "med_spa": "Med spa",
    "dental": "Dental",
    "massage_wellness": "Massage or wellness",
    "other_health": "Another kind of practice"
  },
  "goals": {
    "new_patients": "More new patients",
    "rank_google": "Higher on Google",
    "run_ads": "Google or Facebook ads",
    "new_website": "A new website",
    "reviews": "More reviews",
    "donors": "More donors",
    "volunteers": "More volunteers",
    "signups": "More program signups",
    "awareness": "More awareness"
  },
  "locations": {
    "1": "One location",
    "2_3": "Two or three locations",
    "4_plus": "Four or more locations"
  },
  "budget": {
    "under_500": "Under $500/mo",
    "500_1500": "$500–1,500/mo",
    "1500_5000": "$1,500–5,000/mo",
    "5000_plus": "Over $5,000/mo",
    "unsure": "Budget not set"
  },
  "timeline": {
    "asap": "Wants to start ASAP",
    "quarter": "Next three months",
    "exploring": "Just looking"
  },
  "nonprofit_status": {
    "yes": "501(c)(3): yes",
    "pending": "501(c)(3): applied",
    "no": "501(c)(3): no",
    "unsure": "501(c)(3): not sure"
  },
  "mission": {
    "human_services": "Human services",
    "education_programs": "Education programs",
    "health_programs": "Health programs",
    "arts_culture": "Arts and culture",
    "environment_animals": "Environment or animals",
    "community": "Community development",
    "religious": "Faith-based",
    "hospital_school_gov": "Hospital, school or government",
    "other": "Other mission"
  },
  "grant_status": {
    "no": "No Ad Grants yet",
    "underused": "Has Ad Grants, barely used",
    "active": "Has Ad Grants, running well"
  },
  "staff": {
    "volunteers": "All volunteers",
    "1_5": "1–5 staff",
    "6_25": "6–25 staff",
    "26_plus": "26+ staff"
  }
};
