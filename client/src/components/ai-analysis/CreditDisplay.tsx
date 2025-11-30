/**
 * CreditDisplay - Shows AI credit status in the UI
 *
 * Compact display for sidebar/header showing remaining credits
 * and subscription tier information.
 */

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Zap, AlertTriangle, Info } from 'lucide-react';
import { getAiCreditStatus, type AiCreditStatus } from '@/lib/api';

interface CreditDisplayProps {
  compact?: boolean;
  showDetails?: boolean;
}

export function CreditDisplay({ compact = false, showDetails = true }: CreditDisplayProps) {
  const { data: credits, isLoading, error } = useQuery<AiCreditStatus>({
    queryKey: ['ai-credit-status'],
    queryFn: getAiCreditStatus,
    staleTime: 60000, // 1 minute
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Zap className="h-4 w-4 animate-pulse" />
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  if (error || !credits) {
    return null; // Don't show anything if credits can't be loaded
  }

  const usagePercent = credits.monthlyAllowance > 0
    ? ((credits.monthlyAllowance - credits.creditsRemaining) / credits.monthlyAllowance) * 100
    : 0;

  const isLow = credits.creditsRemaining <= 5 && credits.creditsRemaining > 0;
  const isEmpty = credits.creditsRemaining === 0;

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1.5 h-7 px-2 ${
              isEmpty ? 'text-red-500' :
              isLow ? 'text-amber-500' :
              'text-muted-foreground'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{credits.creditsRemaining}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <CreditDetailsContent credits={credits} />
        </PopoverContent>
      </Popover>
    );
  }

  // Full display
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className={`h-4 w-4 ${
            isEmpty ? 'text-red-500' :
            isLow ? 'text-amber-500' :
            'text-violet-500'
          }`} />
          <span className="text-sm font-medium">AI Credits</span>
        </div>
        <Badge variant={isEmpty ? 'destructive' : isLow ? 'outline' : 'secondary'}>
          {credits.creditsRemaining} / {credits.monthlyAllowance}
        </Badge>
      </div>

      <Progress
        value={usagePercent}
        className={`h-2 ${
          isEmpty ? '[&>div]:bg-red-500' :
          isLow ? '[&>div]:bg-amber-500' :
          '[&>div]:bg-violet-500'
        }`}
      />

      {isEmpty && (
        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>No credits remaining. Additional analyses will incur overage charges.</span>
        </div>
      )}

      {isLow && !isEmpty && (
        <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Low credits. Consider upgrading your subscription.</span>
        </div>
      )}

      {showDetails && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Billing cycle ends:</span>
            <span>{new Date(credits.billingCycleEnd).toLocaleDateString()}</span>
          </div>
          {credits.hasOverride && (
            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <Info className="h-3 w-3" />
              <span>Custom allocation active</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreditDetailsContent({ credits }: { credits: AiCreditStatus }) {
  const usagePercent = credits.monthlyAllowance > 0
    ? ((credits.monthlyAllowance - credits.creditsRemaining) / credits.monthlyAllowance) * 100
    : 0;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold flex items-center gap-2 mb-1">
          <Zap className="h-4 w-4 text-violet-500" />
          AI Analysis Credits
        </h4>
        <p className="text-xs text-muted-foreground">
          Monthly allocation for premium AI analysis
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Used this month</span>
          <span className="font-medium">{credits.creditsUsedThisCycle}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Remaining</span>
          <span className="font-medium">{credits.creditsRemaining}</span>
        </div>
        <Progress value={usagePercent} className="h-2" />
      </div>

      <div className="border-t pt-3 space-y-2 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Monthly allowance</span>
          <span>{credits.monthlyAllowance} credits</span>
        </div>
        <div className="flex justify-between">
          <span>Overage cost</span>
          <span>${credits.overageCostPerCredit}/credit</span>
        </div>
        <div className="flex justify-between">
          <span>Cycle ends</span>
          <span>{new Date(credits.billingCycleEnd).toLocaleDateString()}</span>
        </div>
      </div>

      {credits.hasOverride && (
        <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded text-xs">
          <div className="flex items-center gap-1 text-blue-700 dark:text-blue-300 font-medium">
            <Info className="h-3 w-3" />
            Custom Allocation
          </div>
          {credits.overrideReason && (
            <p className="text-blue-600 dark:text-blue-400 mt-1">{credits.overrideReason}</p>
          )}
        </div>
      )}
    </div>
  );
}
