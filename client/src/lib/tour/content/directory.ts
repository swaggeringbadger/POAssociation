/**
 * Directory Tour Content
 *
 * Tours for the directory page.
 */

import { TourContent } from '../types';
import { Users, Search, Building2, UserPlus } from 'lucide-react';

export const directoryTours: TourContent[] = [
  // Board Member Directory Tour
  {
    pageKey: 'directory',
    pageTitle: 'Community Directory',
    roles: ['poa_board_member'],
    steps: [
      {
        title: 'Member Directory',
        description: 'View all homeowners and members in your community. Search by name, address, or property details.',
        icon: Users,
      },
      {
        title: 'Quick Search',
        description: 'Find specific residents quickly. Search by name or address to locate member information.',
        icon: Search,
      },
      {
        title: 'Property Details',
        description: 'Click any entry to see property details and application history for that address.',
        icon: Building2,
      },
    ],
  },

  // Management Directory Tour
  {
    pageKey: 'directory',
    pageTitle: 'Community Directory',
    roles: ['management_rep', 'management_manager'],
    steps: [
      {
        title: 'Resident Lookup',
        description: 'Search for residents across your managed communities. Find contact information and property details.',
        icon: Users,
      },
      {
        title: 'Community Filter',
        description: 'Filter the directory by community to focus on a specific property. Switch between communities easily.',
        icon: Building2,
      },
      {
        title: 'Contact Management',
        description: 'View and update resident contact information. Ensure you can reach homeowners when needed.',
        icon: UserPlus,
      },
    ],
  },
];
