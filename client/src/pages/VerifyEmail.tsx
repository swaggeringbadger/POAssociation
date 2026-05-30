import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import logoImage from '@assets/generated_images/abstract_geometric_building_logo_concept.png';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmail() {
  const [status, setStatus] = useState<Status>('verifying');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (!token) {
      setStatus('error');
      return;
    }
    api
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logoImage} className="w-16 h-16 rounded-lg" alt="POAssociation" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Email verification</CardTitle>
          <CardDescription>
            {status === 'verifying' && 'Verifying your email address...'}
            {status === 'success' && 'Your email is verified'}
            {status === 'error' && 'We could not verify your email'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-4" data-testid="verify-status">
          {status === 'verifying' && <Loader2 className="h-12 w-12 text-primary animate-spin" />}
          {status === 'success' && <CheckCircle2 className="h-12 w-12 text-green-600" />}
          {status === 'error' && <XCircle className="h-12 w-12 text-destructive" />}
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          {status === 'error' ? (
            <span>This link may be invalid or expired. You can request a new one from your profile.</span>
          ) : (
            <Link href="/dashboard" className="text-primary hover:underline" data-testid="link-dashboard">
              Continue to dashboard
            </Link>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
