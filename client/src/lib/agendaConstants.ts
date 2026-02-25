/**
 * Shared constants for agenda presentation components.
 * Section icons and colors used by SectionNavigator and PresentationAgendaSection.
 */

import {
  Gavel,
  Users,
  FileCheck,
  Clock,
  MessageSquare,
  AlertCircle,
  Vote,
  Flag,
} from 'lucide-react';

// Icon mapping for section slugs
export const sectionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  call_to_order: Gavel,
  roll_call: Users,
  approval_of_minutes: FileCheck,
  old_business: Clock,
  new_business: MessageSquare,
  committee_reports: AlertCircle,
  final_approvals: Vote,
  open_forum: MessageSquare,
  adjournment: Flag,
};

// Tailwind border color classes for section slugs
export const sectionColors: Record<string, string> = {
  call_to_order: 'border-l-purple-500',
  roll_call: 'border-l-blue-500',
  approval_of_minutes: 'border-l-green-500',
  old_business: 'border-l-amber-500',
  new_business: 'border-l-orange-500',
  committee_reports: 'border-l-cyan-500',
  final_approvals: 'border-l-emerald-500',
  open_forum: 'border-l-pink-500',
  adjournment: 'border-l-gray-500',
};

// Background accent colors for sidebar active state
export const sectionBgColors: Record<string, string> = {
  call_to_order: 'bg-purple-50 border-l-purple-500',
  roll_call: 'bg-blue-50 border-l-blue-500',
  approval_of_minutes: 'bg-green-50 border-l-green-500',
  old_business: 'bg-amber-50 border-l-amber-500',
  new_business: 'bg-orange-50 border-l-orange-500',
  committee_reports: 'bg-cyan-50 border-l-cyan-500',
  final_approvals: 'bg-emerald-50 border-l-emerald-500',
  open_forum: 'bg-pink-50 border-l-pink-500',
  adjournment: 'bg-gray-50 border-l-gray-500',
};
