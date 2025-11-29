import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createComplianceItem,
  updateComplianceItem,
  type ComplianceItem,
  type ComplianceCategory,
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
import { Calendar as CalendarIcon, Building, TreePine, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ComplianceItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ComplianceItem | null;
  isCreating: boolean;
  categories: ComplianceCategory[];
  properties: Array<{ id: string; name: string }>;
  managementCompanies: Array<{ id: string; name: string }>;
}

const recurrenceOptions = [
  { value: "none", label: "No recurrence" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-annual" },
  { value: "annual", label: "Annual" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const reminderPresets = [
  { days: 30, label: "30 days" },
  { days: 14, label: "14 days" },
  { days: 7, label: "7 days" },
  { days: 1, label: "1 day" },
];

export default function ComplianceItemModal({
  open,
  onOpenChange,
  item,
  isCreating,
  categories,
  properties,
  managementCompanies,
}: ComplianceItemModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form state
  const [scope, setScope] = useState<"property" | "management_company">("property");
  const [propertyId, setPropertyId] = useState<string>("");
  const [managementCompanyId, setManagementCompanyId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [recurrencePattern, setRecurrencePattern] = useState<string>("none");
  const [priority, setPriority] = useState<string>("normal");
  const [reminderDays, setReminderDays] = useState<number[]>([30, 7, 1]);
  const [notes, setNotes] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [activeTab, setActiveTab] = useState("general");

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      setScope(item.scope);
      setPropertyId(item.propertyId || "");
      setManagementCompanyId(item.managementCompanyId || "");
      setCategoryId(item.categoryId);
      setTitle(item.title);
      setDescription(item.description || "");
      setDueDate(item.dueDate ? new Date(item.dueDate) : undefined);
      setRecurrencePattern(item.recurrencePattern);
      setPriority(item.priority);
      setReminderDays(item.reminderDays || [30, 7, 1]);
      setNotes(item.notes || "");
      setExternalReference(item.externalReference || "");
    } else {
      // Reset to defaults for new item
      setScope("property");
      setPropertyId(properties[0]?.id || "");
      setManagementCompanyId(managementCompanies[0]?.id || "");
      setCategoryId(categories[0]?.id || "");
      setTitle("");
      setDescription("");
      setDueDate(undefined);
      setRecurrencePattern("none");
      setPriority("normal");
      setReminderDays([30, 7, 1]);
      setNotes("");
      setExternalReference("");
    }
    setActiveTab("general");
  }, [item, open, categories, properties, managementCompanies]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createComplianceItem>[0]) => createComplianceItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complianceItems"] });
      queryClient.invalidateQueries({ queryKey: ["complianceDashboard"] });
      onOpenChange(false);
      toast({
        title: "Item created",
        description: "Compliance item has been created successfully.",
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
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateComplianceItem>[1] }) =>
      updateComplianceItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complianceItems"] });
      queryClient.invalidateQueries({ queryKey: ["complianceDashboard"] });
      onOpenChange(false);
      toast({
        title: "Item updated",
        description: "Compliance item has been updated successfully.",
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
    if (!title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required.",
        variant: "destructive",
      });
      return;
    }

    if (!categoryId) {
      toast({
        title: "Validation Error",
        description: "Please select a category.",
        variant: "destructive",
      });
      return;
    }

    if (!dueDate) {
      toast({
        title: "Validation Error",
        description: "Due date is required.",
        variant: "destructive",
      });
      return;
    }

    if (scope === "property" && !propertyId) {
      toast({
        title: "Validation Error",
        description: "Please select a property.",
        variant: "destructive",
      });
      return;
    }

    if (scope === "management_company" && !managementCompanyId) {
      toast({
        title: "Validation Error",
        description: "Please select a management company.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      scope,
      propertyId: scope === "property" ? propertyId : undefined,
      managementCompanyId: scope === "management_company" ? managementCompanyId : undefined,
      categoryId,
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate.toISOString().split('T')[0],
      recurrencePattern: recurrencePattern as any,
      priority: priority as any,
      reminderDays,
      notes: notes.trim() || undefined,
      externalReference: externalReference.trim() || undefined,
    };

    if (isCreating) {
      createMutation.mutate(data);
    } else if (item) {
      updateMutation.mutate({ id: item.id, data });
    }
  };

  const toggleReminderDay = (days: number) => {
    if (reminderDays.includes(days)) {
      setReminderDays(reminderDays.filter((d) => d !== days));
    } else {
      setReminderDays([...reminderDays, days].sort((a, b) => b - a));
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? "Add Compliance Item" : "Edit Compliance Item"}
          </DialogTitle>
          <DialogDescription>
            {isCreating
              ? "Create a new compliance item to track"
              : "Update the compliance item details"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            {/* Scope Selection */}
            <div className="space-y-2">
              <Label>Scope</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={scope === "property" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setScope("property")}
                >
                  <TreePine className="mr-2 h-4 w-4" />
                  Property
                </Button>
                <Button
                  type="button"
                  variant={scope === "management_company" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setScope("management_company")}
                >
                  <Building className="mr-2 h-4 w-4" />
                  Management Company
                </Button>
              </div>
            </div>

            {/* Property/Management Company Selection */}
            {scope === "property" ? (
              <div className="space-y-2">
                <Label htmlFor="propertyId">Property</Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>
                        {prop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="managementCompanyId">Management Company</Label>
                <Select value={managementCompanyId} onValueChange={setManagementCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a management company" />
                  </SelectTrigger>
                  <SelectContent>
                    {managementCompanies.map((mc) => (
                      <SelectItem key={mc.id} value={mc.id}>
                        {mc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Annual Report Filing"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of this compliance item"
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 mt-4">
            {/* Due Date */}
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Select due date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Recurrence */}
            <div className="space-y-2">
              <Label htmlFor="recurrence">Recurrence Pattern</Label>
              <Select value={recurrencePattern} onValueChange={setRecurrencePattern}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recurrenceOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Recurrence will automatically create the next item after completion.
              </p>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reminder Days */}
            <div className="space-y-2">
              <Label>Email Reminders</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Select when to send reminder emails before the due date.
              </p>
              <div className="flex flex-wrap gap-2">
                {reminderPresets.map((preset) => (
                  <Badge
                    key={preset.days}
                    variant={reminderDays.includes(preset.days) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleReminderDay(preset.days)}
                  >
                    {preset.label}
                    {reminderDays.includes(preset.days) && (
                      <X className="ml-1 h-3 w-3" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4 mt-4">
            {/* External Reference */}
            <div className="space-y-2">
              <Label htmlFor="externalReference">External Reference</Label>
              <Input
                id="externalReference"
                value={externalReference}
                onChange={(e) => setExternalReference(e.target.value)}
                placeholder="e.g., Filing number, policy number, etc."
              />
              <p className="text-xs text-muted-foreground">
                Use this for filing numbers, policy numbers, or other external identifiers.
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or instructions"
                rows={5}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : isCreating ? "Create Item" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
