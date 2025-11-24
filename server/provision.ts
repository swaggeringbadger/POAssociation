import { storage } from "./storage";
import { MARKLAND_STRUCTURAL_SCHEMA, ARCH_REQUEST_FORM_SCHEMA } from "../client/src/lib/mock-data";
import type { Tenant, User, FormTemplate, Application, UserTenantRole } from "@shared/schema";

interface DemoEcosystem {
  managementCompany: Tenant;
  communities: Tenant[];
  users: User[];
  formTemplates: FormTemplate[];
  applications: Application[];
  userTenantRoles: UserTenantRole[];
}

/**
 * Provisions a complete, isolated demo ecosystem for a demo code
 * Creates: 1 management company, 2 communities, 4 users, 4 forms, 30+ applications
 */
export async function provisionDemoEcosystem(demoCodeId: string): Promise<DemoEcosystem> {
  console.log(`🌱 Provisioning demo ecosystem for code: ${demoCodeId}`);

  try {
    // Generate unique suffix for subdomains
    const suffix = demoCodeId.slice(-8);

    // 1. Create Management Company
    console.log('Creating management company...');
    const managementCompany = await storage.createTenant({
      name: 'Apex Management Solutions',
      type: 'management_company',
      subdomain: `apex-${suffix}`,
      managementCompanyId: null,
      isActive: true,
      demoCodeId,
    });
    console.log('✅ Created management company:', managementCompany.name);

    // 2. Create Communities
    console.log('Creating communities...');
    const markland = await storage.createTenant({
      name: 'Markland POA',
      type: 'community',
      subdomain: `markland-${suffix}`,
      managementCompanyId: managementCompany.id,
      isActive: true,
      demoCodeId,
    });

    const whisperingPines = await storage.createTenant({
      name: 'Whispering Pines HOA',
      type: 'community',
      subdomain: `whispering-pines-${suffix}`,
      managementCompanyId: managementCompany.id,
      isActive: true,
      demoCodeId,
    });
    console.log('✅ Created 2 communities');

    const communities = [markland, whisperingPines];

    // 3. Create Demo Users
    console.log('Creating demo users...');
    const demoUsers = await Promise.all([
      // Emily - Management Manager
      storage.upsertUser({
        id: `${demoCodeId}-user-manager`,
        email: `demo-manager-${suffix}@poassociation.com`,
        firstName: 'Emily',
        lastName: 'Foster',
        profileImageUrl: null,
        demoCodeId,
      }),
      // Sarah - Board Member
      storage.upsertUser({
        id: `${demoCodeId}-user-board`,
        email: `demo-board-${suffix}@poassociation.com`,
        firstName: 'Sarah',
        lastName: 'Chen',
        profileImageUrl: null,
        demoCodeId,
      }),
      // James - Resident/Homeowner
      storage.upsertUser({
        id: `${demoCodeId}-user-resident`,
        email: `demo-resident-${suffix}@poassociation.com`,
        firstName: 'James',
        lastName: 'Martinez',
        profileImageUrl: null,
        demoCodeId,
      }),
      // Alex - Board Contributor
      storage.upsertUser({
        id: `${demoCodeId}-user-contributor`,
        email: `demo-contributor-${suffix}@poassociation.com`,
        firstName: 'Alex',
        lastName: 'Rivera',
        profileImageUrl: null,
        demoCodeId,
      }),
    ]);
    console.log('✅ Created 4 demo users');

    // 4. Assign User Roles
    console.log('Assigning user roles...');
    const userTenantRoles = await Promise.all([
      // Emily (Manager + Account Admin) - access to all
      storage.assignUserRole({
        userId: demoUsers[0].id,
        tenantId: managementCompany.id,
        role: 'management_manager',
        demoCodeId,
      }),
      storage.assignUserRole({
        userId: demoUsers[0].id,
        tenantId: managementCompany.id,
        role: 'account_admin',
        demoCodeId,
      }),
      storage.assignUserRole({
        userId: demoUsers[0].id,
        tenantId: markland.id,
        role: 'management_rep',
        demoCodeId,
      }),
      storage.assignUserRole({
        userId: demoUsers[0].id,
        tenantId: whisperingPines.id,
        role: 'management_rep',
        demoCodeId,
      }),

      // Sarah (Board Member + Homeowner) - Markland only
      // She serves on the board AND owns property in the community
      storage.assignUserRole({
        userId: demoUsers[1].id,
        tenantId: markland.id,
        role: 'poa_board_member',
        demoCodeId,
      }),
      storage.assignUserRole({
        userId: demoUsers[1].id,
        tenantId: markland.id,
        role: 'homeowner',
        demoCodeId,
      }),

      // James (Resident) - Whispering Pines only
      storage.assignUserRole({
        userId: demoUsers[2].id,
        tenantId: whisperingPines.id,
        role: 'homeowner',
        demoCodeId,
      }),

      // Alex (Contributor) - Markland only
      storage.assignUserRole({
        userId: demoUsers[3].id,
        tenantId: markland.id,
        role: 'poa_board_contributor',
        demoCodeId,
      }),
    ]);
    console.log('✅ Assigned user roles');

    // 5. Create Form Templates
    console.log('Creating form templates...');
    const formTemplates = await Promise.all([
      // Markland forms
      storage.createFormTemplate({
        tenantId: markland.id,
        name: 'Structural Changes Application',
        description: 'For major modifications to property structure',
        schema: MARKLAND_STRUCTURAL_SCHEMA,
        isActive: true,
        demoCodeId,
      }),
      storage.createFormTemplate({
        tenantId: markland.id,
        name: 'Paint & Fence Request',
        description: 'For exterior paint changes and fence installations',
        schema: createPaintFenceSchema(),
        isActive: true,
        demoCodeId,
      }),
      // Whispering Pines forms
      storage.createFormTemplate({
        tenantId: whisperingPines.id,
        name: 'Landscaping Modification',
        description: 'For tree removal, planting, and landscape changes',
        schema: createLandscapingSchema(),
        isActive: true,
        demoCodeId,
      }),
      storage.createFormTemplate({
        tenantId: whisperingPines.id,
        name: 'General Architectural Request',
        description: 'For all other architectural modifications',
        schema: ARCH_REQUEST_FORM_SCHEMA,
        isActive: true,
        demoCodeId,
      }),
    ]);
    console.log('✅ Created 4 form templates');

    // 6. Create Sample Applications
    console.log('Creating sample applications...');
    const applications = await createSampleApplications({
      demoCodeId,
      markland,
      whisperingPines,
      demoUsers,
      formTemplates,
    });
    console.log(`✅ Created ${applications.length} sample applications`);

    // 7. Mark demo code as provisioned
    await storage.updateDemoCode(demoCodeId, {
      isProvisioned: true,
      provisionedAt: new Date(),
    });
    console.log('✅ Demo code marked as provisioned');

    console.log('🎉 Demo ecosystem provisioned successfully!');

    return {
      managementCompany,
      communities,
      users: demoUsers,
      formTemplates,
      applications,
      userTenantRoles,
    };
  } catch (error) {
    console.error('❌ Failed to provision demo ecosystem:', error);
    throw error;
  }
}

/**
 * Creates realistic sample applications across both communities
 */
async function createSampleApplications(params: {
  demoCodeId: string;
  markland: Tenant;
  whisperingPines: Tenant;
  demoUsers: User[];
  formTemplates: FormTemplate[];
}): Promise<Application[]> {
  const { demoCodeId, markland, whisperingPines, demoUsers, formTemplates } = params;
  const applications: Application[] = [];

  const statuses = ['pending', 'under_review', 'approved', 'rejected'] as const;
  const daysAgoList = [1, 2, 3, 5, 7, 10, 14, 18, 21, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90];

  // Create 30 applications
  for (let i = 0; i < 30; i++) {
    const tenant = i % 3 === 0 ? markland : whisperingPines;
    const formTemplate = formTemplates.find(f => f.tenantId === tenant.id);
    const status = statuses[i % 4];
    const daysAgo = daysAgoList[i % daysAgoList.length];

    const submittedAt = new Date();
    submittedAt.setDate(submittedAt.getDate() - daysAgo);

    if (!formTemplate) continue;

    // Randomly assign some applications to board member/manager, most to resident
    const submittedBy = i % 5 === 0 ? demoUsers[1] : demoUsers[2];

    const app = await storage.createApplication({
      tenantId: tenant.id,
      formTemplateId: formTemplate.id,
      submittedByUserId: submittedBy.id,
      formData: generateRealisticFormData(formTemplate.name, i),
      status,
      reviewedAt: status !== 'pending' ? new Date(submittedAt.getTime() + 86400000 * 2) : undefined,
      reviewedByUserId: status !== 'pending' ? demoUsers[1].id : undefined, // Sarah reviews
      reviewNotes: status !== 'pending' ? generateReviewNotes(status) : undefined,
      demoCodeId,
    });

    applications.push(app);
  }

  return applications;
}

/**
 * Generates realistic form data based on form type
 */
function generateRealisticFormData(formName: string, index: number): any {
  const addresses = [
    '142 Lakeside Drive',
    '8734 Maple Ridge Court',
    '521 Willow Creek Lane',
    '1903 Oakmont Circle',
    '4567 Pine Valley Road',
    '3310 Sunset Boulevard',
    '6789 Forest Glen Way',
    '2134 Harbor View Terrace',
  ];

  const names = [
    'Robert Chen',
    'Maria Garcia',
    'David Thompson',
    'Lisa Anderson',
    'Michael Brown',
    'Jennifer Wilson',
    'Christopher Lee',
    'Sarah Martinez',
  ];

  const contractors = [
    'Summit Builders',
    'Premier Construction',
    'Riverside Contractors',
    'Mountain View Builders',
    'Coastal Development',
  ];

  const projectTypes: Record<string, string[]> = {
    'Structural Changes Application': ['Deck Addition', 'Sunroom', 'Room Addition', 'Garage Conversion'],
    'Paint & Fence Request': ['Exterior Paint', 'Fence Installation', 'Gate Replacement'],
    'Landscaping Modification': ['Tree Removal', 'New Plantings', 'Garden Installation', 'Retaining Wall'],
    'General Architectural Request': ['Window Replacement', 'Door Replacement', 'Roof Replacement'],
  };

  const projectType = (projectTypes[formName] || ['General Modification'])[index % 4];

  return {
    homeowner_name: names[index % names.length],
    property_address: addresses[index % addresses.length],
    project_type: projectType,
    project_description: `${projectType} for property. Detailed plans attached. Project will enhance property value and maintain community standards.`,
    estimated_cost: `${(Math.random() * 50000 + 5000).toFixed(0)}`,
    contractor_name: contractors[index % contractors.length],
    contractor_license: `NC-${10000 + index}`,
    start_date: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0], // 30 days from now
    completion_date: new Date(Date.now() + 86400000 * 90).toISOString().split('T')[0], // 90 days from now
  };
}

/**
 * Generates realistic review notes based on status
 */
function generateReviewNotes(status: string): string {
  const approvedNotes = [
    'Application meets all architectural guidelines. Approved with standard conditions.',
    'Reviewed and approved. Ensure contractor is licensed and insured.',
    'Approved as submitted. Please notify HOA before starting work.',
    'Application approved. Remember to pull necessary permits with county.',
  ];

  const rejectedNotes = [
    'Project does not comply with Section 4.2 of the architectural guidelines. Please revise and resubmit.',
    'Proposed materials do not match community standards. Please select from approved material list.',
    'Application incomplete. Missing required documentation. Please resubmit with plat map.',
    'Color selection not approved. Please choose from approved color palette.',
  ];

  const reviewNotes = [
    'Under review. Board will make decision at next meeting on November 28th.',
    'Request for additional information sent to homeowner.',
    'Awaiting clarification on project scope.',
  ];

  if (status === 'approved') {
    return approvedNotes[Math.floor(Math.random() * approvedNotes.length)];
  } else if (status === 'rejected') {
    return rejectedNotes[Math.floor(Math.random() * rejectedNotes.length)];
  } else {
    return reviewNotes[Math.floor(Math.random() * reviewNotes.length)];
  }
}

/**
 * Creates a simple paint & fence form schema
 */
function createPaintFenceSchema(): any {
  return {
    title: 'Paint & Fence Request',
    description: 'Request for exterior paint changes or fence installations',
    sections: [
      {
        id: 'project_info',
        title: 'Project Information',
        fields: [
          {
            id: 'homeowner_name',
            type: 'text',
            label: 'Homeowner Name',
            required: true,
          },
          {
            id: 'property_address',
            type: 'text',
            label: 'Property Address',
            required: true,
          },
          {
            id: 'project_type',
            type: 'select',
            label: 'Project Type',
            options: ['Exterior Paint', 'Fence Installation', 'Gate Replacement', 'Both Paint and Fence'],
            required: true,
          },
          {
            id: 'project_description',
            type: 'textarea',
            label: 'Project Description',
            required: true,
          },
        ],
      },
      {
        id: 'details',
        title: 'Paint & Fence Details',
        fields: [
          {
            id: 'paint_color',
            type: 'text',
            label: 'Paint Color (Name and Brand)',
          },
          {
            id: 'fence_material',
            type: 'select',
            label: 'Fence Material',
            options: ['Wood', 'Vinyl', 'Composite', 'Aluminum', 'Chain Link'],
          },
          {
            id: 'fence_height',
            type: 'text',
            label: 'Fence Height (feet)',
          },
          {
            id: 'contractor_name',
            type: 'text',
            label: 'Contractor Name',
          },
        ],
      },
    ],
  };
}

/**
 * Creates a landscaping modification form schema
 */
function createLandscapingSchema(): any {
  return {
    title: 'Landscaping Modification',
    description: 'Request for tree removal, planting, and landscape changes',
    sections: [
      {
        id: 'applicant_info',
        title: 'Applicant Information',
        fields: [
          {
            id: 'homeowner_name',
            type: 'text',
            label: 'Homeowner Name',
            required: true,
          },
          {
            id: 'property_address',
            type: 'text',
            label: 'Property Address',
            required: true,
          },
        ],
      },
      {
        id: 'landscaping_details',
        title: 'Landscaping Details',
        fields: [
          {
            id: 'project_type',
            type: 'select',
            label: 'Type of Work',
            options: ['Tree Removal', 'New Plantings', 'Garden Installation', 'Retaining Wall', 'Hardscaping', 'Other'],
            required: true,
          },
          {
            id: 'project_description',
            type: 'textarea',
            label: 'Detailed Description',
            required: true,
          },
          {
            id: 'tree_species',
            type: 'text',
            label: 'Tree Species (if applicable)',
          },
          {
            id: 'number_of_trees',
            type: 'number',
            label: 'Number of Trees',
          },
          {
            id: 'contractor_name',
            type: 'text',
            label: 'Contractor/Landscaper Name',
          },
          {
            id: 'start_date',
            type: 'date',
            label: 'Proposed Start Date',
            required: true,
          },
        ],
      },
    ],
  };
}
