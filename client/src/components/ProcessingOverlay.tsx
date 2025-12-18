/**
 * ProcessingOverlay - Pizza Tracker style progress indicator
 *
 * Shows a modal overlay with step-by-step progress during
 * long-running operations like application creation.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  detail?: string;
}

interface ProcessingOverlayProps {
  isOpen: boolean;
  title?: string;
  steps: ProcessingStep[];
  currentStepId?: string;
  onClose?: () => void;
}

export function ProcessingOverlay({
  isOpen,
  title = 'Processing...',
  steps,
  currentStepId,
}: ProcessingOverlayProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Track elapsed time
  useEffect(() => {
    if (!isOpen) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="w-full max-w-md mx-4 bg-card border rounded-xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b bg-muted/30">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {completedCount} of {steps.length} steps completed
                {elapsedTime > 0 && ` • ${elapsedTime}s`}
              </p>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-muted">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>

            {/* Steps list */}
            <div className="px-6 py-4 space-y-3 max-h-80 overflow-y-auto">
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'flex items-start gap-3 py-2 px-3 rounded-lg transition-colors',
                    step.status === 'in_progress' && 'bg-primary/5 border border-primary/20',
                    step.status === 'completed' && 'bg-green-50 dark:bg-green-950/20',
                    step.status === 'error' && 'bg-destructive/10'
                  )}
                >
                  {/* Status icon */}
                  <div className="mt-0.5 flex-shrink-0">
                    {step.status === 'completed' ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 15 }}
                      >
                        <Check className="h-5 w-5 text-green-600" />
                      </motion.div>
                    ) : step.status === 'in_progress' ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    ) : step.status === 'error' ? (
                      <Circle className="h-5 w-5 text-destructive fill-destructive" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Label and detail */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        step.status === 'pending' && 'text-muted-foreground',
                        step.status === 'in_progress' && 'text-primary',
                        step.status === 'completed' && 'text-green-700 dark:text-green-400',
                        step.status === 'error' && 'text-destructive'
                      )}
                    >
                      {step.label}
                    </p>
                    {step.detail && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="text-xs text-muted-foreground mt-0.5 truncate"
                      >
                        {step.detail}
                      </motion.p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer hint */}
            <div className="px-6 py-3 border-t bg-muted/20">
              <p className="text-xs text-muted-foreground text-center">
                Please wait while we process your request...
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook for managing processing steps
 */
export function useProcessingSteps(initialSteps: Omit<ProcessingStep, 'status'>[]) {
  const [steps, setSteps] = useState<ProcessingStep[]>(
    initialSteps.map((s) => ({ ...s, status: 'pending' as const }))
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const startProcessing = () => {
    setIsProcessing(true);
    setSteps(initialSteps.map((s) => ({ ...s, status: 'pending' as const })));
  };

  const setStepStatus = (
    stepId: string,
    status: ProcessingStep['status'],
    detail?: string
  ) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId ? { ...s, status, detail: detail ?? s.detail } : s
      )
    );
  };

  const startStep = (stepId: string, detail?: string) => {
    setStepStatus(stepId, 'in_progress', detail);
  };

  const completeStep = (stepId: string, detail?: string) => {
    setStepStatus(stepId, 'completed', detail);
  };

  const failStep = (stepId: string, detail?: string) => {
    setStepStatus(stepId, 'error', detail);
  };

  const finishProcessing = () => {
    setIsProcessing(false);
  };

  const resetSteps = () => {
    setSteps(initialSteps.map((s) => ({ ...s, status: 'pending' as const })));
    setIsProcessing(false);
  };

  return {
    steps,
    isProcessing,
    startProcessing,
    startStep,
    completeStep,
    failStep,
    finishProcessing,
    resetSteps,
  };
}
