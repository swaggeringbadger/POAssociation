/**
 * InlineBylawDisplay Component
 *
 * Displays bylaws inline (always visible, no hover/click required)
 * Used in presentation mode for easy reading during meetings.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, AlertCircle, CheckCircle, Info } from 'lucide-react';
import type { BylawReference, FormLevelBylaws } from '@/lib/bylawHelpers';
import { hasBylawContent } from '@/lib/bylawHelpers';

interface InlineBylawDisplayProps {
  bylaws: BylawReference;
  variant?: 'compact' | 'full';
  className?: string;
}

export function InlineBylawDisplay({ bylaws, variant = 'compact', className = '' }: InlineBylawDisplayProps) {
  if (!hasBylawContent(bylaws)) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-amber-50 border border-amber-200 rounded-md p-2 text-sm ${className}`}>
        <div className="flex items-start gap-2">
          <BookOpen className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-1 text-amber-800">
            {bylaws.reference && <p>{bylaws.reference}</p>}
            {bylaws.requirement && <p>{bylaws.requirement}</p>}
            {bylaws.requirements?.map((req, i) => (
              <p key={i}>{req}</p>
            ))}
            {bylaws.note && <p className="italic">{bylaws.note}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <Card className={`bg-amber-50 border-amber-200 ${className}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-amber-900 font-medium">
          <BookOpen className="h-4 w-4" />
          <span>Relevant Bylaws</span>
        </div>

        {bylaws.reference && (
          <p className="text-sm text-amber-800">{bylaws.reference}</p>
        )}

        {bylaws.requirement && (
          <p className="text-sm text-amber-800">{bylaws.requirement}</p>
        )}

        {bylaws.requirements && bylaws.requirements.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-amber-700">Requirements:</p>
            <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
              {bylaws.requirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>
        )}

        {bylaws.keyRestrictions && bylaws.keyRestrictions.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium text-red-700">
              <AlertCircle className="h-3 w-3" />
              <span>Restrictions:</span>
            </div>
            <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
              {bylaws.keyRestrictions.map((restriction, i) => (
                <li key={i}>{restriction}</li>
              ))}
            </ul>
          </div>
        )}

        {bylaws.approvedMaterials && bylaws.approvedMaterials.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium text-green-700">
              <CheckCircle className="h-3 w-3" />
              <span>Approved Materials:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {bylaws.approvedMaterials.map((material, i) => (
                <Badge key={i} variant="outline" className="bg-green-50 text-green-800 border-green-200">
                  {material}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {bylaws.prohibited && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-2 rounded">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span><strong>Prohibited:</strong> {bylaws.prohibited}</span>
          </div>
        )}

        {bylaws.preferredStyles && bylaws.preferredStyles.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-amber-700">Preferred Styles:</p>
            <div className="flex flex-wrap gap-1">
              {bylaws.preferredStyles.map((style, i) => (
                <Badge key={i} variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                  {style}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {bylaws.keyProvisions && bylaws.keyProvisions.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-amber-700">Key Provisions:</p>
            <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
              {bylaws.keyProvisions.map((provision, i) => (
                <li key={i}>{provision}</li>
              ))}
            </ul>
          </div>
        )}

        {bylaws.note && (
          <div className="flex items-start gap-2 text-sm text-amber-700 italic">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{bylaws.note}</span>
          </div>
        )}

        {bylaws.quote && (
          <blockquote className="border-l-2 border-amber-400 pl-3 text-sm text-amber-800 italic">
            "{bylaws.quote}"
          </blockquote>
        )}
      </CardContent>
    </Card>
  );
}

interface FormLevelBylawsDisplayProps {
  bylaws: FormLevelBylaws;
  className?: string;
}

export function FormLevelBylawsDisplay({ bylaws, className = '' }: FormLevelBylawsDisplayProps) {
  if (!bylaws.primary && (!bylaws.additionalReferences || bylaws.additionalReferences.length === 0)) {
    return null;
  }

  return (
    <Card className={`bg-blue-50 border-blue-200 ${className}`}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-blue-900 font-medium">
          <BookOpen className="h-5 w-5" />
          <span>Applicable Regulations</span>
        </div>

        {bylaws.primary && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-600">{bylaws.primary.section}</Badge>
              <span className="text-xs text-blue-700">{bylaws.primary.document}</span>
            </div>
            <p className="text-sm text-blue-800">{bylaws.primary.summary}</p>
            {bylaws.primary.keyRequirements && bylaws.primary.keyRequirements.length > 0 && (
              <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                {bylaws.primary.keyRequirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            )}
            {bylaws.primary.quote && (
              <blockquote className="border-l-2 border-blue-400 pl-3 text-sm text-blue-800 italic">
                "{bylaws.primary.quote}"
              </blockquote>
            )}
          </div>
        )}

        {bylaws.additionalReferences && bylaws.additionalReferences.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-blue-200">
            <p className="text-xs font-medium text-blue-700">Additional References:</p>
            {bylaws.additionalReferences.map((ref, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                    {ref.section}
                  </Badge>
                  <span className="text-xs text-blue-600">{ref.document}</span>
                </div>
                <p className="text-sm text-blue-800">{ref.summary}</p>
                {ref.keyProvisions && ref.keyProvisions.length > 0 && (
                  <ul className="list-disc list-inside text-sm text-blue-700 space-y-0.5">
                    {ref.keyProvisions.map((provision, j) => (
                      <li key={j}>{provision}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InlineBylawDisplay;
