import { storage } from "./storage";

export async function seedWorkflowTemplates(tenantId: string) {
  // Check if templates already exist
  const existing = await storage.listWorkflowTemplatesForTenant(tenantId);
  if (existing.length > 0) return;

  const templates = [
    {
      tenantId,
      name: "Standard 3-Step Review",
      description: "Management Review → POA Board Review → Final Decision",
      steps: [
        { title: "Application Submitted", role: "system", actions: ["proceed"] },
        { title: "Management Review", role: "management", actions: ["approved", "rejected", "conditionally_approved"] },
        { title: "POA Board Review", role: "board", actions: ["approved", "rejected", "conditionally_approved"] },
        { title: "Final Decision", role: "system", actions: [] },
      ],
    },
    {
      tenantId,
      name: "Management + Board",
      description: "Management Pre-Screening → Board Approval → Homeowner Notification",
      steps: [
        { title: "Application Submitted", role: "system", actions: ["proceed"] },
        { title: "Management Pre-Screening", role: "management", actions: ["approved", "rejected"] },
        { title: "Board Review & Vote", role: "board", actions: ["approved", "rejected", "conditionally_approved"] },
        { title: "Homeowner Notification", role: "system", actions: [] },
      ],
    },
    {
      tenantId,
      name: "Management Only",
      description: "Management Single-Step Review",
      steps: [
        { title: "Application Submitted", role: "system", actions: ["proceed"] },
        { title: "Management Review", role: "management", actions: ["approved", "rejected", "conditionally_approved"] },
        { title: "Complete", role: "system", actions: [] },
      ],
    },
    {
      tenantId,
      name: "Extended Board Review",
      description: "Initial Review → Committee → Board → Final Approval",
      steps: [
        { title: "Application Submitted", role: "system", actions: ["proceed"] },
        { title: "Initial Screening", role: "management", actions: ["proceed", "rejected"] },
        { title: "Committee Review", role: "board_contributor", actions: ["proceed", "rejected"] },
        { title: "Board Approval", role: "board", actions: ["approved", "rejected", "conditionally_approved"] },
        { title: "Final Processing", role: "system", actions: [] },
      ],
    },
  ];

  for (const template of templates) {
    await storage.createWorkflowTemplate(template as any);
  }

  console.log(`Seeded ${templates.length} workflow templates for tenant ${tenantId}`);
}
