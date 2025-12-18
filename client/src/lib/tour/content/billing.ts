/**
 * Billing Tour Content
 *
 * Tours for the billing page.
 */

import { TourContent } from '../types';
import { CreditCard, FileText, TrendingUp, Settings } from 'lucide-react';

export const billingTours: TourContent[] = [
  // Account Admin Billing Tour
  {
    pageKey: 'billing',
    pageTitle: 'Billing & Subscription',
    roles: ['account_admin'],
    steps: [
      {
        title: 'Subscription Overview',
        description: 'View your current plan and usage across all communities. See what\'s included and track consumption.',
        icon: TrendingUp,
      },
      {
        title: 'Payment Methods',
        description: 'Manage your payment methods and billing information. Update credit cards or switch payment methods.',
        icon: CreditCard,
      },
      {
        title: 'Invoices',
        description: 'Access and download past invoices. View detailed breakdowns of charges for each billing period.',
        icon: FileText,
      },
      {
        title: 'Plan Management',
        description: 'Upgrade or modify your subscription plan. Add communities or adjust your tier as needed.',
        icon: Settings,
      },
    ],
  },
];
