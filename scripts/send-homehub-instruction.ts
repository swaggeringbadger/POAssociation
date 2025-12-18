/**
 * Script to send developer instruction to HomeHub (Hazel Hippo)
 * Run with: npx tsx scripts/send-homehub-instruction.ts
 */

import { sendDeveloperInstruction } from "../server/sync/client";

const instruction = {
  title: "API Request: Sponsorship Information by Zip Code",
  category: "api_request" as const,
  priority: "medium" as const,
  requestedBy: "POA Association Team",
  description: `
# Sponsorship Information API Request

POA Association needs to include Hazel Hippo sponsorship information in email templates for cross-marketing purposes.

## Use Cases
- Household member invitation emails
- Contractor invitation emails
- Contractor referral notification emails
- General transactional emails to POA/HOA members

## Requested Endpoint

### GET /api/sponsorship/by-zip/:zipCode

Returns sponsorship information for a given zip code so POA can include relevant local sponsor messaging in emails.

### Request
\`\`\`
GET /api/sponsorship/by-zip/75001
Authorization: Bearer <inter-app-token>
X-Requesting-App: poa-association
\`\`\`

### Response Contract

\`\`\`typescript
interface SponsorshipResponse {
  success: boolean;
  data: {
    // Sponsor identification
    sponsorId: string;
    sponsorName: string;

    // Display information for emails
    displayName: string;           // e.g., "Hazel Hippo Dallas"
    tagline: string | null;        // e.g., "Your Local Home Services Hub"
    logoUrl: string | null;        // URL to sponsor logo for email headers

    // Contact/links
    websiteUrl: string | null;     // Sponsor's Hazel Hippo landing page
    contactEmail: string | null;

    // Coverage info
    coverageArea: string;          // e.g., "Dallas-Fort Worth Metro Area"

    // Marketing content for emails
    emailBanner: {
      imageUrl: string | null;     // Banner image for email footer
      altText: string;
      linkUrl: string;             // Where banner clicks go (include UTM params)
    } | null;

    // Promotional messaging
    promoMessage: string | null;   // e.g., "Get 10% off your first service!"
    promoCode: string | null;      // e.g., "WELCOME10"
    promoExpiresAt: string | null; // ISO date

    // Feature flags
    isActive: boolean;
    allowEmailMarketing: boolean;  // Whether sponsor allows inclusion in emails
  } | null;

  // Fallback if no sponsor for this zip
  fallback: {
    useGenericBranding: boolean;
    genericMessage: string;        // Generic Hazel Hippo message
    genericLogoUrl: string;
    genericWebsiteUrl: string;     // Include UTM: ?utm_source=poa&utm_medium=email
  } | null;
}
\`\`\`

### Example Response (With Sponsor)
\`\`\`json
{
  "success": true,
  "data": {
    "sponsorId": "sponsor_abc123",
    "sponsorName": "DFW Home Services LLC",
    "displayName": "Hazel Hippo Dallas",
    "tagline": "Your Trusted Home Services Partner",
    "logoUrl": "https://hazelhippo.com/sponsors/dfw/logo.png",
    "websiteUrl": "https://dallas.hazelhippo.com",
    "contactEmail": "dallas@hazelhippo.com",
    "coverageArea": "Dallas-Fort Worth Metro Area",
    "emailBanner": {
      "imageUrl": "https://hazelhippo.com/sponsors/dfw/email-banner.png",
      "altText": "Hazel Hippo Dallas - Find Local Home Services",
      "linkUrl": "https://dallas.hazelhippo.com?utm_source=poa&utm_medium=email"
    },
    "promoMessage": "POA members get 10% off their first booking!",
    "promoCode": "POA10",
    "promoExpiresAt": "2026-03-31T23:59:59Z",
    "isActive": true,
    "allowEmailMarketing": true
  },
  "fallback": null
}
\`\`\`

### Example Response (No Sponsor)
\`\`\`json
{
  "success": true,
  "data": null,
  "fallback": {
    "useGenericBranding": true,
    "genericMessage": "Find trusted home service professionals in your area",
    "genericLogoUrl": "https://hazelhippo.com/assets/logo.png",
    "genericWebsiteUrl": "https://hazelhippo.com?utm_source=poa&utm_medium=email"
  }
}
\`\`\`

## Authentication
Will use existing inter-app sync protocol with shared secret.

## Implementation Notes
1. POA will cache responses for 24 hours
2. Always provide fallback generic branding if no sponsor
3. Include UTM parameters for tracking POA referrals
4. Rate limit: 100 requests/minute suggested

## Questions
1. Is there existing sponsor coverage data to reference?
2. Any legal/compliance requirements for sponsor messaging?
3. Preferred timeline for implementation?
`,
  context: {
    requestDate: new Date().toISOString(),
    poaVersion: "1.0",
    intendedUse: "email_templates",
    emailTypes: [
      "household_member_invitation",
      "contractor_invitation",
      "contractor_referral_notification",
      "transactional_emails"
    ]
  }
};

async function main() {
  console.log("Sending developer instruction to HomeHub...");
  console.log("Title:", instruction.title);
  console.log("Category:", instruction.category);
  console.log("Priority:", instruction.priority);
  console.log("");

  const result = await sendDeveloperInstruction(instruction);

  if (result.success) {
    console.log("✓ Instruction sent successfully!");
    console.log("  Instruction ID:", result.data?.instructionId);
    console.log("  Acknowledged:", result.data?.acknowledged);
  } else {
    console.log("✗ Failed to send instruction");
    console.log("  Error:", result.error);

    // If sync isn't configured, show the instruction content for manual reference
    if (result.error?.includes("not configured")) {
      console.log("\n--- Instruction Content (for manual reference) ---");
      console.log(JSON.stringify(instruction, null, 2));
    }
  }
}

main().catch(console.error);
