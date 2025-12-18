/**
 * Icon Picker Component
 *
 * A popover-based picker for selecting tour step icons.
 * Displays icons grouped by category with search functionality.
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TOUR_ICONS, TOUR_ICON_GROUPS, getTourIcon, type TourIconName } from '@/lib/tour';
import { ChevronDown, Search } from 'lucide-react';

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  disabled?: boolean;
}

export function IconPicker({ value, onChange, disabled }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Get the current icon component
  const CurrentIcon = getTourIcon(value);

  // Filter icons based on search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) {
      return TOUR_ICON_GROUPS;
    }

    const searchLower = search.toLowerCase();
    const filtered: Record<string, string[]> = {};

    for (const [group, icons] of Object.entries(TOUR_ICON_GROUPS)) {
      const matchingIcons = icons.filter(name =>
        name.toLowerCase().includes(searchLower)
      );
      if (matchingIcons.length > 0) {
        filtered[group] = matchingIcons;
      }
    }

    return filtered;
  }, [search]);

  const handleSelect = (iconName: string) => {
    onChange(iconName);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <CurrentIcon className="h-4 w-4" />
            <span>{value}</span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search icons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="p-2">
            {Object.entries(filteredGroups).map(([group, icons]) => (
              <div key={group} className="mb-4 last:mb-0">
                <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
                  {group}
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {icons.map((iconName: string) => {
                    const Icon = TOUR_ICONS[iconName as TourIconName];
                    if (!Icon) return null;

                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => handleSelect(iconName)}
                        className={cn(
                          'flex items-center justify-center p-2 rounded-md hover:bg-accent transition-colors',
                          value === iconName && 'bg-accent ring-1 ring-primary'
                        )}
                        title={iconName}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {Object.keys(filteredGroups).length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-4">
                No icons found
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
