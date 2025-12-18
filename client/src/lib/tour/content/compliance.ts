/**
 * Compliance Tour Content
 *
 * Tours for the compliance page.
 */

import { TourContent } from '../types';
import { Shield, FileCheck, AlertTriangle, BarChart } from 'lucide-react';

export const complianceTours: TourContent[] = [
  // Management Manager Compliance Tour
  {
    pageKey: 'compliance',
    pageTitle: 'Compliance Dashboard',
    roles: ['management_manager'],
    steps: [
      {
        title: 'Compliance Overview',
        description: 'Monitor compliance status across all your managed communities. Identify issues before they become problems.',
        icon: Shield,
      },
      {
        title: 'Document Tracking',
        description: 'Track required documents like insurance certificates and contractor licenses. Get alerts before they expire.',
        icon: FileCheck,
      },
      {
        title: 'Issues & Alerts',
        description: 'View outstanding compliance issues that need attention. Prioritize based on urgency and impact.',
        icon: AlertTriangle,
      },
      {
        title: 'Reports',
        description: 'Generate compliance reports for your communities. Share status updates with boards and stakeholders.',
        icon: BarChart,
      },
    ],
  },
];
