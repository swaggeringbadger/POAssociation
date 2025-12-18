
import { Home, FileText, Settings, Users, Users2, LayoutDashboard, Building2, ShieldCheck, Building, TreePine, Sparkles, GitBranch, Calendar, Receipt, Mail, BookOpen } from "lucide-react";

// Types for our mockup
export type Role =
  | 'super_admin'
  | 'account_admin'
  | 'management_rep'
  | 'management_manager'
  | 'management_auxiliary'
  | 'poa_board_member'
  | 'poa_board_contributor'
  | 'homeowner'
  | 'delegated_rep';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  avatarUrl?: string;
}

export interface Tenant {
  id: string;
  name: string;
  type: 'management_company' | 'community';
  subdomain: string;
}

// Mock Data
export const MOCK_USER: User = {
  id: 'u1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  roles: ['account_admin', 'homeowner'], // Multi-role demonstration
};

export const TENANTS: Tenant[] = [
  { id: 't1', name: 'Apex Management Solutions', type: 'management_company', subdomain: 'apex' },
  { id: 't2', name: 'Whispering Pines HOA', type: 'community', subdomain: 'whispering-pines' },
  { id: 't3', name: 'Oak Ridge Estates', type: 'community', subdomain: 'oak-ridge' },
];

export const NAV_ITEMS = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    roles: ['homeowner', 'poa_board_contributor', 'poa_board_member', 'delegated_rep', 'management_rep', 'management_manager', 'management_auxiliary', 'account_admin', 'super_admin']
  },
  {
    label: 'Applications',
    icon: FileText,
    href: '/applications',
    roles: ['homeowner', 'poa_board_contributor', 'poa_board_member', 'delegated_rep', 'management_rep', 'management_manager', 'management_auxiliary', 'account_admin', 'super_admin']
  },
  {
    label: 'Submit Request',
    icon: FileText,
    href: '/apply',
    roles: ['homeowner', 'poa_board_contributor', 'poa_board_member']
  },
  {
    label: 'Directory',
    icon: Users,
    href: '/directory',
    roles: ['poa_board_contributor', 'poa_board_member', 'delegated_rep', 'management_rep', 'management_manager', 'account_admin', 'super_admin']
  },
  {
    label: 'Properties',
    icon: Building2,
    href: '/properties',
    roles: ['management_rep', 'management_manager', 'management_auxiliary', 'account_admin', 'super_admin']
  },
  {
    label: 'Team',
    icon: Users2,
    href: '/team',
    roles: ['management_manager', 'super_admin']
  },
  {
    label: 'Compliance',
    icon: ShieldCheck,
    href: '/compliance',
    roles: ['management_manager', 'super_admin']
  },
  {
    label: 'Calendar',
    icon: Calendar,
    href: '/calendar',
    roles: ['homeowner', 'poa_board_contributor', 'poa_board_member', 'management_rep', 'management_manager', 'account_admin', 'super_admin']
  },
  {
    label: 'Form Wizard',
    icon: Sparkles,
    href: '/form-wizard',
    roles: ['poa_board_member', 'management_manager', 'account_admin', 'super_admin']
  },
  {
    label: 'Workflows',
    icon: GitBranch,
    href: '/workflows',
    roles: ['account_admin', 'super_admin']
  },
  {
    label: 'Billing',
    icon: Receipt,
    href: '/billing',
    roles: ['account_admin', 'super_admin']
  },
  {
    label: 'Settings',
    icon: Settings,
    href: '/settings',
    roles: ['poa_board_member', 'management_manager', 'account_admin', 'super_admin']
  },
];

// Super Admin only navigation items
export const SUPER_ADMIN_NAV_ITEMS = [
  {
    label: 'AI Activity',
    icon: Sparkles,
    href: '/admin/ai-activity',
    roles: ['super_admin']
  },
  {
    label: 'Management Companies',
    icon: Building,
    href: '/admin/management-companies',
    roles: ['super_admin']
  },
  {
    label: 'Communities',
    icon: TreePine,
    href: '/admin/communities',
    roles: ['super_admin']
  },
  {
    label: 'Demo Codes',
    icon: ShieldCheck,
    href: '/admin/demo-codes',
    roles: ['super_admin']
  },
  {
    label: 'Email Templates',
    icon: Mail,
    href: '/admin/email-templates',
    roles: ['super_admin']
  },
  {
    label: 'Tour Content',
    icon: BookOpen,
    href: '/admin/tours',
    roles: ['super_admin']
  },
];

// Placeholder for the "Revolutionary Form Wizard" JSON structure
export const ARCH_REQUEST_FORM_SCHEMA = {
  title: "Architectural Modification Request",
  description: "Submit your plans for exterior modifications.",
  sections: [
    {
      id: "project_details",
      title: "Project Details",
      fields: [
        { id: "project_type", type: "select", label: "Project Type", options: ["Fence", "Painting", "Landscaping", "Addition", "Other"] },
        { id: "description", type: "textarea", label: "Detailed Description" },
        { id: "contractor", type: "text", label: "Contractor Name" }
      ]
    },
    {
      id: "documents",
      title: "Documentation",
      fields: [
        { id: "plat_map", type: "file", label: "Plat Map / Survey" },
        { id: "materials", type: "file", label: "Material Samples / Photos" }
      ]
    }
  ]
};

export const MARKLAND_STRUCTURAL_SCHEMA = {
  "title": "Structural Changes Additional Information - Markland POA",
  "description": "Please provide comprehensive details about your structural modification project. All structural changes require professional design and engineering oversight, plus Markland ARB approval prior to construction.",
  "relevantBylaws": {
    "primary": {
      "section": "Section 2 Application Review Process",
      "document": "Markland Design Standards and Guidelines (Revision 2021)",
      "summary": "No construction of any kind shall commence until applicants receive their final approval. All new construction must conform to the Markland Declaration of Covenants and Restrictions as well as all applicable governmental codes, ordinances, regulations, permits and laws. The ARB evaluates each proposed improvement application for total effect, including the manner in which the lot is developed.",
      "keyRequirements": [
        "Complete Design Review Application Form must be submitted",
        "Refundable Performance Deposit required (amount varies by project scope)",
        "Site Plan, Landscape Plan, and Architectural Plans required",
        "No site work can commence until site plan approved and builder meets with Developer representative onsite",
        "ARB approval required before any construction begins"
      ],
      "quote": "No construction of any kind shall commence until applicants receive their final approval. No site work can commence until a site plan has been approved and the builder has met with a representative of the Developer onsite."
    },
    "additionalReferences": [
      {
        "section": "Section 4.2 Construction Related Requirements",
        "document": "Design Standards and Guidelines",
        "summary": "Comprehensive construction hour restrictions, site access requirements, and construction activity standards",
        "keyProvisions": [
          "Construction hours comply with St. Johns County regulations",
          "Clean construction site maintenance required at all times",
          "Debris and trash removal with regular dumpster emptying",
          "All construction activities must be controlled within property boundaries"
        ]
      },
      {
        "section": "Section 6.2 General Architectural Standards",
        "document": "Design Standards and Guidelines", 
        "summary": "Building height, setback, and architectural consistency requirements for all structures",
        "keyProvisions": [
          "Maximum building height 35 feet from lowest point of finish grade",
          "No home shall exceed three stories including attic rooms",
          "Minimum setbacks per St. Johns County engineering plans and Southaven PUD",
          "Consistent architectural style required - no mixing of various styles within one home"
        ]
      }
    ]
  },
  "sections": [
    {
      "id": "project_scope",
      "title": "Project Scope and Design",
      "fields": [
        {
          "id": "structure_type",
          "label": "Primary Type of Structural Change",
          "type": "select",
          "required": true,
          "options": [
            "Single-Story Room Addition",
            "Two-Story Addition", 
            "Garage Addition/Expansion",
            "Garage Conversion to Living Space",
            "Covered Patio/Porch Addition",
            "Deck Addition (Attached)",
            "Basement/Lower Level Finishing",
            "Attic/Loft Conversion",
            "Interior Wall Removal (Load-bearing)",
            "Interior Wall Removal (Non-load-bearing)",
            "New Window/Door Opening in Exterior Wall",
            "Foundation Expansion/Modification",
            "Roof Line Changes/Dormers",
            "Second Story Addition",
            "Enclosed Breezeway/Connector",
            "Other Major Structural Modification"
          ],
          "description": "Select the primary type of structural modification being performed",
          "relevantBylaws": {
            "reference": "Section 6.2.1 Maximum Building Height and Stories",
            "requirement": "Maximum building height 35 feet, no home shall exceed three stories including attic rooms",
            "note": "All structural additions must comply with Markland height restrictions and architectural consistency requirements"
          }
        },
        {
          "id": "lot_type_classification",
          "label": "Markland Lot Type Classification",
          "type": "select",
          "required": true,
          "options": [
            "Conventional Lot - 93 ft Width",
            "Conventional Lot - 83 ft Width", 
            "Conventional Lot - 73 ft Width",
            "Conventional Lot - 63 ft Width",
            "Traditional Type 1 Lot (58 ft width with rear garage access)",
            "Traditional Type 2 Lot (73 ft width with rear garage)",
            "Lakefront Lot",
            "Back to Back Lot",
            "Conservation Lot",
            "Perimeter Lot - International Golf Parkway",
            "Corner Lot",
            "Unsure of lot classification"
          ],
          "description": "Lot type determines specific design requirements and restrictions",
          "relevantBylaws": {
            "reference": "Section 3 Lot Types and Section 6.2.5 Minimum/Maximum Home Square Footage",
            "requirement": "Different lot types have specific minimum/maximum square footage requirements and design standards",
            "note": "Lot classification affects setbacks, architectural requirements, and allowable square footage"
          }
        },
        {
          "id": "additional_work",
          "label": "Additional Work Included",
          "type": "checkbox",
          "required": false,
          "options": [
            "Electrical system upgrades",
            "Plumbing additions/modifications",
            "HVAC system expansion",
            "Kitchen renovation",
            "Bathroom addition",
            "Flooring installation",
            "Windows and doors",
            "Roofing work"
          ],
          "description": "Check any additional work being performed as part of this project"
        },
        {
          "id": "purpose_of_addition",
          "label": "Purpose/Use of New/Modified Space",
          "type": "textarea",
          "required": true,
          "placeholder": "Family room, master bedroom suite, home office, guest quarters, etc.",
          "description": "Describe the intended use of the new or modified space"
        },
        {
          "id": "square_footage_existing",
          "label": "Current Home Square Footage",
          "type": "number",
          "required": true,
          "placeholder": "Enter current square footage",
          "description": "Total existing living space square footage",
          "relevantBylaws": {
            "reference": "Section 6.2.5 Minimum and Maximum Home Square Footage",
            "requirement": "Each lot type has specific minimum and maximum square footage requirements",
            "note": "Addition cannot exceed maximum square footage limits for your lot type"
          }
        },
        {
          "id": "square_footage_addition",
          "label": "Square Footage Being Added",
          "type": "number",
          "required": true,
          "placeholder": "Enter additional square footage",
          "description": "Total new conditioned living space being added",
          "relevantBylaws": {
            "reference": "Section 6.2.5 Minimum and Maximum Home Square Footage",
            "requirement": "Total home size after addition must comply with lot-specific maximum square footage limits",
            "note": "73 ft lots: max 3,500 sf, 63 ft lots: max 3,200 sf, 58 ft lots: max 2,800 sf"
          }
        },
        {
          "id": "height_specifications",
          "label": "Height and Elevation Details",
          "type": "textarea",
          "required": true,
          "placeholder": "Ceiling heights, floor elevations, roof peak heights, etc.",
          "description": "Provide specific height measurements and elevation details",
          "relevantBylaws": {
            "reference": "Section 6.2.1 Maximum Building Height and Section 6.2.2 Finish Floor Elevation",
            "requirement": "Maximum height 35 feet measured from lowest point of finish grade. 2-step requirement for floor elevations",
            "note": "All finished floors must have one step from grade to porch, one additional step into home"
          }
        }
      ]
    },
    {
      "id": "construction_specs",
      "title": "Construction Specifications",
      "fields": [
        {
          "id": "foundation_type",
          "label": "Foundation Type",
          "type": "select",
          "required": true,
          "options": [
            "Concrete Slab on Grade",
            "Crawl Space with Block Foundation",
            "Full Basement Foundation",
            "Pier and Beam Foundation",
            "Stem Wall Foundation",
            "Attached to Existing Foundation",
            "Other Foundation Type"
          ],
          "description": "Type of foundation for the new construction",
          "relevantBylaws": {
            "reference": "Section 4.6 Earthwork and Drainage",
            "requirement": "Minimum exposed foundation shall be 18 inches, varies by lot type. Positive drainage required.",
            "note": "Foundation work must adhere to Neighborhood Grading and Drainage Plan"
          }
        },
        {
          "id": "framing_materials",
          "label": "Framing Materials",
          "type": "select",
          "required": true,
          "options": [
            "Wood Frame (2x4 studs)",
            "Wood Frame (2x6 studs)",
            "Steel Frame",
            "Concrete Block (CMU)",
            "Insulated Concrete Forms (ICF)",
            "Structural Insulated Panels (SIPs)",
            "Other Framing System"
          ],
          "description": "Primary framing materials and construction method"
        },
        {
          "id": "roofing_system",
          "label": "Roofing System",
          "type": "textarea",
          "required": true,
          "placeholder": "Roof structure, materials, pitch, drainage, etc.",
          "description": "Describe roofing structure, materials, and integration with existing roof",
          "relevantBylaws": {
            "reference": "Section 6.4.4 Roofs",
            "requirement": "Approved materials: Asphalt shingles (30-year minimum), concrete/clay tile, slate, standing seam metal. Minimum 6/12 slope.",
            "note": "All roof penetrations must be painted to match roof color. Roof style must be consistent with home."
          }
        },
        {
          "id": "exterior_materials",
          "label": "Exterior Finish Materials",
          "type": "textarea",
          "required": true,
          "placeholder": "Siding, brick, stucco, stone, trim materials, etc.",
          "description": "Describe all exterior finish materials and how they match existing home",
          "relevantBylaws": {
            "reference": "Section 6.4.8 Exterior Materials and Finishes",
            "requirement": "Approved materials: stucco, stone, tabby natural shell, brick, wood siding, Hardi-Plank. No vinyl or aluminum siding.",
            "note": "Dominant front elevation materials must wrap around all four sides. Two color minimum scheme required.",
            "quote": "All exterior finishes and all exterior color alterations must be reviewed and approved by ARB prior to installation."
          }
        },
        {
          "id": "structural_elements",
          "label": "Major Structural Elements",
          "type": "textarea",
          "required": true,
          "placeholder": "Beams, columns, load-bearing walls, footings, etc.",
          "description": "Detail key structural components and load-bearing elements"
        }
      ]
    },
    {
      "id": "site_planning",
      "title": "Site Planning and Compliance",
      "fields": [
        {
          "id": "lot_size",
          "label": "Total Lot Size",
          "type": "text",
          "required": true,
          "placeholder": "e.g., 0.25 acres or 10,890 sq ft",
          "description": "Total lot size in acres or square feet"
        },
        {
          "id": "setbacks_front",
          "label": "Front Setback Distance",
          "type": "text",
          "required": true,
          "placeholder": "Distance in feet from front property line",
          "description": "Distance from addition to front property line",
          "relevantBylaws": {
            "reference": "Section 6.2.4 Setbacks",
            "requirement": "Minimum front setback generally 20 feet from front lot line for conventional homes. ARB may require larger setbacks.",
            "note": "Must comply with St. Johns County engineering plans and Southaven PUD Zoning Ordinance"
          }
        },
        {
          "id": "setbacks_side",
          "label": "Side Setback Distances",
          "type": "text",
          "required": true,
          "placeholder": "Left: __ feet, Right: __ feet",
          "description": "Distance from addition to both side property lines",
          "relevantBylaws": {
            "reference": "Section 6.2.4 Setbacks and Section 7.6 Site Walls & Terraces",
            "requirement": "Must comply with minimum setbacks per approved engineering plans. No site wall within 3 feet of property line.",
            "note": "Corner lots have additional side facade design requirements when facing a street"
          }
        },
        {
          "id": "setbacks_rear",
          "label": "Rear Setback Distance",
          "type": "text",
          "required": true,
          "placeholder": "Distance in feet from rear property line",
          "description": "Distance from addition to rear property line"
        },
        {
          "id": "lot_coverage_current",
          "label": "Current Lot Coverage Percentage",
          "type": "number",
          "required": true,
          "placeholder": "Enter current percentage",
          "description": "Current percentage of lot covered by structures"
        },
        {
          "id": "lot_coverage_proposed",
          "label": "Proposed Lot Coverage Percentage",
          "type": "number",
          "required": true,
          "placeholder": "Enter proposed percentage",
          "description": "Total lot coverage percentage after addition"
        },
        {
          "id": "height_restrictions",
          "label": "Height Restriction Compliance",
          "type": "radio",
          "required": true,
          "options": [
            "Complies with all height restrictions",
            "Requires height variance",
            "Under review with building department",
            "Unsure of height requirements"
          ],
          "description": "Does the addition comply with local height restrictions?",
          "relevantBylaws": {
            "reference": "Section 6.2.1 Maximum Building Height and Stories",
            "requirement": "Maximum 35 feet from lowest point of finish grade, no more than three stories including attic rooms",
            "note": "Height restrictions are strictly enforced - ARB will not approve structures exceeding limits"
          }
        }
      ]
    },
    {
      "id": "professional_team",
      "title": "Professional Team and Documentation",
      "fields": [
        {
          "id": "architect_required",
          "label": "Is an architect required for this project?",
          "type": "radio",
          "required": true,
          "options": ["Yes - architect retained", "Yes - architect being selected", "No - not required", "Unsure"],
          "description": "Many structural additions require architectural design",
          "relevantBylaws": {
            "reference": "Section 2.5 Architectural Plans",
            "requirement": "Accurate, scaled architectural drawings required with floor plans, all exterior elevations, materials, and design details",
            "note": "ARB evaluates applications for total effect and aesthetic impact"
          }
        },
        {
          "id": "general_contractor",
          "label": "General Contractor",
          "type": "text",
          "required": true,
          "placeholder": "ABC Construction Company",
          "description": "Name of licensed general contractor performing the work"
        },
        {
          "id": "contractor_insurance",
          "label": "Contractor Insurance Coverage",
          "type": "textarea",
          "required": true,
          "placeholder": "General liability: $X, Workers comp: $Y, Carrier: XYZ Insurance",
          "description": "Contractor insurance details including liability and workers compensation"
        }
      ]
    },
    {
      "id": "arb_requirements",
      "title": "ARB Application Requirements",
      "fields": [
        {
          "id": "arb_application_status",
          "label": "ARB Application Status",
          "type": "select",
          "required": true,
          "options": [
            "Not yet submitted",
            "Application in preparation",
            "Application submitted - under review",
            "Additional information requested by ARB",
            "ARB approval received",
            "ARB approval with conditions"
          ],
          "description": "Current status of Markland ARB application",
          "relevantBylaws": {
            "reference": "Section 2.1 New Construction",
            "requirement": "Required information must be submitted in its entirety to the ARB prior to any review, construction and/or purchase of materials",
            "note": "ARB approval is mandatory before any construction begins"
          }
        },
        {
          "id": "performance_deposit",
          "label": "Performance Deposit Status",
          "type": "radio",
          "required": true,
          "options": [
            "Deposit amount confirmed and posted", 
            "Deposit amount determined - payment pending",
            "Awaiting deposit amount determination",
            "Not yet addressed"
          ],
          "description": "Refundable performance deposit required for all construction",
          "relevantBylaws": {
            "reference": "Section 2.2 Application Form & Fees",
            "requirement": "Refundable Performance Deposit required - checks made payable to Markland POA. Deposit amounts posted on Design Review Application Form.",
            "note": "Performance deposit refunded upon successful completion and compliance verification"
          }
        },
        {
          "id": "pre_construction_meeting",
          "label": "Pre-Construction Site Meeting",
          "type": "radio",
          "required": true,
          "options": [
            "Meeting completed",
            "Meeting scheduled",
            "Awaiting ARB approval to schedule",
            "Not yet scheduled"
          ],
          "description": "Required onsite meeting with Developer representative",
          "relevantBylaws": {
            "reference": "Section 2 Application Review Process",
            "requirement": "No site work can commence until site plan approved and builder has met with a representative of the Developer onsite",
            "note": "Mandatory coordination meeting required before any construction activities begin"
          }
        }
      ]
    },
    {
      "id": "permits",
      "title": "Permits and Approvals",
      "fields": [
        {
          "id": "building_permit_status",
          "label": "Building Permit Status",
          "type": "select",
          "required": true,
          "options": [
            "Will apply after HOA approval",
            "Application submitted - under review",
            "Permit approved - not yet issued",
            "Permit in hand",
            "Multiple permits required - in process"
          ],
          "description": "Current status of required building permits"
        },
        {
          "id": "variance_required",
          "label": "Zoning Variance or Special Approval Required",
          "type": "radio",
          "required": true,
          "options": ["No variance needed", "Variance application submitted", "Variance approved", "Variance required but not yet applied"],
          "description": "Does this project require any zoning variances or special approvals?"
        }
      ]
    },
    {
      "id": "timeline",
      "title": "Timeline and Construction Management",
      "fields": [
        {
          "id": "construction_start_date",
          "label": "Planned Construction Start Date",
          "type": "date",
          "required": true,
          "description": "When do you plan to begin construction?",
          "relevantBylaws": {
            "reference": "Section 4.2.1 Construction Hours",
            "requirement": "Construction hours shall comply with St. Johns County regulations. Developer and Association reserve right to limit weekend and holiday hours.",
            "note": "No construction may begin until ARB final approval and pre-construction meeting completed"
          }
        }
      ]
    }
  ]
};
