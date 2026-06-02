import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import doorImage from '@assets/generated_images/login-craftsman-door-dusk.jpg';
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
    <div className="min-h-screen w-full lg:grid lg:grid-cols-[1.1fr_1fr] bg-stone-50 font-sans">
      {/* ---------- Cinematic image panel ---------- */}
      <div className="relative hidden lg:block overflow-hidden">
        <motion.img
          src={doorImage}
          alt="A warmly lit craftsman front door at dusk"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/20 to-stone-950/40" />
        <div className="absolute inset-0 bg-amber-900/10 mix-blend-multiply" />

        {/* Brand mark top-left */}
        <Link href="/" className="absolute top-8 left-8 z-10 flex items-center gap-2 group">
          <img src={logoImage} alt="POAssociation" className="h-9 w-9 rounded-lg ring-1 ring-white/20" />
          <span className="font-display text-lg font-bold text-white drop-shadow">POAssociation</span>
        </Link>

        {/* Editorial tagline bottom */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3 }}
          className="absolute bottom-12 left-10 right-10 z-10"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200 mb-3">
            Welcome home
          </p>
          <p className="font-display text-3xl xl:text-4xl font-medium text-white leading-snug max-w-md">
            The porch light&apos;s on. Your community is right where you left it.
          </p>
        </motion.div>
      </div>

      {/* ---------- Form panel ---------- */}
      <div className="flex flex-col justify-center min-h-screen px-6 sm:px-12 lg:px-16 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-sm mx-auto"
        >
          {/* Mobile brand mark */}
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-10">
            <img src={logoImage} alt="POAssociation" className="h-10 w-10 rounded-lg" />
            <span className="font-display text-lg font-bold text-stone-900">POAssociation</span>
          </Link>

          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900">
            Welcome back
          </h1>
          <p className="mt-2 text-stone-500">Sign in to your POAssociation account.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" data-testid="form-login">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-stone-700">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@email.com"
                className="h-11 bg-white border-stone-300 focus-visible:ring-amber-500 focus-visible:border-amber-500"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-stone-700">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-amber-700 hover:text-amber-800 hover:underline"
                  data-testid="link-forgot-password"
                >
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
                placeholder="••••••••"
                className="h-11 bg-white border-stone-300 focus-visible:ring-amber-500 focus-visible:border-amber-500"
                data-testid="input-password"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-900/20"
              disabled={isSubmitting}
              data-testid="button-login"
            >
              {isSubmitting ? 'Signing in…' : (
                <>Sign in <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </form>

          <div className="mt-8 space-y-3 text-center text-sm text-stone-500">
            <p>
              Don&apos;t have an account?{' '}
              <Link href={`/register${suffix}`} className="font-medium text-amber-700 hover:underline" data-testid="link-register">
                Create one
              </Link>
            </p>
            <p>
              <Link href="/demo" className="font-medium text-stone-600 hover:text-amber-700 hover:underline" data-testid="link-demo">
                Have a demo code?
              </Link>
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-stone-200 text-center">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
