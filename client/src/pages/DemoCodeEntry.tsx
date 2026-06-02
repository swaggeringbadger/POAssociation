import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, ArrowRight, ArrowLeft, ShieldCheck, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import partyImage from '@assets/generated_images/demo-block-party-stringlights.jpg';
import logoImage from '@assets/generated_images/abstract_geometric_building_logo_concept.png';

const DEMO_CODE_STORAGE_KEY = 'poa-demo-code';

export default function DemoCodeEntry() {
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isAutoValidating, setIsAutoValidating] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Check for stored demo code on mount
  useEffect(() => {
    const checkStoredCode = async () => {
      try {
        const stored = localStorage.getItem(DEMO_CODE_STORAGE_KEY);
        if (!stored) return;

        // Decode the stored code (base64 encoded for basic obfuscation)
        const decoded = atob(stored);

        setIsAutoValidating(true);
        const result = await api.validateDemoCode(decoded);

        if (result.valid) {
          // Store for next page
          sessionStorage.setItem('demoCodeId', result.codeId!);
          sessionStorage.setItem('demoLabel', result.label!);
          sessionStorage.setItem('demoPersonas', JSON.stringify(result.personas));
          navigate('/demo/personas');
        } else {
          // Code is no longer valid, clear it
          localStorage.removeItem(DEMO_CODE_STORAGE_KEY);
        }
      } catch (error) {
        // Invalid stored code, clear it
        localStorage.removeItem(DEMO_CODE_STORAGE_KEY);
      } finally {
        setIsAutoValidating(false);
      }
    };

    checkStoredCode();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      toast({
        title: 'Please enter a demo code',
        variant: 'destructive',
      });
      return;
    }

    setIsValidating(true);
    try {
      const normalizedCode = code.trim().toUpperCase();
      const result = await api.validateDemoCode(normalizedCode);

      if (result.valid) {
        // Store for next page (sessionStorage)
        sessionStorage.setItem('demoCodeId', result.codeId!);
        sessionStorage.setItem('demoLabel', result.label!);
        sessionStorage.setItem('demoPersonas', JSON.stringify(result.personas));

        // Store code in localStorage for future visits (base64 encoded)
        localStorage.setItem(DEMO_CODE_STORAGE_KEY, btoa(normalizedCode));

        navigate('/demo/personas');
      } else {
        toast({
          title: result.message || 'Invalid Demo Code',
          description: 'Please check your code and try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to validate code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Auto-validation loading state
  if (isAutoValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950 relative overflow-hidden">
        <img src={partyImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-stone-950/70" />
        <div className="relative text-center space-y-5">
          <div className="mx-auto h-12 w-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
          <p className="text-lg font-medium text-stone-100">Validating your saved demo code…</p>
        </div>
      </div>
    );
  }

  const highlights = [
    { icon: Sparkles, title: 'Smart application management', desc: 'AI-powered forms with inline bylaw guidance.' },
    { icon: ShieldCheck, title: 'Built for real communities', desc: 'Role-based access across every neighborhood.' },
    { icon: Zap, title: 'The complete workflow', desc: 'From submission to approval — every step tracked.' },
  ];

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-[1fr_1.1fr] bg-stone-50 font-sans">
      {/* ---------- Form panel ---------- */}
      <div className="flex flex-col justify-center min-h-screen px-6 sm:px-12 lg:px-16 py-12 order-2 lg:order-1">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md mx-auto"
        >
          <Link href="/" className="lg:hidden flex items-center gap-2 mb-10">
            <img src={logoImage} alt="POAssociation" className="h-10 w-10 rounded-lg" />
            <span className="font-display text-lg font-bold text-stone-900">POAssociation</span>
          </Link>

          <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1 text-sm font-medium text-amber-800 mb-5">
            <Sparkles className="h-3.5 w-3.5" /> Demo access
          </span>

          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900 leading-tight">
            Step inside the neighborhood.
          </h1>
          <p className="mt-3 text-stone-500">
            Enter your access code to explore a fully interactive sandbox — no signup required.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-stone-700">Demo access code</label>
              <Input
                type="text"
                placeholder="DEMO-CODE-HERE"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="h-14 text-center text-lg tracking-[0.3em] font-mono bg-white border-stone-300 focus-visible:ring-amber-500 focus-visible:border-amber-500"
                maxLength={50}
                autoFocus
              />
              <p className="text-xs text-stone-400 text-center">
                Demo codes are provided during conferences, webinars, and trial periods.
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-900/20"
              disabled={isValidating || !code.trim()}
            >
              {isValidating ? 'Validating…' : (
                <>Access demo <ArrowRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-stone-500">Looking for a full account?</p>
            <Button
              variant="outline"
              className="border-stone-300 text-stone-700 hover:border-amber-400 hover:text-amber-700"
              onClick={() => navigate('/login')}
            >
              Sign in
            </Button>
          </div>

          <div className="mt-8 text-center">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to home
            </Link>
          </div>
        </motion.div>
      </div>

      {/* ---------- Cinematic image panel ---------- */}
      <div className="relative hidden lg:block overflow-hidden order-1 lg:order-2">
        <motion.img
          src={partyImage}
          alt="A warm neighborhood gathering under string lights at dusk"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/25 to-stone-950/35" />
        <div className="absolute inset-0 bg-amber-900/10 mix-blend-multiply" />

        <Link href="/" className="absolute top-8 right-8 z-10 flex items-center gap-2">
          <img src={logoImage} alt="POAssociation" className="h-9 w-9 rounded-lg ring-1 ring-white/20" />
          <span className="font-display text-lg font-bold text-white drop-shadow">POAssociation</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3 }}
          className="absolute bottom-12 left-10 right-10 z-10"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200 mb-3">
            A live, interactive tour
          </p>
          <p className="font-display text-3xl xl:text-4xl font-medium text-white leading-snug max-w-md mb-8">
            See what community management feels like when it&apos;s built with care.
          </p>
          <div className="space-y-4 max-w-md">
            {highlights.map((h) => (
              <div key={h.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur ring-1 ring-white/20 text-amber-200">
                  <h.icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="font-semibold text-white text-sm">{h.title}</p>
                  <p className="text-sm text-stone-300/90">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
