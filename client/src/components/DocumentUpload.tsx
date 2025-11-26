/**
 * Document Upload Component
 *
 * Handles document uploads for application submissions
 * Shows required and optional documents with upload status
 */

import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, X, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { DocumentRequirement } from '@shared/additionalInfoTypes';
import { uploadDocument, listDocuments, deleteDocument, getDocumentDownloadUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DocumentUploadProps {
  applicationId: string | null; // null if application not created yet
  documents: DocumentRequirement[];
  onUploadComplete?: () => void;
}

interface UploadedDocument {
  id: string;
  documentRequirementName: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
}

export function DocumentUpload({ applicationId, documents, onUploadComplete }: DocumentUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Fetch uploaded documents if application exists
  const { data: uploadedDocuments = [] } = useQuery<UploadedDocument[]>({
    queryKey: ['documents', applicationId],
    queryFn: () => listDocuments(applicationId!),
    enabled: !!applicationId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, requirementName }: { file: File; requirementName: string }) => {
      if (!applicationId) {
        throw new Error('Application must be created before uploading documents');
      }
      return uploadDocument(applicationId, file, requirementName);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', applicationId] });
      toast({
        title: "Document uploaded",
        description: `${variables.file.name} has been uploaded successfully.`,
      });
      setUploadingFor(null);
      onUploadComplete?.();
    },
    onError: (error: Error, variables) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadingFor(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', applicationId] });
      toast({
        title: "Document deleted",
        description: "The document has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File, requirementName: string) => {
    if (!applicationId) {
      toast({
        title: "Cannot upload yet",
        description: "Please complete the previous steps first to create your application.",
        variant: "destructive",
      });
      return;
    }

    setUploadingFor(requirementName);
    uploadMutation.mutate({ file, requirementName });
  };

  const handleDrop = (e: React.DragEvent, requirementName: string) => {
    e.preventDefault();
    setDragOver(null);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file, requirementName);
    }
  };

  const handleDragOver = (e: React.DragEvent, requirementName: string) => {
    e.preventDefault();
    setDragOver(requirementName);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const getUploadedDocsForRequirement = (requirementName: string) => {
    return uploadedDocuments.filter(doc => doc.documentRequirementName === requirementName);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const requiredDocs = documents.filter(d => d.required);
  const optionalDocs = documents.filter(d => !d.required);

  // Count uploaded required documents
  const uploadedRequiredCount = requiredDocs.filter(doc =>
    getUploadedDocsForRequirement(doc.name).length > 0
  ).length;
  const isAllRequiredUploaded = uploadedRequiredCount === requiredDocs.length;

  if (!applicationId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Documents can be uploaded after completing the previous steps and creating your application.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      {requiredDocs.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Required Documents Progress</span>
                <span className="text-muted-foreground">
                  {uploadedRequiredCount} of {requiredDocs.length} uploaded
                </span>
              </div>
              <Progress value={(uploadedRequiredCount / requiredDocs.length) * 100} />
              {isAllRequiredUploaded && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>All required documents uploaded</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Required Documents */}
      {requiredDocs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Required Documents
          </h3>
          <div className="space-y-3">
            {requiredDocs.map((doc) => {
              const uploaded = getUploadedDocsForRequirement(doc.name);
              const isUploading = uploadingFor === doc.name;

              return (
                <Card
                  key={doc.name}
                  className={cn(
                    "transition-colors",
                    dragOver === doc.name && "border-primary bg-primary/5",
                    uploaded.length > 0 && "border-green-500/50 bg-green-50/50"
                  )}
                >
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-destructive" />
                            <h4 className="font-medium">{doc.name}</h4>
                            {uploaded.length > 0 && (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                          {doc.description && (
                            <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Upload area */}
                      {uploaded.length === 0 && (
                        <div
                          className={cn(
                            "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer hover:border-primary hover:bg-primary/5",
                            dragOver === doc.name && "border-primary bg-primary/5"
                          )}
                          onDrop={(e) => handleDrop(e, doc.name)}
                          onDragOver={(e) => handleDragOver(e, doc.name)}
                          onDragLeave={handleDragLeave}
                          onClick={() => fileInputRefs.current[doc.name]?.click()}
                        >
                          {isUploading ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                              <p className="text-sm text-muted-foreground">Uploading...</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Upload className="h-8 w-8 text-muted-foreground" />
                              <p className="text-sm font-medium">Click to upload or drag and drop</p>
                              <p className="text-xs text-muted-foreground">PDF, JPG, PNG up to 50MB</p>
                            </div>
                          )}
                          <input
                            ref={(el) => (fileInputRefs.current[doc.name] = el)}
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(file, doc.name);
                            }}
                          />
                        </div>
                      )}

                      {/* Uploaded files */}
                      {uploaded.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{file.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.fileSize)} • Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(getDocumentDownloadUrl(file.id), '_blank')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(file.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Optional Documents */}
      {optionalDocs.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Optional Documents (Recommended)
          </h3>
          <div className="space-y-3">
            {optionalDocs.map((doc) => {
              const uploaded = getUploadedDocsForRequirement(doc.name);
              const isUploading = uploadingFor === doc.name;

              return (
                <Card key={doc.name} className={cn(dragOver === doc.name && "border-primary bg-primary/5")}>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-medium">{doc.name}</h4>
                            {uploaded.length > 0 && (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                          {doc.description && (
                            <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Upload area */}
                      {uploaded.length === 0 && (
                        <div
                          className={cn(
                            "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer hover:border-primary hover:bg-primary/5",
                            dragOver === doc.name && "border-primary bg-primary/5"
                          )}
                          onDrop={(e) => handleDrop(e, doc.name)}
                          onDragOver={(e) => handleDragOver(e, doc.name)}
                          onDragLeave={handleDragLeave}
                          onClick={() => fileInputRefs.current[doc.name]?.click()}
                        >
                          {isUploading ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="h-6 w-6 animate-spin text-primary" />
                              <p className="text-xs text-muted-foreground">Uploading...</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <Upload className="h-6 w-6 text-muted-foreground" />
                              <p className="text-xs font-medium">Click to upload or drag and drop</p>
                            </div>
                          )}
                          <input
                            ref={(el) => (fileInputRefs.current[doc.name] = el)}
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(file, doc.name);
                            }}
                          />
                        </div>
                      )}

                      {/* Uploaded files */}
                      {uploaded.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{file.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.fileSize)} • Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(getDocumentDownloadUrl(file.id), '_blank')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(file.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
