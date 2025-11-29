import React from 'react';
import { Type, AlignLeft, Hash, Calendar, ChevronDown, Circle, CheckSquare, HelpCircle } from 'lucide-react';

interface FieldIconProps {
  type: string;
  className?: string;
}

const ICON_MAP: Record<string, any> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  date: Calendar,
  select: ChevronDown,
  radio: Circle,
  checkbox: CheckSquare,
};

export function FieldIcon({ type, className = "h-4 w-4" }: FieldIconProps) {
  const Icon = ICON_MAP[type] || HelpCircle;
  return <Icon className={className} />;
}
