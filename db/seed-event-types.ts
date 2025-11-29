import { db } from '../server/storage';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';

async function seedEventTypes() {
  console.log('Seeding default event types...');

  const defaultEventTypes = [
    {
      slug: 'board_meeting',
      name: 'Board Meeting',
      description: 'Regular POA/HOA Board of Directors meeting',
      icon: 'Users',
      color: 'blue',
      defaultDuration: 120,
      requiresAttendance: true,
      isSystem: true,
      sortOrder: 1,
    },
    {
      slug: 'arc_meeting',
      name: 'ARC Review Meeting',
      description: 'Architectural Review Committee meeting to review applications',
      icon: 'ClipboardCheck',
      color: 'purple',
      defaultDuration: 90,
      requiresAttendance: true,
      isSystem: true,
      sortOrder: 2,
    },
    {
      slug: 'annual_meeting',
      name: 'Annual Meeting',
      description: 'Annual member meeting for the community',
      icon: 'Calendar',
      color: 'green',
      defaultDuration: 180,
      requiresAttendance: true,
      isSystem: true,
      sortOrder: 3,
    },
    {
      slug: 'committee_meeting',
      name: 'Committee Meeting',
      description: 'General committee meeting',
      icon: 'UserCircle',
      color: 'teal',
      defaultDuration: 60,
      requiresAttendance: true,
      isSystem: true,
      sortOrder: 4,
    },
    {
      slug: 'hearing',
      name: 'Hearing',
      description: 'Violation hearing or appeal hearing',
      icon: 'Scale',
      color: 'red',
      defaultDuration: 60,
      requiresAttendance: true,
      isSystem: true,
      sortOrder: 5,
    },
    {
      slug: 'deadline',
      name: 'Deadline',
      description: 'Important deadline or due date',
      icon: 'Clock',
      color: 'orange',
      defaultDuration: 0,
      requiresAttendance: false,
      isSystem: true,
      sortOrder: 6,
    },
    {
      slug: 'inspection',
      name: 'Inspection',
      description: 'Property or community inspection',
      icon: 'Search',
      color: 'yellow',
      defaultDuration: 120,
      requiresAttendance: false,
      isSystem: true,
      sortOrder: 7,
    },
    {
      slug: 'community_event',
      name: 'Community Event',
      description: 'Community gathering or social event',
      icon: 'PartyPopper',
      color: 'pink',
      defaultDuration: 180,
      requiresAttendance: false,
      isSystem: true,
      sortOrder: 8,
    },
  ];

  for (const eventType of defaultEventTypes) {
    // Check if already exists
    const existing = await db
      .select()
      .from(schema.eventTypes)
      .where(eq(schema.eventTypes.slug, eventType.slug));

    if (existing.length === 0) {
      await db.insert(schema.eventTypes).values(eventType);
      console.log(`  Created event type: ${eventType.name}`);
    } else {
      console.log(`  Event type already exists: ${eventType.name}`);
    }
  }

  console.log('Done seeding event types.');
}

seedEventTypes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error seeding event types:', error);
    process.exit(1);
  });
