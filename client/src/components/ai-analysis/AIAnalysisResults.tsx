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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Search,
  Building,
  FileWarning,
  Receipt,
  Landmark,
  Map,
  Gavel,
  Users,
  Info,
  Flag,
  ExternalLink,
  History,
} from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useToast } from '@/hooks/use-toast';
import { getAiAnalysis, submitAnalysisFeedback, type AiAnalysis } from '@/lib/api';
import { AIAnalysisTimeline } from './AIAnalysisTimeline';

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

// Lightbox image type
interface LightboxImage {
  url: string;
  title: string;
  description?: string;
}

export function AIAnalysisResults({ analysisId }: AIAnalysisResultsProps) {
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [expandedBylaws, setExpandedBylaws] = useState<Set<string>>(new Set());
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);
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
            <TabsList className="grid w-full grid-cols-6">
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
                <span className="hidden sm:inline">Recommend.</span>
              </TabsTrigger>
              <TabsTrigger value="research" className="gap-2">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Research</span>
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Timeline</span>
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

            {/* Property Research Tab */}
            <TabsContent value="research" className="mt-6 space-y-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Search className="h-5 w-5 text-indigo-500" />
                Property Research
              </h3>

              {analysis.propertyResearch ? (
                <>
                  {/* Research Summary */}
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Research Risk Level</span>
                      <Badge className={riskColors[analysis.propertyResearch.overallRiskLevel]}>
                        {analysis.propertyResearch.overallRiskLevel.charAt(0).toUpperCase() + analysis.propertyResearch.overallRiskLevel.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{analysis.propertyResearch.researchSummary}</p>
                  </div>

                  {/* Red Flags */}
                  {analysis.propertyResearch.redFlags.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold flex items-center gap-2 text-red-600">
                        <Flag className="h-4 w-4" />
                        Red Flags ({analysis.propertyResearch.redFlags.length})
                      </h4>
                      {analysis.propertyResearch.redFlags.map((flag, idx) => (
                        <div key={idx} className="border border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${
                              flag.severity === 'critical' ? 'text-red-600' :
                              flag.severity === 'high' ? 'text-orange-500' :
                              flag.severity === 'medium' ? 'text-yellow-500' :
                              'text-blue-500'
                            }`} />
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={riskColors[flag.severity]}>{flag.severity}</Badge>
                              </div>
                              <p className="text-sm font-medium">{flag.issue}</p>
                              <p className="text-sm text-muted-foreground mt-1">{flag.recommendation}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Key Findings */}
                  {analysis.propertyResearch.keyFindings.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-500" />
                        Key Findings ({analysis.propertyResearch.keyFindings.length})
                      </h4>
                      {analysis.propertyResearch.keyFindings.map((finding, idx) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            {finding.category === 'tax' && <Receipt className="h-5 w-5 text-green-500 shrink-0" />}
                            {finding.category === 'lien' && <FileWarning className="h-5 w-5 text-orange-500 shrink-0" />}
                            {finding.category === 'permit' && <FileText className="h-5 w-5 text-blue-500 shrink-0" />}
                            {finding.category === 'deed' && <Landmark className="h-5 w-5 text-purple-500 shrink-0" />}
                            {finding.category === 'survey' && <Map className="h-5 w-5 text-teal-500 shrink-0" />}
                            {finding.category === 'legal' && <Gavel className="h-5 w-5 text-red-500 shrink-0" />}
                            {finding.category === 'zoning' && <Building className="h-5 w-5 text-indigo-500 shrink-0" />}
                            {finding.category === 'ownership' && <Users className="h-5 w-5 text-amber-500 shrink-0" />}
                            {finding.category === 'other' && <Info className="h-5 w-5 text-gray-500 shrink-0" />}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{finding.title}</span>
                                <Badge variant="outline" className="text-xs capitalize">{finding.category}</Badge>
                                <Badge className={`text-xs ${
                                  finding.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                  finding.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                  finding.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  finding.severity === 'low' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>{finding.severity}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{finding.description}</p>
                              <p className="text-sm mt-2"><span className="font-medium">Relevance:</span> {finding.relevanceToApplication}</p>
                              {finding.recommendation && (
                                <p className="text-sm mt-1 text-blue-600 dark:text-blue-400">{finding.recommendation}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tax Records */}
                  {analysis.propertyResearch.taxRecords.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-green-500" />
                        Tax Records
                      </h4>
                      {analysis.propertyResearch.taxRecords.map((tax, idx) => (
                        <div key={idx} className="border rounded-lg p-4 bg-green-50/30 dark:bg-green-950/10">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            {tax.parcelId && <div><span className="text-muted-foreground">Parcel ID:</span> {tax.parcelId}</div>}
                            {tax.assessedValue && <div><span className="text-muted-foreground">Assessed:</span> {tax.assessedValue}</div>}
                            {tax.marketValue && <div><span className="text-muted-foreground">Market Value:</span> {tax.marketValue}</div>}
                            {tax.annualTaxAmount && <div><span className="text-muted-foreground">Annual Tax:</span> {tax.annualTaxAmount}</div>}
                            {tax.taxStatus && (
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">Status:</span>
                                <Badge className={
                                  tax.taxStatus === 'current' ? 'bg-green-100 text-green-700' :
                                  tax.taxStatus === 'delinquent' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                                }>{tax.taxStatus}</Badge>
                              </div>
                            )}
                            {tax.taxYear && <div><span className="text-muted-foreground">Tax Year:</span> {tax.taxYear}</div>}
                          </div>
                          {tax.exemptions.length > 0 && (
                            <div className="mt-2 text-sm"><span className="text-muted-foreground">Exemptions:</span> {tax.exemptions.join(', ')}</div>
                          )}
                          {tax.notes && <p className="mt-2 text-sm text-muted-foreground">{tax.notes}</p>}
                        </div>
                      ))}
                      {analysis.propertyResearch.taxAnalysis && (
                        <p className="text-sm text-muted-foreground italic">{analysis.propertyResearch.taxAnalysis}</p>
                      )}
                    </div>
                  )}

                  {/* Liens */}
                  {analysis.propertyResearch.liens.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold flex items-center gap-2">
                        <FileWarning className="h-4 w-4 text-orange-500" />
                        Liens & Encumbrances ({analysis.propertyResearch.liens.length})
                      </h4>
                      {analysis.propertyResearch.liens.map((lien, idx) => (
                        <div key={idx} className={`border rounded-lg p-4 ${
                          lien.status === 'active' ? 'border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20' : 'bg-muted/30'
                        }`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium capitalize">{lien.lienType.replace('_', ' ')} Lien</span>
                                <Badge className={
                                  lien.status === 'active' ? 'bg-orange-100 text-orange-700' :
                                  lien.status === 'released' ? 'bg-green-100 text-green-700' :
                                  lien.status === 'satisfied' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }>{lien.status}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{lien.description}</p>
                              <div className="mt-2 text-sm">
                                <span className="text-muted-foreground">Holder:</span> {lien.lienHolder}
                                {lien.amount && <span className="ml-4"><span className="text-muted-foreground">Amount:</span> {lien.amount}</span>}
                                {lien.filedDate && <span className="ml-4"><span className="text-muted-foreground">Filed:</span> {lien.filedDate}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {analysis.propertyResearch.lienAnalysis && (
                        <p className="text-sm text-muted-foreground italic">{analysis.propertyResearch.lienAnalysis}</p>
                      )}
                    </div>
                  )}

                  {/* Permit History */}
                  {analysis.propertyResearch.permits.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        Permit History ({analysis.propertyResearch.permits.length})
                      </h4>
                      {analysis.propertyResearch.permits.map((permit, idx) => (
                        <div key={idx} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{permit.permitType}</span>
                                <Badge className={
                                  permit.status === 'final' ? 'bg-green-100 text-green-700' :
                                  permit.status === 'issued' ? 'bg-blue-100 text-blue-700' :
                                  permit.status === 'expired' ? 'bg-yellow-100 text-yellow-700' :
                                  permit.status === 'revoked' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                                }>{permit.status}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{permit.description}</p>
                              <div className="mt-2 text-sm flex flex-wrap gap-4">
                                {permit.permitNumber && <span><span className="text-muted-foreground">Permit #:</span> {permit.permitNumber}</span>}
                                {permit.issueDate && <span><span className="text-muted-foreground">Issued:</span> {permit.issueDate}</span>}
                                {permit.estimatedValue && <span><span className="text-muted-foreground">Value:</span> {permit.estimatedValue}</span>}
                                {permit.contractor && <span><span className="text-muted-foreground">Contractor:</span> {permit.contractor}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {analysis.propertyResearch.permitAnalysis && (
                        <p className="text-sm text-muted-foreground italic">{analysis.propertyResearch.permitAnalysis}</p>
                      )}
                    </div>
                  )}

                  {/* Survey Info */}
                  {analysis.propertyResearch.surveyInfo && (
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold flex items-center gap-2">
                        <Map className="h-4 w-4 text-teal-500" />
                        Survey / Plat Information
                      </h4>
                      <div className="border rounded-lg p-4 bg-teal-50/30 dark:bg-teal-950/10">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          {analysis.propertyResearch.surveyInfo.subdivision && <div><span className="text-muted-foreground">Subdivision:</span> {analysis.propertyResearch.surveyInfo.subdivision}</div>}
                          {analysis.propertyResearch.surveyInfo.lotNumber && <div><span className="text-muted-foreground">Lot:</span> {analysis.propertyResearch.surveyInfo.lotNumber}</div>}
                          {analysis.propertyResearch.surveyInfo.blockNumber && <div><span className="text-muted-foreground">Block:</span> {analysis.propertyResearch.surveyInfo.blockNumber}</div>}
                          {analysis.propertyResearch.surveyInfo.lotSize && <div><span className="text-muted-foreground">Lot Size:</span> {analysis.propertyResearch.surveyInfo.lotSize}</div>}
                          {analysis.propertyResearch.surveyInfo.platBook && <div><span className="text-muted-foreground">Plat Book:</span> {analysis.propertyResearch.surveyInfo.platBook}</div>}
                          {analysis.propertyResearch.surveyInfo.platPage && <div><span className="text-muted-foreground">Plat Page:</span> {analysis.propertyResearch.surveyInfo.platPage}</div>}
                        </div>
                        {analysis.propertyResearch.surveyInfo.setbacks && (
                          <div className="mt-3 text-sm">
                            <span className="font-medium">Setbacks: </span>
                            {analysis.propertyResearch.surveyInfo.setbacks.front && <span className="mr-3">Front: {analysis.propertyResearch.surveyInfo.setbacks.front}</span>}
                            {analysis.propertyResearch.surveyInfo.setbacks.rear && <span className="mr-3">Rear: {analysis.propertyResearch.surveyInfo.setbacks.rear}</span>}
                            {analysis.propertyResearch.surveyInfo.setbacks.leftSide && <span className="mr-3">Left: {analysis.propertyResearch.surveyInfo.setbacks.leftSide}</span>}
                            {analysis.propertyResearch.surveyInfo.setbacks.rightSide && <span>Right: {analysis.propertyResearch.surveyInfo.setbacks.rightSide}</span>}
                          </div>
                        )}
                        {analysis.propertyResearch.surveyInfo.easements.length > 0 && (
                          <div className="mt-2 text-sm"><span className="font-medium">Easements:</span> {analysis.propertyResearch.surveyInfo.easements.join('; ')}</div>
                        )}
                      </div>
                      {analysis.propertyResearch.surveyAnalysis && (
                        <p className="text-sm text-muted-foreground italic">{analysis.propertyResearch.surveyAnalysis}</p>
                      )}
                    </div>
                  )}

                  {/* Zoning */}
                  {analysis.propertyResearch.zoning && (
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold flex items-center gap-2">
                        <Building className="h-4 w-4 text-indigo-500" />
                        Zoning Information
                      </h4>
                      <div className="border rounded-lg p-4 bg-indigo-50/30 dark:bg-indigo-950/10">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          {analysis.propertyResearch.zoning.zoningCode && <div><span className="text-muted-foreground">Zoning Code:</span> <span className="font-medium">{analysis.propertyResearch.zoning.zoningCode}</span></div>}
                          {analysis.propertyResearch.zoning.floodZone && <div><span className="text-muted-foreground">Flood Zone:</span> {analysis.propertyResearch.zoning.floodZone}</div>}
                          {analysis.propertyResearch.zoning.maxBuildingHeight && <div><span className="text-muted-foreground">Max Height:</span> {analysis.propertyResearch.zoning.maxBuildingHeight}</div>}
                          {analysis.propertyResearch.zoning.maxLotCoverage && <div><span className="text-muted-foreground">Max Coverage:</span> {analysis.propertyResearch.zoning.maxLotCoverage}</div>}
                        </div>
                        {analysis.propertyResearch.zoning.zoningDescription && (
                          <p className="mt-2 text-sm">{analysis.propertyResearch.zoning.zoningDescription}</p>
                        )}
                        {analysis.propertyResearch.zoning.allowedUses.length > 0 && (
                          <div className="mt-2 text-sm"><span className="font-medium">Allowed Uses:</span> {analysis.propertyResearch.zoning.allowedUses.join(', ')}</div>
                        )}
                        {analysis.propertyResearch.zoning.restrictions.length > 0 && (
                          <div className="mt-2 text-sm text-orange-600 dark:text-orange-400"><span className="font-medium">Restrictions:</span> {analysis.propertyResearch.zoning.restrictions.join(', ')}</div>
                        )}
                      </div>
                      {analysis.propertyResearch.zoningAnalysis && (
                        <p className="text-sm text-muted-foreground italic">{analysis.propertyResearch.zoningAnalysis}</p>
                      )}
                    </div>
                  )}

                  {/* Legal Issues */}
                  {analysis.propertyResearch.legalIssues.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold flex items-center gap-2 text-red-600">
                        <Gavel className="h-4 w-4" />
                        Legal Issues ({analysis.propertyResearch.legalIssues.length})
                      </h4>
                      {analysis.propertyResearch.legalIssues.map((issue, idx) => (
                        <div key={idx} className={`border rounded-lg p-4 ${
                          issue.status === 'open' || issue.status === 'pending' ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20' : 'bg-muted/30'
                        }`}>
                          <div className="flex items-start gap-3">
                            <Gavel className={`h-5 w-5 shrink-0 ${issue.status === 'open' || issue.status === 'pending' ? 'text-red-500' : 'text-gray-400'}`} />
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium capitalize">{issue.issueType.replace('_', ' ')}</span>
                                <Badge className={
                                  issue.status === 'open' ? 'bg-red-100 text-red-700' :
                                  issue.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                  issue.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-700'
                                }>{issue.status}</Badge>
                              </div>
                              <p className="text-sm">{issue.description}</p>
                              {issue.potentialImpact && (
                                <p className="text-sm mt-1 text-red-600 dark:text-red-400"><span className="font-medium">Potential Impact:</span> {issue.potentialImpact}</p>
                              )}
                              <div className="mt-2 text-sm text-muted-foreground flex flex-wrap gap-4">
                                {issue.filedDate && <span>Filed: {issue.filedDate}</span>}
                                {issue.resolvedDate && <span>Resolved: {issue.resolvedDate}</span>}
                                {issue.caseNumber && <span>Case #: {issue.caseNumber}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {analysis.propertyResearch.legalAnalysis && (
                        <p className="text-sm text-muted-foreground italic">{analysis.propertyResearch.legalAnalysis}</p>
                      )}
                    </div>
                  )}

                  {/* Ownership History */}
                  {analysis.propertyResearch.ownershipHistory.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4 text-amber-500" />
                        Ownership History
                      </h4>
                      <div className="space-y-2">
                        {analysis.propertyResearch.ownershipHistory.map((owner, idx) => (
                          <div key={idx} className="border rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{owner.ownerName}</span>
                              {owner.ownershipType && <Badge variant="outline" className="text-xs capitalize">{owner.ownershipType}</Badge>}
                            </div>
                            <div className="mt-1 text-muted-foreground flex flex-wrap gap-3">
                              {owner.purchaseDate && <span>Purchased: {owner.purchaseDate}</span>}
                              {owner.purchasePrice && <span>for {owner.purchasePrice}</span>}
                              {owner.saleDate && <span>Sold: {owner.saleDate}</span>}
                              {owner.salePrice && <span>for {owner.salePrice}</span>}
                              {owner.durationOwned && <span>({owner.durationOwned})</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                      {analysis.propertyResearch.ownershipAnalysis && (
                        <p className="text-sm text-muted-foreground italic">{analysis.propertyResearch.ownershipAnalysis}</p>
                      )}
                    </div>
                  )}

                  {/* Deeds */}
                  {analysis.propertyResearch.deeds.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-purple-500" />
                        Deed History
                      </h4>
                      <div className="space-y-2">
                        {analysis.propertyResearch.deeds.map((deed, idx) => (
                          <div key={idx} className="border rounded-lg p-3 text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium capitalize">{deed.documentType.replace('_', ' ')}</span>
                              {deed.recordingDate && <span className="text-muted-foreground">({deed.recordingDate})</span>}
                            </div>
                            <div className="text-muted-foreground">
                              {deed.grantor && deed.grantee && <span>{deed.grantor} → {deed.grantee}</span>}
                              {deed.salePrice && <span className="ml-3">Sale: {deed.salePrice}</span>}
                              {deed.documentNumber && <span className="ml-3">Doc #: {deed.documentNumber}</span>}
                            </div>
                            {deed.notes && <p className="mt-1 text-muted-foreground">{deed.notes}</p>}
                          </div>
                        ))}
                      </div>
                      {analysis.propertyResearch.titleAnalysis && (
                        <p className="text-sm text-muted-foreground italic">{analysis.propertyResearch.titleAnalysis}</p>
                      )}
                    </div>
                  )}

                  {/* Further Research Needed */}
                  {analysis.propertyResearch.furtherResearchNeeded.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-base font-semibold flex items-center gap-2 text-amber-600">
                        <Search className="h-4 w-4" />
                        Further Research Recommended
                      </h4>
                      {analysis.propertyResearch.furtherResearchNeeded.map((item, idx) => (
                        <div key={idx} className="border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 rounded-lg p-3">
                          <p className="text-sm font-medium">{item.area}</p>
                          <p className="text-sm text-muted-foreground">{item.reason}</p>
                          {item.suggestedSource && (
                            <p className="text-sm mt-1 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> {item.suggestedSource}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Research Limitations */}
                  {analysis.propertyResearch.researchLimitations.length > 0 && (
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="text-sm font-medium mb-2">Research Limitations</h4>
                      <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                        {analysis.propertyResearch.researchLimitations.map((limitation, idx) => (
                          <li key={idx}>{limitation}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Data Sources */}
                  {analysis.propertyResearch.dataSources.length > 0 && (
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="text-sm font-medium mb-2">Data Sources</h4>
                      <div className="space-y-2">
                        {analysis.propertyResearch.dataSources.map((source, idx) => (
                          <div key={idx} className="text-sm flex items-center gap-2">
                            <Badge variant="outline" className={`text-xs ${
                              source.reliability === 'official' ? 'border-green-500 text-green-700' :
                              source.reliability === 'likely_accurate' ? 'border-blue-500 text-blue-700' :
                              source.reliability === 'needs_verification' ? 'border-yellow-500 text-yellow-700' :
                              'border-gray-500 text-gray-700'
                            }`}>{source.reliability.replace('_', ' ')}</Badge>
                            <span>{source.name}</span>
                            {source.url && (
                              <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <span className="text-muted-foreground">({source.accessDate})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Property research not available for this analysis.</p>
                  <p className="text-sm mt-1">Research includes tax records, liens, permits, deeds, legal issues, and more.</p>
                </div>
              )}
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="mt-6">
              <AIAnalysisTimeline applicationId={analysis.applicationId} />
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
            <CardDescription>Click any image to view in full size</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.satelliteImageUrl && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Satellite View
                  </h4>
                  <div
                    className="relative group cursor-pointer"
                    onClick={() => setLightboxImage({
                      url: analysis.satelliteImageUrl!,
                      title: 'Satellite View',
                      description: 'Satellite imagery of the property location'
                    })}
                  >
                    <img
                      src={analysis.satelliteImageUrl}
                      alt="Satellite view of property"
                      className="w-full rounded-lg border transition-transform group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                      <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </div>
                </div>
              )}
              {analysis.blueprintImageUrls && analysis.blueprintImageUrls.map((url, idx) => (
                <div key={`blueprint-${idx}`} className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Site Plan / Blueprint {analysis.blueprintImageUrls!.length > 1 ? idx + 1 : ''}
                  </h4>
                  <div
                    className="relative group cursor-pointer"
                    onClick={() => setLightboxImage({
                      url,
                      title: `Site Plan / Blueprint${analysis.blueprintImageUrls!.length > 1 ? ` ${idx + 1}` : ''}`,
                      description: 'AI-generated site plan showing property layout, measurements, and landscape elements'
                    })}
                  >
                    <img
                      src={url}
                      alt="AI generated site plan blueprint"
                      className="w-full rounded-lg border bg-white transition-transform group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                      <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI-generated site plan showing property layout, measurements, and landscape elements
                  </p>
                </div>
              ))}
              {analysis.mockupImageUrls && analysis.mockupImageUrls.map((url, idx) => (
                <div key={`mockup-${idx}`} className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    AI Presentation Board {analysis.mockupImageUrls!.length > 1 ? idx + 1 : ''}
                  </h4>
                  <div
                    className="relative group cursor-pointer"
                    onClick={() => setLightboxImage({
                      url,
                      title: `AI Presentation Board${analysis.mockupImageUrls!.length > 1 ? ` ${idx + 1}` : ''}`,
                      description: 'AI-generated presentation board with blueprint and drone views'
                    })}
                  >
                    <img
                      src={url}
                      alt={`AI generated mockup ${idx + 1}`}
                      className="w-full rounded-lg border transition-transform group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                      <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Lightbox Modal with Pan/Zoom */}
      <Dialog open={!!lightboxImage} onOpenChange={(open) => !open && setLightboxImage(null)}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-2 shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>{lightboxImage?.title}</span>
            </DialogTitle>
            {lightboxImage?.description && (
              <p className="text-sm text-muted-foreground">{lightboxImage.description}</p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-hidden relative">
            {lightboxImage && (
              <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={5}
                centerOnInit
                wheel={{ step: 0.1 }}
                doubleClick={{ mode: 'zoomIn', step: 0.7 }}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    {/* Zoom Controls */}
                    <div className="absolute top-2 right-2 z-10 flex gap-1 bg-background/80 backdrop-blur-sm rounded-lg p-1 shadow-lg">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => zoomIn()}
                        title="Zoom in"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => zoomOut()}
                        title="Zoom out"
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => resetTransform()}
                        title="Reset view"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Help text */}
                    <div className="absolute bottom-2 left-2 z-10 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm rounded px-2 py-1">
                      <Move className="h-3 w-3 inline mr-1" />
                      Drag to pan • Scroll or pinch to zoom • Double-click to zoom in
                    </div>
                    <TransformComponent
                      wrapperStyle={{
                        width: '100%',
                        height: '100%',
                      }}
                      contentStyle={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={lightboxImage.url}
                        alt={lightboxImage.title}
                        className="max-w-full max-h-full object-contain rounded-lg"
                        style={{ cursor: 'grab' }}
                      />
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
