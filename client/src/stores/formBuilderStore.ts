import { create } from 'zustand';
import type {
  AdditionalInfoConfig,
  AdditionalInfoSection,
  AdditionalInfoField,
  RelevantBylaws,
  DocumentRequirement,
  ComplianceNotes,
  ARBProcessNotes
} from '@shared/formTypes';

interface FormBuilderState {
  // Schema state
  schema: AdditionalInfoConfig | null;
  originalSchema: AdditionalInfoConfig | null; // For dirty checking

  // UI state
  selectedFieldId: string | null;
  selectedSectionIndex: number | null;
  isPreviewMode: boolean;
  isSaving: boolean;

  // Dirty tracking
  hasUnsavedChanges: boolean;

  // Actions - Form metadata
  setFormTitle: (title: string) => void;
  setFormDescription: (description: string) => void;

  // Actions - Sections
  addSection: (section: AdditionalInfoSection) => void;
  updateSection: (index: number, section: Partial<AdditionalInfoSection>) => void;
  deleteSection: (index: number) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  duplicateSection: (index: number) => void;

  // Actions - Fields
  addField: (sectionIndex: number, field: AdditionalInfoField) => void;
  updateField: (sectionIndex: number, fieldId: string, field: Partial<AdditionalInfoField>) => void;
  deleteField: (sectionIndex: number, fieldId: string) => void;
  reorderFields: (sectionIndex: number, fromIndex: number, toIndex: number) => void;
  moveFieldToSection: (fieldId: string, fromSectionIndex: number, toSectionIndex: number) => void;
  duplicateField: (sectionIndex: number, fieldId: string) => void;

  // Actions - Form settings
  setRelevantBylaws: (bylaws: RelevantBylaws) => void;
  setDocumentRequirements: (documents: DocumentRequirement[]) => void;
  setScoringWeights: (weights: Record<string, number>) => void;
  setComplianceNotes: (notes: ComplianceNotes) => void;
  setARBProcessNotes: (notes: ARBProcessNotes) => void;

  // Actions - UI
  selectField: (sectionIndex: number, fieldId: string) => void;
  deselectField: () => void;
  togglePreviewMode: () => void;
  setSaving: (isSaving: boolean) => void;

  // Actions - Persistence
  loadSchema: (schema: AdditionalInfoConfig) => void;
  reset: () => void;
  discardChanges: () => void;
}

export const useFormBuilderStore = create<FormBuilderState>((set, get) => ({
  // Initial state
  schema: null,
  originalSchema: null,
  selectedFieldId: null,
  selectedSectionIndex: null,
  isPreviewMode: false,
  isSaving: false,
  hasUnsavedChanges: false,

  // Form metadata actions
  setFormTitle: (title: string) => set((state) => {
    if (!state.schema) return state;
    return {
      schema: { ...state.schema, title },
      hasUnsavedChanges: true,
    };
  }),

  setFormDescription: (description: string) => set((state) => {
    if (!state.schema) return state;
    return {
      schema: { ...state.schema, description },
      hasUnsavedChanges: true,
    };
  }),

  // Section actions
  addSection: (section: AdditionalInfoSection) => set((state) => {
    if (!state.schema) return state;
    return {
      schema: {
        ...state.schema,
        sections: [...state.schema.sections, section],
      },
      hasUnsavedChanges: true,
    };
  }),

  updateSection: (index: number, section: Partial<AdditionalInfoSection>) => set((state) => {
    if (!state.schema) return state;
    const sections = [...state.schema.sections];
    sections[index] = { ...sections[index], ...section };
    return {
      schema: { ...state.schema, sections },
      hasUnsavedChanges: true,
    };
  }),

  deleteSection: (index: number) => set((state) => {
    if (!state.schema) return state;
    const sections = state.schema.sections.filter((_, i) => i !== index);
    return {
      schema: { ...state.schema, sections },
      hasUnsavedChanges: true,
    };
  }),

  reorderSections: (fromIndex: number, toIndex: number) => set((state) => {
    if (!state.schema) return state;
    const sections = [...state.schema.sections];
    const [removed] = sections.splice(fromIndex, 1);
    sections.splice(toIndex, 0, removed);
    return {
      schema: { ...state.schema, sections },
      hasUnsavedChanges: true,
    };
  }),

  duplicateSection: (index: number) => set((state) => {
    if (!state.schema) return state;
    const section = state.schema.sections[index];
    const duplicatedSection: AdditionalInfoSection = {
      title: `${section.title} (Copy)`,
      fields: section.fields.map((field, i) => ({
        ...field,
        id: `${field.id}_copy_${i}`,
      })),
    };
    const sections = [...state.schema.sections];
    sections.splice(index + 1, 0, duplicatedSection);
    return {
      schema: { ...state.schema, sections },
      hasUnsavedChanges: true,
    };
  }),

  // Field actions
  addField: (sectionIndex: number, field: AdditionalInfoField) => set((state) => {
    if (!state.schema) return state;
    const sections = [...state.schema.sections];
    sections[sectionIndex] = {
      ...sections[sectionIndex],
      fields: [...sections[sectionIndex].fields, field],
    };
    return {
      schema: { ...state.schema, sections },
      hasUnsavedChanges: true,
    };
  }),

  updateField: (sectionIndex: number, fieldId: string, field: Partial<AdditionalInfoField>) => set((state) => {
    if (!state.schema) return state;
    const sections = [...state.schema.sections];
    const fieldIndex = sections[sectionIndex].fields.findIndex(f => f.id === fieldId);
    if (fieldIndex === -1) return state;

    sections[sectionIndex] = {
      ...sections[sectionIndex],
      fields: sections[sectionIndex].fields.map((f, i) =>
        i === fieldIndex ? { ...f, ...field } : f
      ),
    };
    return {
      schema: { ...state.schema, sections },
      hasUnsavedChanges: true,
    };
  }),

  deleteField: (sectionIndex: number, fieldId: string) => set((state) => {
    if (!state.schema) return state;
    const sections = [...state.schema.sections];
    sections[sectionIndex] = {
      ...sections[sectionIndex],
      fields: sections[sectionIndex].fields.filter(f => f.id !== fieldId),
    };
    return {
      schema: { ...state.schema, sections },
      hasUnsavedChanges: true,
    };
  }),

  reorderFields: (sectionIndex: number, fromIndex: number, toIndex: number) => set((state) => {
    if (!state.schema) return state;
    const sections = [...state.schema.sections];
    const fields = [...sections[sectionIndex].fields];
    const [removed] = fields.splice(fromIndex, 1);
    fields.splice(toIndex, 0, removed);
    sections[sectionIndex] = { ...sections[sectionIndex], fields };
    return {
      schema: { ...state.schema, sections },
      hasUnsavedChanges: true,
    };
  }),

  moveFieldToSection: (fieldId: string, fromSectionIndex: number, toSectionIndex: number) => set((state) => {
    if (!state.schema) return state;
    const sections = [...state.schema.sections];
    const fieldIndex = sections[fromSectionIndex].fields.findIndex(f => f.id === fieldId);
    if (fieldIndex === -1) return state;

    const [field] = sections[fromSectionIndex].fields.splice(fieldIndex, 1);
    sections[toSectionIndex].fields.push(field);

    return {
      schema: { ...state.schema, sections },
      hasUnsavedChanges: true,
    };
  }),

  duplicateField: (sectionIndex: number, fieldId: string) => set((state) => {
    if (!state.schema) return state;
    const sections = [...state.schema.sections];
    const fieldIndex = sections[sectionIndex].fields.findIndex(f => f.id === fieldId);
    if (fieldIndex === -1) return state;

    const field = sections[sectionIndex].fields[fieldIndex];
    const duplicatedField: AdditionalInfoField = {
      ...field,
      id: `${field.id}_2`,
      label: `${field.label} (Copy)`,
    };

    sections[sectionIndex] = {
      ...sections[sectionIndex],
      fields: [
        ...sections[sectionIndex].fields.slice(0, fieldIndex + 1),
        duplicatedField,
        ...sections[sectionIndex].fields.slice(fieldIndex + 1),
      ],
    };

    return {
      schema: { ...state.schema, sections },
      hasUnsavedChanges: true,
    };
  }),

  // Form settings actions
  setRelevantBylaws: (bylaws: RelevantBylaws) => set((state) => {
    if (!state.schema) return state;
    return {
      schema: { ...state.schema, relevantBylaws: bylaws },
      hasUnsavedChanges: true,
    };
  }),

  setDocumentRequirements: (documents: DocumentRequirement[]) => set((state) => {
    if (!state.schema) return state;
    return {
      schema: { ...state.schema, documents },
      hasUnsavedChanges: true,
    };
  }),

  setScoringWeights: (weights: Record<string, number>) => set((state) => {
    if (!state.schema) return state;
    return {
      schema: { ...state.schema, scoring_weights: weights },
      hasUnsavedChanges: true,
    };
  }),

  setComplianceNotes: (notes: ComplianceNotes) => set((state) => {
    if (!state.schema) return state;
    return {
      schema: { ...state.schema, complianceNotes: notes },
      hasUnsavedChanges: true,
    };
  }),

  setARBProcessNotes: (notes: ARBProcessNotes) => set((state) => {
    if (!state.schema) return state;
    return {
      schema: { ...state.schema, arbProcessNotes: notes },
      hasUnsavedChanges: true,
    };
  }),

  // UI actions
  selectField: (sectionIndex: number, fieldId: string) => set({
    selectedSectionIndex: sectionIndex,
    selectedFieldId: fieldId,
  }),

  deselectField: () => set({
    selectedSectionIndex: null,
    selectedFieldId: null,
  }),

  togglePreviewMode: () => set((state) => ({
    isPreviewMode: !state.isPreviewMode,
  })),

  setSaving: (isSaving: boolean) => set({ isSaving }),

  // Persistence actions
  loadSchema: (schema: AdditionalInfoConfig) => set({
    schema,
    originalSchema: JSON.parse(JSON.stringify(schema)), // Deep clone
    hasUnsavedChanges: false,
  }),

  reset: () => set({
    schema: null,
    originalSchema: null,
    selectedFieldId: null,
    selectedSectionIndex: null,
    isPreviewMode: false,
    isSaving: false,
    hasUnsavedChanges: false,
  }),

  discardChanges: () => set((state) => ({
    schema: state.originalSchema ? JSON.parse(JSON.stringify(state.originalSchema)) : null,
    hasUnsavedChanges: false,
  })),
}));
