import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, EmailTemplate } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mail,
  Eye,
  Send,
  Loader2,
  CheckCircle,
  Info,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export default function EmailTemplates() {
  const { setCurrentPageTitle } = useAppStore();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sampleData, setSampleData] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState<string>("");

  useEffect(() => {
    setCurrentPageTitle("Email Templates");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);

  // Fetch all email templates
  const { data, isLoading } = useQuery({
    queryKey: ["emailTemplates"],
    queryFn: () => api.getEmailTemplates(),
  });

  const templates = data?.templates || [];

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: (data: { templateId: string; sampleData: Record<string, string> }) =>
      api.previewEmailTemplate(data.templateId, data.sampleData),
    onSuccess: (result) => {
      setPreviewHtml(result.html);
      setPreviewSubject(result.subject);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Send test email mutation
  const sendTestMutation = useMutation({
    mutationFn: (data: { templateId: string; sampleData: Record<string, string> }) =>
      api.sendTestEmail(data.templateId, data.sampleData),
    onSuccess: (result) => {
      toast.success(`Test email sent to ${result.sentTo}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Handle template selection
  const handleSelectTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setSampleData({ ...template.sampleData });
    setPreviewHtml("");
    setPreviewSubject("");
    setDialogOpen(true);
  };

  // Handle preview
  const handlePreview = () => {
    if (!selectedTemplate) return;
    previewMutation.mutate({
      templateId: selectedTemplate.id,
      sampleData,
    });
  };

  // Handle send test
  const handleSendTest = () => {
    if (!selectedTemplate) return;
    sendTestMutation.mutate({
      templateId: selectedTemplate.id,
      sampleData,
    });
  };

  // Handle sample data change
  const handleSampleDataChange = (key: string, value: string) => {
    setSampleData((prev) => ({ ...prev, [key]: value }));
  };

  // Get status badge
  const getStatusBadge = (status: EmailTemplate["status"]) => {
    switch (status) {
      case "success":
        return (
          <Badge className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            Success
          </Badge>
        );
      case "info":
        return (
          <Badge className="gap-1 bg-blue-600">
            <Info className="h-3 w-3" />
            Info
          </Badge>
        );
      case "warning":
        return (
          <Badge className="gap-1 bg-amber-600">
            <AlertTriangle className="h-3 w-3" />
            Warning
          </Badge>
        );
      case "action":
        return (
          <Badge className="gap-1 bg-cyan-600">
            <Zap className="h-3 w-3" />
            Action
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Group templates by status
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, EmailTemplate[]> = {
      action: [],
      info: [],
      success: [],
      warning: [],
    };
    templates.forEach((t) => {
      if (groups[t.status]) {
        groups[t.status].push(t);
      }
    });
    return groups;
  }, [templates]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Email Template Dashboard</h1>
        <p className="text-muted-foreground">
          Preview and test all system email templates
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
            <p className="text-xs text-muted-foreground">Available for testing</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Action Emails</CardTitle>
            <Zap className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupedTemplates.action.length}</div>
            <p className="text-xs text-muted-foreground">Require user action</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Emails</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupedTemplates.success.length}</div>
            <p className="text-xs text-muted-foreground">Confirmation messages</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Info/Warning</CardTitle>
            <Info className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {groupedTemplates.info.length + groupedTemplates.warning.length}
            </div>
            <p className="text-xs text-muted-foreground">Notifications & alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Template Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Email Templates</CardTitle>
          <CardDescription>
            Click on any template to preview and send a test email to yourself
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleSelectTemplate(template)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {getStatusBadge(template.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    <span>{template.parameters.length} parameters</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate?.name}
              {selectedTemplate && getStatusBadge(selectedTemplate.status)}
            </DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sample Data Form */}
              <div className="space-y-4">
                <h3 className="font-semibold">Sample Data</h3>
                <p className="text-sm text-muted-foreground">
                  Edit the sample data below to customize the preview
                </p>
                <div className="space-y-3">
                  {selectedTemplate.parameters.map((param) => (
                    <div key={param.key} className="space-y-1">
                      <Label htmlFor={param.key}>{param.label}</Label>
                      {param.type === "select" && param.options ? (
                        <Select
                          value={sampleData[param.key] || ""}
                          onValueChange={(value) => handleSampleDataChange(param.key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${param.label}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {param.options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : param.key === "message" || param.key === "reason" || param.key === "comment" ? (
                        <Textarea
                          id={param.key}
                          value={sampleData[param.key] || ""}
                          onChange={(e) => handleSampleDataChange(param.key, e.target.value)}
                          rows={3}
                        />
                      ) : (
                        <Input
                          id={param.key}
                          type={param.type === "url" ? "url" : "text"}
                          value={sampleData[param.key] || ""}
                          onChange={(e) => handleSampleDataChange(param.key, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handlePreview} disabled={previewMutation.isPending}>
                    {previewMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    Preview
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSendTest}
                    disabled={sendTestMutation.isPending || !previewHtml}
                  >
                    {sendTestMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send Test Email
                  </Button>
                </div>
              </div>

              {/* Preview Panel */}
              <div className="space-y-4">
                <h3 className="font-semibold">Preview</h3>
                {previewSubject && (
                  <div className="text-sm">
                    <span className="font-medium">Subject: </span>
                    <span className="text-muted-foreground">{previewSubject}</span>
                  </div>
                )}
                {previewHtml ? (
                  <div className="border rounded-lg overflow-hidden bg-white">
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full h-[500px]"
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                ) : (
                  <div className="border rounded-lg h-[500px] flex items-center justify-center bg-muted/50">
                    <div className="text-center text-muted-foreground">
                      <Eye className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Click "Preview" to see the email</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
