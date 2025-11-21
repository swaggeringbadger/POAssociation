import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Layout, Shield, Users } from "lucide-react";
import heroImage from "@assets/generated_images/modern_suburban_homes_with_green_lawns_and_blue_sky.png";
import logoImage from "@assets/generated_images/abstract_geometric_building_logo_concept.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Navigation */}
      <nav className="border-b sticky top-0 bg-background/80 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="Logo" className="h-8 w-8 rounded" />
            <span className="text-xl font-bold text-primary font-heading">POA Association</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#solutions" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Solutions</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => window.location.href = '/api/login'} data-testid="button-login">
              Sign In <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-8 text-center md:text-left">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
              Community Management <br/>
              <span className="text-primary">Reimagined.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto md:mx-0 leading-relaxed">
              The all-in-one platform for HOAs, Management Companies, and Boards to streamline architectural reviews, communications, and compliance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
              <Button size="lg" className="text-lg px-8 h-12" onClick={() => window.location.href = '/api/login'} data-testid="button-get-started">
                Get Started
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 h-12">View Demo</Button>
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-purple-500/20 blur-3xl rounded-full opacity-50" />
            <img 
              src={heroImage} 
              alt="Community Dashboard" 
              className="relative rounded-2xl shadow-2xl border border-border transform hover:scale-[1.02] transition-transform duration-500"
            />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-secondary/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need to run a community</h2>
            <p className="text-muted-foreground text-lg">
              Powerful tools tailored for every role in the association ecosystem.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Layout}
              title="Smart Workflows"
              description="Automate architectural requests with our revolutionary form wizard that adapts to your specific covenants."
            />
            <FeatureCard 
              icon={Users}
              title="Role-Based Access"
              description="Granular permissions for Managers, Board Members, Homeowners, and Delegated Representatives."
            />
            <FeatureCard 
              icon={Shield}
              title="Compliance & Safety"
              description="Secure document storage, audit logs, and transparent communication channels for peace of mind."
            />
          </div>
        </div>
      </section>
      
      {/* Footer Mockup */}
      <footer className="bg-background border-t py-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 POA Association. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="bg-background p-8 rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
