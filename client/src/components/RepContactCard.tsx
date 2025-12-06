import { useQuery } from "@tanstack/react-query";
import { api, PropertyRepInfo, PropertyRepAssignment, User } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Phone, ChevronDown, User as UserIcon } from "lucide-react";
import { useState } from "react";

interface RepContactCardProps {
  propertyId: string;
  className?: string;
}

export default function RepContactCard({ propertyId, className }: RepContactCardProps) {
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  const { data: repInfo, isLoading, error } = useQuery({
    queryKey: ["propertyRepInfo", propertyId],
    queryFn: () => api.getPropertyRepInfo(propertyId),
    enabled: !!propertyId,
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Your Property Representative
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !repInfo) {
    return null;
  }

  const { reps, fallbackRep, fallbackTitle } = repInfo;

  // Find primary rep and backup reps from the reps array
  const primaryRep = reps.find(r => r.designation === 'primary');
  const backupReps = reps.filter(r => r.designation !== 'primary');

  // Determine what to show - primary rep takes precedence, then fallback
  const mainRep = primaryRep;
  const mainContact = mainRep || (fallbackRep ? { user: fallbackRep, designation: 'default', title: fallbackTitle } : null);
  const hasBackups = backupReps && backupReps.length > 0;

  // If no rep info at all, don't show the card
  if (!mainContact) {
    return null;
  }

  const getInitials = (firstName?: string | null, lastName?: string | null, email?: string | null) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    return email?.substring(0, 2).toUpperCase() || "?";
  };

  const getDisplayName = (user: { firstName?: string | null; lastName?: string | null; email?: string | null }) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email || "Unknown";
  };

  const RepDisplay = ({
    rep,
    showBadge = true,
    compact = false,
    isFallback = false
  }: {
    rep: { user?: User | null; designation?: string; title?: string | null };
    showBadge?: boolean;
    compact?: boolean;
    isFallback?: boolean;
  }) => {
    const user = rep.user;
    if (!user) return null;

    return (
      <div className={`flex items-start gap-3 ${compact ? 'py-2' : ''}`}>
        <Avatar className={compact ? "h-10 w-10" : "h-12 w-12"}>
          <AvatarImage src={user.profileImageUrl || undefined} />
          <AvatarFallback>
            {getInitials(user.firstName, user.lastName, user.email)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-medium ${compact ? 'text-sm' : ''}`}>
              {getDisplayName(user)}
            </p>
            {showBadge && rep.designation && rep.designation !== 'default' && (
              <Badge variant="secondary" className="text-xs capitalize">
                {rep.designation}
              </Badge>
            )}
          </div>
          {rep.title && (
            <p className="text-sm text-muted-foreground">{rep.title}</p>
          )}
          <div className="mt-2 space-y-1">
            {user.email && (
              <a
                href={`mailto:${user.email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                <span className="truncate">{user.email}</span>
              </a>
            )}
            {user.phoneNumber && (
              <a
                href={`tel:${user.phoneNumber}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
                {user.phoneNumber}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  const isFallbackShowing = !primaryRep && fallbackRep;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <UserIcon className="h-4 w-4" />
          Your Property Representative
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RepDisplay rep={mainContact} showBadge={!isFallbackShowing} isFallback={!!isFallbackShowing} />

        {isFallbackShowing && (
          <p className="text-xs text-muted-foreground italic">
            Default representative for this management company
          </p>
        )}

        {hasBackups && (
          <Collapsible open={isBackupOpen} onOpenChange={setIsBackupOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between h-auto py-2">
                <span className="text-sm text-muted-foreground">
                  {backupReps.length} backup rep{backupReps.length > 1 ? 's' : ''}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isBackupOpen ? 'rotate-180' : ''}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2 border-t">
              {backupReps.map((backup: PropertyRepAssignment) => (
                <RepDisplay key={backup.id} rep={backup} compact />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
