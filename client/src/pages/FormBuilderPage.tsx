import React, { useEffect } from 'react';
import { useRoute } from 'wouter';
import { Loader2 } from 'lucide-react';

export default function FormBuilderPage() {
  const [match, params] = useRoute('/form-builder/:templateId');
  const templateId = params?.templateId;

  useEffect(() => {
    console.log('[FormBuilder] Loading template:', templateId);
  }, [templateId]);

  if (!templateId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Invalid template ID</p>
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
              Template ID: {templateId}
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
                placeholder="Form Title"
                className="text-3xl font-bold w-full bg-transparent border-none focus:outline-none focus:ring-0"
              />
              <textarea
                placeholder="Form Description"
                className="mt-2 w-full bg-transparent border-none focus:outline-none focus:ring-0 text-muted-foreground resize-none"
                rows={2}
              />
            </div>

            <div className="text-center py-12 text-muted-foreground">
              <p>Form builder canvas - sections and fields will appear here</p>
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
