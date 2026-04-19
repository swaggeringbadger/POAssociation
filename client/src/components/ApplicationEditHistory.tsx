import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCog, Clock, Edit3, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useFormatRoleLabel } from "@/hooks/useLegalEntityLabel";

interface ApplicationFieldEdit {
  id: string;
  applicationId: string;
  tenantId: string;
  editedByUserId: string;
  editedByRole: string;
  onBehalfOfUserId: string;
  fieldPath: string;
  fieldLabel: string | null;
  previousValue: any;
  newValue: any;
  editReason: string | null;
  editSource: string;
  editedAt: string;
  editedByUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
}

interface EditHistoryResponse {
  edits: ApplicationFieldEdit[];
  summary: {
    totalEdits: number;
    editedFields: string[];
    lastEdit: ApplicationFieldEdit | null;
    editorSummary: Array<{
      userId: string;
      name: string;
      role: string;
      editCount: number;
    }>;
  };
}

interface ApplicationEditHistoryProps {
  applicationId: string;
}

const editSourceDisplayNames: Record<string, string> = {
  phone_call: "Phone Call",
  in_person: "In Person",
  email: "Email Request",
  system_correction: "System Correction",
};

function formatValue(value: any): string {
  if (value === null || value === undefined) return "(empty)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.length === 0 ? "(none)" : value.join(", ");
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function formatEditSource(source: string): string {
  return editSourceDisplayNames[source] || source;
}

export function ApplicationEditHistory({ applicationId }: ApplicationEditHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const formatRole = useFormatRoleLabel();

  const { data, isLoading } = useQuery<EditHistoryResponse>({
    queryKey: [`/api/applications/${applicationId}/edit-history`],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}/edit-history`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch edit history");
      return res.json();
    },
  });

  if (isLoading || !data || data.edits.length === 0) {
    return null;
  }

  const { edits, summary } = data;

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-amber-50/50 transition-colors py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-amber-600" />
                <CardTitle className="text-base">Delegated Edit History</CardTitle>
                <Badge variant="secondary" className="ml-2">
                  {summary.totalEdits} edit{summary.totalEdits !== 1 ? "s" : ""}
                </Badge>
              </div>
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <CardDescription className="text-xs">
              Changes made on behalf of the applicant by management or board members
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Editor Summary */}
            <div className="flex flex-wrap gap-2 pb-3 border-b">
              {summary.editorSummary.map((editor) => (
                <Badge key={editor.userId} variant="outline" className="bg-white text-xs">
                  {editor.name} ({formatRole(editor.role)}): {editor.editCount} edit{editor.editCount !== 1 ? "s" : ""}
                </Badge>
              ))}
            </div>

            {/* Edit Timeline */}
            <div className="space-y-3">
              {edits.map((edit) => (
                <div
                  key={edit.id}
                  className="flex gap-3 p-3 bg-white rounded-lg border border-amber-100"
                >
                  <Edit3 className="h-4 w-4 text-amber-500 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {edit.fieldLabel || edit.fieldPath}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {edit.editedByUser.firstName} {edit.editedByUser.lastName}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(edit.editedAt).toLocaleString()}
                        {edit.editSource && ` via ${formatEditSource(edit.editSource)}`}
                      </span>
                    </div>
                    {edit.editReason && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        "{edit.editReason}"
                      </p>
                    )}
                    <div className="mt-2 text-xs flex items-center gap-2 flex-wrap">
                      <span className="text-red-600 line-through bg-red-50 px-1 rounded">
                        {formatValue(edit.previousValue)}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-green-600 bg-green-50 px-1 rounded">
                        {formatValue(edit.newValue)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default ApplicationEditHistory;
