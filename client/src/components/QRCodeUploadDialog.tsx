import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Smartphone, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';

interface QRCodeUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  documentRequirementName: string;
  onUploadComplete: () => void;
}

export function QRCodeUploadDialog({
  open,
  onOpenChange,
  applicationId,
  documentRequirementName,
  onUploadComplete,
}: QRCodeUploadDialogProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [uploadToken, setUploadToken] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [isUploaded, setIsUploaded] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(600); // 10 minutes in seconds
  const [error, setError] = useState<string | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Generate QR code when dialog opens
  useEffect(() => {
    if (open && !uploadToken) {
      generateQRCode();
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expires = new Date(expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        clearInterval(timer);
        setError('Upload link expired. Please generate a new one.');
        stopPolling();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  const generateQRCode = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      // Request upload token from backend
      const response = await api.createDocumentUploadToken(applicationId, documentRequirementName);

      setUploadToken(response.token);
      setExpiresAt(new Date(response.expiresAt));

      // Generate full URL for QR code
      const baseUrl = window.location.origin;
      const uploadUrl = `${baseUrl}/upload/${response.token}`;

      // Generate QR code
      const qrDataUrl = await QRCode.toDataURL(uploadUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      setQrCodeDataUrl(qrDataUrl);
      startPolling(response.token);
    } catch (err: any) {
      console.error('Error generating QR code:', err);
      setError(err.message || 'Failed to generate QR code');
    } finally {
      setIsGenerating(false);
    }
  };

  const startPolling = (token: string) => {
    // Poll every 2 seconds to check if document uploaded
    pollingInterval.current = setInterval(async () => {
      try {
        const status = await api.checkUploadTokenStatus(token);

        if (status.isUsed) {
          setIsUploaded(true);
          stopPolling();
          onUploadComplete();
        }

        if (status.isExpired && !status.isUsed) {
          setError('Upload link expired');
          stopPolling();
        }
      } catch (err) {
        console.error('Error polling upload status:', err);
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    stopPolling();
    setQrCodeDataUrl('');
    setUploadToken('');
    setExpiresAt(null);
    setIsUploaded(false);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Upload from Phone
          </DialogTitle>
          <DialogDescription>
            Scan this QR code with your phone to upload <strong>{documentRequirementName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating upload link...</p>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : isUploaded ? (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Document uploaded successfully!
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* QR Code */}
              <div className="flex justify-center py-4">
                <div className="border-4 border-border rounded-lg p-4 bg-white">
                  <img src={qrCodeDataUrl} alt="QR Code" className="w-64 h-64" />
                </div>
              </div>

              {/* Timer */}
              <div className="flex items-center justify-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span className={timeRemaining < 60 ? 'text-destructive font-semibold' : ''}>
                  Expires in {formatTime(timeRemaining)}
                </span>
              </div>

              {/* Instructions */}
              <div className="space-y-2 text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
                <p className="font-semibold text-foreground">How to upload:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open your phone's camera app</li>
                  <li>Point it at the QR code above</li>
                  <li>Tap the notification to open the upload page</li>
                  <li>Select and upload your document</li>
                  <li>Wait for confirmation here</li>
                </ol>
              </div>

              {/* Waiting indicator */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for upload from phone...</span>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {isUploaded ? (
              <Button onClick={handleClose}>Done</Button>
            ) : (
              <>
                {!isGenerating && !error && (
                  <Button variant="outline" onClick={generateQRCode}>
                    Generate New Code
                  </Button>
                )}
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
