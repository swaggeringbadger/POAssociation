import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createEvent,
  updateEvent,
  type CalendarEvent,
  type EventType,
} from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Video,
  Bell,
  X,
  Users,
  FileText,
  Link2,
  Eye,
  EyeOff,
  Repeat,
  Building2,
  Home,
  ArrowRight,
  Info,
} from "lucide-react";
import { format, addHours, setHours, setMinutes, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import RecurrenceSelector from "./RecurrenceSelector";
import {
  type RecurrenceConfig,
  configToRRule,
  rruleToConfig,
} from "@shared/recurrence";

interface EventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  isCreating: boolean;
  initialDate?: Date | null;
  eventTypes: EventType[];
  tenants: Array<{ id: string; name: string; type: string }>;
}

const reminderPresets = [
  { days: 14, label: "14 days" },
  { days: 7, label: "7 days" },
  { days: 1, label: "1 day" },
];

const timeOptions = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const ampm = hour < 12 ? "AM" : "PM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const display = `${displayHour}:${minute.toString().padStart(2, "0")} ${ampm}`;
  return { value: time, label: display };
});

export default function EventModal({
  open,
  onOpenChange,
  event,
  isCreating,
  initialDate,
  eventTypes,
  tenants,
}: EventModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form state
  const [tenantId, setTenantId] = useState<string>("");
  const [eventTypeId, setEventTypeId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [reminderDays, setReminderDays] = useState<number[]>([7, 1]);
  const [noticeRequiredDays, setNoticeRequiredDays] = useState<string>("");
  const [isPublic, setIsPublic] = useState(true);
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig | null>(null);
  const [timezone, setTimezone] = useState("America/New_York");
  const [activeTab, setActiveTab] = useState("details");

  // Filter tenants (management companies and communities)
  const availableTenants = tenants.filter(
    (t) => t.type === "management_company" || t.type === "community"
  );
  const communityTenants = availableTenants.filter((t) => t.type === "community");
  const managementTenants = availableTenants.filter((t) => t.type === "management_company");

  // Show prominent tenant picker when creating and multiple tenants exist
  const needsTenantStep = isCreating && availableTenants.length > 1;
  const [tenantStepComplete, setTenantStepComplete] = useState(false);

  // Get the first available tenant and event type IDs
  // Default to first community if available, otherwise first tenant
  const firstTenantId = communityTenants[0]?.id || availableTenants[0]?.id || "";
  const firstEventTypeId = eventTypes[0]?.id || "";

  // Reset form when event changes or dialog opens
  useEffect(() => {
    if (!open) return; // Don't run when dialog is closed

    if (event) {
      setTenantId(event.tenantId);
      setEventTypeId(event.eventTypeId);
      setTitle(event.title);
      setDescription(event.description || "");

      const start = parseISO(event.startDatetime);
      const end = parseISO(event.endDatetime);
      setStartDate(start);
      setStartTime(format(start, "HH:mm"));
      setEndDate(end);
      setEndTime(format(end, "HH:mm"));
      setAllDay(event.allDay);
      setLocation(event.location || "");
      setMeetingUrl(event.meetingUrl || "");
      setReminderDays(event.reminderDays || [7, 1]);
      setNoticeRequiredDays(event.noticeRequiredDays?.toString() || "");
      setIsPublic(event.isPublic ?? true);
      setTimezone(event.timezone || "America/New_York");
      // Load recurrence config if event has a recurrence rule
      if (event.recurrenceRule) {
        const start = parseISO(event.startDatetime);
        setRecurrenceConfig(rruleToConfig(event.recurrenceRule, start));
      } else {
        setRecurrenceConfig(null);
      }
    } else {
      // Reset to defaults for new event
      const defaultDate = initialDate || new Date();
      setTenantId(firstTenantId);
      setEventTypeId(firstEventTypeId);
      setTitle("");
      setDescription("");
      setStartDate(defaultDate);
      setStartTime("09:00");
      setEndDate(defaultDate);
      setEndTime("10:00");
      setAllDay(false);
      setLocation("");
      setMeetingUrl("");
      setReminderDays([7, 1]);
      setNoticeRequiredDays("");
      setIsPublic(true);
      setTimezone("America/New_York");
      setRecurrenceConfig(null);
    }
    setActiveTab("details");
    setTenantStepComplete(false);
  }, [event, open, initialDate, firstTenantId, firstEventTypeId]);

  // Update end date when start date changes
  useEffect(() => {
    if (startDate && !endDate) {
      setEndDate(startDate);
    }
  }, [startDate]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createEvent>[0]) => createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      onOpenChange(false);
      toast({
        title: "Event created",
        description: "The event has been created successfully.",
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

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateEvent>[1] }) =>
      updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      onOpenChange(false);
      toast({
        title: "Event updated",
        description: "The event has been updated successfully.",
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

  const handleSubmit = () => {
    if (!tenantId) {
      toast({
        title: "Error",
        description: "Please select a property or management company",
        variant: "destructive",
      });
      return;
    }

    if (!eventTypeId) {
      toast({
        title: "Error",
        description: "Please select an event type",
        variant: "destructive",
      });
      return;
    }

    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select start and end dates",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter an event title",
        variant: "destructive",
      });
      return;
    }

    // Build datetime from date + time
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    const startDatetime = setMinutes(setHours(startDate, startHour), startMinute);
    const endDatetime = setMinutes(setHours(endDate, endHour), endMinute);

    if (endDatetime <= startDatetime && !allDay) {
      toast({
        title: "Error",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }

    // Generate recurrence rule if configured
    const recurrenceRule = recurrenceConfig
      ? configToRRule(recurrenceConfig, startDatetime)
      : undefined;
    // Handle endDate which could be a Date object or string
    let recurrenceEndDate: string | undefined;
    if (recurrenceConfig?.endDate) {
      const endDate = recurrenceConfig.endDate instanceof Date
        ? recurrenceConfig.endDate
        : new Date(recurrenceConfig.endDate);
      recurrenceEndDate = endDate.toISOString();
    }

    const data = {
      tenantId,
      eventTypeId,
      title: title.trim(),
      description: description.trim() || undefined,
      startDatetime: startDatetime.toISOString(),
      endDatetime: endDatetime.toISOString(),
      allDay,
      location: location.trim() || undefined,
      meetingUrl: meetingUrl.trim() || undefined,
      reminderDays,
      noticeRequiredDays: noticeRequiredDays ? parseInt(noticeRequiredDays, 10) : undefined,
      isPublic,
      timezone, // For DST-aware recurring events
      recurrenceRule: recurrenceRule || undefined,
      recurrenceEndDate: recurrenceEndDate || undefined,
    };

    if (isCreating) {
      createMutation.mutate(data);
    } else if (event) {
      updateMutation.mutate({ id: event.id, data });
    }
  };

  const toggleReminder = (days: number) => {
    if (reminderDays.includes(days)) {
      setReminderDays(reminderDays.filter((d) => d !== days));
    } else {
      setReminderDays([...reminderDays, days].sort((a, b) => b - a));
    }
  };

  const getEventTypeName = (typeId: string) => {
    return eventTypes.find((t) => t.id === typeId)?.name || "Event";
  };

  const selectedEventType = eventTypes.find((t) => t.id === eventTypeId);
  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Step 1: Prominent community picker for new events with multiple tenants */}
        {needsTenantStep && !tenantStepComplete ? (
          <>
            <DialogHeader>
              <DialogTitle>Who is this event for?</DialogTitle>
              <DialogDescription>
                Select the community or company this event belongs to — this determines which members see it and which applications are available for the agenda.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Communities */}
              {communityTenants.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Communities / Properties</Label>
                  <div className="grid gap-2">
                    {communityTenants.map((tenant) => (
                      <button
                        key={tenant.id}
                        type="button"
                        onClick={() => {
                          setTenantId(tenant.id);
                          setTenantStepComplete(true);
                        }}
                        className={cn(
                          "flex items-center gap-3 w-full p-4 rounded-lg border-2 text-left transition-all hover:border-primary/50 hover:bg-primary/5",
                          tenantId === tenant.id
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        )}
                      >
                        <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                          <Home className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground">Community events, meetings, and reviews</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Management Companies */}
              {managementTenants.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Management Company</Label>
                  <div className="grid gap-2">
                    {managementTenants.map((tenant) => (
                      <button
                        key={tenant.id}
                        type="button"
                        onClick={() => {
                          setTenantId(tenant.id);
                          setTenantStepComplete(true);
                        }}
                        className={cn(
                          "flex items-center gap-3 w-full p-3 rounded-lg border text-left transition-all hover:border-primary/50 hover:bg-muted/50 opacity-75 hover:opacity-100",
                          tenantId === tenant.id
                            ? "border-primary bg-primary/5 opacity-100"
                            : "border-border"
                        )}
                      >
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground">Internal company events only (not community-specific)</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                  <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <p className="text-xs">
                      Management company events won't have access to community applications or agenda features like ARC reviews. Choose a specific community above for meetings that involve application reviews.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
        <>
        <DialogHeader>
          <DialogTitle>
            {isCreating ? "New Event" : `Edit: ${event?.title}`}
          </DialogTitle>
          <DialogDescription>
            {isCreating
              ? "Create a new event, meeting, or deadline"
              : "Update the event details"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="location" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </TabsTrigger>
            <TabsTrigger value="recurrence" className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Repeat
            </TabsTrigger>
            <TabsTrigger value="reminders" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              More
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Tenant Selection - show selected badge if came from picker step, dropdown otherwise */}
            <div className="space-y-2">
              <Label htmlFor="tenant">Event For</Label>
              {needsTenantStep ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
                  {availableTenants.find((t) => t.id === tenantId)?.type === "management_company" ? (
                    <Building2 className="h-4 w-4 text-slate-600" />
                  ) : (
                    <Home className="h-4 w-4 text-emerald-600" />
                  )}
                  <span className="text-sm font-medium">
                    {availableTenants.find((t) => t.id === tenantId)?.name || "Not selected"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 text-xs text-muted-foreground"
                    onClick={() => setTenantStepComplete(false)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property or company" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                        <span className="text-muted-foreground ml-2 text-xs">
                          ({tenant.type === "management_company" ? "Company" : "Property"})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Event Type */}
            <div className="space-y-2">
              <Label htmlFor="eventType">Event Type</Label>
              <Select value={eventTypeId} onValueChange={setEventTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEventType?.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedEventType.description}
                </p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`e.g., ${getEventTypeName(eventTypeId)} - ${format(startDate || new Date(), "MMMM")}`}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Event description, agenda items, notes..."
                rows={3}
              />
            </div>

            {/* All Day Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="allDay"
                checked={allDay}
                onCheckedChange={setAllDay}
              />
              <Label htmlFor="allDay">All day event</Label>
            </div>

            {/* Date & Time */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Start Date/Time */}
              <div className="space-y-2">
                <Label>Start</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {!allDay && (
                    <Select value={startTime} onValueChange={setStartTime}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* End Date/Time */}
              <div className="space-y-2">
                <Label>End</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "MMM d, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {!allDay && (
                    <Select value={endTime} onValueChange={setEndTime}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="location" className="space-y-4 mt-4">
            {/* Physical Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Physical address or room name"
                  className="pl-10"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Enter a physical address or type "Virtual" for online events
              </p>
            </div>

            {/* Virtual Meeting URL */}
            <div className="space-y-2">
              <Label htmlFor="meetingUrl">Virtual Meeting Link</Label>
              <div className="relative">
                <Video className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="meetingUrl"
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                  className="pl-10"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Add a Zoom, Google Meet, or Teams link for virtual attendance
              </p>
            </div>
          </TabsContent>

          <TabsContent value="recurrence" className="space-y-4 mt-4">
            <RecurrenceSelector
              value={recurrenceConfig}
              onChange={setRecurrenceConfig}
              startDate={startDate}
            />

            {/* Timezone selector for recurring events */}
            {recurrenceConfig && recurrenceConfig.frequency !== 'none' && (
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="timezone">
                  <Clock className="inline h-4 w-4 mr-2" />
                  Event Timezone
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific (PT)</SelectItem>
                    <SelectItem value="America/Anchorage">Alaska (AKT)</SelectItem>
                    <SelectItem value="Pacific/Honolulu">Hawaii (HT)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Recurring events will always occur at the specified time in this timezone,
                  even during Daylight Saving Time changes.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="reminders" className="space-y-4 mt-4">
            {/* Reminder Days */}
            <div className="space-y-2">
              <Label>Remind Attendees</Label>
              <div className="flex flex-wrap gap-2">
                {reminderPresets.map((preset) => (
                  <Badge
                    key={preset.days}
                    variant={reminderDays.includes(preset.days) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleReminder(preset.days)}
                  >
                    {preset.label}
                    {reminderDays.includes(preset.days) && (
                      <X className="ml-1 h-3 w-3" />
                    )}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Select when to send reminder notifications before the event
              </p>
            </div>

            {/* Notice Required Days */}
            <div className="space-y-2">
              <Label htmlFor="noticeRequiredDays">Notice Required (days)</Label>
              <Input
                id="noticeRequiredDays"
                type="number"
                min="0"
                value={noticeRequiredDays}
                onChange={(e) => setNoticeRequiredDays(e.target.value)}
                placeholder="e.g., 14 for board meetings"
              />
              <p className="text-sm text-muted-foreground">
                For compliance tracking - how many days notice is required before this event
              </p>
            </div>

            {/* Visibility Toggle */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="flex items-center gap-2">
                {isPublic ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                Event Visibility
              </Label>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">
                    {isPublic ? "Public to Community" : "Board & Staff Only"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isPublic
                      ? "All community members (homeowners) can see this event"
                      : "Only board members, managers, and staff can see this event"}
                  </div>
                </div>
                <Switch
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Use "Board & Staff Only" for internal events like inspections or executive sessions
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full">
            {/* Show "Back" button to return to tenant picker when applicable */}
            {needsTenantStep && tenantStepComplete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTenantStepComplete(false)}
                disabled={isLoading}
                className="mr-auto text-muted-foreground"
              >
                Change community
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? "Saving..." : isCreating ? "Create Event" : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
