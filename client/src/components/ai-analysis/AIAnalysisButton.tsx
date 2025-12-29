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
import { Sparkles, Loader2, AlertTriangle, Zap, Satellite, Image, FileSearch, Wand2, ScanText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  checkAiCredits,
  triggerAiAnalysis,
  triggerOcrProcessing,
  getOcrServiceStatus,
  type AiCreditCheck,
  type TriggerAnalysisResponse,
} from '@/lib/api';
import { CREDIT_COSTS, calculateAnalysisCreditCost } from '@shared/subscriptionTypes';

interface AIAnalysisButtonProps {
  applicationId: string;
  userRole?: string;
  onAnalysisStarted?: (analysisId: string) => void;
  disabled?: boolean;
  isAnalyzing?: boolean;
}

// Roles that can trigger AI analysis
const ALLOWED_ROLES = ['management_manager', 'management_rep', 'account_admin', 'super_admin'];

export function AIAnalysisButton({
  applicationId,
  userRole,
  onAnalysisStarted,
  disabled = false,
  isAnalyzing = false,
}: AIAnalysisButtonProps) {
  const [open, setOpen] = useState(false);
  const [includeSatellite, setIncludeSatellite] = useState(true);
  const [includeMockups, setIncludeMockups] = useState(true);
  const [includeBreakdownReport, setIncludeBreakdownReport] = useState(false);
  const [includeOcr, setIncludeOcr] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user has permission
  const canTriggerAnalysis = userRole && ALLOWED_ROLES.includes(userRole);

  // Calculate credit cost based on selected options
  const creditCost = calculateAnalysisCreditCost({
    includeSatellite,
    includeMockups,
    includeBreakdownReport,
    includeOcr,
  });

  // Check credit availability
  const { data: creditCheck, isLoading: checkingCredits } = useQuery<AiCreditCheck>({
    queryKey: ['ai-credits-check'],
    queryFn: checkAiCredits,
    enabled: !!(canTriggerAnalysis && open),
    staleTime: 30000, // 30 seconds
  });

  // Check if OCR service is available
  const { data: ocrStatus } = useQuery({
    queryKey: ['ocr-service-status'],
    queryFn: getOcrServiceStatus,
    enabled: !!(canTriggerAnalysis && open),
    staleTime: 60000, // 1 minute
  });

  // Mutation to trigger analysis
  const triggerMutation = useMutation({
    mutationFn: async () => {
      // If OCR is selected, trigger it first
      if (includeOcr) {
        try {
          const ocrResult = await triggerOcrProcessing(applicationId, {
            includeImageEnhancement: true,
          });
          toast({
            title: 'OCR Processing Started',
            description: `Processing ${ocrResult.totalDocuments} document(s). Analysis will use extracted text.`,
          });
        } catch (ocrError) {
          // Log but don't fail the analysis
          console.error('OCR trigger failed:', ocrError);
        }
      }

      return triggerAiAnalysis(applicationId, {
        includeSatellite,
        includeMockups,
        includeBreakdownReport,
        includeOcr,
        mockupQuality: 'standard',
      });
    },
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

  // When analyzing, show animated button instead of dialog trigger
  if (isAnalyzing) {
    return (
      <Button
        variant="default"
        className="gap-2 relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-700 hover:via-purple-700 hover:to-indigo-700"
        disabled
        data-testid="button-ai-analysis-progress"
      >
        {/* Animated shimmer/paint effect */}
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmer_2s_infinite] -translate-x-full" />
        <style>{`
          @keyframes shimmer {
            100% { transform: translateX(100%); }
          }
          @keyframes wiggle {
            0%, 100% { transform: rotate(-8deg); }
            50% { transform: rotate(8deg); }
          }
        `}</style>
        <Wand2 className="h-4 w-4 animate-[wiggle_0.5s_ease-in-out_infinite]" />
        <span className="relative">Analyzing...</span>
        <span className="flex gap-0.5">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
      </Button>
    );
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            AI-Powered Application Analysis
          </DialogTitle>
          <DialogDescription>
            Generate a comprehensive AI analysis including bylaw compliance check, risk assessment,
            and board recommendations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-2">
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

              {/* Credit cost for this analysis */}
              <div className="flex items-center justify-between p-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <span className="text-sm font-medium">This analysis costs</span>
                </div>
                <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                  {creditCost} credits
                </Badge>
              </div>

              {creditCheck.creditsRemaining < creditCost && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Not enough credits remaining. This analysis will incur an overage charge of{' '}
                    <strong>${(creditCost * parseFloat(creditCheck.overageCost || '0')).toFixed(2)}</strong>.
                  </AlertDescription>
                </Alert>
              )}

              {creditCheck.isOverage && creditCheck.creditsRemaining >= creditCost && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You're in overage mode. This analysis will cost{' '}
                    <strong>${(creditCost * parseFloat(creditCheck.overageCost || '0')).toFixed(2)}</strong>.
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
              <div className="space-y-1 flex-1">
                <Label htmlFor="satellite" className="flex items-center gap-2 cursor-pointer">
                  <Satellite className="h-4 w-4 text-blue-500" />
                  Include Satellite Imagery
                </Label>
                <p className="text-xs text-muted-foreground">
                  Fetch satellite view of the property address for context
                </p>
              </div>
              <Badge variant="outline" className="text-xs shrink-0">
                +{CREDIT_COSTS.OPTION_SATELLITE_IMAGERY} credit
              </Badge>
            </div>

            <div className="flex items-start space-x-3 p-3 border rounded-lg">
              <Checkbox
                id="mockups"
                checked={includeMockups}
                onCheckedChange={(checked) => setIncludeMockups(checked as boolean)}
              />
              <div className="space-y-1 flex-1">
                <Label htmlFor="mockups" className="flex items-center gap-2 cursor-pointer">
                  <Image className="h-4 w-4 text-green-500" />
                  Generate AI Mockups
                </Label>
                <p className="text-xs text-muted-foreground">
                  Create visual mockups of the proposed project
                </p>
              </div>
              <Badge variant="outline" className="text-xs shrink-0">
                +{CREDIT_COSTS.OPTION_AI_MOCKUPS} credits
              </Badge>
            </div>

            <div className="flex items-start space-x-3 p-3 border rounded-lg border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
              <Checkbox
                id="breakdown"
                checked={includeBreakdownReport}
                onCheckedChange={(checked) => setIncludeBreakdownReport(checked as boolean)}
              />
              <div className="space-y-1 flex-1">
                <Label htmlFor="breakdown" className="flex items-center gap-2 cursor-pointer">
                  <FileSearch className="h-4 w-4 text-amber-600" />
                  Comprehensive Breakdown Report
                </Label>
                <p className="text-xs text-muted-foreground">
                  Deep analysis of completeness, correctness, community & regulatory compliance,
                  categorized issues, and questions for homeowner. Analyzes all community documents including PDFs.
                </p>
              </div>
              <Badge variant="outline" className="text-xs shrink-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                +{CREDIT_COSTS.OPTION_BREAKDOWN_REPORT} credit
              </Badge>
            </div>

            {ocrStatus?.available && (
              <div className="flex items-start space-x-3 p-3 border rounded-lg border-cyan-200 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/30">
                <Checkbox
                  id="ocr"
                  checked={includeOcr}
                  onCheckedChange={(checked) => setIncludeOcr(checked as boolean)}
                />
                <div className="space-y-1 flex-1">
                  <Label htmlFor="ocr" className="flex items-center gap-2 cursor-pointer">
                    <ScanText className="h-4 w-4 text-cyan-600" />
                    OCR & Document Text Extraction
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Extract text from scanned documents, photos, and handwritten notes.
                    Improves analysis accuracy for uploaded images and PDFs.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0 border-cyan-300 text-cyan-700 dark:border-cyan-700 dark:text-cyan-400">
                  +{CREDIT_COSTS.OPTION_OCR_EXTRACTION} credits
                </Badge>
              </div>
            )}
          </div>

          {/* Itemized Cost Breakdown */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Base Analysis</span>
              <span>{CREDIT_COSTS.BASE_ANALYSIS} credit</span>
            </div>
            {includeSatellite && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>+ Satellite Imagery</span>
                <span>{CREDIT_COSTS.OPTION_SATELLITE_IMAGERY} credit</span>
              </div>
            )}
            {includeMockups && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>+ AI Mockups</span>
                <span>{CREDIT_COSTS.OPTION_AI_MOCKUPS} credits</span>
              </div>
            )}
            {includeBreakdownReport && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>+ Breakdown Report</span>
                <span>{CREDIT_COSTS.OPTION_BREAKDOWN_REPORT} credit</span>
              </div>
            )}
            {includeOcr && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>+ OCR Extraction</span>
                <span>{CREDIT_COSTS.OPTION_OCR_EXTRACTION} credits</span>
              </div>
            )}
            <div className="border-t pt-2 mt-2 flex justify-between font-medium">
              <span>Total</span>
              <span className="text-violet-600 dark:text-violet-400">{creditCost} credits</span>
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

        <DialogFooter className="flex-shrink-0">
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
