/**
 * AIAnalysisResults - Display comprehensive AI analysis results
 *
 * Shows bylaw compliance, risk assessment, questions/concerns,
 * recommendations, satellite imagery, AI mockups, and PDF download.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sparkles,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  Star,
  MapPin,
  Image,
  Clock,
  Loader2,
  Shield,
  Scale,
  MessageCircleQuestion,
  Lightbulb,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAiAnalysis, submitAnalysisFeedback, type AiAnalysis } from '@/lib/api';

interface AIAnalysisResultsProps {
  analysisId: string;
}

// Risk severity colors
const riskColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

// Recommendation type colors
const recommendationColors: Record<string, string> = {
  approve: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
  approve_with_conditions: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700',
  deny: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
  request_changes: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',
  table: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700',
};

const recommendationLabels: Record<string, string> = {
  approve: 'Approve',
  approve_with_conditions: 'Approve with Conditions',
  deny: 'Deny',
  request_changes: 'Request Changes',
  table: 'Table for Later',
};

export function AIAnalysisResults({ analysisId }: AIAnalysisResultsProps) {
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [expandedBylaws, setExpandedBylaws] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch analysis data
  const { data: analysis, isLoading, error } = useQuery<AiAnalysis>({
    queryKey: ['ai-analysis', analysisId],
    queryFn: () => getAiAnalysis(analysisId),
    enabled: !!analysisId,
  });

  // Submit feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: () => submitAnalysisFeedback(analysisId, feedbackRating!, feedbackText),
    onSuccess: () => {
      toast({
        title: 'Feedback Submitted',
        description: 'Thank you for your feedback!',
      });
      queryClient.invalidateQueries({ queryKey: ['ai-analysis', analysisId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Feedback Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleBylaw = (bylawId: string) => {
    setExpandedBylaws((prev) => {
      const next = new Set(prev);
      if (next.has(bylawId)) {
        next.delete(bylawId);
      } else {
        next.add(bylawId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading analysis results...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !analysis) {
    return (
      <Card className="border-red-200">
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Failed to load analysis results
          </div>
        </CardContent>
      </Card>
    );
  }

  if (analysis.status === 'failed') {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <XCircle className="h-5 w-5" />
            Analysis Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 dark:text-red-400">
            {analysis.errorMessage || 'An error occurred during the analysis.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (analysis.status !== 'completed' || !analysis.result) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Analysis in progress...
          </div>
        </CardContent>
      </Card>
    );
  }

  const result = analysis.result;
  const complianceScore = result.complianceScore;
  const compliantCount = result.bylawCompliance.filter((b) => b.compliant).length;
  const totalBylaws = result.bylawCompliance.length;

  return (
    <div className="space-y-6">
      {/* Header Card with Overall Score */}
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 dark:border-violet-800 dark:from-violet-950/30 dark:to-indigo-950/30">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-500" />
                AI Analysis Results
              </CardTitle>
              <CardDescription>
                Generated {analysis.completedAt ? new Date(analysis.completedAt).toLocaleString() : 'recently'}
              </CardDescription>
            </div>
            {analysis.pdfReportUrl && (
              <Button variant="outline" className="gap-2" asChild>
                <a href={analysis.pdfReportUrl} download>
                  <Download className="h-4 w-4" />
                  Download PDF
                </a>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Compliance Score */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Compliance Score</span>
                <span className={`text-2xl font-bold ${
                  complianceScore >= 80 ? 'text-green-600' :
                  complianceScore >= 60 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {complianceScore}%
                </span>
              </div>
              <Progress
                value={complianceScore}
                className={`h-3 ${
                  complianceScore >= 80 ? '[&>div]:bg-green-500' :
                  complianceScore >= 60 ? '[&>div]:bg-yellow-500' :
                  '[&>div]:bg-red-500'
                }`}
              />
              <p className="text-xs text-muted-foreground">
                {compliantCount} of {totalBylaws} bylaws compliant
              </p>
            </div>

            {/* Risk Level */}
            <div className="space-y-2">
              <span className="text-sm font-medium">Overall Risk Level</span>
              <div className="flex items-center gap-2">
                <Badge className={`text-lg px-4 py-1 ${riskColors[result.riskLevel]}`}>
                  {result.riskLevel.charAt(0).toUpperCase() + result.riskLevel.slice(1)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {result.riskAssessment.length} risk factors identified
              </p>
            </div>

            {/* Recommendation */}
            <div className="space-y-2">
              <span className="text-sm font-medium">Recommendation</span>
              {result.recommendations[0] && (
                <Badge className={`text-base px-4 py-1 ${recommendationColors[result.recommendations[0].type]}`}>
                  {recommendationLabels[result.recommendations[0].type]}
                </Badge>
              )}
              <p className="text-xs text-muted-foreground">
                {result.questionsConcerns.length} questions for review
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-6 p-4 bg-white/50 dark:bg-black/20 rounded-lg">
            <h4 className="text-sm font-semibold mb-2">Executive Summary</h4>
            <p className="text-sm text-muted-foreground">{result.overallSummary}</p>
          </div>

          {/* Meta info */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            {analysis.processingTimeMs && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Processed in {(analysis.processingTimeMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="compliance">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="compliance" className="gap-2">
                <Scale className="h-4 w-4" />
                <span className="hidden sm:inline">Compliance</span>
              </TabsTrigger>
              <TabsTrigger value="risks" className="gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Risks</span>
              </TabsTrigger>
              <TabsTrigger value="questions" className="gap-2">
                <MessageCircleQuestion className="h-4 w-4" />
                <span className="hidden sm:inline">Questions</span>
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="gap-2">
                <Lightbulb className="h-4 w-4" />
                <span className="hidden sm:inline">Recommendations</span>
              </TabsTrigger>
            </TabsList>

            {/* Compliance Tab */}
            <TabsContent value="compliance" className="mt-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-500" />
                Bylaw Compliance Check
              </h3>
              <div className="space-y-3">
                {result.bylawCompliance.map((item, idx) => (
                  <Collapsible
                    key={idx}
                    open={expandedBylaws.has(item.bylawId)}
                    onOpenChange={() => toggleBylaw(item.bylawId)}
                  >
                    <div className={`border rounded-lg ${item.compliant ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'}`}>
                      <CollapsibleTrigger className="w-full p-4 flex items-start justify-between text-left">
                        <div className="flex items-start gap-3">
                          {item.compliant ? (
                            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                          )}
                          <div>
                            <p className="font-medium">{item.sectionReference}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {item.explanation}
                            </p>
                          </div>
                        </div>
                        {expandedBylaws.has(item.bylawId) ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-3">
                          <div className="pl-8">
                            <p className="text-sm">{item.explanation}</p>
                            {item.bylawText && (
                              <div className="mt-2 p-3 bg-muted/50 rounded border-l-4 border-primary/50">
                                <p className="text-sm italic">"{item.bylawText}"</p>
                              </div>
                            )}
                            {item.concerns.length > 0 && (
                              <div className="mt-3">
                                <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
                                  Concerns:
                                </p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                  {item.concerns.map((concern, cIdx) => (
                                    <li key={cIdx}>{concern}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </TabsContent>

            {/* Risks Tab */}
            <TabsContent value="risks" className="mt-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5 text-orange-500" />
                Risk Assessment
              </h3>
              <div className="space-y-3">
                {result.riskAssessment.map((risk, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${
                          risk.severity === 'critical' ? 'text-red-500' :
                          risk.severity === 'high' ? 'text-orange-500' :
                          risk.severity === 'medium' ? 'text-yellow-500' :
                          'text-green-500'
                        }`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium capitalize">{risk.category.replace('_', ' ')}</span>
                            <Badge className={riskColors[risk.severity]}>
                              {risk.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{risk.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 ml-8 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
                        Mitigation:
                      </p>
                      <p className="text-sm text-blue-600 dark:text-blue-300">{risk.mitigation}</p>
                    </div>
                  </div>
                ))}
                {result.riskAssessment.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">No significant risks identified</p>
                )}
              </div>
            </TabsContent>

            {/* Questions Tab */}
            <TabsContent value="questions" className="mt-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageCircleQuestion className="h-5 w-5 text-purple-500" />
                Questions & Concerns for Board Review
              </h3>
              <div className="space-y-3">
                {result.questionsConcerns.map((q, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <HelpCircle className={`h-5 w-5 mt-0.5 shrink-0 ${
                        q.priority === 'high' ? 'text-red-500' :
                        q.priority === 'medium' ? 'text-yellow-500' :
                        'text-blue-500'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {q.category.replace('_', ' ')}
                          </Badge>
                          <Badge className={`text-xs ${
                            q.priority === 'high' ? 'bg-red-100 text-red-700' :
                            q.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {q.priority} priority
                          </Badge>
                        </div>
                        <p className="text-sm">{q.question}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {result.questionsConcerns.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">No questions or concerns</p>
                )}
              </div>
            </TabsContent>

            {/* Recommendations Tab */}
            <TabsContent value="recommendations" className="mt-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                AI Recommendations
              </h3>
              <div className="space-y-4">
                {result.recommendations.map((rec, idx) => (
                  <div key={idx} className={`border-2 rounded-lg p-4 ${recommendationColors[rec.type]}`}>
                    <div className="flex items-start gap-3">
                      {rec.type === 'approve' ? (
                        <ThumbsUp className="h-6 w-6 shrink-0" />
                      ) : rec.type === 'deny' ? (
                        <ThumbsDown className="h-6 w-6 shrink-0" />
                      ) : (
                        <FileText className="h-6 w-6 shrink-0" />
                      )}
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold mb-2">
                          {recommendationLabels[rec.type]}
                        </h4>
                        <p className="text-sm mb-3">{rec.explanation}</p>
                        {rec.conditions && rec.conditions.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium mb-2">Conditions:</p>
                            <ul className="list-disc list-inside text-sm space-y-1">
                              {rec.conditions.map((cond, cIdx) => (
                                <li key={cIdx}>{cond}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Imagery Section */}
      {(analysis.satelliteImageUrl || (analysis.mockupImageUrls && analysis.mockupImageUrls.length > 0) || (analysis.blueprintImageUrls && analysis.blueprintImageUrls.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Visual Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.satelliteImageUrl && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Satellite View
                  </h4>
                  <img
                    src={analysis.satelliteImageUrl}
                    alt="Satellite view of property"
                    className="w-full rounded-lg border"
                  />
                </div>
              )}
              {analysis.blueprintImageUrls && analysis.blueprintImageUrls.map((url, idx) => (
                <div key={`blueprint-${idx}`} className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Site Plan / Blueprint
                  </h4>
                  <img
                    src={url}
                    alt="AI generated site plan blueprint"
                    className="w-full rounded-lg border bg-white"
                  />
                  <p className="text-xs text-muted-foreground">
                    AI-generated site plan showing property layout, measurements, and landscape elements
                  </p>
                </div>
              ))}
              {analysis.mockupImageUrls && analysis.mockupImageUrls.map((url, idx) => (
                <div key={`mockup-${idx}`} className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    AI Mockup {idx + 1}
                  </h4>
                  <img
                    src={url}
                    alt={`AI generated mockup ${idx + 1}`}
                    className="w-full rounded-lg border"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback Section */}
      {!analysis.userRating && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rate This Analysis</CardTitle>
            <CardDescription>
              Help us improve our AI analysis by providing feedback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Button
                    key={rating}
                    variant={feedbackRating === rating ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFeedbackRating(rating)}
                    className="gap-1"
                  >
                    <Star className={`h-4 w-4 ${feedbackRating && feedbackRating >= rating ? 'fill-current' : ''}`} />
                    {rating}
                  </Button>
                ))}
              </div>
              {feedbackRating && (
                <>
                  <Textarea
                    placeholder="Additional feedback (optional)"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={() => feedbackMutation.mutate()}
                    disabled={feedbackMutation.isPending}
                    className="gap-2"
                  >
                    {feedbackMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Submit Feedback
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Already rated message */}
      {analysis.userRating && (
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Thank you for rating this analysis ({analysis.userRating}/5 stars)</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
