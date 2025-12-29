import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type EventAgendaItem,
  type AgendaDecision,
  updateAgendaItem,
  deleteAgendaItem,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  GripVertical,
  MoreVertical,
  FileText,
  MessageSquare,
  Megaphone,
  Vote,
  Clock,
  User,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Pause,
  ArrowRight,
  HelpCircle,
  ThumbsUp,
  ExternalLink,
  MapPin,
  Calendar,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Item type icons
const itemTypeIcons: Record<string, React.ElementType> = {
  application: FileText,
  discussion: MessageSquare,
  announcement: Megaphone,
  motion: Vote,
};

// Item type labels
const itemTypeLabels: Record<string, string> = {
  application: "Application",
  discussion: "Discussion",
  announcement: "Announcement",
  motion: "Motion",
};

// Review stage badges
const reviewStageBadges: Record<string, { label: string; className: string }> = {
  new_business: { label: "New", className: "bg-blue-100 text-blue-800" },
  old_business: { label: "Returning", className: "bg-amber-100 text-amber-800" },
  final_approval: { label: "Final Review", className: "bg-purple-100 text-purple-800" },
};

// Decision options
const decisionOptions: { value: AgendaDecision; label: string; icon: React.ElementType; className: string }[] = [
  { value: "approved", label: "Approved", icon: CheckCircle, className: "text-green-600" },
  { value: "rejected", label: "Rejected", icon: XCircle, className: "text-red-600" },
  { value: "tabled", label: "Tabled", icon: Pause, className: "text-amber-600" },
  { value: "needs_info", label: "Needs Info", icon: HelpCircle, className: "text-blue-600" },
  { value: "conditional", label: "Conditional", icon: AlertCircle, className: "text-orange-600" },
  { value: "deferred", label: "Deferred", icon: ArrowRight, className: "text-slate-600" },
  { value: "withdrawn", label: "Withdrawn", icon: XCircle, className: "text-gray-600" },
  { value: "recommended", label: "Recommended", icon: ThumbsUp, className: "text-emerald-600" },
];

interface AgendaItemProps {
  item: EventAgendaItem;
  eventId: string;
  isFinalized?: boolean;
}

export default function AgendaItem({
  item,
  eventId,
  isFinalized = false,
}: AgendaItemProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Sortable hook
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: isFinalized });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState(item.title || "");
  const [editDescription, setEditDescription] = useState(item.description || "");
  const [editMinutes, setEditMinutes] = useState(item.estimatedMinutes?.toString() || "");
  const [editNotes, setEditNotes] = useState(item.presenterNotes || "");

  // Decision form state
  const [selectedDecision, setSelectedDecision] = useState<AgendaDecision | "">(item.decision || "");
  const [decisionNotes, setDecisionNotes] = useState(item.decisionNotes || "");

  const ItemIcon = itemTypeIcons[item.itemType] || FileText;

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateAgendaItem>[2]) =>
      updateAgendaItem(eventId, item.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventAgenda", eventId] });
      setEditDialogOpen(false);
      toast({ title: "Item updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Decision mutation
  const decisionMutation = useMutation({
    mutationFn: (data: { decision: AgendaDecision; decisionNotes?: string }) =>
      updateAgendaItem(eventId, item.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventAgenda", eventId] });
      setDecisionDialogOpen(false);
      toast({ title: "Decision recorded" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteAgendaItem(eventId, item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventAgenda", eventId] });
      setDeleteDialogOpen(false);
      toast({ title: "Item removed from agenda" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveEdit = () => {
    updateMutation.mutate({
      title: editTitle || undefined,
      description: editDescription || undefined,
      estimatedMinutes: editMinutes ? parseInt(editMinutes, 10) : undefined,
      presenterNotes: editNotes || undefined,
    });
  };

  const handleSaveDecision = () => {
    if (!selectedDecision) return;
    decisionMutation.mutate({
      decision: selectedDecision,
      decisionNotes: decisionNotes || undefined,
    });
  };

  // Get display title for application items
  const displayTitle = item.itemType === "application" && item.application
    ? item.application.title
      || item.application.formData?.projectTitle
      || item.application.formData?.project_title
      || item.application.formData?.structure_type
      || item.application.formData?.project_type
      || "Untitled Application"
    : item.title || "Untitled Item";

  // Get application number
  const applicationNumber = item.application?.applicationNumber
    || (item.application?.id ? `#${item.application.id.slice(-6)}` : null);

  // Get property address
  const propertyAddress = item.application?.propertyAddress
    || item.application?.formData?.property_address
    || item.application?.formData?.property_address_full
    || item.application?.formData?.propertyAddress
    || null;

  // Get applicant name for application items
  const applicantName = item.application?.formData?.applicantName
    || item.application?.formData?.homeowner_name
    || item.application?.formData?.ownerName
    || null;

  // Get submitted date
  const submittedDate = item.application?.submittedAt
    ? format(parseISO(item.application.submittedAt), "MMM d, yyyy")
    : null;

  const decisionInfo = item.decision ? decisionOptions.find(d => d.value === item.decision) : null;
  const DecisionIcon = decisionInfo?.icon;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "group transition-all",
          isDragging && "opacity-50 ring-2 ring-primary shadow-lg z-50",
          item.decision && "border-l-4",
          item.decision === "approved" && "border-l-green-500",
          item.decision === "rejected" && "border-l-red-500",
          item.decision === "tabled" && "border-l-amber-500",
          item.decision === "conditional" && "border-l-orange-500",
          item.decision === "recommended" && "border-l-emerald-500"
        )}
        {...attributes}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            {/* Drag handle */}
            {!isFinalized && (
              <div
                className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
                {...listeners}
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )}

            {/* Item type icon */}
            <div className={cn(
              "mt-0.5 p-1.5 rounded",
              item.itemType === "application" && "bg-blue-100 text-blue-700",
              item.itemType === "discussion" && "bg-purple-100 text-purple-700",
              item.itemType === "announcement" && "bg-amber-100 text-amber-700",
              item.itemType === "motion" && "bg-green-100 text-green-700"
            )}>
              <ItemIcon className="h-4 w-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* Title and badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-sm truncate">{displayTitle}</h4>
                    {item.reviewStage && (
                      <Badge variant="secondary" className={cn("text-xs", reviewStageBadges[item.reviewStage]?.className)}>
                        {reviewStageBadges[item.reviewStage]?.label}
                      </Badge>
                    )}
                    {decisionInfo && DecisionIcon && (
                      <Badge variant="outline" className={cn("text-xs gap-1", decisionInfo.className)}>
                        <DecisionIcon className="h-3 w-3" />
                        {decisionInfo.label}
                      </Badge>
                    )}
                  </div>

                  {/* Application number (for applications) */}
                  {item.itemType === "application" && applicationNumber && (
                    <p className="text-xs font-mono text-muted-foreground">{applicationNumber}</p>
                  )}

                  {/* Property address (for applications) */}
                  {item.itemType === "application" && propertyAddress && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{propertyAddress}</span>
                    </div>
                  )}

                  {/* Metadata row */}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {item.itemType !== "application" && (
                      <span className="flex items-center gap-1">
                        <ItemIcon className="h-3 w-3" />
                        {itemTypeLabels[item.itemType]}
                      </span>
                    )}
                    {item.estimatedMinutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.estimatedMinutes} min
                      </span>
                    )}
                    {applicantName && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {applicantName}
                      </span>
                    )}
                    {submittedDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {submittedDate}
                      </span>
                    )}
                    {item.presenter && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Presenter: {item.presenter.name}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}

                  {/* Decision notes */}
                  {item.decisionNotes && (
                    <p className="text-xs text-muted-foreground mt-1 italic bg-muted/50 p-2 rounded">
                      {item.decisionNotes}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {item.itemType === "application" && item.applicationId && (
                    <Link href={`/applications/${item.applicationId}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                  {!isFinalized && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDecisionDialogOpen(true)}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Record Decision
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setEditTitle(item.title || "");
                          setEditDescription(item.description || "");
                          setEditMinutes(item.estimatedMinutes?.toString() || "");
                          setEditNotes(item.presenterNotes || "");
                          setEditDialogOpen(true);
                        }}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteDialogOpen(true)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Agenda Item</DialogTitle>
            <DialogDescription>
              Update the details for this agenda item
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {item.itemType !== "application" && (
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Item title"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Additional details..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minutes">Estimated Minutes</Label>
              <Input
                id="minutes"
                type="number"
                min="1"
                value={editMinutes}
                onChange={(e) => setEditMinutes(e.target.value)}
                placeholder="e.g., 10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Presenter Notes</Label>
              <Textarea
                id="notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notes for the presenter..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decision Dialog */}
      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Decision</DialogTitle>
            <DialogDescription>
              Record the outcome for "{displayTitle}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Decision</Label>
              <Select value={selectedDecision} onValueChange={(v) => setSelectedDecision(v as AgendaDecision)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a decision" />
                </SelectTrigger>
                <SelectContent>
                  {decisionOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-4 w-4", option.className)} />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="decisionNotes">Notes</Label>
              <Textarea
                id="decisionNotes"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Any conditions, follow-up requirements, or notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveDecision}
              disabled={!selectedDecision || decisionMutation.isPending}
            >
              {decisionMutation.isPending ? "Saving..." : "Save Decision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from Agenda</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove "{displayTitle}" from the agenda? This will not delete the underlying application or item.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
