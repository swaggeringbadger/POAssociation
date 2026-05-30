import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import logoImage from '@assets/generated_images/abstract_geometric_building_logo_concept.png';

function getReturnTo(): string {
  const params = new URLSearchParams(window.location.search);
  const rt = params.get('returnTo');
  return rt && rt.startsWith('/') ? rt : '/dashboard';
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.login({ email: email.trim(), password });
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      navigate(getReturnTo());
    } catch (error: any) {
      toast({
        title: 'Sign in failed',
        description: error?.message || 'Invalid email or password.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const returnTo = getReturnTo();
  const suffix = returnTo !== '/dashboard' ? `?returnTo=${encodeURIComponent(returnTo)}` : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logoImage} className="w-16 h-16 rounded-lg" alt="POAssociation" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
          <CardDescription>Sign in to your POAssociation account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-login">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-sm text-primary hover:underline" data-testid="link-forgot-password">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting} data-testid="button-login">
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col gap-2 text-center text-sm text-muted-foreground">
          <p>
            Don't have an account?{' '}
            <Link href={`/register${suffix}`} className="text-primary hover:underline" data-testid="link-register">
              Create one
            </Link>
          </p>
          <Link href="/demo" className="text-primary hover:underline" data-testid="link-demo">
            Have a demo code?
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
