import React, { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { Loader2, AlertCircle } from 'lucide-react';
import { useFormBuilderStore } from '@/stores/formBuilderStore';
import { useValidationStore } from '@/stores/validationStore';
import { apiRequest } from '@/lib/api';
import type { FormTemplate } from '@shared/formTypes';

export default function FormBuilderPage() {
  const [match, params] = useRoute('/form-builder/:templateId');
  const templateId = params?.templateId;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);

  const loadSchema = useFormBuilderStore(state => state.loadSchema);
  const schema = useFormBuilderStore(state => state.schema);
  const validate = useValidationStore(state => state.validate);

  useEffect(() => {
    async function fetchTemplate() {
      if (!templateId) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await apiRequest<FormTemplate>(`/api/form-templates/${templateId}`);
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
              {template.name} · v{template.versionNumber} · {template.projectType}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm border rounded hover:bg-accent">
              Discard
            </button>
            <button className="px-4 py-2 text-sm border rounded hover:bg-accent">
              Update Version
            </button>
            <button className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90">
              Save as New Version
            </button>
          </div>
        </div>
      </header>

      {/* 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Section Tree */}
        <aside className="w-64 border-r bg-muted/20 p-4 overflow-y-auto">
          <h2 className="font-semibold mb-4">Sections</h2>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              No sections yet
            </p>
          </div>
        </aside>

        {/* Center Canvas - Form Editor */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <input
                type="text"
                value={schema.title}
                readOnly
                placeholder="Form Title"
                className="text-3xl font-bold w-full bg-transparent border-none focus:outline-none focus:ring-0"
              />
              <textarea
                value={schema.description || ''}
                readOnly
                placeholder="Form Description"
                className="mt-2 w-full bg-transparent border-none focus:outline-none focus:ring-0 text-muted-foreground resize-none"
                rows={2}
              />
            </div>

            {/* Sections */}
            <div className="space-y-6">
              {schema.sections.map((section, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3">{section.title}</h3>
                  <div className="space-y-2">
                    {section.fields.map((field) => (
                      <div key={field.id} className="flex items-center gap-2 p-2 border rounded bg-muted/30">
                        <span className="text-sm font-medium">{field.label}</span>
                        <span className="text-xs text-muted-foreground">({field.type})</span>
                        {field.required && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Required</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Right Panel - Properties */}
        <aside className="w-80 border-l bg-muted/20 p-4 overflow-y-auto">
          <h2 className="font-semibold mb-4">Properties</h2>
          <div className="text-sm text-muted-foreground">
            <p>Select a field to edit its properties</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
