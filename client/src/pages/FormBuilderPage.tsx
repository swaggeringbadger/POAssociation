import React, { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Loader2, AlertCircle } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useFormBuilderStore } from '@/stores/formBuilderStore';
import { useValidationStore } from '@/stores/validationStore';
import { SectionList } from '@/components/form-builder/SectionList';
import { FormBuilderSidebar } from '@/components/form-builder/FormBuilderSidebar';
import { SaveVersionDialog } from '@/components/form-builder/SaveVersionDialog';
import { FieldPropertiesPanel } from '@/components/form-builder/FieldPropertiesPanel';
import { DocumentRequirementsEditor } from '@/components/form-builder/DocumentRequirementsEditor';
import { UnsavedChangesDialog } from '@/components/form-builder/UnsavedChangesDialog';
import { ConfirmDialog } from '@/components/form-builder/ConfirmDialog';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import type { FormTemplate } from '@shared/formTypes';

export default function FormBuilderPage() {
  const [match, params] = useRoute('/form-builder/:templateId');
  const templateId = params?.templateId;
  const [, setLocation] = useLocation();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<'new' | 'update'>('new');
  const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const loadSchema = useFormBuilderStore(state => state.loadSchema);
  const schema = useFormBuilderStore(state => state.schema);
  const setFormTitle = useFormBuilderStore(state => state.setFormTitle);
  const setFormDescription = useFormBuilderStore(state => state.setFormDescription);
  const hasUnsavedChanges = useFormBuilderStore(state => state.hasUnsavedChanges);
  const discardChanges = useFormBuilderStore(state => state.discardChanges);
  const markAsSaved = useFormBuilderStore(state => state.markAsSaved);
  const validate = useValidationStore(state => state.validate);
  const errors = useValidationStore(state => state.errors);

  const handleDiscard = () => {
    setDiscardConfirmOpen(true);
  };

  const confirmDiscard = () => {
    discardChanges();
    if (pendingNavigation) {
      setLocation(pendingNavigation);
    }
  };

  const handleOpenSaveDialog = (mode: 'new' | 'update') => {
    setSaveMode(mode);
    setSaveDialogOpen(true);
  };

  const handleSave = async (versionName: string, description: string) => {
    if (!schema || !template) return;

    // Validate before saving
    validate(schema);
    if (errors.length > 0) {
      toast({
        title: 'Validation Failed',
        description: `Please fix ${errors.length} validation ${errors.length === 1 ? 'error' : 'errors'} before saving.`,
        variant: 'destructive',
      });
      throw new Error('Validation failed');
    }

    try {
      if (saveMode === 'new') {
        // Create new version
        const newTemplate = await api.createFormTemplate({
          tenantId: template.tenantId,
          name: versionName,
          description: description || template.description || '',
          projectType: template.projectType,
          schema,
        });

        toast({
          title: 'Version Created',
          description: `Successfully created new version "${versionName}"`,
        });

        markAsSaved();

        // Navigate back to form wizard
        setTimeout(() => {
          setLocation('/form-wizard');
        }, 500);
      } else {
        // Update existing version
        await api.updateFormTemplate(template.id, {
          name: versionName,
          description: description || template.description || '',
          schema,
        });

        toast({
          title: 'Version Updated',
          description: `Successfully updated "${versionName}"`,
        });

        markAsSaved();

        // Navigate back to form wizard
        setTimeout(() => {
          setLocation('/form-wizard');
        }, 500);
      }
    } catch (error: any) {
      console.error('[FormBuilder] Save failed:', error);
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save form template',
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    async function fetchTemplate() {
      if (!templateId) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await api.getFormTemplate(templateId);
        setTemplate(data);
        loadSchema(data.schema);
        validate(data.schema);
      } catch (err: any) {
        console.error('[FormBuilder] Failed to load template:', err);
        setError(err.message || 'Failed to load form template');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTemplate();
  }, [templateId, loadSchema, validate]);

  // Browser close/refresh warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle unsaved changes when navigating away
  const handleUnsavedChangesDiscard = () => {
    discardChanges();
    if (pendingNavigation) {
      setLocation(pendingNavigation);
      setPendingNavigation(null);
    }
    setUnsavedChangesDialogOpen(false);
  };

  const handleUnsavedChangesSave = () => {
    setUnsavedChangesDialogOpen(false);
    setSaveMode('new');
    setSaveDialogOpen(true);
    // After save, navigation will happen via the save handler
  };

  if (!templateId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Invalid template ID</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Loading form template...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Failed to Load Template</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!schema || !template) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">No template data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Form Builder</h1>
            <p className="text-sm text-muted-foreground">
              {template.name} · v{template.version} · {template.projectType}
              {hasUnsavedChanges && <span className="ml-2 text-orange-600">• Unsaved changes</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDiscard}
              className="px-4 py-2 text-sm border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!hasUnsavedChanges}
            >
              Discard
            </button>
            <button
              onClick={() => handleOpenSaveDialog('update')}
              className="px-4 py-2 text-sm border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!hasUnsavedChanges}
            >
              Update Version
            </button>
            <button
              onClick={() => handleOpenSaveDialog('new')}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!hasUnsavedChanges}
            >
              Save as New Version
            </button>
          </div>
        </div>
      </header>

      {/* 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Section Tree */}
        <aside className="w-64 border-r bg-muted/20 p-4 overflow-y-auto">
          <FormBuilderSidebar />
        </aside>

        {/* Resizable Center and Right Panels */}
        <PanelGroup direction="horizontal" className="flex-1">
          {/* Center Canvas - Form Editor */}
          <Panel defaultSize={70} minSize={40}>
            <main className="h-full p-6 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                  <input
                    type="text"
                    value={schema.title}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Form Title"
                    className="text-3xl font-bold w-full bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-2 -mx-2 transition-all"
                    maxLength={200}
                  />
                  <textarea
                    value={schema.description || ''}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Form Description"
                    className="mt-2 w-full bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary/20 rounded px-2 -mx-2 text-muted-foreground resize-none transition-all"
                    rows={2}
                    maxLength={1000}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {schema.description?.length || 0}/1000 characters
                  </p>
                </div>

                {/* Sections */}
                <SectionList />

                {/* Document Requirements */}
                <div className="mt-8 pt-8 border-t">
                  <DocumentRequirementsEditor />
                </div>
              </div>
            </main>
          </Panel>

          {/* Resizable Handle */}
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize" />

          {/* Right Panel - Properties */}
          <Panel defaultSize={30} minSize={20} maxSize={50}>
            <aside className="h-full border-l bg-muted/20 p-4 overflow-y-auto">
              <h2 className="font-semibold mb-4">Properties</h2>
              <FieldPropertiesPanel />
            </aside>
          </Panel>
        </PanelGroup>
      </div>

      {/* Save Version Dialog */}
      <SaveVersionDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSave}
        mode={saveMode}
        currentVersionName={template?.name}
        validationErrors={errors.length}
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={unsavedChangesDialogOpen}
        onClose={() => {
          setUnsavedChangesDialogOpen(false);
          setPendingNavigation(null);
        }}
        onDiscard={handleUnsavedChangesDiscard}
        onSave={handleUnsavedChangesSave}
      />

      {/* Discard Confirmation Dialog */}
      <ConfirmDialog
        open={discardConfirmOpen}
        onClose={() => setDiscardConfirmOpen(false)}
        onConfirm={confirmDiscard}
        title="Discard Changes"
        description="Are you sure you want to discard all unsaved changes? This action cannot be undone."
        confirmText="Discard Changes"
        variant="warning"
      />
    </div>
  );
}
