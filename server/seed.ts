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
    communitySettings: {
      legalEntityType: "poa",
      legalEntityName: "Markland Property Owners Association, Inc.",
      contactEmail: "arc@marklandpoa.org",
      contactPhone: "(555) 867-5309",
      officeHours: "Mon–Fri, 9:00 AM – 5:00 PM",
      emergencyPhone: "(555) 867-5310",
      description: "A vibrant residential community with 312 homes, established in 1998. Markland POA is committed to preserving property values and fostering a welcoming neighborhood.",
      website: "https://info.marklandpoa.org",
      yearEstablished: 1998,
      numberOfLots: 312,
      physicalAddress: { street: "4200 Markland Blvd", city: "Statesville", state: "NC", zip: "28677" },
      mailingAddress: { street: "PO Box 4200", city: "Statesville", state: "NC", zip: "28677" },
    },
  });
  console.log("✅ Created community:", markland.name);

  const whisperingPines = await storage.createTenant({
    name: "Whispering Pines HOA",
    type: "community",
    subdomain: "whispering-pines",
    managementCompanyId: apex.id,
    isActive: true,
    communitySettings: {
      legalEntityType: "hoa",
      legalEntityName: "Whispering Pines Homeowners Association",
      contactEmail: "info@whisperingpineshoa.org",
      contactPhone: "(555) 234-5678",
      officeHours: "Tue–Thu, 10:00 AM – 4:00 PM",
      description: "A peaceful, wooded community of 148 homes nestled among longleaf pines.",
      website: "https://whisperingpineshoa.org",
      yearEstablished: 2005,
      numberOfLots: 148,
      physicalAddress: { street: "100 Pine Hollow Dr", city: "Southern Pines", state: "NC", zip: "28387" },
    },
  });
  console.log("✅ Created community:", whisperingPines.name);

  const oakRidge = await storage.createTenant({
    name: "Oak Ridge Estates",
    type: "community",
    subdomain: "oak-ridge",
    managementCompanyId: apex.id,
    isActive: true,
    communitySettings: {
      legalEntityType: "poa",
      legalEntityName: "Oak Ridge Estates Property Owners Association",
      contactEmail: "board@oakridgeestates.org",
      contactPhone: "(555) 345-6789",
      officeHours: "Mon, Wed, Fri, 9:00 AM – 1:00 PM",
      description: "An upscale gated community with 96 estate lots and a championship golf course.",
      yearEstablished: 2012,
      numberOfLots: 96,
      physicalAddress: { street: "1 Oak Ridge Pkwy", city: "Mooresville", state: "NC", zip: "28117" },
    },
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

  console.log("\n🎉 Database seeded successfully!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
