/**
 * Workflows Tour Content
 *
 * Tours for the workflows configuration page.
 */

import { TourContent } from '../types';
import { Workflow, Settings, FileText, CheckCircle } from 'lucide-react';

export const workflowsTours: TourContent[] = [
  // Account Admin Workflows Tour
  {
    pageKey: 'workflows',
    pageTitle: 'Workflow Configuration',
    roles: ['account_admin'],
    steps: [
      {
        title: 'Review Workflows',
        description: 'Configure how applications flow through your review process. Set up approval stages and routing rules.',
        icon: Workflow,
      },
      {
        title: 'Application Types',
        description: 'Manage the types of applications homeowners can submit. Customize forms and required documents for each type.',
        icon: FileText,
      },
      {
        title: 'Approval Rules',
        description: 'Set up automatic approvals, escalation rules, and review deadlines. Streamline your process.',
        icon: CheckCircle,
      },
      {
        title: 'Default Settings',
        description: 'Configure default workflow settings that apply to new communities. Save time during onboarding.',
        icon: Settings,
      },
    ],
  },
];
