import React, { useRef, useState, useEffect } from 'react';
import SignaturePad from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

interface SignatureCanvasProps {
  type: 'signature' | 'initial';
  onSave: (dataUrl: string) => void;
  onCancel?: () => void;
  legalText: string;
  disabled?: boolean;
}

export function SignatureCanvas({
  type,
  onSave,
  onCancel,
  legalText,
  disabled = false,
}: SignatureCanvasProps) {
  const sigPad = useRef<SignaturePad>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [error, setError] = useState<string>('');

  const canvasWidth = type === 'signature' ? 500 : 300;
  const canvasHeight = type === 'signature' ? 150 : 100;

  const handleClear = () => {
    sigPad.current?.clear();
    setIsEmpty(true);
    setError('');
  };

  const handleEnd = () => {
    if (sigPad.current && !sigPad.current.isEmpty()) {
      setIsEmpty(false);
      setError('');
    }
  };

  const handleSave = () => {
    if (!sigPad.current || sigPad.current.isEmpty()) {
      setError(`Please draw your ${type} before continuing`);
      return;
    }

    if (!consentGiven) {
      setError('Please provide consent to use electronic signatures');
      return;
    }

    const dataUrl = sigPad.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Legal text */}
        <div className="text-sm text-muted-foreground">
          {legalText}
        </div>

        {/* Canvas */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {type === 'signature' ? 'Your Signature' : 'Your Initials'}
          </label>
          <div
            className="border-2 border-gray-300 rounded-lg bg-white"
            style={{
              width: '100%',
              maxWidth: `${canvasWidth}px`,
              touchAction: 'none', // Prevent scrolling on touch devices
            }}
          >
            <SignaturePad
              ref={sigPad}
              canvasProps={{
                width: canvasWidth,
                height: canvasHeight,
                className: 'signature-canvas w-full',
                style: { maxWidth: '100%', height: 'auto' },
              }}
              onEnd={handleEnd}
              backgroundColor="rgb(255, 255, 255)"
              penColor="rgb(0, 0, 0)"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Sign above using your mouse or touch screen
          </p>
        </div>

        {/* Consent checkbox */}
        <div className="flex items-start gap-2">
          <Checkbox
            id="consent"
            checked={consentGiven}
            onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
            disabled={disabled}
          />
          <label
            htmlFor="consent"
            className="text-sm leading-tight cursor-pointer"
          >
            I consent to use electronic {type}s and agree this has the same
            legal effect as a handwritten {type}.
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={disabled || isEmpty}
          >
            Clear
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={disabled}
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={disabled || isEmpty || !consentGiven}
            className="ml-auto"
          >
            Save {type === 'signature' ? 'Signature' : 'Initials'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
