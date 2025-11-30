/**
 * AIAnalysisStatus - Polling component that shows analysis progress
 *
 * Polls the status endpoint and shows progress. When complete,
 * calls onComplete callback with the analysis ID.
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, CheckCircle, XCircle, Clock, X } from 'lucide-react';
import { getAiAnalysisStatus, cancelAiAnalysis, type AiAnalysisStatus } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface AIAnalysisStatusProps {
  analysisId: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function AIAnalysisStatusCard({ analysisId, onComplete, onCancel }: AIAnalysisStatusProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // Poll for status
  const { data: status, isError } = useQuery<AiAnalysisStatus>({
    queryKey: ['ai-analysis-status', analysisId],
    queryFn: () => getAiAnalysisStatus(analysisId),
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when completed or failed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 3000; // Poll every 3 seconds
    },
    enabled: !!analysisId,
  });

  // Update elapsed time
  useEffect(() => {
    if (status?.status === 'completed' || status?.status === 'failed') {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status?.status]);

  // Simulate progress based on elapsed time and estimated time
  useEffect(() => {
    if (status?.status === 'completed') {
      setProgress(100);
      onComplete?.();
      return;
    }

    if (status?.status === 'failed') {
      return;
    }

    const estimatedSeconds = status?.estimatedTimeSeconds || 120;
    const calculatedProgress = Math.min(95, (elapsedTime / estimatedSeconds) * 100);
    setProgress(calculatedProgress);
  }, [elapsedTime, status, onComplete]);

  const handleCancel = async () => {
    try {
      await cancelAiAnalysis(analysisId);
      toast({
        title: 'Analysis Cancelled',
        description: 'The AI analysis has been cancelled.',
      });
      onCancel?.();
    } catch (error: any) {
      toast({
        title: 'Cancel Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isError) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-300">Analysis Error</p>
              <p className="text-sm text-red-600 dark:text-red-400">
                Unable to fetch analysis status
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status?.status === 'completed') {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-300">Analysis Complete</p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Your AI analysis is ready to view
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status?.status === 'failed') {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-500" />
            <div className="flex-1">
              <p className="font-medium text-red-700 dark:text-red-300">Analysis Failed</p>
              <p className="text-sm text-red-600 dark:text-red-400">
                {status.errorMessage || 'An error occurred during analysis'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Processing or Queued state
  const isQueued = status?.status === 'queued';

  return (
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 dark:border-violet-800 dark:from-violet-950/30 dark:to-indigo-950/30">
      <CardContent className="py-4">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {isQueued ? (
                <Clock className="h-5 w-5 text-violet-500" />
              ) : (
                <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />
              )}
              <div>
                <p className="font-medium text-violet-700 dark:text-violet-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {isQueued ? 'Analysis Queued' : 'Analyzing Application'}
                </p>
                <p className="text-sm text-violet-600 dark:text-violet-400">
                  {isQueued
                    ? `Position ${status?.queuePosition || 1} in queue`
                    : 'AI is reviewing your application...'}
                </p>
              </div>
            </div>
            {(isQueued || status?.status === 'processing') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="text-violet-600 hover:text-violet-700 hover:bg-violet-100"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {!isQueued && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-violet-600 dark:text-violet-400">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Elapsed: {formatTime(elapsedTime)}</span>
            {status?.estimatedTimeSeconds && (
              <span>Est. remaining: {formatTime(Math.max(0, status.estimatedTimeSeconds - elapsedTime))}</span>
            )}
          </div>

          {/* Progress stages */}
          {!isQueued && (
            <div className="grid grid-cols-4 gap-1 text-xs">
              <div className={`text-center p-1 rounded ${progress >= 10 ? 'bg-violet-200 dark:bg-violet-800' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <p className="font-medium">Reading</p>
              </div>
              <div className={`text-center p-1 rounded ${progress >= 35 ? 'bg-violet-200 dark:bg-violet-800' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <p className="font-medium">Analyzing</p>
              </div>
              <div className={`text-center p-1 rounded ${progress >= 60 ? 'bg-violet-200 dark:bg-violet-800' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <p className="font-medium">Imagery</p>
              </div>
              <div className={`text-center p-1 rounded ${progress >= 85 ? 'bg-violet-200 dark:bg-violet-800' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <p className="font-medium">Report</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
