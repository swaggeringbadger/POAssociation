import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type AgendaSuggestions as AgendaSuggestionsType,
  type AgendaSection,
  type Application,
  type ReviewStage,
  getAgendaSuggestions,
  addAgendaItem,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  Plus,
  User,
  Calendar,
  Loader2,
  MapPin,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface AgendaSuggestionsProps {
  eventId: string;
  sections: AgendaSection[];
  existingApplicationIds: Set<string>;
  isFinalized?: boolean;
  onItemAdded?: () => void;
}

// Map review stages to appropriate section slugs
const stageToSectionSlug: Record<ReviewStage, string> = {
  new_business: "new_business",
  old_business: "old_business",
  final_approval: "final_approvals",
};

// Review stage metadata
const stageInfo: Record<ReviewStage, { label: string; description: string; icon: React.ElementType; className: string }> = {
  new_business: {
    label: "New Business",
    description: "First time on the agenda",
    icon: FileText,
    className: "text-blue-600",
  },
  old_business: {
    label: "Old Business",
    description: "Previously tabled or needs follow-up",
    icon: AlertCircle,
    className: "text-amber-600",
  },
  final_approval: {
    label: "Final Approval",
    description: "Ready for final decision",
    icon: CheckCircle,
    className: "text-emerald-600",
  },
};

function ApplicationSuggestionCard({
  application,
  stage,
  sections,
  eventId,
  isAlreadyAdded,
  isFinalized,
  onAdded,
}: {
  application: Application;
  stage: ReviewStage;
  sections: AgendaSection[];
  eventId: string;
  isAlreadyAdded: boolean;
  isFinalized: boolean;
  onAdded: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  // Initialize and update selectedSectionId when sections change
  useEffect(() => {
    if (sections.length > 0 && !selectedSectionId) {
      const defaultSlug = stageToSectionSlug[stage];
      const section = sections.find(s => s.slug === defaultSlug && s.allowsApplications);
      const newSectionId = section?.id || sections.find(s => s.allowsApplications)?.id || "";
      if (newSectionId) {
        setSelectedSectionId(newSectionId);
      }
    }
  }, [sections, stage, selectedSectionId]);

  const addMutation = useMutation({
    mutationFn: () => addAgendaItem(eventId, {
      sectionId: selectedSectionId,
      itemType: "application",
      applicationId: application.id,
      reviewStage: stage,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventAgenda", eventId] });
      queryClient.invalidateQueries({ queryKey: ["agendaSuggestions", eventId] });
      toast({ title: "Application added to agenda" });
      onAdded();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Parse application data
  const projectTitle = application.title
    || application.formData?.projectTitle
    || application.formData?.project_title
    || application.formData?.structure_type
    || application.formData?.project_type
    || "Untitled Application";
  const applicationNumber = application.applicationNumber || `#${application.id.slice(-6)}`;
  const propertyAddress = application.propertyAddress
    || application.formData?.property_address
    || application.formData?.property_address_full
    || application.formData?.propertyAddress
    || null;
  const applicantName = application.formData?.applicantName
    || application.formData?.homeowner_name
    || application.formData?.ownerName
    || null;
  const submittedDate = application.submittedAt ? format(parseISO(application.submittedAt), "MMM d, yyyy") : "Unknown";

  // Sections that allow applications
  const applicationSections = sections.filter(s => s.allowsApplications);

  const StageIcon = stageInfo[stage].icon;

  // Applications in ideal states (pending/under_review) get full emphasis;
  // others (approved, etc.) are shown but visually de-emphasized
  const idealStatuses = ['pending', 'under_review'];
  const isIdealStatus = idealStatuses.includes(application.status || '');

  if (isAlreadyAdded) {
    return (
      <div className="p-3 rounded-lg border bg-muted/30 opacity-60">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded bg-green-100 text-green-700">
            <CheckCircle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{projectTitle}</p>
            <p className="text-xs text-muted-foreground font-mono">{applicationNumber}</p>
            <p className="text-xs text-muted-foreground">Already on agenda</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "p-3 rounded-lg border transition-colors",
      isIdealStatus
        ? "hover:bg-muted/30"
        : "opacity-60 bg-muted/20 hover:opacity-80"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("p-1.5 rounded shrink-0",
          stage === "new_business" && "bg-blue-100 text-blue-700",
          stage === "old_business" && "bg-amber-100 text-amber-700",
          stage === "final_approval" && "bg-emerald-100 text-emerald-700"
        )}>
          <StageIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          {/* Title and Application Number */}
          <p className="text-sm font-medium truncate">{projectTitle}</p>
          <p className="text-xs font-mono text-muted-foreground">{applicationNumber}</p>

          {/* Property Address */}
          {propertyAddress && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{propertyAddress}</span>
            </div>
          )}

          {/* Applicant and Date */}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {applicantName && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {applicantName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {submittedDate}
            </span>
          </div>

          {application.status && (
            <Badge
              variant="outline"
              className={cn(
                "mt-2 text-xs",
                !isIdealStatus && "border-muted-foreground/40 text-muted-foreground"
              )}
            >
              {application.status.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
      </div>

      {!isFinalized && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              {applicationSections.map((section) => (
                <SelectItem key={section.id} value={section.id} className="text-xs">
                  {section.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8"
            onClick={() => addMutation.mutate()}
            disabled={!selectedSectionId || addMutation.isPending}
          >
            {addMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AgendaSuggestions({
  eventId,
  sections,
  existingApplicationIds,
  isFinalized = false,
  onItemAdded,
}: AgendaSuggestionsProps) {
  const [activeTab, setActiveTab] = useState<ReviewStage>("new_business");

  const { data: suggestions, isLoading, error } = useQuery({
    queryKey: ["agendaSuggestions", eventId],
    queryFn: () => getAgendaSuggestions(eventId),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Smart Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Smart Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load suggestions</p>
        </CardContent>
      </Card>
    );
  }

  const newBusinessCount = suggestions?.newBusiness?.length || 0;
  const oldBusinessCount = suggestions?.oldBusiness?.length || 0;
  const finalApprovalCount = suggestions?.finalApproval?.length || 0;
  const totalCount = newBusinessCount + oldBusinessCount + finalApprovalCount;

  const getApplications = (stage: ReviewStage): Application[] => {
    switch (stage) {
      case "new_business":
        return suggestions?.newBusiness || [];
      case "old_business":
        return suggestions?.oldBusiness || [];
      case "final_approval":
        return suggestions?.finalApproval || [];
      default:
        return [];
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-amber-500" />
          Smart Suggestions
          {totalCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {totalCount} available
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Applications automatically categorized by their review stage
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalCount === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No pending applications to suggest</p>
            <p className="text-xs mt-1">Applications will appear here based on their status</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReviewStage)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="new_business" className="text-xs">
                New
                {newBusinessCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {newBusinessCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="old_business" className="text-xs">
                Returning
                {oldBusinessCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {oldBusinessCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="final_approval" className="text-xs">
                Final
                {finalApprovalCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {finalApprovalCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {(["new_business", "old_business", "final_approval"] as ReviewStage[]).map((stage) => {
              const applications = getApplications(stage);
              const info = stageInfo[stage];
              const Icon = info.icon;

              return (
                <TabsContent key={stage} value={stage} className="mt-3">
                  <div className="mb-3 p-2 rounded bg-muted/50 flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", info.className)} />
                    <span className="text-xs text-muted-foreground">{info.description}</span>
                  </div>
                  <ScrollArea className="h-[600px] pr-4">
                    {applications.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <p className="text-sm">No {info.label.toLowerCase()} items</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {applications.map((app) => (
                          <ApplicationSuggestionCard
                            key={app.id}
                            application={app}
                            stage={stage}
                            sections={sections}
                            eventId={eventId}
                            isAlreadyAdded={existingApplicationIds.has(app.id)}
                            isFinalized={isFinalized}
                            onAdded={onItemAdded || (() => {})}
                          />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
