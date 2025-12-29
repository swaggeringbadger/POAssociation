import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  getEvent,
  getEventAgenda,
  listMeetingTemplates,
  applyMeetingTemplate,
  finalizeAgenda,
  unfinalizeAgenda,
  addAgendaItem,
  type EventWithDetails,
  type EventAgenda,
  type MeetingTemplate,
  type AgendaItemType,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Video,
  FileText,
  MessageSquare,
  Megaphone,
  Vote,
  Plus,
  Lock,
  Unlock,
  Printer,
  LayoutTemplate,
  Loader2,
  CheckCircle,
  Users,
  Sparkles,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AgendaSection, AgendaSuggestions } from "@/components/agenda";

// Item type options for adding new items
const itemTypeOptions: { value: AgendaItemType; label: string; icon: React.ElementType; description: string }[] = [
  { value: "discussion", label: "Discussion", icon: MessageSquare, description: "General discussion topic" },
  { value: "announcement", label: "Announcement", icon: Megaphone, description: "Informational announcement" },
  { value: "motion", label: "Motion", icon: Vote, description: "Item requiring a vote" },
];

export default function MeetingAgenda() {
  const { eventId } = useParams<{ eventId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Dialog states
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [mobileSuggestionsOpen, setMobileSuggestionsOpen] = useState(false);

  // Add item form state
  const [newItemType, setNewItemType] = useState<AgendaItemType>("discussion");
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemMinutes, setNewItemMinutes] = useState("");

  // Template selection state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Fetch event details
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => getEvent(eventId!),
    enabled: !!eventId,
  });

  // Fetch agenda
  const { data: agenda, isLoading: agendaLoading } = useQuery({
    queryKey: ["eventAgenda", eventId],
    queryFn: () => getEventAgenda(eventId!),
    enabled: !!eventId,
  });

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ["meetingTemplates", event?.tenantId],
    queryFn: () => listMeetingTemplates(event?.tenantId),
    enabled: !!event?.tenantId,
  });

  // Apply template mutation
  const applyTemplateMutation = useMutation({
    mutationFn: (templateId: string) => applyMeetingTemplate(eventId!, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventAgenda", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      setTemplateDialogOpen(false);
      toast({ title: "Template applied", description: "Meeting sections have been set up" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Finalize mutation
  const finalizeMutation = useMutation({
    mutationFn: () => finalizeAgenda(eventId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      setFinalizeDialogOpen(false);
      toast({ title: "Agenda finalized", description: "The agenda is now locked" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Unfinalize mutation
  const unfinalizeMutation = useMutation({
    mutationFn: () => unfinalizeAgenda(eventId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      toast({ title: "Agenda unlocked", description: "You can now edit the agenda" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: () => addAgendaItem(eventId!, {
      sectionId: selectedSectionId,
      itemType: newItemType,
      title: newItemTitle,
      description: newItemDescription || undefined,
      estimatedMinutes: newItemMinutes ? parseInt(newItemMinutes, 10) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventAgenda", eventId] });
      setAddItemDialogOpen(false);
      resetAddItemForm();
      toast({ title: "Item added to agenda" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetAddItemForm = () => {
    setNewItemType("discussion");
    setNewItemTitle("");
    setNewItemDescription("");
    setNewItemMinutes("");
    setSelectedSectionId("");
  };

  const handleAddItem = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    setAddItemDialogOpen(true);
  };

  // Group items by section
  const itemsBySection = useMemo(() => {
    const map = new Map<string, EventAgenda["items"]>();
    agenda?.sections?.forEach(section => {
      map.set(section.id, []);
    });
    agenda?.items?.forEach(item => {
      const items = map.get(item.sectionId) || [];
      items.push(item);
      map.set(item.sectionId, items);
    });
    // Sort items within each section by orderIndex
    map.forEach((items) => {
      items.sort((a, b) => a.orderIndex - b.orderIndex);
    });
    return map;
  }, [agenda]);

  // Get set of existing application IDs on agenda
  const existingApplicationIds = useMemo(() => {
    const ids = new Set<string>();
    agenda?.items?.forEach(item => {
      if (item.applicationId) {
        ids.add(item.applicationId);
      }
    });
    return ids;
  }, [agenda]);

  // Calculate total time
  const totalMinutes = useMemo(() => {
    return agenda?.items?.reduce((sum, item) => sum + (item.estimatedMinutes || 0), 0) || 0;
  }, [agenda]);

  // Check if agenda is finalized
  const isFinalized = !!(event as any)?.agendaFinalized;

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  if (eventLoading || agendaLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Event not found</p>
        <Link href="/calendar">
          <Button variant="link" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Calendar
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/calendar">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(parseISO(event.startDatetime), "EEEE, MMMM d, yyyy")}
              </span>
              {!event.allDay && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(parseISO(event.startDatetime), "h:mm a")} - {format(parseISO(event.endDatetime), "h:mm a")}
                </span>
              )}
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {event.location}
                </span>
              )}
              {event.meetingUrl && (
                <span className="flex items-center gap-1">
                  <Video className="h-4 w-4" />
                  Virtual
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isFinalized ? (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Finalized
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <Unlock className="h-3 w-3" />
              Draft
            </Badge>
          )}
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold text-center">{event.title}</h1>
        <p className="text-center text-sm mt-1">
          {format(parseISO(event.startDatetime), "EEEE, MMMM d, yyyy")}
          {!event.allDay && ` at ${format(parseISO(event.startDatetime), "h:mm a")}`}
        </p>
        {event.location && (
          <p className="text-center text-sm text-muted-foreground">{event.location}</p>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          {!isFinalized && (
            <>
              <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
                <LayoutTemplate className="mr-2 h-4 w-4" />
                Apply Template
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalMinutes > 0 && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m estimated
            </span>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          {isFinalized ? (
            <Button
              variant="outline"
              onClick={() => unfinalizeMutation.mutate()}
              disabled={unfinalizeMutation.isPending}
            >
              {unfinalizeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unlock className="mr-2 h-4 w-4" />
              )}
              Unlock Agenda
            </Button>
          ) : (
            <Button onClick={() => setFinalizeDialogOpen(true)}>
              <Lock className="mr-2 h-4 w-4" />
              Finalize Agenda
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3 print:block">
        {/* Agenda Sections */}
        <div className="lg:col-span-2 space-y-4 print:space-y-2">
          {!agenda?.sections?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <LayoutTemplate className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">No Agenda Structure</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Apply a meeting template to set up the agenda structure
                </p>
                <Button onClick={() => setTemplateDialogOpen(true)}>
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  Apply Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            agenda.sections
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((section) => (
                <AgendaSection
                  key={section.id}
                  section={section}
                  items={itemsBySection.get(section.id) || []}
                  eventId={eventId!}
                  isFinalized={isFinalized}
                  onAddItem={handleAddItem}
                />
              ))
          )}
        </div>

        {/* Sidebar - Suggestions (Desktop) */}
        <div className="hidden lg:block print:hidden">
          {agenda?.sections?.length ? (
            <AgendaSuggestions
              eventId={eventId!}
              sections={agenda.sections}
              existingApplicationIds={existingApplicationIds}
              isFinalized={isFinalized}
            />
          ) : null}
        </div>
      </div>

      {/* Mobile Suggestions FAB */}
      {agenda?.sections?.length && !isFinalized ? (
        <Sheet open={mobileSuggestionsOpen} onOpenChange={setMobileSuggestionsOpen}>
          <SheetTrigger asChild>
            <Button
              className="lg:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg print:hidden"
              size="icon"
            >
              <Sparkles className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Smart Suggestions
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 h-[calc(80vh-5rem)] overflow-y-auto">
              <AgendaSuggestions
                eventId={eventId!}
                sections={agenda.sections}
                existingApplicationIds={existingApplicationIds}
                isFinalized={isFinalized}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {/* Apply Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Meeting Template</DialogTitle>
            <DialogDescription>
              Select a template to set up the agenda structure. This will replace any existing sections.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Template</Label>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div>
                      <span className="font-medium">{template.name}</span>
                      {template.isDefault && (
                        <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplateId && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {templates.find(t => t.id === selectedTemplateId)?.description || "No description"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedTemplateId && applyTemplateMutation.mutate(selectedTemplateId)}
              disabled={!selectedTemplateId || applyTemplateMutation.isPending}
            >
              {applyTemplateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Apply Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog */}
      <Dialog open={addItemDialogOpen} onOpenChange={(open) => {
        setAddItemDialogOpen(open);
        if (!open) resetAddItemForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Agenda Item</DialogTitle>
            <DialogDescription>
              Add a new item to the agenda section
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {itemTypeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setNewItemType(option.value)}
                      className={cn(
                        "p-3 rounded-lg border text-center transition-colors",
                        newItemType === option.value
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted"
                      )}
                    >
                      <Icon className="h-5 w-5 mx-auto mb-1" />
                      <span className="text-xs font-medium">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemTitle">Title</Label>
              <Input
                id="itemTitle"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="Item title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemDescription">Description (optional)</Label>
              <Textarea
                id="itemDescription"
                value={newItemDescription}
                onChange={(e) => setNewItemDescription(e.target.value)}
                placeholder="Additional details..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemMinutes">Estimated Minutes (optional)</Label>
              <Input
                id="itemMinutes"
                type="number"
                min="1"
                value={newItemMinutes}
                onChange={(e) => setNewItemMinutes(e.target.value)}
                placeholder="e.g., 10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addItemMutation.mutate()}
              disabled={!newItemTitle.trim() || addItemMutation.isPending}
            >
              {addItemMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalize Confirmation Dialog */}
      <AlertDialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize Agenda</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to finalize this agenda? Once finalized, the agenda will be locked and no further changes can be made unless you unlock it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => finalizeMutation.mutate()}
              disabled={finalizeMutation.isPending}
            >
              {finalizeMutation.isPending ? "Finalizing..." : "Finalize Agenda"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
