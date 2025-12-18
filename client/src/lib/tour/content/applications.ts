/**
 * Applications Tour Content
 *
 * Tours for the applications page across all roles.
 */

import { TourContent } from '../types';
import { FileText, Search, Filter, Eye, CheckCircle, Clock, Plus } from 'lucide-react';

export const applicationsTours: TourContent[] = [
  // Homeowner Applications Tour
  {
    pageKey: 'applications',
    pageTitle: 'Your Applications',
    roles: ['homeowner', 'household_member'],
    steps: [
      {
        title: 'View All Applications',
        description: 'See every application you\'ve submitted, organized by status. Track what\'s pending, approved, or needs more information.',
        icon: FileText,
      },
      {
        title: 'Start New Application',
        description: 'Click the "New Application" button to submit a new request. You\'ll be guided through each step of the process.',
        icon: Plus,
      },
      {
        title: 'Filter & Search',
        description: 'Use filters to find specific applications by status, date, or type. Search by address or project description to quickly locate what you need.',
        icon: Search,
      },
    ],
  },

  // Board Member Applications Tour
  {
    pageKey: 'applications',
    pageTitle: 'Application Review',
    roles: ['poa_board_member'],
    steps: [
      {
        title: 'Review Queue',
        description: 'Applications awaiting board review are highlighted at the top. Work through pending items to keep your community running smoothly.',
        icon: Clock,
      },
      {
        title: 'Quick Actions',
        description: 'Approve, deny, or request more information directly from the list. Click any application to see full details before making a decision.',
        icon: CheckCircle,
      },
      {
        title: 'Application History',
        description: 'View the complete history of applications in your community. See past decisions and any conditions that were applied.',
        icon: Eye,
      },
    ],
  },

  // Management Rep Applications Tour
  {
    pageKey: 'applications',
    pageTitle: 'Application Management',
    roles: ['management_rep'],
    steps: [
      {
        title: 'Your Assigned Reviews',
        description: 'See applications assigned to you for initial review. Process these before they go to the board for final approval.',
        icon: FileText,
      },
      {
        title: 'Community Filter',
        description: 'If you manage multiple properties, filter by community to focus on one property at a time.',
        icon: Filter,
      },
      {
        title: 'Status Tracking',
        description: 'Monitor where each application is in the review process. Track items you\'ve forwarded to the board.',
        icon: Clock,
      },
    ],
  },

  // Management Manager Applications Tour
  {
    pageKey: 'applications',
    pageTitle: 'Applications Overview',
    roles: ['management_manager'],
    steps: [
      {
        title: 'Portfolio View',
        description: 'See all applications across your managed communities in one place. Get a complete picture of review activity.',
        icon: FileText,
      },
      {
        title: 'Assignment Management',
        description: 'See which rep is assigned to each application. Reassign work as needed to balance the team\'s workload.',
        icon: Filter,
      },
      {
        title: 'Performance Insights',
        description: 'Track review times and identify bottlenecks. Ensure your team meets service level expectations.',
        icon: Eye,
      },
    ],
  },

  // Account Admin Applications Tour
  {
    pageKey: 'applications',
    pageTitle: 'Application Oversight',
    roles: ['account_admin'],
    steps: [
      {
        title: 'Organization-wide View',
        description: 'Access applications across all communities in your organization. Monitor activity and ensure consistent processes.',
        icon: FileText,
      },
      {
        title: 'Reporting Access',
        description: 'Export application data for reporting and analysis. Track trends across your communities.',
        icon: Eye,
      },
    ],
  },

  // Contractor Applications Tour
  {
    pageKey: 'applications',
    pageTitle: 'Your Projects',
    roles: ['contractor'],
    steps: [
      {
        title: 'Invited Projects',
        description: 'View all applications where you\'ve been added as a contractor. Each project shows what documents and information are needed.',
        icon: FileText,
      },
      {
        title: 'Document Upload',
        description: 'Click into any application to upload required documents like permits, insurance, or project specifications.',
        icon: Plus,
      },
      {
        title: 'Status Updates',
        description: 'Track the approval status of your projects. You\'ll be notified when applications are approved or need additional information.',
        icon: Clock,
      },
    ],
  },

  // Super Admin Applications Tour
  {
    pageKey: 'applications',
    pageTitle: 'Platform Applications',
    roles: ['super_admin'],
    steps: [
      {
        title: 'Platform-wide Access',
        description: 'View applications across all organizations on the platform. Support users and troubleshoot issues as needed.',
        icon: FileText,
      },
      {
        title: 'Audit Trail',
        description: 'Access complete application history and audit logs. Track all actions and changes for compliance purposes.',
        icon: Eye,
      },
    ],
  },
];
