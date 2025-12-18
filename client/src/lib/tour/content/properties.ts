/**
 * Properties Tour Content
 *
 * Tours for the properties management page.
 */

import { TourContent } from '../types';
import { Building2, Plus, Settings, Users } from 'lucide-react';

export const propertiesTours: TourContent[] = [
  // Management Properties Tour
  {
    pageKey: 'properties',
    pageTitle: 'Property Management',
    roles: ['management_rep', 'management_manager'],
    steps: [
      {
        title: 'Your Properties',
        description: 'View all communities you manage. See key information like unit count, active applications, and board contacts.',
        icon: Building2,
      },
      {
        title: 'Property Settings',
        description: 'Configure each property\'s settings including application types, review workflows, and notification preferences.',
        icon: Settings,
      },
      {
        title: 'Team Assignments',
        description: 'See which team members are assigned to each property. Managers can adjust assignments as needed.',
        icon: Users,
      },
    ],
  },

  // Account Admin Properties Tour
  {
    pageKey: 'properties',
    pageTitle: 'Community Portfolio',
    roles: ['account_admin'],
    steps: [
      {
        title: 'All Communities',
        description: 'View every community in your organization. Monitor their configuration and usage.',
        icon: Building2,
      },
      {
        title: 'Add Community',
        description: 'Onboard new communities to your organization. Click "Add Community" to start the setup process.',
        icon: Plus,
      },
      {
        title: 'Configuration',
        description: 'Access each community\'s settings and customize their experience. Manage subscriptions and features.',
        icon: Settings,
      },
    ],
  },
];
