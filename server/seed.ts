import { storage } from "./storage";
import { MARKLAND_STRUCTURAL_SCHEMA } from "../client/src/lib/mock-data";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create management company
  const apex = await storage.createTenant({
    name: "Apex Management Solutions",
    type: "management_company",
    subdomain: "apex",
    managementCompanyId: null,
    isActive: true,
  });
  console.log("✅ Created management company:", apex.name);

  // Create communities
  const markland = await storage.createTenant({
    name: "Markland POA",
    type: "community",
    subdomain: "markland",
    managementCompanyId: apex.id,
    isActive: true,
  });
  console.log("✅ Created community:", markland.name);

  const whisperingPines = await storage.createTenant({
    name: "Whispering Pines HOA",
    type: "community",
    subdomain: "whispering-pines",
    managementCompanyId: apex.id,
    isActive: true,
  });
  console.log("✅ Created community:", whisperingPines.name);

  const oakRidge = await storage.createTenant({
    name: "Oak Ridge Estates",
    type: "community",
    subdomain: "oak-ridge",
    managementCompanyId: apex.id,
    isActive: true,
  });
  console.log("✅ Created community:", oakRidge.name);

  // Create Markland Structural Changes form template
  const marklandForm = await storage.createFormTemplate({
    tenantId: markland.id,
    name: "Structural Changes Additional Information",
    description: "Comprehensive structural modification application form for Markland POA with integrated design standards and guidelines",
    schema: MARKLAND_STRUCTURAL_SCHEMA,
    isActive: true,
  });
  console.log("✅ Created form template:", marklandForm.name);

  // Create a demo user
  const user = await storage.createUser({
    name: "Jane Doe",
    email: "jane@example.com",
    passwordHash: null,
  });
  console.log("✅ Created user:", user.name);

  // Assign user to Markland as homeowner
  await storage.assignUserRole({
    userId: user.id,
    tenantId: markland.id,
    role: "homeowner",
  });
  console.log("✅ Assigned user to Markland as homeowner");

  console.log("\n🎉 Database seeded successfully!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
