/**
 * Calendar Tour Content
 *
 * Tours for the calendar page.
 */

import { TourContent } from '../types';
import { Calendar, Bell, Clock, Filter } from 'lucide-react';

export const calendarTours: TourContent[] = [
  // Homeowner Calendar Tour
  {
    pageKey: 'calendar',
    pageTitle: 'Community Calendar',
    roles: ['homeowner', 'household_member'],
    steps: [
      {
        title: 'Important Dates',
        description: 'View community events, board meetings, and deadlines all in one place. Stay informed about what\'s happening in your community.',
        icon: Calendar,
      },
      {
        title: 'Your Deadlines',
        description: 'See application deadlines and scheduled reviews related to your submissions. Never miss an important date.',
        icon: Clock,
      },
      {
        title: 'Event Notifications',
        description: 'Get reminded about upcoming events and meetings. Click any event for more details and to add it to your personal calendar.',
        icon: Bell,
      },
    ],
  },

  // Board Member Calendar Tour
  {
    pageKey: 'calendar',
    pageTitle: 'Board Calendar',
    roles: ['poa_board_member'],
    steps: [
      {
        title: 'Meeting Schedule',
        description: 'View all scheduled board meetings and review sessions. See which applications are on the agenda for each meeting.',
        icon: Calendar,
      },
      {
        title: 'Review Deadlines',
        description: 'Track application review deadlines. Ensure your board meets response time requirements.',
        icon: Clock,
      },
      {
        title: 'Community Events',
        description: 'See and manage community events. Add important dates that homeowners should know about.',
        icon: Bell,
      },
    ],
  },

  // Management Calendar Tour
  {
    pageKey: 'calendar',
    pageTitle: 'Management Calendar',
    roles: ['management_rep', 'management_manager'],
    steps: [
      {
        title: 'Community Calendars',
        description: 'View calendars for all your managed communities. Switch between properties to see their specific schedules.',
        icon: Calendar,
      },
      {
        title: 'Review Schedule',
        description: 'Track board meeting dates and application review deadlines across your portfolio.',
        icon: Clock,
      },
      {
        title: 'Filter by Community',
        description: 'Use filters to focus on specific properties or see everything at once. Plan your week efficiently.',
        icon: Filter,
      },
    ],
  },
];
