import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { MailCheck } from 'lucide-react';
import { api } from '@/lib/api';
import logoImage from '@assets/generated_images/abstract_geometric_building_logo_concept.png';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.forgotPassword(email.trim());
    } catch {
      // Endpoint always succeeds to avoid leaking account existence.
    } finally {
      setIsSubmitting(false);
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logoImage} className="w-16 h-16 rounded-lg" alt="POAssociation" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Reset your password</CardTitle>
          <CardDescription>
            {sent ? 'Check your inbox' : "Enter your email and we'll send a reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <MailCheck className="h-12 w-12 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                If an account exists for <span className="font-medium">{email}</span>, a password reset
                link is on its way. The link expires in 1 hour.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-forgot-password">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus data-testid="input-email" />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting} data-testid="button-send-reset">
                {isSubmitting ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
