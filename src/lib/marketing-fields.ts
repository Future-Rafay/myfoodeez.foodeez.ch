// Safe to import in client components (the editor); lib/marketing.ts uses Node modules.
export const MERGE_FIELDS = [
  { token: "{{restaurant_name}}", label: "Restaurant name" },
  { token: "{{town}}", label: "Town" },
  { token: "{{claim_url}}", label: "Claim link" },
  { token: "{{email}}", label: "Email" },
] as const;
