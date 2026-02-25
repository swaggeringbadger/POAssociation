/**
 * SectionNavigator Component
 *
 * Desktop: Sticky sidebar showing all sections with progress indicators.
 * Mobile: Sticky top bar with current section name + expandable sheet.
 */

import { CheckCircle2, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { sectionIcons, sectionBgColors } from '@/lib/agendaConstants';
import type { AgendaSection, EventAgendaItemWithDetails, MeetingSectionCompletion } from '@/lib/api';

interface SectionNavigatorProps {
  sections: AgendaSection[];
  itemsBySection: Map<string, EventAgendaItemWithDetails[]>;
  completions: Map<string, MeetingSectionCompletion>;
  activeSectionId: string | null;
  onSectionClick: (sectionId: string) => void;
}

export function SectionNavigator({
  sections,
  itemsBySection,
  completions,
  activeSectionId,
  onSectionClick,
}: SectionNavigatorProps) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const sortedSections = [...sections].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeIndex = sortedSections.findIndex(s => s.id === activeSectionId);
  const activeSection = activeIndex >= 0 ? sortedSections[activeIndex] : sortedSections[0];

  const handleSectionClick = (sectionId: string) => {
    onSectionClick(sectionId);
    setMobileSheetOpen(false);
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      onSectionClick(sortedSections[activeIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (activeIndex < sortedSections.length - 1) {
      onSectionClick(sortedSections[activeIndex + 1].id);
    }
  };

  const renderSectionItem = (section: AgendaSection, compact = false) => {
    const Icon = sectionIcons[section.slug] || List;
    const isActive = section.id === activeSectionId;
    const isCompleted = completions.has(section.id);
    const items = itemsBySection.get(section.id) || [];
    const decidedCount = items.filter(i => i.decision).length;

    return (
      <button
        key={section.id}
        onClick={() => handleSectionClick(section.id)}
        className={cn(
          'w-full text-left px-3 py-2.5 rounded-md border-l-3 transition-all duration-200',
          isActive
            ? sectionBgColors[section.slug] || 'bg-accent border-l-primary'
            : 'border-l-transparent hover:bg-muted/50',
          isCompleted && !isActive && 'opacity-70',
        )}
      >
        <div className="flex items-center gap-2.5">
          <Icon className={cn(
            'h-4 w-4 shrink-0',
            isCompleted ? 'text-green-600' : isActive ? 'text-foreground' : 'text-muted-foreground',
          )} />
          <div className="flex-1 min-w-0">
            <div className={cn(
              'text-sm font-medium truncate',
              isCompleted && 'line-through text-muted-foreground',
            )}>
              {section.name}
            </div>
            {!compact && items.length > 0 && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
                {decidedCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {decidedCount}/{items.length} decided
                  </span>
                )}
              </div>
            )}
          </div>
          {isCompleted && (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          )}
        </div>
      </button>
    );
  };

  return (
    <>
      {/* Desktop sidebar - hidden on mobile */}
      <nav className="hidden lg:block w-[260px] shrink-0 print:hidden">
        <div className="sticky top-4 space-y-1 bg-card border rounded-lg p-3 shadow-sm">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
            Sections
          </h3>
          {sortedSections.map((section) => renderSectionItem(section))}
          <div className="pt-2 mt-2 border-t">
            <div className="flex items-center justify-between px-3 text-xs text-muted-foreground">
              <span>{completions.size}/{sortedSections.length} completed</span>
              <Badge variant="outline" className="text-xs">
                {Math.round((completions.size / Math.max(sortedSections.length, 1)) * 100)}%
              </Badge>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile top bar - hidden on desktop */}
      <div className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b print:hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            disabled={activeIndex <= 0}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-1 rounded-md hover:bg-muted text-sm font-medium">
                {activeSection && (
                  <>
                    {(() => {
                      const Icon = sectionIcons[activeSection.slug] || List;
                      return <Icon className="h-4 w-4" />;
                    })()}
                    <span className="truncate max-w-[200px]">{activeSection.name}</span>
                    <Badge variant="outline" className="text-xs ml-1">
                      {activeIndex + 1}/{sortedSections.length}
                    </Badge>
                  </>
                )}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[70vh]">
              <SheetHeader>
                <SheetTitle>Meeting Sections</SheetTitle>
              </SheetHeader>
              <div className="space-y-1 mt-4 overflow-y-auto">
                {sortedSections.map((section) => renderSectionItem(section))}
              </div>
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            disabled={activeIndex >= sortedSections.length - 1}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

export default SectionNavigator;
