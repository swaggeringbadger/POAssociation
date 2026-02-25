import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import {
  Loader2, Share2, Building2, Copy, CheckCircle, Clock,
  DollarSign, TrendingUp, Users, AlertCircle, QrCode
} from 'lucide-react';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { useState } from 'react';

interface ContractorReferral {
  id: string;
  tenantName: string;
  tenantSubdomain: string;
  signedUpAt: string;
  status: 'pending' | 'qualified' | 'paid' | 'invalid';
  qualifiedAt: string | null;
  paidAt: string | null;
  payoutAmount: string | null;
}

interface ReferralStats {
  totalReferrals: number;
  pendingReferrals: number;
  qualifiedReferrals: number;
  paidReferrals: number;
  totalEarnings: string;
}

export default function ContractorReferrals() {
  const [, setLocation] = useLocation();
  const { setCurrentPageTitle } = useAppStore();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCurrentPageTitle("Referrals");
    return () => setCurrentPageTitle(null);
  }, [setCurrentPageTitle]);

  // Fetch contractor profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['contractor-profile'],
    queryFn: () => api.getMyContractorProfile(),
  });

  // Fetch referrals
  const { data: referralsData, isLoading: referralsLoading } = useQuery<{
    referrals: ContractorReferral[];
    stats: ReferralStats;
  }>({
    queryKey: ['contractor-referrals', profile?.id],
    queryFn: () => api.getContractorReferrals(profile!.id),
    enabled: !!profile?.id,
  });

  const isLoading = profileLoading || referralsLoading;

  const copyReferralLink = () => {
    if (profile?.referralCode) {
      const link = `${window.location.origin}/r/${profile.referralCode}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'qualified':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><CheckCircle className="w-3 h-3 mr-1" />Qualified</Badge>;
      case 'paid':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><DollarSign className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'invalid':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Invalid</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No contractor profile
  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Referral Program</h1>
          <p className="text-muted-foreground">
            Track your HOA/POA referrals and earnings
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <Share2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-2">Create Your Contractor Profile</h3>
            <p className="text-muted-foreground mb-4">
              Set up your profile to get a referral code and start earning.
            </p>
            <Button onClick={() => setLocation('/contractor/profile')}>
              <Building2 className="h-4 w-4 mr-2" />
              Create Profile
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = referralsData?.stats || {
    totalReferrals: 0,
    pendingReferrals: 0,
    qualifiedReferrals: 0,
    paidReferrals: 0,
    totalEarnings: '$0',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Referral Program</h1>
          <p className="text-muted-foreground">
            Track your HOA/POA referrals and earnings
          </p>
        </div>
        <Button variant="outline" onClick={() => setLocation('/contractor/profile')}>
          <Building2 className="h-4 w-4 mr-2" />
          My Profile
        </Button>
      </div>

      {/* Referral Code Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Your Referral Code
          </CardTitle>
          <CardDescription>
            Share this with HOAs/POAs. When they sign up, you earn referral credit!
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profile.referralCode ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-white rounded-lg p-4 border font-mono text-xl text-center">
                {profile.referralCode}
              </div>
              <Button
                variant="outline"
                onClick={copyReferralLink}
                className="h-14 px-6"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-5 w-5 mr-2" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">Generate a referral code to start earning!</p>
              <Button onClick={() => setLocation('/contractor/profile')}>
                Generate Referral Code
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalReferrals}</div>
                <p className="text-sm text-muted-foreground">Total Referrals</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.pendingReferrals}</div>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.qualifiedReferrals + stats.paidReferrals}</div>
                <p className="text-sm text-muted-foreground">Qualified</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-full">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalEarnings}</div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How it Works */}
      <Card>
        <CardHeader>
          <CardTitle>How the Referral Program Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold text-primary">1</span>
              </div>
              <h4 className="font-medium mb-1">Share Your Link</h4>
              <p className="text-sm text-muted-foreground">
                Give your referral link to HOAs or POAs that could benefit from our platform
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold text-primary">2</span>
              </div>
              <h4 className="font-medium mb-1">They Sign Up</h4>
              <p className="text-sm text-muted-foreground">
                When they create an account using your link, we track the referral
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold text-primary">3</span>
              </div>
              <h4 className="font-medium mb-1">Earn Rewards</h4>
              <p className="text-sm text-muted-foreground">
                Once they qualify, you earn a referral bonus paid out directly to you
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referrals List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referrals</CardTitle>
          <CardDescription>Track the status of each community you've referred</CardDescription>
        </CardHeader>
        <CardContent>
          {!referralsData?.referrals?.length ? (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">No referrals yet</h3>
              <p className="text-muted-foreground">
                Start sharing your referral link to see referrals here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {referralsData.referrals.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{referral.tenantName}</span>
                      {getStatusBadge(referral.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Signed up {format(new Date(referral.signedUpAt), 'MMM d, yyyy')}
                      {referral.qualifiedAt && (
                        <> • Qualified {format(new Date(referral.qualifiedAt), 'MMM d, yyyy')}</>
                      )}
                      {referral.paidAt && (
                        <> • Paid {format(new Date(referral.paidAt), 'MMM d, yyyy')}</>
                      )}
                    </p>
                  </div>
                  {referral.payoutAmount && (
                    <div className="text-right">
                      <div className="font-bold text-green-600">{referral.payoutAmount}</div>
                      <p className="text-xs text-muted-foreground">Payout</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <AlertCircle className="h-8 w-8 text-amber-600 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-amber-900">Referral Qualification</h3>
              <p className="text-sm text-amber-700 mt-1">
                Referrals become "qualified" once the HOA/POA completes their account setup
                and begins actively using the platform. Payouts are processed monthly for
                all qualified referrals.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
