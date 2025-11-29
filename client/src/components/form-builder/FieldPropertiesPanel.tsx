import React, { useEffect, useState } from 'react';
import { useFormBuilderStore } from '@/stores/formBuilderStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, X, Trash2 } from 'lucide-react';
import { FieldIcon } from './FieldIcon';
import { ConfirmDialog } from './ConfirmDialog';

export function FieldPropertiesPanel() {
  const schema = useFormBuilderStore(state => state.schema);
  const selectedFieldId = useFormBuilderStore(state => state.selectedFieldId);
  const selectedSectionIndex = useFormBuilderStore(state => state.selectedSectionIndex);
  const updateField = useFormBuilderStore(state => state.updateField);
  const deleteField = useFormBuilderStore(state => state.deleteField);
  const deselectField = useFormBuilderStore(state => state.deselectField);

  // Local state for editing
  const [label, setLabel] = useState('');
  const [id, setId] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [description, setDescription] = useState('');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Get selected field
  const selectedField = React.useMemo(() => {
    if (!schema || selectedSectionIndex === null || !selectedFieldId) return null;
    return schema.sections[selectedSectionIndex]?.fields.find(f => f.id === selectedFieldId);
  }, [schema, selectedSectionIndex, selectedFieldId]);

  // Update local state when field changes
  useEffect(() => {
    if (selectedField) {
      setLabel(selectedField.label);
      setId(selectedField.id);
      setPlaceholder(selectedField.placeholder || '');
      setDescription(selectedField.description || '');
      setRequired(selectedField.required);
      setOptions(selectedField.options || []);
    }
  }, [selectedField]);

  const needsOptions = selectedField && ['select', 'radio', 'checkbox'].includes(selectedField.type);

  const handleSave = () => {
    if (!selectedField || selectedSectionIndex === null) return;

    updateField(selectedSectionIndex, selectedField.id, {
      label,
      id,
      placeholder: placeholder || undefined,
      description: description || undefined,
      required,
      options: needsOptions ? options.filter(o => o.trim()) : undefined,
    });
  };

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

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedField || selectedSectionIndex === null) return;
    deleteField(selectedSectionIndex, selectedField.id);
    deselectField();
  };

  const isValid = () => {
    if (!label.trim() || !id.trim()) return false;
    if (!/^[a-z][a-z0-9_]*$/.test(id)) return false;
    if (needsOptions && options.filter(o => o.trim()).length < 2) return false;
    return true;
  };

  const hasChanges = () => {
    if (!selectedField) return false;
    return (
      label !== selectedField.label ||
      id !== selectedField.id ||
      placeholder !== (selectedField.placeholder || '') ||
      description !== (selectedField.description || '') ||
      required !== selectedField.required ||
      JSON.stringify(options) !== JSON.stringify(selectedField.options || [])
    );
  };

  if (!selectedField) {
    return (
      <div className="text-sm text-muted-foreground">
        <p>Select a field to edit its properties</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Field Header */}
      <div className="flex items-center gap-2 pb-4 border-b">
        <FieldIcon type={selectedField.type} className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Field Properties</h3>
          <p className="text-xs text-muted-foreground capitalize">{selectedField.type} Field</p>
        </div>
        <button
          onClick={() => deselectField()}
          className="p-1 hover:bg-accent rounded"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Field Label */}
      <div className="space-y-2">
        <Label htmlFor="prop-label">
          Field Label <span className="text-red-500">*</span>
        </Label>
        <Input
          id="prop-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., Project Description"
          maxLength={200}
        />
      </div>

      {/* Field ID */}
      <div className="space-y-2">
        <Label htmlFor="prop-id">
          Field ID <span className="text-red-500">*</span>
        </Label>
        <Input
          id="prop-id"
          value={id}
          onChange={(e) => setId(e.target.value)}
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
        <Label htmlFor="prop-placeholder">Placeholder Text</Label>
        <Input
          id="prop-placeholder"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          placeholder="e.g., Enter your project details..."
          maxLength={200}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="prop-description">Help Text</Label>
        <Textarea
          id="prop-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Provide additional guidance for users..."
          maxLength={500}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          {description.length}/500 characters
        </p>
      </div>

      {/* Required Toggle */}
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <Label htmlFor="prop-required" className="cursor-pointer">
            Required Field
          </Label>
          <p className="text-xs text-muted-foreground">
            Users must fill this field to submit
          </p>
        </div>
        <Switch
          id="prop-required"
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

      {/* Action Buttons */}
      <div className="pt-4 border-t space-y-2">
        <Button
          onClick={handleSave}
          disabled={!isValid() || !hasChanges()}
          className="w-full"
        >
          Save Changes
        </Button>
        <Button
          onClick={handleDelete}
          variant="destructive"
          className="w-full"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Field
        </Button>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Field"
        description={`Are you sure you want to delete "${selectedField?.label}"? This action cannot be undone.`}
        confirmText="Delete Field"
        variant="danger"
      />
    </div>
  );
}
