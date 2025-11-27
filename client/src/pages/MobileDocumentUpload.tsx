import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Upload, AlertCircle, FileIcon, Loader2, Clock } from 'lucide-react';
import { api } from '@/lib/api';

export default function MobileDocumentUpload() {
  const { token } = useParams<{ token: string }>();
  const [location] = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadInfo, setUploadInfo] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Validate token on mount
  useEffect(() => {
    validateToken();
  }, [token]);

  // Update time remaining
  useEffect(() => {
    if (!uploadInfo?.expiresAt) return;

    const updateTime = () => {
      const now = new Date().getTime();
      const expires = new Date(uploadInfo.expiresAt).getTime();
      const remaining = expires - now;

      if (remaining <= 0) {
        setValidationError('This upload link has expired');
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);

    return () => clearInterval(timer);
  }, [uploadInfo]);

  const validateToken = async () => {
    try {
      setIsValidating(true);
      const info = await api.validateUploadToken(token!);
      setUploadInfo(info);
    } catch (err: any) {
      setValidationError(err.message || 'Invalid or expired upload link');
    } finally {
      setIsValidating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(0);

      // Simulate progress (since FormData upload doesn't provide real progress easily)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 300);

      await api.uploadViaToken(token!, selectedFile);

      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadSuccess(true);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg text-muted-foreground">Validating upload link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-6 w-6" />
              <CardTitle>Upload Link Invalid</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
            <p className="mt-4 text-sm text-muted-foreground">
              Please request a new upload link from the desktop application.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (uploadSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <CardTitle>Upload Successful!</CardTitle>
            </div>
            <CardDescription>Your document has been uploaded</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>{selectedFile?.name}</strong> has been successfully uploaded.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
              <p><strong>Application:</strong> {uploadInfo.applicationNumber}</p>
              <p><strong>Document:</strong> {uploadInfo.documentRequirement}</p>
              <p><strong>File Size:</strong> {selectedFile && formatFileSize(selectedFile.size)}</p>
            </div>

            <p className="text-sm text-center text-muted-foreground">
              You can now close this page and return to your desktop.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Document
          </CardTitle>
          <CardDescription>
            Upload <strong>{uploadInfo.documentRequirement}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Application Info */}
          <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
            <p><strong>Application:</strong> {uploadInfo.applicationNumber}</p>
            <p><strong>Title:</strong> {uploadInfo.applicationTitle}</p>
          </div>

          {/* Timer */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className={timeRemaining.startsWith('0:') ? 'text-destructive font-semibold' : ''}>
              Link expires in {timeRemaining}
            </span>
          </div>

          {/* File Selection */}
          {!selectedFile ? (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <FileIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">Tap to select a file</p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, JPG, PNG, DOC, DOCX (max 50MB)
                </p>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File */}
              <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <FileIcon className="h-8 w-8 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-sm text-center text-muted-foreground">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}

              {/* Error */}
              {uploadError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedFile(null)}
                  disabled={isUploading}
                  className="flex-1"
                >
                  Choose Different File
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
