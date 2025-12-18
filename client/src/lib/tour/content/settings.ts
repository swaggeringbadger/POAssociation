/**
 * Settings Tour Content
 *
 * Tours for the settings page.
 */

import { TourContent } from '../types';
import { Settings, Bell, Shield, Palette } from 'lucide-react';

export const settingsTours: TourContent[] = [
  // Board Member Settings Tour
  {
    pageKey: 'settings',
    pageTitle: 'Community Settings',
    roles: ['poa_board_member'],
    steps: [
      {
        title: 'Community Configuration',
        description: 'Customize your community\'s settings including application types, required documents, and review processes.',
        icon: Settings,
      },
      {
        title: 'Notification Preferences',
        description: 'Control when and how you receive notifications about new applications and updates.',
        icon: Bell,
      },
      {
        title: 'Appearance',
        description: 'Customize the look of your community portal. Upload logos and choose colors that match your brand.',
        icon: Palette,
      },
    ],
  },

  // Management Settings Tour
  {
    pageKey: 'settings',
    pageTitle: 'Settings',
    roles: ['management_rep', 'management_manager'],
    steps: [
      {
        title: 'Your Preferences',
        description: 'Customize your notification settings and display preferences. Control how you receive alerts.',
        icon: Settings,
      },
      {
        title: 'Community Settings',
        description: 'Access settings for communities you manage. Configure application forms and review workflows.',
        icon: Shield,
      },
      {
        title: 'Notifications',
        description: 'Set up email and in-app notification preferences. Choose which events trigger alerts.',
        icon: Bell,
      },
    ],
  },

  // Account Admin Settings Tour
  {
    pageKey: 'settings',
    pageTitle: 'Organization Settings',
    roles: ['account_admin'],
    steps: [
      {
        title: 'Organization Configuration',
        description: 'Manage settings that apply across all your communities. Set default configurations and policies.',
        icon: Settings,
      },
      {
        title: 'Security Settings',
        description: 'Configure authentication, access controls, and security policies for your organization.',
        icon: Shield,
      },
      {
        title: 'Branding',
        description: 'Upload your organization\'s logo and customize the appearance of your portal.',
        icon: Palette,
      },
    ],
  },
];
