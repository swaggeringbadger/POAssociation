/**
 * Dashboard Tour Content
 *
 * Tours for the main dashboard page across all roles.
 */

import { TourContent } from '../types';
import { LayoutDashboard, FileText, Bell, Home, Building2, ClipboardCheck, Users, Settings } from 'lucide-react';

export const dashboardTours: TourContent[] = [
  // Homeowner Dashboard Tour
  {
    pageKey: 'dashboard',
    pageTitle: 'Welcome to Your Dashboard',
    roles: ['homeowner'],
    steps: [
      {
        title: 'Your Applications at a Glance',
        description: 'See the status of all your submitted requests in one place. Track pending approvals, view approved applications, and stay informed about any updates.',
        icon: FileText,
      },
      {
        title: 'Quick Actions',
        description: 'Start a new application directly from your dashboard. Whether it\'s a home improvement project, landscaping change, or other modification, get started with just one click.',
        icon: LayoutDashboard,
      },
      {
        title: 'Stay Notified',
        description: 'Important updates and notifications appear here. You\'ll be alerted when your application status changes or when action is required from you.',
        icon: Bell,
      },
    ],
  },

  // Household Member Dashboard Tour
  {
    pageKey: 'dashboard',
    pageTitle: 'Welcome to Your Dashboard',
    roles: ['household_member'],
    steps: [
      {
        title: 'Household Applications',
        description: 'View applications submitted by your household. You can track the status of projects and see what\'s pending or approved.',
        icon: Home,
      },
      {
        title: 'Submit New Requests',
        description: 'As a household member, you can submit applications on behalf of your household for home improvements and modifications.',
        icon: FileText,
      },
      {
        title: 'Notifications',
        description: 'Stay updated on application progress. You\'ll see alerts when applications are reviewed or require additional information.',
        icon: Bell,
      },
    ],
  },

  // Board Member Dashboard Tour
  {
    pageKey: 'dashboard',
    pageTitle: 'Board Member Dashboard',
    roles: ['poa_board_member'],
    steps: [
      {
        title: 'Applications Awaiting Review',
        description: 'See all pending applications that need board attention. Prioritize reviews and ensure timely responses to homeowner requests.',
        icon: ClipboardCheck,
      },
      {
        title: 'Community Overview',
        description: 'Get a quick snapshot of your community\'s activity including recent approvals, pending reviews, and application trends.',
        icon: Building2,
      },
      {
        title: 'Quick Review Access',
        description: 'Jump directly into application reviews from your dashboard. Click any pending application to view details and take action.',
        icon: FileText,
      },
    ],
  },

  // Management Rep Dashboard Tour
  {
    pageKey: 'dashboard',
    pageTitle: 'Welcome to Your Dashboard',
    roles: ['management_rep'],
    steps: [
      {
        title: 'Your Assigned Applications',
        description: 'View applications assigned to you across your managed communities. Track what needs your attention today.',
        icon: FileText,
      },
      {
        title: 'Community Quick Access',
        description: 'Switch between your assigned communities quickly. See activity summaries for each property you manage.',
        icon: Building2,
      },
      {
        title: 'Task Priorities',
        description: 'Applications are sorted by urgency and due dates. Focus on what matters most to keep reviews moving smoothly.',
        icon: ClipboardCheck,
      },
    ],
  },

  // Management Manager Dashboard Tour
  {
    pageKey: 'dashboard',
    pageTitle: 'Management Dashboard',
    roles: ['management_manager'],
    steps: [
      {
        title: 'Portfolio Overview',
        description: 'See the big picture across all your managed communities. Track application volumes, review times, and team performance.',
        icon: Building2,
      },
      {
        title: 'Team Activity',
        description: 'Monitor your team\'s workload and assignment distribution. Ensure balanced coverage across all properties.',
        icon: Users,
      },
      {
        title: 'Performance Metrics',
        description: 'Track key metrics like average review time and approval rates. Use insights to improve your team\'s efficiency.',
        icon: LayoutDashboard,
      },
    ],
  },

  // Account Admin Dashboard Tour
  {
    pageKey: 'dashboard',
    pageTitle: 'Account Administration',
    roles: ['account_admin'],
    steps: [
      {
        title: 'Organization Overview',
        description: 'See a summary of all communities under your account. Monitor subscription status and usage across your organization.',
        icon: Building2,
      },
      {
        title: 'Quick Configuration',
        description: 'Access billing, user management, and workflow settings directly from your dashboard. Configure your organization efficiently.',
        icon: Settings,
      },
      {
        title: 'Usage & Billing',
        description: 'Track your organization\'s resource usage and billing status. Stay informed about upcoming renewals and consumption.',
        icon: LayoutDashboard,
      },
    ],
  },

  // Contractor Dashboard Tour
  {
    pageKey: 'dashboard',
    pageTitle: 'Contractor Dashboard',
    roles: ['contractor'],
    steps: [
      {
        title: 'Your Assigned Projects',
        description: 'View all applications where you\'ve been invited as a contractor. See project details and what\'s needed from you.',
        icon: FileText,
      },
      {
        title: 'Upload Documents',
        description: 'Submit required documents like permits, insurance certificates, and project plans directly to each application.',
        icon: ClipboardCheck,
      },
      {
        title: 'Track Progress',
        description: 'Monitor the approval status of projects you\'re involved with. Stay informed as applications move through review.',
        icon: Bell,
      },
    ],
  },

  // Super Admin Dashboard Tour
  {
    pageKey: 'dashboard',
    pageTitle: 'System Administration',
    roles: ['super_admin'],
    steps: [
      {
        title: 'Platform Overview',
        description: 'Monitor the entire platform\'s health and activity. See active users, application volume, and system status.',
        icon: LayoutDashboard,
      },
      {
        title: 'Organization Management',
        description: 'Access and manage all organizations on the platform. Handle onboarding, configurations, and support requests.',
        icon: Building2,
      },
      {
        title: 'System Health',
        description: 'Track platform performance and identify any issues. Ensure smooth operation for all users.',
        icon: Settings,
      },
    ],
  },
];
