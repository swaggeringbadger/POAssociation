import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Download, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QRCodeDisplayProps {
  value: string;
  title?: string;
  description?: string;
  size?: number;
  showCopyLink?: boolean;
  showDownload?: boolean;
  className?: string;
}

export function QRCodeDisplay({
  value,
  title,
  description,
  size = 200,
  showCopyLink = true,
  showDownload = true,
  className = '',
}: QRCodeDisplayProps) {
  const { toast } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const generateQR = async () => {
      try {
        setIsLoading(true);
        const dataUrl = await QRCode.toDataURL(value, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (value) {
      generateQR();
    }
  }, [value, size]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'The link has been copied to your clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'qr-code.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Downloaded!',
      description: 'QR code has been downloaded.',
    });
  };

  return (
    <div className={className}>
      {title && <h3 className="font-medium text-center mb-2">{title}</h3>}
      {description && <p className="text-sm text-muted-foreground text-center mb-4">{description}</p>}

      <div className="flex flex-col items-center gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          {isLoading ? (
            <div
              className="flex items-center justify-center"
              style={{ width: size, height: size }}
            >
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR Code"
              width={size}
              height={size}
              className="block"
            />
          ) : (
            <div
              className="flex items-center justify-center bg-gray-100"
              style={{ width: size, height: size }}
            >
              <span className="text-sm text-muted-foreground">Failed to generate</span>
            </div>
          )}
        </div>

        {(showCopyLink || showDownload) && (
          <div className="flex gap-2">
            {showCopyLink && (
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Link
                  </>
                )}
              </Button>
            )}
            {showDownload && qrDataUrl && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ReferralQRCodeProps {
  referralCode: string;
  contractorName?: string;
}

export function ReferralQRCode({ referralCode, contractorName }: ReferralQRCodeProps) {
  const referralUrl = `${window.location.origin}/r/${referralCode}`;

  return (
    <Card>
      <CardContent className="pt-6">
        <QRCodeDisplay
          value={referralUrl}
          title="Share Your Referral Code"
          description={
            contractorName
              ? `${contractorName}'s referral link`
              : 'Scan to sign up with your referral'
          }
          size={180}
        />
        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground break-all">{referralUrl}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface InvitationQRCodeProps {
  invitationToken: string;
  type: 'household' | 'contractor';
}

export function InvitationQRCode({ invitationToken, type }: InvitationQRCodeProps) {
  const invitationUrl = `${window.location.origin}/invite/${invitationToken}`;

  return (
    <QRCodeDisplay
      value={invitationUrl}
      title={type === 'household' ? 'Household Invitation' : 'Contractor Invitation'}
      description="Scan to accept the invitation"
      size={180}
    />
  );
}
