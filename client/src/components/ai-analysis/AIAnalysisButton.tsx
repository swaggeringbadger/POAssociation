/**
 * AIAnalysisButton - Trigger AI analysis for an application
 *
 * Shows credit availability and triggers analysis when clicked.
 * Only visible to management roles (management_manager, management_rep, account_admin).
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, Loader2, AlertTriangle, Zap, Satellite, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  checkAiCredits,
  triggerAiAnalysis,
  type AiCreditCheck,
  type TriggerAnalysisResponse,
} from '@/lib/api';

interface AIAnalysisButtonProps {
  applicationId: string;
  userRole?: string;
  onAnalysisStarted?: (analysisId: string) => void;
  disabled?: boolean;
}

// Roles that can trigger AI analysis
const ALLOWED_ROLES = ['management_manager', 'management_rep', 'account_admin', 'super_admin'];

export function AIAnalysisButton({
  applicationId,
  userRole,
  onAnalysisStarted,
  disabled = false,
}: AIAnalysisButtonProps) {
  const [open, setOpen] = useState(false);
  const [includeSatellite, setIncludeSatellite] = useState(true);
  const [includeMockups, setIncludeMockups] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user has permission
  const canTriggerAnalysis = userRole && ALLOWED_ROLES.includes(userRole);

  // Check credit availability
  const { data: creditCheck, isLoading: checkingCredits } = useQuery<AiCreditCheck>({
    queryKey: ['ai-credits-check'],
    queryFn: checkAiCredits,
    enabled: !!(canTriggerAnalysis && open),
    staleTime: 30000, // 30 seconds
  });

  // Mutation to trigger analysis
  const triggerMutation = useMutation({
    mutationFn: () =>
      triggerAiAnalysis(applicationId, {
        includeSatellite,
        includeMockups,
        mockupQuality: 'standard',
      }),
    onSuccess: (data: TriggerAnalysisResponse) => {
      toast({
        title: 'AI Analysis Started',
        description: `Analysis queued. Estimated time: ${Math.ceil(data.estimatedTimeSeconds / 60)} minutes.`,
      });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['ai-credits-check'] });
      queryClient.invalidateQueries({ queryKey: ['application-analyses', applicationId] });
      onAnalysisStarted?.(data.analysisId);
    },
    onError: (error: Error) => {
      toast({
        title: 'Analysis Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Don't render if user doesn't have permission
  if (!canTriggerAnalysis) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          disabled={disabled}
          data-testid="button-ai-analysis"
        >
          <Sparkles className="h-4 w-4" />
          AI Analysis
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            AI-Powered Application Analysis
          </DialogTitle>
          <DialogDescription>
            Generate a comprehensive AI analysis including bylaw compliance check, risk assessment,
            and board recommendations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Credit Status */}
          {checkingCredits ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking credits...
            </div>
          ) : creditCheck ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Credits Available</span>
                </div>
                <Badge variant={creditCheck.hasCredits ? 'default' : 'destructive'}>
                  {creditCheck.creditsRemaining} remaining
                </Badge>
              </div>

              {!creditCheck.hasCredits && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No credits remaining. This analysis will incur an overage charge of{' '}
                    <strong>${creditCheck.overageCost}</strong>.
                  </AlertDescription>
                </Alert>
              )}

              {creditCheck.isOverage && creditCheck.hasCredits && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You're in overage mode. This analysis will cost{' '}
                    <strong>${creditCheck.overageCost}</strong>.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : null}

          {/* Analysis Options */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Analysis Options</h4>

            <div className="flex items-start space-x-3 p-3 border rounded-lg">
              <Checkbox
                id="satellite"
                checked={includeSatellite}
                onCheckedChange={(checked) => setIncludeSatellite(checked as boolean)}
              />
              <div className="space-y-1">
                <Label htmlFor="satellite" className="flex items-center gap-2 cursor-pointer">
                  <Satellite className="h-4 w-4 text-blue-500" />
                  Include Satellite Imagery
                </Label>
                <p className="text-xs text-muted-foreground">
                  Fetch satellite view of the property address for context
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 border rounded-lg">
              <Checkbox
                id="mockups"
                checked={includeMockups}
                onCheckedChange={(checked) => setIncludeMockups(checked as boolean)}
              />
              <div className="space-y-1">
                <Label htmlFor="mockups" className="flex items-center gap-2 cursor-pointer">
                  <Image className="h-4 w-4 text-green-500" />
                  Generate AI Mockups
                </Label>
                <p className="text-xs text-muted-foreground">
                  Create visual mockups of the proposed project
                </p>
              </div>
            </div>
          </div>

          {/* What's Included */}
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-violet-700 dark:text-violet-300">
              Analysis Includes:
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                Bylaw compliance check with citations
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                Risk assessment (structural, aesthetic, property value)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                Questions for the applicant
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                Board recommendation (approve/deny/conditions)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                Downloadable PDF report
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
            className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
          >
            {triggerMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Start Analysis
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
