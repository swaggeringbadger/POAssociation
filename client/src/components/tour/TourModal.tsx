/**
 * Tour Modal Component
 *
 * Displays the tour content in a modal with step navigation.
 * Shows icons and text descriptions for each step.
 */

import { useTour } from './TourProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';

export function TourModal() {
  const {
    isOpen,
    currentTour,
    currentStepIndex,
    closeTour,
    nextStep,
    prevStep,
    completeTour,
  } = useTour();

  if (!currentTour) return null;

  const currentStep = currentTour.steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === currentTour.steps.length - 1;
  const progressPercent = ((currentStepIndex + 1) / currentTour.steps.length) * 100;

  const handleNext = () => {
    if (isLastStep) {
      completeTour();
    } else {
      nextStep();
    }
  };

  const handleSkip = () => {
    completeTour();
  };

  const StepIcon = currentStep.icon;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeTour()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-4">
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {currentTour.pageTitle}
              </span>
              <span>
                Step {currentStepIndex + 1} of {currentTour.steps.length}
              </span>
            </div>
            <Progress value={progressPercent} className="h-1" />
          </div>

          {/* Step content */}
          <div className="flex flex-col items-center text-center pt-4 space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <StepIcon className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-xl">{currentStep.title}</DialogTitle>
            <DialogDescription className="text-base leading-relaxed">
              {currentStep.description}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Step indicators (dots) */}
        <div className="flex justify-center gap-2 py-4">
          {currentTour.steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === currentStepIndex
                  ? 'bg-primary'
                  : index < currentStepIndex
                  ? 'bg-primary/50'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Skip button - only on first step */}
          {isFirstStep && (
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="sm:mr-auto text-muted-foreground"
            >
              Skip tour
            </Button>
          )}

          {/* Back button - only if not first step */}
          {!isFirstStep && (
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}

          {/* Next/Complete button */}
          <Button onClick={handleNext} className="min-w-[100px]">
            {isLastStep ? (
              'Got it!'
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
