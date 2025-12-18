import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Building2, Award, ArrowRight } from 'lucide-react';

interface ReferralInfo {
  referralCode: string;
  companyName: string | null;
  contractorName: string | null;
}

export default function ReferralLanding() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();

  // Fetch referral info
  const { data: referral, isLoading, error } = useQuery<ReferralInfo>({
    queryKey: ['referral', code],
    queryFn: async () => {
      const response = await fetch(`/api/r/${code}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Invalid referral code');
      }
      return response.json();
    },
    enabled: !!code,
  });

  // Store referral code for use during signup
  const handleGetStarted = () => {
    // Store in localStorage for the signup flow
    localStorage.setItem('referralCode', code || '');
    setLocation('/pricing');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !referral) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Referral Code</CardTitle>
            <CardDescription>
              This referral code is not valid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/pricing')}>
              View Pricing
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            <span className="font-bold text-xl">POA Association</span>
          </div>
          <Button variant="outline" onClick={() => setLocation('/pricing')}>
            View Plans
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Award className="h-4 w-4" />
            You've been referred!
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to POA Association
          </h1>

          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {referral.companyName || referral.contractorName ? (
              <>
                <span className="font-medium text-gray-900">
                  {referral.companyName || referral.contractorName}
                </span>{' '}
                recommends our platform for managing your HOA or POA.
              </>
            ) : (
              'You\'ve been referred to the best platform for managing your HOA or POA.'
            )}
          </p>
        </div>

        {/* Benefits */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Streamlined Applications</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600">
              Online architectural review applications with automatic tracking and notifications.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI-Powered Analysis</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600">
              Get instant compliance checks and recommendations powered by AI.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Easy Management</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600">
              Manage board members, documents, events, and communications in one place.
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Card className="inline-block bg-primary text-primary-foreground p-8">
            <h2 className="text-2xl font-bold mb-4">
              Get Started Today
            </h2>
            <p className="mb-6 opacity-90">
              Sign up now and enjoy all the benefits of modern HOA management.
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={handleGetStarted}
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Card>
        </div>

        {/* Referral Badge */}
        {(referral.companyName || referral.contractorName) && (
          <div className="mt-12 text-center text-sm text-gray-500">
            Referred by: <span className="font-medium">{referral.companyName || referral.contractorName}</span>
            <span className="mx-2">•</span>
            Code: <span className="font-mono">{referral.referralCode}</span>
          </div>
        )}
      </main>
    </div>
  );
}
