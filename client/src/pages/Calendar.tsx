import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  listEventTypes,
  listEvents,
  getCalendarEvents,
  getEventTenants,
  deleteEvent,
  completeEvent,
  cancelEvent,
  deleteEventOccurrence,
  type CalendarEvent,
  type EventType,
  type EventFilters,
  type RecurrenceEditMode,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Users,
  ClipboardCheck,
  Scale,
  MapPin,
  Video,
  FileText,
  Link2,
  ListChecks,
  Grid3X3,
  Repeat,
  ClipboardList,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import EventModal from "@/components/calendar/EventModal";
import RecurrenceEditDialog from "@/components/calendar/RecurrenceEditDialog";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  addDays,
} from "date-fns";
import { cn } from "@/lib/utils";

// Event type icons mapping
const eventTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  board_meeting: Users,
  arc_meeting: ClipboardCheck,
  annual_meeting: CalendarIcon,
  committee_meeting: Users,
  hearing: Scale,
  deadline: Clock,
  inspection: Search,
  community_event: Users,
};

// Status badge config
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
  draft: { label: "Draft", variant: "secondary" },
  scheduled: { label: "Scheduled", variant: "outline" },
  in_progress: { label: "In Progress", variant: "default", className: "bg-blue-500" },
  completed: { label: "Completed", variant: "default", className: "bg-green-500" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

// Event type color mapping
const eventTypeColors: Record<string, string> = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  green: "bg-green-500",
  teal: "bg-teal-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  pink: "bg-pink-500",
};

type ViewMode = "calendar" | "list";

export default function Calendar() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [initialDate, setInitialDate] = useState<Date | null>(null);

  // Recurrence dialog state
  const [recurrenceDialogOpen, setRecurrenceDialogOpen] = useState(false);
  const [recurrenceDialogMode, setRecurrenceDialogMode] = useState<'edit' | 'delete'>('edit');
  const [pendingRecurrenceEvent, setPendingRecurrenceEvent] = useState<CalendarEvent | null>(null);

  // Calculate calendar range for the current month view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  // Fetch event types
  const { data: eventTypes = [] } = useQuery({
    queryKey: ["eventTypes"],
    queryFn: listEventTypes,
  });

  // Fetch events for calendar view
  const { data: calendarEvents = [], isLoading } = useQuery({
    queryKey: ["calendarEvents", calendarStart.toISOString(), calendarEnd.toISOString()],
    queryFn: () => getCalendarEvents(calendarStart.toISOString(), calendarEnd.toISOString()),
  });

  // Fetch events for list view with filters
  const { data: listViewEvents = [] } = useQuery({
    queryKey: ["events", typeFilter, statusFilter],
    queryFn: () => listEvents({
      eventTypeId: typeFilter !== "all" ? typeFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    }),
    enabled: viewMode === "list",
  });

  // Fetch tenants for event creation
  const { data: eventTenants = [] } = useQuery({
    queryKey: ["eventTenants"],
    queryFn: () => getEventTenants(),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      setDeleteDialogOpen(false);
      setSelectedEvent(null);
      toast({
        title: "Event deleted",
        description: "The event has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: (id: string) => completeEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      toast({
        title: "Event completed",
        description: "The event has been marked as completed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      toast({
        title: "Event cancelled",
        description: "The event has been cancelled.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete occurrence mutation (for recurring events)
  const deleteOccurrenceMutation = useMutation({
    mutationFn: ({ eventId, originalDate, deleteMode }: { eventId: string; originalDate: string; deleteMode: RecurrenceEditMode }) =>
      deleteEventOccurrence(eventId, originalDate, deleteMode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      setRecurrenceDialogOpen(false);
      setPendingRecurrenceEvent(null);
      toast({
        title: "Event deleted",
        description: "The event occurrence has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get all days in the calendar view
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    calendarEvents.forEach((event) => {
      const dateKey = format(parseISO(event.startDatetime), "yyyy-MM-dd");
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [calendarEvents]);

  // Filter events for list view
  const filteredEvents = useMemo(() => {
    const events = viewMode === "list" ? listViewEvents : calendarEvents;
    return events.filter((event) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        event.title.toLowerCase().includes(searchLower) ||
        event.description?.toLowerCase().includes(searchLower) ||
        event.location?.toLowerCase().includes(searchLower)
      );
    });
  }, [viewMode, listViewEvents, calendarEvents, searchQuery]);

  // Events for selected date
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) || [];
  }, [selectedDate, eventsByDate]);

  const handleCreate = (date?: Date) => {
    setIsCreating(true);
    setSelectedEvent(null);
    setInitialDate(date || null);
    setDialogOpen(true);
  };

  const handleEdit = (event: CalendarEvent) => {
    // Check if this is a recurring event instance
    if (event.isRecurrenceInstance && event.seriesId) {
      setPendingRecurrenceEvent(event);
      setRecurrenceDialogMode('edit');
      setRecurrenceDialogOpen(true);
    } else {
      setIsCreating(false);
      setSelectedEvent(event);
      setInitialDate(null);
      setDialogOpen(true);
    }
  };

  const handleDelete = (event: CalendarEvent) => {
    // Check if this is a recurring event instance
    if (event.isRecurrenceInstance && event.seriesId) {
      setPendingRecurrenceEvent(event);
      setRecurrenceDialogMode('delete');
      setRecurrenceDialogOpen(true);
    } else {
      setSelectedEvent(event);
      setDeleteDialogOpen(true);
    }
  };

  // Handle recurrence dialog choice
  const handleRecurrenceChoice = async (choice: RecurrenceEditMode) => {
    if (!pendingRecurrenceEvent) return;

    if (recurrenceDialogMode === 'edit') {
      if (choice === 'all') {
        // Edit the entire series - load the parent event
        // For now, we'll just set up for editing with the series ID
        setIsCreating(false);
        // The seriesId points to the parent recurring event
        setSelectedEvent({
          ...pendingRecurrenceEvent,
          id: pendingRecurrenceEvent.seriesId!,
          isRecurrenceInstance: false,
        });
        setRecurrenceDialogOpen(false);
        setPendingRecurrenceEvent(null);
        setDialogOpen(true);
      } else {
        // For 'single' or 'thisAndFuture', we need special handling
        // Pass metadata to the EventModal to indicate edit mode
        setIsCreating(false);
        setSelectedEvent({
          ...pendingRecurrenceEvent,
          // Add metadata for the modal to know how to save
          _editMode: choice,
        } as CalendarEvent & { _editMode?: RecurrenceEditMode });
        setRecurrenceDialogOpen(false);
        setPendingRecurrenceEvent(null);
        setDialogOpen(true);
      }
    } else {
      // Delete mode
      const eventId = pendingRecurrenceEvent.seriesId!;
      const originalDate = pendingRecurrenceEvent.originalDate!;

      deleteOccurrenceMutation.mutate({
        eventId,
        originalDate,
        deleteMode: choice,
      });
    }
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
    setSelectedDate(null);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const getEventTypeName = (typeId: string) => {
    return eventTypes.find((t) => t.id === typeId)?.name || "Event";
  };

  const getEventTypeSlug = (typeId: string) => {
    return eventTypes.find((t) => t.id === typeId)?.slug || "default";
  };

  const getEventTypeColor = (typeId: string) => {
    const type = eventTypes.find((t) => t.id === typeId);
    return type?.color ? eventTypeColors[type.color] || "bg-gray-500" : "bg-gray-500";
  };

  const getTenantName = (tenantId: string) => {
    const tenant = eventTenants.find((p) => p.id === tenantId);
    return tenant?.name || "Unknown";
  };

  // Upcoming events for sidebar
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return filteredEvents
      .filter((e) => parseISO(e.startDatetime) >= now && e.status !== 'cancelled')
      .sort((a, b) => parseISO(a.startDatetime).getTime() - parseISO(b.startDatetime).getTime())
      .slice(0, 5);
  }, [filteredEvents]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Schedule and manage meetings, deadlines, and events
          </p>
        </div>
        <Button onClick={() => handleCreate()} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          New Event
        </Button>
      </div>

      {/* View Toggle and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                <span className="hidden sm:inline">Calendar</span>
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                <span className="hidden sm:inline">List</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-40">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {eventTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[calc(50%-0.25rem)] sm:w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Calendar Grid */}
          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2 sm:gap-4">
                <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-base sm:text-xl font-semibold">
                  {format(currentDate, "MMMM yyyy")}
                </h2>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {calendarDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDate.get(dateKey) || [];
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentDate);

                  return (
                    <button
                      key={dateKey}
                      onClick={() => handleDateClick(day)}
                      className={cn(
                        "min-h-24 p-2 text-left bg-background hover:bg-muted/50 transition-colors",
                        !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                        isSelected && "ring-2 ring-primary ring-inset",
                        isToday(day) && "bg-primary/5"
                      )}
                    >
                      <div className={cn(
                        "text-sm font-medium mb-1",
                        isToday(day) && "text-primary"
                      )}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className={cn(
                              "text-xs px-1 py-0.5 rounded truncate text-white",
                              getEventTypeColor(event.eventTypeId),
                              event.status === 'cancelled' && "opacity-50 line-through"
                            )}
                            title={event.title}
                          >
                            {event.isRecurrenceInstance && <Repeat className="inline h-3 w-3 mr-0.5" />}
                            {event.allDay ? "" : format(parseISO(event.startDatetime), "h:mm a")} {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground px-1">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Selected Date Events */}
            {selectedDate && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {format(selectedDate, "MMMM d, yyyy")}
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => handleCreate(selectedDate)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedDateEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No events scheduled</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedDateEvents.map((event) => (
                        <div
                          key={event.id}
                          className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleEdit(event)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "font-medium truncate flex items-center gap-1",
                                event.status === 'cancelled' && "line-through text-muted-foreground"
                              )}>
                                {event.isRecurrenceInstance && <Repeat className="h-3 w-3 flex-shrink-0" />}
                                <span className="truncate">{event.title}</span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {event.allDay
                                  ? "All day"
                                  : `${format(parseISO(event.startDatetime), "h:mm a")} - ${format(parseISO(event.endDatetime), "h:mm a")}`}
                              </p>
                              <Badge variant="secondary" className="mt-1">
                                {getEventTypeName(event.eventTypeId)}
                              </Badge>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/calendar/events/${event.id}/agenda`); }}>
                                  <ClipboardList className="mr-2 h-4 w-4" />
                                  Agenda
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(event); }}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                {event.status === 'scheduled' && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); completeMutation.mutate(event.id); }}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Complete
                                  </DropdownMenuItem>
                                )}
                                {event.status !== 'cancelled' && event.status !== 'completed' && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); cancelMutation.mutate(event.id); }}>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(event); }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Upcoming Events */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Upcoming Events</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming events</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded"
                        onClick={() => handleEdit(event)}
                      >
                        <div className={cn("w-2 h-2 rounded-full mt-2", getEventTypeColor(event.eventTypeId))} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(event.startDatetime), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* List View */
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Events</CardTitle>
                <CardDescription>
                  {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading events...</div>
            ) : filteredEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No events found. Create your first event to get started.
              </div>
            ) : (
              <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {filteredEvents.map((event) => {
                  const config = statusConfig[event.status];
                  const EventIcon = eventTypeIcons[getEventTypeSlug(event.eventTypeId)] || CalendarIcon;

                  return (
                    <div
                      key={event.id}
                      className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50"
                      onClick={() => handleEdit(event)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={cn("p-2 rounded shrink-0", getEventTypeColor(event.eventTypeId))}>
                            <EventIcon className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className={cn(
                              "font-medium",
                              event.status === 'cancelled' && "line-through text-muted-foreground"
                            )}>
                              {event.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getTenantName(event.tenantId)}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="shrink-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/calendar/events/${event.id}/agenda`); }}>
                              <ClipboardList className="mr-2 h-4 w-4" />
                              Agenda
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(event); }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {event.status === 'scheduled' && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); completeMutation.mutate(event.id); }}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Complete
                              </DropdownMenuItem>
                            )}
                            {event.status !== 'cancelled' && event.status !== 'completed' && (
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); cancelMutation.mutate(event.id); }}>
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => { e.stopPropagation(); handleDelete(event); }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Date & Time</p>
                          <p className="font-medium">{format(parseISO(event.startDatetime), "MMM d, yyyy")}</p>
                          <p className="text-xs text-muted-foreground">
                            {event.allDay
                              ? "All day"
                              : `${format(parseISO(event.startDatetime), "h:mm a")} - ${format(parseISO(event.endDatetime), "h:mm a")}`}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Location</p>
                          {event.location ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          ) : event.meetingUrl ? (
                            <div className="flex items-center gap-1 text-blue-600">
                              <Video className="h-3 w-3" />
                              Virtual
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {getEventTypeName(event.eventTypeId)}
                        </Badge>
                        <Badge
                          variant={config?.variant || "secondary"}
                          className={cn("text-xs", config?.className)}
                        >
                          {config?.label || event.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => {
                    const config = statusConfig[event.status];
                    const EventIcon = eventTypeIcons[getEventTypeSlug(event.eventTypeId)] || CalendarIcon;

                    return (
                      <TableRow
                        key={event.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleEdit(event)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded", getEventTypeColor(event.eventTypeId))}>
                              <EventIcon className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <p className={cn(
                                "font-medium",
                                event.status === 'cancelled' && "line-through text-muted-foreground"
                              )}>
                                {event.title}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {getTenantName(event.tenantId)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {getEventTypeName(event.eventTypeId)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {format(parseISO(event.startDatetime), "MMM d, yyyy")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {event.allDay
                                ? "All day"
                                : `${format(parseISO(event.startDatetime), "h:mm a")} - ${format(parseISO(event.endDatetime), "h:mm a")}`}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {event.location && (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">{event.location}</span>
                            </div>
                          )}
                          {event.meetingUrl && (
                            <div className="flex items-center gap-1 text-sm text-blue-600">
                              <Video className="h-3 w-3" />
                              Virtual
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={config?.variant || "secondary"}
                            className={config?.className}
                          >
                            {config?.label || event.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/calendar/events/${event.id}/agenda`); }}>
                                <ClipboardList className="mr-2 h-4 w-4" />
                                Agenda
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(event); }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              {event.status === 'scheduled' && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); completeMutation.mutate(event.id); }}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Mark Complete
                                </DropdownMenuItem>
                              )}
                              {event.status !== 'cancelled' && event.status !== 'completed' && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); cancelMutation.mutate(event.id); }}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel Event
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleDelete(event); }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                </Table>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Event Modal */}
      <EventModal
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={selectedEvent}
        isCreating={isCreating}
        initialDate={initialDate}
        eventTypes={eventTypes}
        tenants={eventTenants}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedEvent?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedEvent && deleteMutation.mutate(selectedEvent.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recurrence Edit/Delete Dialog */}
      <RecurrenceEditDialog
        open={recurrenceDialogOpen}
        onOpenChange={setRecurrenceDialogOpen}
        mode={recurrenceDialogMode}
        onChoice={handleRecurrenceChoice}
        eventTitle={pendingRecurrenceEvent?.title}
      />
    </div>
  );
}
