/**
 * Team Tour Content
 *
 * Tours for the team management page.
 */

import { TourContent } from '../types';
import { Users, UserPlus, Shield, Building2 } from 'lucide-react';

export const teamTours: TourContent[] = [
  // Management Manager Team Tour
  {
    pageKey: 'team',
    pageTitle: 'Team Management',
    roles: ['management_manager'],
    steps: [
      {
        title: 'Your Team',
        description: 'View all team members in your organization. See their roles and which communities they\'re assigned to.',
        icon: Users,
      },
      {
        title: 'Add Team Members',
        description: 'Invite new team members to your organization. Assign them to communities and set their permissions.',
        icon: UserPlus,
      },
      {
        title: 'Roles & Permissions',
        description: 'Manage what each team member can do. Control access to features and communities based on their role.',
        icon: Shield,
      },
      {
        title: 'Community Assignments',
        description: 'Assign reps to specific communities. Balance workloads and ensure proper coverage.',
        icon: Building2,
      },
    ],
  },

  // Account Admin Team Tour
  {
    pageKey: 'team',
    pageTitle: 'User Management',
    roles: ['account_admin'],
    steps: [
      {
        title: 'Organization Users',
        description: 'View everyone with access to your organization. Manage account admins and community managers.',
        icon: Users,
      },
      {
        title: 'Invite Users',
        description: 'Add new users to your organization. Set their role and what communities they can access.',
        icon: UserPlus,
      },
      {
        title: 'Access Control',
        description: 'Control permissions across your organization. Ensure users have appropriate access levels.',
        icon: Shield,
      },
    ],
  },
];
