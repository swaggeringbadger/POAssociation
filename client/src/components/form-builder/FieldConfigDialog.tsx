import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, X } from 'lucide-react';
import type { AdditionalInfoField } from '@shared/formTypes';

interface FieldConfigDialogProps {
  open: boolean;
  onClose: () => void;
  fieldType: string | null;
  onSave: (field: AdditionalInfoField) => void;
}

// Generate snake_case ID from label
function generateFieldId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

export function FieldConfigDialog({ open, onClose, fieldType, onSave }: FieldConfigDialogProps) {
  const [label, setLabel] = useState('');
  const [id, setId] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [description, setDescription] = useState('');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<string[]>(['', '']);
  const [idManuallyEdited, setIdManuallyEdited] = useState(false);

  // Auto-generate ID from label
  useEffect(() => {
    if (!idManuallyEdited && label) {
      setId(generateFieldId(label));
    }
  }, [label, idManuallyEdited]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setLabel('');
        setId('');
        setPlaceholder('');
        setDescription('');
        setRequired(false);
        setOptions(['', '']);
        setIdManuallyEdited(false);
      }, 200);
    }
  }, [open]);

  const needsOptions = fieldType && ['select', 'radio', 'checkbox'].includes(fieldType);

  const handleAddOption = () => {
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSave = () => {
    const field: AdditionalInfoField = {
      id,
      label,
      type: fieldType as any,
      required,
      placeholder: placeholder || undefined,
      description: description || undefined,
      options: needsOptions ? options.filter(o => o.trim()) : undefined,
    };

    onSave(field);
    onClose();
  };

  const isValid = () => {
    if (!label.trim() || !id.trim()) return false;
    if (!/^[a-z][a-z0-9_]*$/.test(id)) return false;
    if (needsOptions && options.filter(o => o.trim()).length < 2) return false;
    return true;
  };

  if (!fieldType) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {fieldType} Field</DialogTitle>
          <DialogDescription>
            Set up the properties for this field
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="label">
              Field Label <span className="text-red-500">*</span>
            </Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Project Description"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              This is what users will see
            </p>
          </div>

          {/* Field ID */}
          <div className="space-y-2">
            <Label htmlFor="id">
              Field ID <span className="text-red-500">*</span>
            </Label>
            <Input
              id="id"
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setIdManuallyEdited(true);
              }}
              placeholder="e.g., project_description"
              maxLength={50}
              className={!/^[a-z][a-z0-9_]*$/.test(id) && id ? 'border-red-500' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Must be lowercase with underscores (snake_case)
            </p>
          </div>

          {/* Placeholder */}
          <div className="space-y-2">
            <Label htmlFor="placeholder">Placeholder Text</Label>
            <Input
              id="placeholder"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              placeholder="e.g., Enter your project details..."
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Help Text</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide additional guidance for users..."
              maxLength={500}
              rows={3}
            />
          </div>

          {/* Required Toggle */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label htmlFor="required" className="cursor-pointer">
                Required Field
              </Label>
              <p className="text-xs text-muted-foreground">
                Users must fill this field to submit
              </p>
            </div>
            <Switch
              id="required"
              checked={required}
              onCheckedChange={setRequired}
            />
          </div>

          {/* Options (for select/radio/checkbox) */}
          {needsOptions && (
            <div className="space-y-2">
              <Label>
                Options <span className="text-red-500">* (min 2)</span>
              </Label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                    />
                    {options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddOption}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Option
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid()}>
            Add Field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
