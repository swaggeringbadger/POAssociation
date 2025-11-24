/**
 * Seed Form Configurations
 *
 * Creates initial form templates for all 6 project types
 * Based on the reference architecture from the single-community app
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { formTemplates, tenants } from '@shared/schema';
import type { AdditionalInfoConfig } from '@shared/additionalInfoTypes';
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle({ client: pool });

/**
 * Form configurations for each project type
 */
const formConfigs: Record<string, AdditionalInfoConfig> = {
  'exterior-modifications': {
    title: "Exterior Modifications Application",
    description: "Provide detailed information about your exterior modification project",
    sections: [
      {
        title: "Project Scope",
        fields: [
          {
            id: "modification_type",
            label: "Type of Modification",
            type: "select",
            required: true,
            options: [
              "Paint/Stain Color Change",
              "Siding Replacement",
              "Window Replacement",
              "Door Replacement",
              "Roofing",
              "Trim/Shutters",
              "Other"
            ],
            description: "Select the primary type of exterior modification"
          },
          {
            id: "colors",
            label: "Color Selections",
            type: "textarea",
            required: true,
            placeholder: "e.g., Main: Sherwin Williams SW7023 Requisite Gray, Trim: SW7005 Pure White",
            description: "Provide color names and codes for all exterior changes",
            relevantBylaws: {
              primary: "All exterior colors must be submitted for approval and should complement the existing neighborhood aesthetic.",
              additionalReferences: ["Color Palette Guidelines - Section 3.2"]
            }
          },
          {
            id: "materials",
            label: "Materials",
            type: "textarea",
            required: true,
            placeholder: "Describe materials, brands, and specifications",
            description: "Detail all materials to be used including manufacturer and model numbers"
          }
        ]
      },
      {
        title: "Timeline",
        fields: [
          {
            id: "start_date",
            label: "Estimated Start Date",
            type: "date",
            required: true,
            description: "When do you plan to begin work?"
          },
          {
            id: "completion_date",
            label: "Estimated Completion Date",
            type: "date",
            required: true,
            description: "When do you expect the project to be completed?"
          }
        ]
      }
    ],
    required_documents: [
      "Color samples or swatches",
      "Material specifications sheets",
      "Photos of current condition",
      "Contractor information (if applicable)"
    ],
    scoring_weights: {
      modification_type: 15,
      colors: 25,
      materials: 25,
      start_date: 15,
      completion_date: 20
    }
  },

  'structural-changes': {
    title: "Structural Changes Application",
    description: "Provide detailed information about your structural modification project",
    sections: [
      {
        title: "Project Scope",
        fields: [
          {
            id: "project_type_sub",
            label: "Type of Structural Change",
            type: "select",
            required: true,
            options: [
              "Addition",
              "Deck/Porch Extension",
              "Garage Modification",
              "Foundation Work",
              "Other"
            ],
            description: "Select the primary type of structural work",
            relevantBylaws: {
              primary: "Section 3.1 - Structural Modifications must comply with local building codes and receive HOA approval before construction begins.",
              additionalReferences: [
                "Section 4.2 - Setback Requirements",
                "Section 5.1 - Architectural Standards"
              ]
            }
          },
          {
            id: "square_footage",
            label: "Total Square Footage",
            type: "number",
            required: true,
            placeholder: "Enter square footage",
            description: "Total square footage of the new structure or addition"
          },
          {
            id: "timeline",
            label: "Project Timeline",
            type: "textarea",
            required: true,
            placeholder: "Describe project duration, phases, etc.",
            description: "Expected start date, duration, and any phases"
          }
        ]
      },
      {
        title: "Design & Specifications",
        fields: [
          {
            id: "architectural_plans",
            label: "Will you provide architectural plans?",
            type: "radio",
            required: true,
            options: ["Yes", "No"],
            description: "Professional architectural drawings are required for most structural changes"
          },
          {
            id: "materials",
            label: "Primary Materials",
            type: "checkbox",
            required: true,
            options: [
              "Wood Framing",
              "Steel Framing",
              "Concrete",
              "Vinyl Siding",
              "Fiber Cement",
              "Brick/Masonry"
            ],
            description: "Select all materials that will be used"
          },
          {
            id: "color_selection",
            label: "Exterior Color",
            type: "text",
            required: false,
            placeholder: "e.g., Beige #D4A574",
            description: "If known, provide color name and code",
            relevantBylaws: "Color must complement existing neighborhood palette"
          }
        ]
      }
    ],
    required_documents: [
      "Architectural plans or detailed drawings",
      "Material specifications and color samples",
      "Site plan showing location and setbacks",
      "Contractor license and insurance",
      "Timeline and construction schedule"
    ],
    scoring_weights: {
      project_type_sub: 10,
      square_footage: 15,
      timeline: 10,
      architectural_plans: 20,
      materials: 15,
      color_selection: 5
    }
  },

  'landscaping': {
    title: "Landscaping Application",
    description: "Provide details about your landscaping project",
    sections: [
      {
        title: "Project Details",
        fields: [
          {
            id: "project_type",
            label: "Type of Landscaping Work",
            type: "checkbox",
            required: true,
            options: [
              "Tree Removal",
              "Tree Planting",
              "Garden Installation",
              "Irrigation System",
              "Hardscaping (Walkways/Patios)",
              "Lawn Renovation",
              "Other"
            ],
            description: "Select all that apply"
          },
          {
            id: "tree_details",
            label: "Tree Information",
            type: "textarea",
            required: false,
            placeholder: "Specify types, sizes, and locations of trees",
            description: "Required if planting or removing trees",
            relevantBylaws: "Trees over 6 inches in diameter require special approval for removal"
          },
          {
            id: "hardscaping_details",
            label: "Hardscaping Materials",
            type: "textarea",
            required: false,
            placeholder: "Describe materials for walkways, patios, retaining walls, etc.",
            description: "Include materials, dimensions, and locations"
          }
        ]
      },
      {
        title: "Timeline & Maintenance",
        fields: [
          {
            id: "start_date",
            label: "Project Start Date",
            type: "date",
            required: true,
            description: "When will work begin?"
          },
          {
            id: "maintenance_plan",
            label: "Maintenance Plan",
            type: "textarea",
            required: false,
            placeholder: "Describe how you will maintain the landscaping",
            description: "Ongoing maintenance responsibilities"
          }
        ]
      }
    ],
    required_documents: [
      "Site plan or sketch",
      "Plant list with species and sizes",
      "Photos of current area",
      "Contractor information (if applicable)"
    ],
    scoring_weights: {
      project_type: 20,
      tree_details: 15,
      hardscaping_details: 15,
      start_date: 20,
      maintenance_plan: 10
    }
  },

  'fencing': {
    title: "Fencing & Barriers Application",
    description: "Provide information about your fence or barrier installation",
    sections: [
      {
        title: "Fence Specifications",
        fields: [
          {
            id: "fence_type",
            label: "Type of Fence/Barrier",
            type: "select",
            required: true,
            options: [
              "Privacy Fence",
              "Decorative Fence",
              "Pool Barrier",
              "Retaining Wall",
              "Gate",
              "Other"
            ],
            description: "Select the type of fence or barrier",
            relevantBylaws: "All fences must comply with height restrictions and setback requirements"
          },
          {
            id: "height",
            label: "Height (in feet)",
            type: "number",
            required: true,
            placeholder: "e.g., 6",
            description: "Maximum height of fence or barrier",
            relevantBylaws: "Most fences limited to 6 feet in height"
          },
          {
            id: "length",
            label: "Total Length (in feet)",
            type: "number",
            required: true,
            placeholder: "e.g., 150",
            description: "Total linear feet of fencing"
          },
          {
            id: "material",
            label: "Material",
            type: "select",
            required: true,
            options: [
              "Wood",
              "Vinyl/PVC",
              "Chain Link",
              "Wrought Iron",
              "Composite",
              "Stone/Brick",
              "Other"
            ],
            description: "Primary fence material"
          },
          {
            id: "color",
            label: "Color/Finish",
            type: "text",
            required: true,
            placeholder: "e.g., Natural cedar, White vinyl",
            description: "Color or finish of fence"
          }
        ]
      },
      {
        title: "Location",
        fields: [
          {
            id: "location_description",
            label: "Fence Location",
            type: "textarea",
            required: true,
            placeholder: "Describe where the fence will be installed",
            description: "Include property boundaries, setbacks, and any relevant landmarks"
          }
        ]
      }
    ],
    required_documents: [
      "Site plan showing fence location",
      "Material samples or specifications",
      "Photos of installation area",
      "Survey or property plat (if near boundaries)"
    ],
    scoring_weights: {
      fence_type: 15,
      height: 15,
      length: 10,
      material: 20,
      color: 15,
      location_description: 25
    }
  },

  'outdoor-structures': {
    title: "Outdoor Structures Application",
    description: "Provide details about your outdoor structure project",
    sections: [
      {
        title: "Structure Information",
        fields: [
          {
            id: "structure_type",
            label: "Type of Structure",
            type: "select",
            required: true,
            options: [
              "Storage Shed",
              "Gazebo",
              "Pergola",
              "Swimming Pool",
              "Hot Tub/Spa",
              "Outdoor Kitchen",
              "Playhouse",
              "Other"
            ],
            description: "Select the type of outdoor structure",
            relevantBylaws: "Outdoor structures require approval and must meet setback requirements"
          },
          {
            id: "dimensions",
            label: "Dimensions",
            type: "text",
            required: true,
            placeholder: "e.g., 10' x 12' x 8' height",
            description: "Provide length, width, and height"
          },
          {
            id: "square_footage",
            label: "Square Footage",
            type: "number",
            required: true,
            placeholder: "e.g., 120",
            description: "Total square footage of structure footprint"
          },
          {
            id: "materials",
            label: "Construction Materials",
            type: "textarea",
            required: true,
            placeholder: "Describe materials, finishes, colors",
            description: "Include all materials and finishes"
          }
        ]
      },
      {
        title: "Location & Installation",
        fields: [
          {
            id: "location",
            label: "Structure Location",
            type: "textarea",
            required: true,
            placeholder: "Describe location on property",
            description: "Include distance from property lines and existing structures"
          },
          {
            id: "foundation",
            label: "Foundation Type",
            type: "select",
            required: true,
            options: [
              "Concrete Slab",
              "Pier/Post",
              "Gravel Base",
              "None (portable)",
              "Other"
            ],
            description: "Type of foundation or base"
          },
          {
            id: "utilities",
            label: "Utilities Required",
            type: "checkbox",
            required: false,
            options: [
              "Electrical",
              "Plumbing",
              "Gas",
              "None"
            ],
            description: "Select any utilities needed"
          }
        ]
      }
    ],
    required_documents: [
      "Detailed plans or manufacturer specifications",
      "Site plan showing structure location",
      "Material and color samples",
      "Photos of proposed location",
      "Contractor information (if applicable)"
    ],
    scoring_weights: {
      structure_type: 15,
      dimensions: 15,
      square_footage: 10,
      materials: 20,
      location: 20,
      foundation: 10,
      utilities: 10
    }
  },

  'signage': {
    title: "Signage Application",
    description: "Provide information about your proposed signage",
    sections: [
      {
        title: "Sign Details",
        fields: [
          {
            id: "sign_type",
            label: "Type of Sign",
            type: "select",
            required: true,
            options: [
              "Address Marker",
              "Decorative Sign",
              "Security/Warning Sign",
              "Home Business Sign",
              "For Sale/Rent Sign",
              "Other"
            ],
            description: "Select the type of sign",
            relevantBylaws: "Commercial signage is restricted; decorative and address signs permitted with approval"
          },
          {
            id: "dimensions",
            label: "Sign Dimensions",
            type: "text",
            required: true,
            placeholder: "e.g., 12\" x 18\"",
            description: "Width and height of sign"
          },
          {
            id: "material",
            label: "Sign Material",
            type: "select",
            required: true,
            options: [
              "Wood",
              "Metal",
              "Plastic/Vinyl",
              "Stone/Masonry",
              "Other"
            ],
            description: "Primary material of sign"
          },
          {
            id: "text_content",
            label: "Sign Text/Content",
            type: "textarea",
            required: true,
            placeholder: "Describe text, graphics, or design elements",
            description: "What will the sign say or display?"
          },
          {
            id: "illuminated",
            label: "Will the sign be illuminated?",
            type: "radio",
            required: true,
            options: ["Yes", "No"],
            description: "Illuminated signs may require additional approval",
            relevantBylaws: "Illuminated signs must be tasteful and not create light pollution"
          }
        ]
      },
      {
        title: "Location",
        fields: [
          {
            id: "location",
            label: "Sign Location",
            type: "textarea",
            required: true,
            placeholder: "Describe where sign will be placed",
            description: "Include mounting method (post, wall, ground, etc.)"
          }
        ]
      }
    ],
    required_documents: [
      "Design mockup or photo of proposed sign",
      "Dimensions diagram",
      "Photo of proposed location"
    ],
    scoring_weights: {
      sign_type: 20,
      dimensions: 15,
      material: 15,
      text_content: 20,
      illuminated: 10,
      location: 20
    }
  }
};

async function seedFormConfigs() {
  console.log('Starting form configuration seed...\n');

  try {
    // Get Markland POA tenant
    const [marklandTenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.subdomain, 'markland'))
      .limit(1);

    if (!marklandTenant) {
      console.error('❌ Markland POA tenant not found. Please run the main seed script first.');
      process.exit(1);
    }

    console.log(`✓ Found tenant: ${marklandTenant.name} (${marklandTenant.id})\n`);

    // Create form template for each project type
    for (const [projectType, config] of Object.entries(formConfigs)) {
      console.log(`Creating form template for: ${projectType}`);

      const formTemplate = {
        tenantId: marklandTenant.id,
        projectType,
        version: 1,
        name: config.title,
        description: config.description,
        schema: config as any, // JSONB field
        isActive: true,
        createdByUserId: null, // System-created
        activatedAt: new Date(),
        activatedByUserId: null,
      };

      const [created] = await db
        .insert(formTemplates)
        .values(formTemplate)
        .returning();

      console.log(`  ✓ Created: ${created.name} (v${created.version})`);
    }

    console.log('\n✅ Form configuration seed completed successfully!');
    console.log(`\nCreated ${Object.keys(formConfigs).length} form templates for Markland POA:`);
    Object.keys(formConfigs).forEach(type => {
      console.log(`  - ${type}`);
    });

  } catch (error) {
    console.error('\n❌ Error seeding form configurations:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the seed
seedFormConfigs().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
