import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building, ShieldCheck, Briefcase, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api, queryClient } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import logoImage from '@assets/generated_images/abstract_geometric_building_logo_concept.png';

const PERSONA_INFO = {
  'Emily': {
    title: 'Management Company Manager',
    icon: Building,
    description: 'Oversee multiple communities, manage form templates, and coordinate with board members',
    features: [
      'Multi-community dashboard',
      'Form template creation',
      'User role management',
      'Analytics and reporting',
    ],
    gradient: 'from-blue-500 to-blue-600',
  },
  'Sarah': {
    title: 'Board Member',
    icon: ShieldCheck,
    description: 'Review applications, approve modifications, and maintain community standards',
    features: [
      'Application review queue',
      'Approve/reject workflows',
      'Inline bylaw guidance',
      'Comment and request changes',
    ],
    gradient: 'from-purple-500 to-purple-600',
  },
  'Jordan': {
    title: 'Management Rep',
    icon: Briefcase,
    description: 'Handle day-to-day operations for assigned properties with limited access scope',
    features: [
      'View all managed properties',
      'Full access to assigned properties only',
      'Process applications for your communities',
      'See restricted access on unassigned properties',
    ],
    gradient: 'from-teal-500 to-teal-600',
  },
  'Alex': {
    title: 'Board Contributor & Contractor',
    icon: Users,
    description: 'Serve on the Markland board AND run a landscaping business serving multiple communities',
    features: [
      'Board contributor at Markland POA',
      'Contractor dashboard for landscaping jobs',
      'View applications across communities',
      'Cross-community contractor work',
    ],
    gradient: 'from-orange-500 to-orange-600',
  },
};

export default function DemoPersonaSelect() {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { clearState } = useAppStore();

  const demoLabel = sessionStorage.getItem('demoLabel');
  const personasJson = sessionStorage.getItem('demoPersonas');
  const personas = personasJson ? JSON.parse(personasJson) : [];

  const handlePersonaClick = async (userId: string, firstName: string) => {
    setSelectedPersona(userId);
    setIsLoading(true);

    try {
      // Clear previous user's state before logging in as new user
      clearState();
      queryClient.clear();

      const result = await api.loginAsDemo(userId);

      if (result.success) {
        const personaInfo = PERSONA_INFO[firstName as keyof typeof PERSONA_INFO];
        toast({
          title: `Welcome, ${firstName}!`,
          description: `Logged in as ${personaInfo?.title || 'Demo User'}`,
        });

        // Clear demo code from storage
        sessionStorage.removeItem('demoCodeId');
        sessionStorage.removeItem('demoLabel');
        sessionStorage.removeItem('demoPersonas');

        // Force full page reload to refresh auth state
        window.location.href = '/dashboard';
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start demo session. Please try again.',
        variant: 'destructive',
      });
      setSelectedPersona(null);
    } finally {
      setIsLoading(false);
    }
  };

  // If no personas in session, redirect back
  if (personas.length === 0) {
    navigate('/demo');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logoImage} className="w-16 h-16 rounded-lg" alt="POAssociation" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Choose Your Perspective</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Experience POAssociation from different roles. Each persona shows unique features and workflows.
          </p>
          {demoLabel && (
            <p className="text-sm text-primary font-medium">
              Demo Access: {demoLabel}
            </p>
          )}
        </div>

        {/* Persona Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {personas.map((persona: any) => {
            const personaInfo = PERSONA_INFO[persona.firstName as keyof typeof PERSONA_INFO];
            if (!personaInfo) return null;

            const Icon = personaInfo.icon;
            const isSelected = selectedPersona === persona.id;
            const isDisabled = isLoading && !isSelected;

            return (
              <Card
                key={persona.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  isSelected ? 'ring-2 ring-primary' : ''
                } ${isDisabled ? 'opacity-50' : ''}`}
                onClick={() => !isLoading && handlePersonaClick(persona.id, persona.firstName)}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${personaInfo.gradient} text-white`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">
                        {persona.firstName} {persona.lastName}
                      </CardTitle>
                      <CardDescription className="text-base">
                        {personaInfo.title}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {personaInfo.description}
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      What You'll Experience:
                    </p>
                    <ul className="space-y-1">
                      {personaInfo.features.map((feature, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-0.5">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    className="w-full"
                    variant={isSelected ? 'default' : 'outline'}
                    disabled={isLoading}
                  >
                    {isLoading && isSelected
                      ? 'Loading...'
                      : `Login as ${persona.firstName}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center pt-4">
          <Button variant="ghost" onClick={() => {
            // Clear stored demo code so user can enter a different one
            localStorage.removeItem('poa-demo-code');
            sessionStorage.removeItem('demoCodeId');
            sessionStorage.removeItem('demoLabel');
            sessionStorage.removeItem('demoPersonas');
            navigate('/demo');
          }}>
            ← Use Different Demo Code
          </Button>
        </div>
      </div>
    </div>
  );
}
