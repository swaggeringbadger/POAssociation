/**
 * PremiumFeatureModal - Modal shown when user tries to access a premium feature
 * without the required subscription level
 */

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Check, Lock, ArrowRight } from 'lucide-react';

interface PremiumFeatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  featureDescription: string;
  currentPlan?: string;
  requiredPlan?: string;
  benefits?: string[];
  onUpgrade?: () => void;
  // For downgrade scenario
  hasLockedContent?: boolean;
  lockedContentMessage?: string;
}

export function PremiumFeatureModal({
  open,
  onOpenChange,
  featureName,
  featureDescription,
  currentPlan = 'Free',
  requiredPlan = 'Professional',
  benefits = [],
  onUpgrade,
  hasLockedContent = false,
  lockedContentMessage,
}: PremiumFeatureModalProps) {
  const defaultBenefits = [
    'Create unlimited custom workflows',
    'Clone and modify system templates',
    'Design approval processes tailored to your community',
    'Set up multi-step review workflows',
    'Configure automatic notifications at each step',
  ];

  const displayBenefits = benefits.length > 0 ? benefits : defaultBenefits;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-100 rounded-full">
              <Crown className="h-6 w-6 text-yellow-600" />
            </div>
            <DialogTitle className="text-xl">{featureName}</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {featureDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Current vs Required Plan */}
          <div className="flex items-center justify-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Current Plan</p>
              <Badge variant="outline" className="text-sm">
                {currentPlan}
              </Badge>
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400" />
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Required</p>
              <Badge className="text-sm bg-gradient-to-r from-yellow-500 to-orange-500">
                {requiredPlan}+
              </Badge>
            </div>
          </div>

          {/* Locked content warning for downgraded accounts */}
          {hasLockedContent && lockedContentMessage && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Lock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Content Locked</p>
                <p className="text-sm text-amber-700">{lockedContentMessage}</p>
              </div>
            </div>
          )}

          {/* Benefits list */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Upgrade to unlock:
            </p>
            <ul className="space-y-2">
              {displayBenefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-600">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Maybe Later
          </Button>
          <Button
            onClick={() => {
              if (onUpgrade) {
                onUpgrade();
              }
              onOpenChange(false);
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
          >
            <Crown className="h-4 w-4 mr-2" />
            Upgrade Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Variant for when user has downgraded and has locked custom workflows
 */
export function LockedWorkflowsModal({
  open,
  onOpenChange,
  lockedWorkflowCount,
  requiredPlan = 'Premium',
  onUpgrade,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockedWorkflowCount: number;
  requiredPlan?: string;
  onUpgrade?: () => void;
}) {
  return (
    <PremiumFeatureModal
      open={open}
      onOpenChange={onOpenChange}
      featureName="Custom Workflows Locked"
      featureDescription={`You have ${lockedWorkflowCount} custom workflow${lockedWorkflowCount !== 1 ? 's' : ''} that ${lockedWorkflowCount !== 1 ? 'are' : 'is'} no longer accessible with your current plan.`}
      requiredPlan={requiredPlan}
      hasLockedContent={true}
      lockedContentMessage="Your custom workflows are preserved but locked. Upgrade to regain access and continue using them."
      benefits={[
        'Regain access to your existing custom workflows',
        'Continue editing and managing your workflows',
        'Create new custom workflows',
        'Clone system templates',
      ]}
      onUpgrade={onUpgrade}
    />
  );
}
