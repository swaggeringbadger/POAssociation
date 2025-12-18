/**
 * Tour Icon Registry
 *
 * Maps icon names (stored as strings in database) to Lucide icon components.
 * This allows tour content to be editable while still using icons.
 */

import { LucideIcon } from 'lucide-react';
import {
  // Navigation & Layout
  LayoutDashboard,
  Home,
  Building2,
  Map,

  // Documents & Files
  FileText,
  Files,
  Folder,
  ClipboardCheck,
  ClipboardList,

  // Actions
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,

  // Status & Notifications
  Bell,
  CheckCircle,
  AlertTriangle,
  Clock,
  Calendar,

  // People & Teams
  Users,
  User,
  UserPlus,
  Building,

  // Communication
  Mail,
  MessageSquare,
  Send,

  // Settings & Tools
  Settings,
  Cog,
  Wrench,
  Shield,

  // Finance
  DollarSign,
  CreditCard,
  Receipt,
  TrendingUp,
  BarChart,

  // Misc
  Sparkles,
  Star,
  Heart,
  Info,
  HelpCircle,
  BookOpen,
  Workflow,
} from 'lucide-react';

/**
 * Map of icon names to Lucide icon components.
 * Add new icons here when needed.
 */
export const TOUR_ICONS: Record<string, LucideIcon> = {
  // Navigation & Layout
  LayoutDashboard,
  Home,
  Building2,
  Map,

  // Documents & Files
  FileText,
  Files,
  Folder,
  ClipboardCheck,
  ClipboardList,

  // Actions
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,

  // Status & Notifications
  Bell,
  CheckCircle,
  AlertTriangle,
  Clock,
  Calendar,

  // People & Teams
  Users,
  User,
  UserPlus,
  Building,

  // Communication
  Mail,
  MessageSquare,
  Send,

  // Settings & Tools
  Settings,
  Cog,
  Wrench,
  Shield,

  // Finance
  DollarSign,
  CreditCard,
  Receipt,
  TrendingUp,
  BarChart,

  // Misc
  Sparkles,
  Star,
  Heart,
  Info,
  HelpCircle,
  BookOpen,
  Workflow,
};

/**
 * Get all available icon names for the icon picker
 */
export const TOUR_ICON_OPTIONS = Object.keys(TOUR_ICONS);

/**
 * Type for valid tour icon names
 */
export type TourIconName = keyof typeof TOUR_ICONS;

/**
 * Get a Lucide icon component by name.
 * Returns HelpCircle as fallback if icon not found.
 */
export function getTourIcon(name: string): LucideIcon {
  return TOUR_ICONS[name] || HelpCircle;
}

/**
 * Check if an icon name is valid
 */
export function isValidIconName(name: string): name is TourIconName {
  return name in TOUR_ICONS;
}

/**
 * Icon options grouped by category for better UX in picker
 */
export const TOUR_ICON_GROUPS = {
  'Navigation': ['LayoutDashboard', 'Home', 'Building2', 'Map'],
  'Documents': ['FileText', 'Files', 'Folder', 'ClipboardCheck', 'ClipboardList'],
  'Actions': ['Plus', 'Search', 'Filter', 'Eye', 'Edit', 'Trash2'],
  'Status': ['Bell', 'CheckCircle', 'AlertTriangle', 'Clock', 'Calendar'],
  'People': ['Users', 'User', 'UserPlus', 'Building'],
  'Communication': ['Mail', 'MessageSquare', 'Send'],
  'Settings': ['Settings', 'Cog', 'Wrench', 'Shield'],
  'Finance': ['DollarSign', 'CreditCard', 'Receipt', 'TrendingUp', 'BarChart'],
  'Misc': ['Sparkles', 'Star', 'Heart', 'Info', 'HelpCircle', 'BookOpen', 'Workflow'],
} as const;
