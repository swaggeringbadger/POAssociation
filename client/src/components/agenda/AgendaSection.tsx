import { useState } from "react";
import {
  type AgendaSection as AgendaSectionType,
  type EventAgendaItem,
  reorderAgendaItems,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Clock,
  Gavel,
  Users,
  FileText,
  MessageSquare,
  CheckSquare,
  AlertCircle,
  Megaphone,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import AgendaItem from "./AgendaItem";

// Section icons mapping based on slug
const sectionIcons: Record<string, React.ElementType> = {
  call_to_order: Gavel,
  roll_call: Users,
  approval_of_minutes: FileText,
  public_comments: MessageSquare,
  old_business: AlertCircle,
  new_business: FileText,
  final_approvals: CheckSquare,
  announcements: Megaphone,
  adjournment: CalendarCheck,
};

// Section colors based on slug
const sectionColors: Record<string, string> = {
  call_to_order: "bg-slate-100 text-slate-700",
  roll_call: "bg-blue-100 text-blue-700",
  approval_of_minutes: "bg-gray-100 text-gray-700",
  public_comments: "bg-purple-100 text-purple-700",
  old_business: "bg-amber-100 text-amber-700",
  new_business: "bg-green-100 text-green-700",
  final_approvals: "bg-emerald-100 text-emerald-700",
  announcements: "bg-orange-100 text-orange-700",
  adjournment: "bg-slate-100 text-slate-700",
};

interface AgendaSectionProps {
  section: AgendaSectionType;
  items: EventAgendaItem[];
  eventId: string;
  isFinalized?: boolean;
  defaultOpen?: boolean;
  onAddItem?: (sectionId: string) => void;
}

export default function AgendaSection({
  section,
  items,
  eventId,
  isFinalized = false,
  defaultOpen = true,
  onAddItem,
}: AgendaSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [localItems, setLocalItems] = useState(items);
  const [isPendingReorder, setIsPendingReorder] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update local items when props change, but only if we're not in the middle of a reorder
  // This prevents the snap-back effect during optimistic updates
  if (!isPendingReorder && items.length !== localItems.length) {
    setLocalItems(items);
  } else if (!isPendingReorder) {
    // Check if items actually changed from server (not just our optimistic update)
    const itemsIds = items.map(i => i.id).join(',');
    const localIds = localItems.map(i => i.id).join(',');
    if (itemsIds !== localIds) {
      setLocalItems(items);
    }
  }

  const SectionIcon = sectionIcons[section.slug] || FileText;
  const colorClass = sectionColors[section.slug] || "bg-gray-100 text-gray-700";

  // Calculate total estimated time
  const totalMinutes = items.reduce((sum, item) => sum + (item.estimatedMinutes || 0), 0);

  // Count decisions made
  const decisionsCount = items.filter(item => item.decision).length;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: (itemIds: string[]) => reorderAgendaItems(eventId, section.id, itemIds),
    onSuccess: () => {
      // Clear pending flag after a short delay to let the query refetch complete
      setTimeout(() => setIsPendingReorder(false), 100);
      queryClient.invalidateQueries({ queryKey: ["eventAgenda", eventId] });
    },
    onError: (error: Error) => {
      // Revert on error
      setIsPendingReorder(false);
      setLocalItems(items);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localItems.findIndex((item) => item.id === active.id);
      const newIndex = localItems.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(localItems, oldIndex, newIndex);

      // Set pending flag before updating to prevent snap-back
      setIsPendingReorder(true);
      setLocalItems(newItems);

      // Send reorder request to server
      reorderMutation.mutate(newItems.map((item) => item.id));
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg bg-card">
        {/* Section Header */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded", colorClass)}>
                <SectionIcon className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{section.name}</h3>
                  {items.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {items.length} item{items.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {decisionsCount > 0 && decisionsCount === items.length && (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                      All decided
                    </Badge>
                  )}
                </div>
                {section.description && (
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {totalMinutes > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {totalMinutes} min
                </span>
              )}
              {!isFinalized && onAddItem && (section.allowsApplications || section.allowsDiscussionItems) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddItem(section.id);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              )}
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Section Content */}
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            {localItems.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                {section.allowsApplications || section.allowsDiscussionItems ? (
                  <>
                    No items in this section yet.
                    {!isFinalized && onAddItem && (
                      <Button
                        variant="link"
                        className="px-1 h-auto"
                        onClick={() => onAddItem(section.id)}
                      >
                        Add an item
                      </Button>
                    )}
                  </>
                ) : (
                  <span className="italic">Procedural section - no items needed</span>
                )}
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={localItems.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {localItems.map((item) => (
                      <AgendaItem
                        key={item.id}
                        item={item}
                        eventId={eventId}
                        isFinalized={isFinalized}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
