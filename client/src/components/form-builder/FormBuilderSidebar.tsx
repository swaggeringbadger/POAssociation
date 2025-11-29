import React from 'react';
import { useFormBuilderStore } from '@/stores/formBuilderStore';
import { ChevronRight, ChevronDown, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function FormBuilderSidebar() {
  const schema = useFormBuilderStore(state => state.schema);
  const [expandedSections, setExpandedSections] = React.useState<Set<number>>(new Set());
  const [documentsExpanded, setDocumentsExpanded] = React.useState(false);

  if (!schema) return null;

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const documents = schema.documents || [];
  const requiredDocsCount = documents.filter(d => d.required).length;

  return (
    <div className="space-y-2">
      <h2 className="font-semibold mb-4 text-sm uppercase text-muted-foreground">
        Form Structure
      </h2>

      {schema.sections.map((section, index) => {
        const isExpanded = expandedSections.has(index);
        const requiredCount = section.fields.filter(f => f.required).length;

        return (
          <div key={index} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection(index)}
              className="w-full flex items-center gap-2 p-3 hover:bg-accent transition-colors text-left"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="flex-1 font-medium text-sm truncate">
                {section.title}
              </span>
              <div className="flex gap-1">
                <Badge variant="secondary" className="text-xs">
                  {section.fields.length}
                </Badge>
                {requiredCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {requiredCount}*
                  </Badge>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t bg-muted/30">
                {section.fields.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-3">
                    No fields
                  </p>
                ) : (
                  <div className="p-2 space-y-1">
                    {section.fields.map((field) => (
                      <div
                        key={field.id}
                        className="text-xs p-2 rounded hover:bg-accent cursor-pointer"
                      >
                        <div className="font-medium truncate">{field.label}</div>
                        <div className="text-muted-foreground flex items-center gap-2">
                          <span>{field.type}</span>
                          {field.required && (
                            <span className="text-red-600">required</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {schema.sections.length === 0 && (
        <p className="text-sm text-muted-foreground italic text-center py-8">
          No sections yet. Add one to get started.
        </p>
      )}

      {/* Documents Section */}
      <div className="border rounded-lg overflow-hidden mt-4">
        <button
          onClick={() => setDocumentsExpanded(!documentsExpanded)}
          className="w-full flex items-center gap-2 p-3 hover:bg-accent transition-colors text-left"
        >
          {documentsExpanded ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          )}
          <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="flex-1 font-medium text-sm">
            Documents
          </span>
          <div className="flex gap-1">
            <Badge variant="secondary" className="text-xs">
              {documents.length}
            </Badge>
            {requiredDocsCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {requiredDocsCount}*
              </Badge>
            )}
          </div>
        </button>

        {documentsExpanded && (
          <div className="border-t bg-muted/30">
            {documents.length === 0 ? (
              <p className="text-xs text-muted-foreground italic p-3">
                No documents
              </p>
            ) : (
              <div className="p-2 space-y-1">
                {documents.map((doc, index) => (
                  <div
                    key={index}
                    className="text-xs p-2 rounded hover:bg-accent cursor-pointer"
                  >
                    <div className="font-medium truncate">{doc.name}</div>
                    <div className="text-muted-foreground">
                      {doc.required ? (
                        <span className="text-red-600">required</span>
                      ) : (
                        <span>optional</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
