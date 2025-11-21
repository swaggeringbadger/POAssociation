import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, ArrowRight, ShieldCheck, Users, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import logoImage from '@assets/generated_images/abstract_geometric_building_logo_concept.png';

export default function DemoCodeEntry() {
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

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
      const result = await api.validateDemoCode(code.trim().toUpperCase());

      if (result.valid) {
        // Store for next page
        sessionStorage.setItem('demoCodeId', result.codeId!);
        sessionStorage.setItem('demoLabel', result.label!);
        sessionStorage.setItem('demoPersonas', JSON.stringify(result.personas));
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="flex justify-center">
            <img src={logoImage} className="w-20 h-20 rounded-lg" alt="POA Association" />
          </div>
          <CardTitle className="text-4xl font-bold tracking-tight">
            Welcome to POA Association
          </CardTitle>
          <CardDescription className="text-lg">
            Experience the future of community management
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Marketing Content */}
          <div className="bg-primary/5 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Smart Application Management</h3>
                <p className="text-sm text-muted-foreground">
                  Streamline architectural reviews with AI-powered forms and inline bylaw guidance
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Multi-Tenant Architecture</h3>
                <p className="text-sm text-muted-foreground">
                  Manage multiple communities with role-based access and isolated data
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg mb-1">Complete Workflow</h3>
                <p className="text-sm text-muted-foreground">
                  From submission to approval, track every step of your community's processes
                </p>
              </div>
            </div>
          </div>

          {/* Demo Code Entry */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Enter Demo Access Code</label>
              <Input
                type="text"
                placeholder="DEMO-CODE-HERE"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="text-center text-lg tracking-widest font-mono"
                maxLength={50}
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                Demo codes are provided during conferences, webinars, and trial periods
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isValidating || !code.trim()}
            >
              {isValidating ? (
                'Validating...'
              ) : (
                <>
                  Access Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Looking for a full account?
            </p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Return to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
