import React, { useState } from 'react';
import { Pencil, Trash2, GripVertical, Plus, Copy, X } from 'lucide-react';
import { useFormBuilderStore } from '@/stores/formBuilderStore';
import { Button } from '@/components/ui/button';
import { FieldTypeSelector } from './FieldTypeSelector';
import { FieldConfigDialog } from './FieldConfigDialog';
import { FieldIcon } from './FieldIcon';
import { ConfirmDialog } from './ConfirmDialog';
import type { AdditionalInfoSection, AdditionalInfoField } from '@shared/formTypes';
import { cn } from '@/lib/utils';

function FieldItem({ field, sectionIndex }: { field: AdditionalInfoField; sectionIndex: number }) {
  const selectField = useFormBuilderStore(state => state.selectField);
  const deleteField = useFormBuilderStore(state => state.deleteField);
  const updateField = useFormBuilderStore(state => state.updateField);
  const selectedFieldId = useFormBuilderStore(state => state.selectedFieldId);
  const selectedSectionIndex = useFormBuilderStore(state => state.selectedSectionIndex);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isSelected = selectedFieldId === field.id && selectedSectionIndex === sectionIndex;

  const handleClick = (e: React.MouseEvent) => {
    // Don't select if clicking the delete button or required toggle
    if ((e.target as HTMLElement).closest('button')) return;
    selectField(sectionIndex, field.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    deleteField(sectionIndex, field.id);
  };

  const handleToggleRequired = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateField(sectionIndex, field.id, { required: !field.required });
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-center gap-2 p-2 border rounded transition-colors cursor-pointer group",
        isSelected
          ? "bg-primary/10 border-primary ring-2 ring-primary/20"
          : "bg-muted/30 hover:bg-muted/50 border-border"
      )}
    >
      <FieldIcon type={field.type} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm font-medium flex-1">{field.label}</span>
      <span className="text-xs text-muted-foreground">({field.type})</span>
      <button
        onClick={handleToggleRequired}
        className={cn(
          "text-xs px-2 py-0.5 rounded transition-all hover:opacity-80",
          field.required
            ? "bg-red-100 text-red-700 hover:bg-red-200"
            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        )}
        title={field.required ? "Click to make optional" : "Click to make required"}
      >
        {field.required ? "Required" : "Optional"}
      </button>
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 text-destructive rounded transition-opacity"
        title="Delete field"
      >
        <X className="h-3 w-3" />
      </button>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Field"
        description={`Are you sure you want to delete "${field.label}"? This action cannot be undone.`}
        confirmText="Delete Field"
        variant="danger"
      />
    </div>
  );
}

export function SectionList() {
  const schema = useFormBuilderStore(state => state.schema);
  const updateSection = useFormBuilderStore(state => state.updateSection);
  const deleteSection = useFormBuilderStore(state => state.deleteSection);
  const duplicateSection = useFormBuilderStore(state => state.duplicateSection);
  const addSection = useFormBuilderStore(state => state.addSection);
  const addField = useFormBuilderStore(state => state.addField);

  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [fieldTypeSelectorOpen, setFieldTypeSelectorOpen] = useState(false);
  const [fieldConfigOpen, setFieldConfigOpen] = useState(false);
  const [selectedFieldType, setSelectedFieldType] = useState<string | null>(null);
  const [targetSectionIndex, setTargetSectionIndex] = useState<number | null>(null);
  const [deleteSectionIndex, setDeleteSectionIndex] = useState<number | null>(null);

  const handleStartEdit = (index: number, currentTitle: string) => {
    setEditingSectionIndex(index);
    setEditingTitle(currentTitle);
  };

  const handleSaveEdit = (index: number) => {
    if (editingTitle.trim()) {
      updateSection(index, { title: editingTitle.trim() });
    }
    setEditingSectionIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingSectionIndex(null);
    setEditingTitle('');
  };

  const handleDelete = (index: number) => {
    setDeleteSectionIndex(index);
  };

  const confirmDeleteSection = () => {
    if (deleteSectionIndex !== null) {
      deleteSection(deleteSectionIndex);
    }
  };

  const handleAddSection = () => {
    const newSection: AdditionalInfoSection = {
      title: 'New Section',
      fields: [],
    };
    addSection(newSection);
  };

  const handleOpenFieldTypeSelector = (sectionIndex: number) => {
    setTargetSectionIndex(sectionIndex);
    setFieldTypeSelectorOpen(true);
  };

  const handleSelectFieldType = (type: string) => {
    setSelectedFieldType(type);
    setFieldConfigOpen(true);
  };

  const handleSaveField = (field: AdditionalInfoField) => {
    if (targetSectionIndex !== null) {
      addField(targetSectionIndex, field);
    }
  };

  if (!schema) return null;

  return (
    <div className="space-y-4">
      {schema.sections.map((section, index) => (
        <div
          key={index}
          className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
        >
          {/* Section Header */}
          <div className="flex items-start gap-2 mb-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-move flex-shrink-0 mt-0.5" />

            {editingSectionIndex === index ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(index);
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                onBlur={() => handleSaveEdit(index)}
                className="text-lg font-semibold flex-1 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
                maxLength={100}
              />
            ) : (
              <h3
                className="text-lg font-semibold flex-1 cursor-pointer hover:text-primary"
                onClick={() => handleStartEdit(index, section.title)}
              >
                {section.title}
              </h3>
            )}

            <div className="flex gap-1">
              <button
                onClick={() => handleStartEdit(index, section.title)}
                className="p-1 hover:bg-accent rounded"
                title="Edit section"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => duplicateSection(index)}
                className="p-1 hover:bg-accent rounded"
                title="Duplicate section"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDelete(index)}
                className="p-1 hover:bg-destructive/10 text-destructive rounded"
                title="Delete section"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Fields List */}
          <div className="space-y-2">
            {section.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">
                No fields yet. Click "Add Field" to get started.
              </p>
            ) : (
              section.fields.map((field) => (
                <FieldItem
                  key={field.id}
                  field={field}
                  sectionIndex={index}
                />
              ))
            )}
          </div>

          {/* Add Field Button */}
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={() => handleOpenFieldTypeSelector(index)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>
        </div>
      ))}

      {/* Add Section Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleAddSection}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Section
      </Button>

      {/* Dialogs */}
      <FieldTypeSelector
        open={fieldTypeSelectorOpen}
        onClose={() => setFieldTypeSelectorOpen(false)}
        onSelectType={handleSelectFieldType}
      />

      <FieldConfigDialog
        open={fieldConfigOpen}
        onClose={() => setFieldConfigOpen(false)}
        fieldType={selectedFieldType}
        onSave={handleSaveField}
      />

      <ConfirmDialog
        open={deleteSectionIndex !== null}
        onClose={() => setDeleteSectionIndex(null)}
        onConfirm={confirmDeleteSection}
        title="Delete Section"
        description={`Are you sure you want to delete "${schema?.sections[deleteSectionIndex ?? 0]?.title}" and all its fields? This action cannot be undone.`}
        confirmText="Delete Section"
        variant="danger"
      />
    </div>
  );
}
