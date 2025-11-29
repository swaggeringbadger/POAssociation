import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Type, AlignLeft, Hash, Calendar, ChevronDown, Circle, CheckSquare } from 'lucide-react';

interface FieldTypeSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectType: (type: string) => void;
}

const FIELD_TYPES = [
  {
    type: 'text',
    icon: Type,
    name: 'Text',
    description: 'Single-line text input',
    example: 'Name, address, email',
  },
  {
    type: 'textarea',
    icon: AlignLeft,
    name: 'Text Area',
    description: 'Multi-line text input',
    example: 'Description, comments, notes',
  },
  {
    type: 'number',
    icon: Hash,
    name: 'Number',
    description: 'Numeric input with validation',
    example: 'Age, quantity, measurements',
  },
  {
    type: 'date',
    icon: Calendar,
    name: 'Date',
    description: 'Date picker input',
    example: 'Birth date, completion date',
  },
  {
    type: 'select',
    icon: ChevronDown,
    name: 'Dropdown',
    description: 'Select one option from a list',
    example: 'Country, category, status',
  },
  {
    type: 'radio',
    icon: Circle,
    name: 'Radio Buttons',
    description: 'Choose one option (visible options)',
    example: 'Yes/No, size selection',
  },
  {
    type: 'checkbox',
    icon: CheckSquare,
    name: 'Checkboxes',
    description: 'Select multiple options',
    example: 'Features, preferences, amenities',
  },
];

export function FieldTypeSelector({ open, onClose, onSelectType }: FieldTypeSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Field</DialogTitle>
          <DialogDescription>
            Choose the type of field you want to add to this section
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-4">
          {FIELD_TYPES.map((fieldType) => {
            const Icon = fieldType.icon;
            return (
              <button
                key={fieldType.type}
                onClick={() => {
                  onSelectType(fieldType.type);
                  onClose();
                }}
                className="flex items-start gap-3 p-4 border rounded-lg hover:border-primary hover:bg-accent transition-all text-left group"
              >
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                    {fieldType.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fieldType.description}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1 italic">
                    e.g., {fieldType.example}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
