/**
 * Seed Agenda Sections and Meeting Templates
 *
 * Ensures the agenda_sections and meeting_templates tables have default values.
 * Called on server startup to keep database in sync with code defaults.
 */

import { db } from './storage';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type { MeetingTemplateSectionConfig } from '@shared/schema';

// Default agenda sections
const DEFAULT_AGENDA_SECTIONS = [
  {
    slug: 'call_to_order',
    name: 'Call to Order',
    description: 'Official start of the meeting',
    icon: 'Gavel',
    color: 'text-slate-600',
    sortOrder: 10,
    allowsApplications: false,
    allowsDiscussionItems: false,
    isSystemDefined: true,
  },
  {
    slug: 'roll_call',
    name: 'Roll Call / Attendance',
    description: 'Record attendance and establish quorum',
    icon: 'Users',
    color: 'text-blue-600',
    sortOrder: 20,
    allowsApplications: false,
    allowsDiscussionItems: false,
    isSystemDefined: true,
  },
  {
    slug: 'approval_of_minutes',
    name: 'Approval of Minutes',
    description: 'Review and approve previous meeting minutes',
    icon: 'FileCheck',
    color: 'text-green-600',
    sortOrder: 30,
    allowsApplications: false,
    allowsDiscussionItems: true,
    isSystemDefined: true,
  },
  {
    slug: 'old_business',
    name: 'Old Business',
    description: 'Items previously discussed or tabled from prior meetings',
    icon: 'History',
    color: 'text-amber-600',
    sortOrder: 40,
    allowsApplications: true,
    allowsDiscussionItems: true,
    isSystemDefined: true,
  },
  {
    slug: 'new_business',
    name: 'New Business',
    description: 'New items being presented for the first time',
    icon: 'Sparkles',
    color: 'text-purple-600',
    sortOrder: 50,
    allowsApplications: true,
    allowsDiscussionItems: true,
    isSystemDefined: true,
  },
  {
    slug: 'final_approvals',
    name: 'Final Approvals',
    description: 'Applications ready for final vote after previous review',
    icon: 'CheckCircle',
    color: 'text-emerald-600',
    sortOrder: 60,
    allowsApplications: true,
    allowsDiscussionItems: false,
    isSystemDefined: true,
  },
  {
    slug: 'general_discussion',
    name: 'General Discussion',
    description: 'Open discussion on various topics',
    icon: 'MessageSquare',
    color: 'text-indigo-600',
    sortOrder: 70,
    allowsApplications: false,
    allowsDiscussionItems: true,
    isSystemDefined: true,
  },
  {
    slug: 'announcements',
    name: 'Announcements',
    description: 'Community announcements and updates',
    icon: 'Megaphone',
    color: 'text-orange-600',
    sortOrder: 80,
    allowsApplications: false,
    allowsDiscussionItems: true,
    isSystemDefined: true,
  },
  {
    slug: 'adjournment',
    name: 'Adjournment',
    description: 'Official end of the meeting',
    icon: 'DoorOpen',
    color: 'text-slate-600',
    sortOrder: 90,
    allowsApplications: false,
    allowsDiscussionItems: false,
    isSystemDefined: true,
  },
];

/**
 * Seed or update agenda sections from code defaults
 */
export async function seedAgendaSections(): Promise<Record<string, string>> {
  console.log('[SeedAgenda] Checking agenda sections...');

  const sectionIdMap: Record<string, string> = {};

  for (const section of DEFAULT_AGENDA_SECTIONS) {
    // Check if section exists
    const [existing] = await db
      .select()
      .from(schema.agendaSections)
      .where(eq(schema.agendaSections.slug, section.slug))
      .limit(1);

    if (existing) {
      sectionIdMap[section.slug] = existing.id;
      // Could update if needed, but for now just track ID
    } else {
      // Insert new section
      const [inserted] = await db
        .insert(schema.agendaSections)
        .values(section)
        .returning({ id: schema.agendaSections.id });

      sectionIdMap[section.slug] = inserted.id;
      console.log(`[SeedAgenda] Created section: ${section.name}`);
    }
  }

  console.log('[SeedAgenda] Agenda sections synced successfully');
  return sectionIdMap;
}

/**
 * Build meeting template section configs from section ID map
 */
function buildTemplateSections(
  sectionIdMap: Record<string, string>,
  slugs: string[],
  options: Partial<Record<string, { customName?: string; defaultDurationMinutes?: number; isRequired?: boolean }>> = {}
): MeetingTemplateSectionConfig[] {
  return slugs.map((slug) => ({
    sectionId: sectionIdMap[slug],
    customName: options[slug]?.customName,
    defaultDurationMinutes: options[slug]?.defaultDurationMinutes,
    isRequired: options[slug]?.isRequired ?? true,
  }));
}

/**
 * Seed default meeting templates
 */
export async function seedMeetingTemplates(sectionIdMap: Record<string, string>): Promise<void> {
  console.log('[SeedAgenda] Checking meeting templates...');

  // ARC Review Meeting Template
  const arcTemplateSlugs = ['call_to_order', 'roll_call', 'approval_of_minutes', 'old_business', 'new_business', 'final_approvals', 'announcements', 'adjournment'];
  const arcSections = buildTemplateSections(sectionIdMap, arcTemplateSlugs, {
    call_to_order: { defaultDurationMinutes: 2 },
    roll_call: { defaultDurationMinutes: 3 },
    approval_of_minutes: { defaultDurationMinutes: 5 },
    old_business: { defaultDurationMinutes: 30 },
    new_business: { defaultDurationMinutes: 45 },
    final_approvals: { defaultDurationMinutes: 15 },
    announcements: { defaultDurationMinutes: 5 },
    adjournment: { defaultDurationMinutes: 1 },
  });

  // Check if ARC template exists
  const [existingArc] = await db
    .select()
    .from(schema.meetingTemplates)
    .where(eq(schema.meetingTemplates.eventTypeSlug, 'arc_meeting'))
    .limit(1);

  if (!existingArc) {
    await db.insert(schema.meetingTemplates).values({
      name: 'ARC Review Meeting',
      description: 'Standard Architectural Review Committee meeting with application review sections',
      eventTypeSlug: 'arc_meeting',
      sections: arcSections,
      isDefault: true,
      isActive: true,
    });
    console.log('[SeedAgenda] Created template: ARC Review Meeting');
  }

  // Board Meeting Template (full structure)
  const boardTemplateSlugs = ['call_to_order', 'roll_call', 'approval_of_minutes', 'old_business', 'new_business', 'general_discussion', 'announcements', 'adjournment'];
  const boardSections = buildTemplateSections(sectionIdMap, boardTemplateSlugs, {
    call_to_order: { defaultDurationMinutes: 2 },
    roll_call: { defaultDurationMinutes: 5 },
    approval_of_minutes: { defaultDurationMinutes: 5 },
    old_business: { defaultDurationMinutes: 20 },
    new_business: { defaultDurationMinutes: 30 },
    general_discussion: { defaultDurationMinutes: 15 },
    announcements: { defaultDurationMinutes: 5 },
    adjournment: { defaultDurationMinutes: 1 },
  });

  const [existingBoard] = await db
    .select()
    .from(schema.meetingTemplates)
    .where(eq(schema.meetingTemplates.eventTypeSlug, 'board_meeting'))
    .limit(1);

  if (!existingBoard) {
    await db.insert(schema.meetingTemplates).values({
      name: 'Board Meeting',
      description: 'Standard POA/HOA board meeting with general discussion',
      eventTypeSlug: 'board_meeting',
      sections: boardSections,
      isDefault: true,
      isActive: true,
    });
    console.log('[SeedAgenda] Created template: Board Meeting');
  }

  // Quick Review Template (streamlined)
  const quickTemplateSlugs = ['roll_call', 'new_business', 'final_approvals', 'adjournment'];
  const quickSections = buildTemplateSections(sectionIdMap, quickTemplateSlugs, {
    roll_call: { defaultDurationMinutes: 2 },
    new_business: { defaultDurationMinutes: 30, customName: 'Applications for Review' },
    final_approvals: { defaultDurationMinutes: 15 },
    adjournment: { defaultDurationMinutes: 1 },
  });

  const [existingQuick] = await db
    .select()
    .from(schema.meetingTemplates)
    .where(eq(schema.meetingTemplates.name, 'Quick Review'))
    .limit(1);

  if (!existingQuick) {
    await db.insert(schema.meetingTemplates).values({
      name: 'Quick Review',
      description: 'Streamlined meeting for quick application reviews',
      eventTypeSlug: 'arc_meeting',
      sections: quickSections,
      isDefault: false,
      isActive: true,
    });
    console.log('[SeedAgenda] Created template: Quick Review');
  }

  console.log('[SeedAgenda] Meeting templates synced successfully');
}

/**
 * Main seed function - seeds both sections and templates
 */
export async function seedAgendaSystem(): Promise<void> {
  try {
    const sectionIdMap = await seedAgendaSections();
    await seedMeetingTemplates(sectionIdMap);
    console.log('[SeedAgenda] Agenda system seeded successfully');
  } catch (error) {
    console.error('[SeedAgenda] Error seeding agenda system:', error);
    throw error;
  }
}
