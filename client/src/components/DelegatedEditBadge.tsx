import { Badge } from "@/components/ui/badge";
import { UserCog } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useFormatRoleLabel } from "@/hooks/useLegalEntityLabel";

interface DelegatedEditBadgeProps {
  editorName: string;
  editorRole: string;
  editedAt: string;
  fieldLabel?: string;
  editReason?: string | null;
  editSource?: string;
}

const editSourceDisplayNames: Record<string, string> = {
  phone_call: "Phone Call",
  in_person: "In Person",
  email: "Email Request",
  system_correction: "System Correction",
};

export function DelegatedEditBadge({
  editorName,
  editorRole,
  editedAt,
  fieldLabel,
  editReason,
  editSource,
}: DelegatedEditBadgeProps) {
  const formatRole = useFormatRoleLabel();

  const formatEditSource = (source: string): string => {
    return editSourceDisplayNames[source] || source;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Badge
          variant="outline"
          className="ml-2 cursor-help bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 text-xs"
        >
          <UserCog className="h-3 w-3 mr-1" />
          Edited on behalf
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-amber-600" />
            <span className="font-semibold text-sm">Delegated Edit</span>
          </div>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Edited by:</span>
              <span className="font-medium">{editorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role:</span>
              <span>{formatRole(editorRole)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">When:</span>
              <span>{formatDate(editedAt)}</span>
            </div>
            {editSource && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source:</span>
                <span>{formatEditSource(editSource)}</span>
              </div>
            )}
            {editReason && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground text-xs">Reason:</span>
                <p className="text-sm mt-1 italic text-muted-foreground">
                  "{editReason}"
                </p>
              </div>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export default DelegatedEditBadge;
