import { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Repeat } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  type RecurrenceConfig,
  configToRRule,
  getNextOccurrences,
  describeRecurrence,
  suggestMonthlyPattern,
} from "@shared/recurrence";

interface RecurrenceSelectorProps {
  value: RecurrenceConfig | null;
  onChange: (config: RecurrenceConfig | null) => void;
  startDate?: Date;
}

const WEEKDAY_LABELS = [
  { value: 0, label: "Sun", fullLabel: "Sunday" },
  { value: 1, label: "Mon", fullLabel: "Monday" },
  { value: 2, label: "Tue", fullLabel: "Tuesday" },
  { value: 3, label: "Wed", fullLabel: "Wednesday" },
  { value: 4, label: "Thu", fullLabel: "Thursday" },
  { value: 5, label: "Fri", fullLabel: "Friday" },
  { value: 6, label: "Sat", fullLabel: "Saturday" },
];

const POSITION_LABELS = [
  { value: 1, label: "First" },
  { value: 2, label: "Second" },
  { value: 3, label: "Third" },
  { value: 4, label: "Fourth" },
  { value: -1, label: "Last" },
];

const FREQUENCY_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export default function RecurrenceSelector({
  value,
  onChange,
  startDate,
}: RecurrenceSelectorProps) {
  const effectiveStartDate = startDate || new Date();

  // Default config - ensure endDate is a Date object if present
  const rawConfig: RecurrenceConfig = value || {
    frequency: "none",
    interval: 1,
    endType: "never",
  };

  // Normalize endDate to be a Date object (could be string from JSON)
  const config: RecurrenceConfig = {
    ...rawConfig,
    endDate: rawConfig.endDate
      ? (rawConfig.endDate instanceof Date ? rawConfig.endDate : new Date(rawConfig.endDate))
      : undefined,
  };

  // Get suggested monthly pattern based on start date
  const suggestedPattern = useMemo(
    () => suggestMonthlyPattern(effectiveStartDate),
    [effectiveStartDate]
  );

  const updateConfig = (updates: Partial<RecurrenceConfig>) => {
    const newConfig = { ...config, ...updates };
    onChange(newConfig.frequency === "none" ? null : newConfig);
  };

  // Generate preview occurrences
  const previewOccurrences = useMemo(() => {
    if (config.frequency === "none") return [];
    try {
      const rrule = configToRRule(config, effectiveStartDate);
      if (!rrule) return [];
      return getNextOccurrences(rrule, effectiveStartDate, 5);
    } catch {
      return [];
    }
  }, [config, effectiveStartDate]);

  // Get description
  const recurrenceDescription = useMemo(() => {
    if (config.frequency === "none") return "";
    try {
      const rrule = configToRRule(config, effectiveStartDate);
      return describeRecurrence(rrule);
    } catch {
      return "";
    }
  }, [config, effectiveStartDate]);

  return (
    <div className="space-y-4">
      {/* Frequency Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Repeat className="h-4 w-4" />
          Repeats
        </Label>
        <Select
          value={config.frequency}
          onValueChange={(val) =>
            updateConfig({
              frequency: val as RecurrenceConfig["frequency"],
              // Reset to sensible defaults when changing frequency
              interval: 1,
              weekDays:
                val === "weekly" ? [effectiveStartDate.getDay()] : undefined,
              monthlyType: val === "monthly" ? "date" : undefined,
              monthWeekday:
                val === "monthly"
                  ? {
                      position: suggestedPattern.position,
                      weekday: suggestedPattern.weekday,
                    }
                  : undefined,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {config.frequency !== "none" && (
        <>
          {/* Interval */}
          <div className="space-y-2">
            <Label>Repeat every</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={99}
                value={config.interval}
                onChange={(e) =>
                  updateConfig({ interval: Math.max(1, parseInt(e.target.value) || 1) })
                }
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">
                {config.frequency === "daily" &&
                  (config.interval === 1 ? "day" : "days")}
                {config.frequency === "weekly" &&
                  (config.interval === 1 ? "week" : "weeks")}
                {config.frequency === "monthly" &&
                  (config.interval === 1 ? "month" : "months")}
                {config.frequency === "yearly" &&
                  (config.interval === 1 ? "year" : "years")}
              </span>
            </div>
          </div>

          {/* Weekly: Day Selection */}
          {config.frequency === "weekly" && (
            <div className="space-y-2">
              <Label>On these days</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((day) => (
                  <div key={day.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`day-${day.value}`}
                      checked={config.weekDays?.includes(day.value) || false}
                      onCheckedChange={(checked) => {
                        const currentDays = config.weekDays || [];
                        const newDays = checked
                          ? [...currentDays, day.value].sort()
                          : currentDays.filter((d) => d !== day.value);
                        updateConfig({
                          weekDays: newDays.length > 0 ? newDays : [effectiveStartDate.getDay()],
                        });
                      }}
                    />
                    <label
                      htmlFor={`day-${day.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {day.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly: Type Selection */}
          {config.frequency === "monthly" && (
            <div className="space-y-3">
              <Label>Repeat on</Label>
              <RadioGroup
                value={config.monthlyType || "date"}
                onValueChange={(val) =>
                  updateConfig({ monthlyType: val as "date" | "weekday" })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="date" id="monthly-date" />
                  <label htmlFor="monthly-date" className="text-sm cursor-pointer">
                    Day {effectiveStartDate.getDate()} of the month
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="weekday" id="monthly-weekday" />
                  <label
                    htmlFor="monthly-weekday"
                    className="text-sm cursor-pointer flex items-center gap-2"
                  >
                    The
                    {config.monthlyType === "weekday" && (
                      <>
                        <Select
                          value={String(config.monthWeekday?.position || 1)}
                          onValueChange={(val) =>
                            updateConfig({
                              monthWeekday: {
                                position: parseInt(val),
                                weekday:
                                  config.monthWeekday?.weekday ||
                                  effectiveStartDate.getDay(),
                              },
                            })
                          }
                        >
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {POSITION_LABELS.map((pos) => (
                              <SelectItem
                                key={pos.value}
                                value={String(pos.value)}
                              >
                                {pos.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={String(
                            config.monthWeekday?.weekday ||
                              effectiveStartDate.getDay()
                          )}
                          onValueChange={(val) =>
                            updateConfig({
                              monthWeekday: {
                                position: config.monthWeekday?.position || 1,
                                weekday: parseInt(val),
                              },
                            })
                          }
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WEEKDAY_LABELS.map((day) => (
                              <SelectItem
                                key={day.value}
                                value={String(day.value)}
                              >
                                {day.fullLabel}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                    {config.monthlyType !== "weekday" && (
                      <span className="text-muted-foreground">
                        {POSITION_LABELS.find(
                          (p) => p.value === suggestedPattern.position
                        )?.label || "First"}{" "}
                        {
                          WEEKDAY_LABELS.find(
                            (d) => d.value === suggestedPattern.weekday
                          )?.fullLabel
                        }
                      </span>
                    )}
                  </label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* End Options */}
          <div className="space-y-3 pt-2 border-t">
            <Label>Ends</Label>
            <RadioGroup
              value={config.endType}
              onValueChange={(val) =>
                updateConfig({ endType: val as "never" | "count" | "date" })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="never" id="end-never" />
                <label htmlFor="end-never" className="text-sm cursor-pointer">
                  Never
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="count" id="end-count" />
                <label
                  htmlFor="end-count"
                  className="text-sm cursor-pointer flex items-center gap-2"
                >
                  After
                  {config.endType === "count" && (
                    <Input
                      type="number"
                      min={1}
                      max={999}
                      value={config.endCount || 10}
                      onChange={(e) =>
                        updateConfig({
                          endCount: Math.max(1, parseInt(e.target.value) || 10),
                        })
                      }
                      className="w-20 h-8"
                    />
                  )}
                  {config.endType !== "count" && (
                    <span className="text-muted-foreground">10</span>
                  )}
                  occurrences
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="date" id="end-date" />
                <label
                  htmlFor="end-date"
                  className="text-sm cursor-pointer flex items-center gap-2"
                >
                  On
                  {config.endType === "date" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-8 justify-start text-left font-normal",
                            !config.endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {config.endDate
                            ? format(config.endDate, "MMM d, yyyy")
                            : "Pick date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={config.endDate}
                          onSelect={(date) => updateConfig({ endDate: date })}
                          initialFocus
                          disabled={(date) => date < effectiveStartDate}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                  {config.endType !== "date" && (
                    <span className="text-muted-foreground">a specific date</span>
                  )}
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* Preview */}
          {previewOccurrences.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                Preview
              </Label>
              {recurrenceDescription && (
                <p className="text-sm font-medium">{recurrenceDescription}</p>
              )}
              <div className="text-sm text-muted-foreground space-y-1">
                {previewOccurrences.slice(0, 5).map((date, i) => (
                  <div key={i}>{format(date, "EEEE, MMMM d, yyyy")}</div>
                ))}
                {config.endType === "never" && (
                  <div className="text-xs italic">...and so on</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
