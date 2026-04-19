import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation, Link } from "wouter";
import {
  ArrowRight,
  Brain,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  FileText,
  GitBranch,
  Home,
  LayoutDashboard,
  Shield,
  Smartphone,
  Users,
  Zap,
} from "lucide-react";
import heroImage from "@assets/generated_images/modern_suburban_homes_with_green_lawns_and_blue_sky.png";
import logoImage from "@assets/generated_images/abstract_geometric_building_logo_concept.png";
import { ContactModal } from "@/components/ContactModal";
import { CommunitySearch } from "@/components/CommunitySearch";

// Navigation Component
function Navbar({ onScheduleDemo }: { onScheduleDemo: () => void }) {
  const [, navigate] = useLocation();

  return (
    <nav className="border-b sticky top-0 bg-background/80 backdrop-blur z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="Logo" className="h-8 w-8 rounded" />
          <span className="text-xl font-bold text-primary font-heading">POAssociation</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#solutions" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Solutions
          </a>
          <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/demo')}>
            Enter Demo Code
          </Button>
          <Button variant="outline" onClick={onScheduleDemo}>
            Schedule Demo
          </Button>
          <Button onClick={() => window.location.href = '/api/login'} data-testid="button-login">
            Sign In <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

// Hero Section
function HeroSection({ onScheduleDemo }: { onScheduleDemo: () => void }) {
  return (
    <section className="relative pt-16 pb-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1 space-y-8 text-center lg:text-left">
          <Badge variant="secondary" className="text-sm px-4 py-1">
            Now with AI-Powered Form Generation
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
            Community Management <br />
            <span className="text-primary">Reimagined.</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 leading-relaxed">
            The all-in-one platform for HOAs, POAs, and Management Companies to streamline
            architectural reviews, compliance tracking, and resident communications.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Button size="lg" className="text-lg px-8 h-12" onClick={() => window.location.href = '/api/login'} data-testid="button-get-started">
              Get Started
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 h-12" onClick={onScheduleDemo}>
              Schedule Demo
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Request a demo or try our sandbox environment.
          </p>
        </div>
        <div className="flex-1 relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-purple-500/20 blur-3xl rounded-full opacity-50" />
          <img
            src={heroImage}
            alt="Beautiful suburban community"
            className="relative rounded-2xl shadow-2xl border border-border transform hover:scale-[1.02] transition-transform duration-500"
          />
        </div>
      </div>
    </section>
  );
}

// Social Proof Bar
function SocialProofBar() {
  const highlights = [
    { value: "9", label: "User Roles" },
    { value: "AI-Powered", label: "Application Analysis" },
    { value: "Multi-Tenant", label: "Architecture" },
    { value: "Real-Time", label: "Workflow Tracking" },
  ];

  return (
    <section className="py-12 bg-muted/30 border-y">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-muted-foreground mb-8">
          Built for HOA and POA communities
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {highlights.map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-3xl font-bold text-foreground">{item.value}</div>
              <div className="text-sm text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Features Section
function FeaturesSection() {
  const features = [
    {
      icon: Brain,
      title: "AI-Powered Forms",
      description: "Automatically generate application forms from your bylaws and covenants using AI.",
    },
    {
      icon: GitBranch,
      title: "Smart Workflows",
      description: "Custom approval workflows with multi-step routing, parallel reviews, and automated notifications.",
    },
    {
      icon: LayoutDashboard,
      title: "Board Portal",
      description: "Secure area for board members to review applications, vote, and track decisions.",
    },
    {
      icon: Shield,
      title: "Compliance Tracking",
      description: "Track filing deadlines, insurance renewals, annual meetings, and state requirements in one place.",
    },
    {
      icon: FileText,
      title: "Document Management",
      description: "Secure cloud storage for community documents with organized uploads and access controls.",
    },
    {
      icon: Calendar,
      title: "Calendar & Events",
      description: "Schedule meetings, send invites, and manage board agendas all in one place.",
    },
    {
      icon: Smartphone,
      title: "Mobile-First Design",
      description: "Upload photos via QR code, submit requests on the go, and review applications from any device.",
    },
    {
      icon: Building2,
      title: "Multi-Community",
      description: "Manage multiple HOAs or POAs from a single dashboard with role-based access control.",
    },
  ];

  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4">Features</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Everything you need to run a community
          </h2>
          <p className="text-lg text-muted-foreground">
            Powerful tools tailored for every role in the association ecosystem.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="group hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <feature.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// Solutions Section
function SolutionsSection() {
  const solutions = [
    {
      icon: Building2,
      title: "For Management Companies",
      description: "Streamline operations across your entire portfolio",
      features: [
        "Manage multiple communities from one dashboard",
        "Assign property reps to specific communities",
        "Credit-based billing with invoice management",
        "Customizable community landing pages",
        "Team management with role-based access",
        "Centralized document storage",
      ],
    },
    {
      icon: Home,
      title: "For HOA/POA Boards",
      description: "Modernize your community governance",
      features: [
        "Simple application submission for homeowners",
        "AI-powered analysis of architectural requests",
        "Automated compliance reminders",
        "Meeting management with agendas & minutes",
        "Transparent communication with residents",
        "Self-service resident portal",
      ],
    },
  ];

  return (
    <section id="solutions" className="py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4">Solutions</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Built for your needs
          </h2>
          <p className="text-lg text-muted-foreground">
            Whether you manage one community or a hundred, we have you covered.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {solutions.map((solution) => (
            <Card key={solution.title} className="p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="h-14 w-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary flex-shrink-0">
                  <solution.icon className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">{solution.title}</h3>
                  <p className="text-muted-foreground">{solution.description}</p>
                </div>
              </div>
              <ul className="space-y-3">
                {solution.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// Pricing Section - Uses COMMUNITY_TIER_DEFAULTS from shared/subscriptionTypes.ts
// All plans include ALL features. Credits are for AI-powered operations.
function PricingSection({ onContact }: { onContact: () => void }) {
  const tiers = [
    {
      name: "Small",
      doors: "1-50",
      price: "$29",
      period: "/month",
      description: "Perfect for small communities",
      credits: "10 credits/month",
      overageCost: "$2.00/credit",
      features: [
        "All features included",
        "Custom workflows",
        "AI analysis & forms",
        "Compliance tracking",
      ],
      popular: false,
    },
    {
      name: "Medium",
      doors: "51-150",
      price: "$79",
      period: "/month",
      description: "For growing communities",
      credits: "25 credits/month",
      overageCost: "$1.75/credit",
      features: [
        "All features included",
        "Custom workflows",
        "AI analysis & forms",
        "Compliance tracking",
      ],
      popular: true,
    },
    {
      name: "Large",
      doors: "151-500",
      price: "$149",
      period: "/month",
      description: "For established communities",
      credits: "50 credits/month",
      overageCost: "$1.50/credit",
      features: [
        "All features included",
        "Custom workflows",
        "AI analysis & forms",
        "Compliance tracking",
      ],
      popular: false,
    },
    {
      name: "Extra Large",
      doors: "501+",
      price: "$299",
      period: "/month",
      description: "For large communities",
      credits: "100 credits/month",
      overageCost: "$1.25/credit",
      features: [
        "All features included",
        "Custom workflows",
        "AI analysis & forms",
        "Compliance tracking",
      ],
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4">Pricing</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Simple, door-based pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Choose your plan based on community size. All plans include every feature.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={`relative flex flex-col ${
                tier.popular ? 'border-primary shadow-lg scale-[1.02]' : ''
              }`}
            >
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">{tier.name}</CardTitle>
                <CardDescription>{tier.doors} doors</CardDescription>
                <div className="pt-4">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-muted-foreground">{tier.period}</span>
                </div>
                <p className="text-sm text-muted-foreground pt-2">{tier.description}</p>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mb-4 flex flex-col gap-1">
                  <Badge variant="secondary" className="text-xs w-fit">
                    <Zap className="h-3 w-3 mr-1" />
                    {tier.credits}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Overage: {tier.overageCost}
                  </span>
                </div>
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <div className="p-6 pt-0 mt-auto">
                <Button
                  className="w-full"
                  variant={tier.popular ? 'default' : 'outline'}
                  onClick={() => window.location.href = '/api/login'}
                >
                  Get Started
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Need a custom plan?{" "}
          <button
            onClick={onContact}
            className="text-primary hover:underline font-medium"
          >
            Contact us
          </button>{" "}
          for enterprise pricing.
        </p>
      </div>
    </section>
  );
}

// CTA Section
function CTASection({ onScheduleDemo }: { onScheduleDemo: () => void }) {
  return (
    <section className="py-24 bg-primary text-primary-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Ready to modernize your community management?
        </h2>
        <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
          See how POAssociation can streamline your architectural reviews, compliance, and operations.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            variant="secondary"
            className="text-lg px-8 h-12"
            onClick={onScheduleDemo}
          >
            Schedule a Demo
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-lg px-8 h-12 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            onClick={() => window.location.href = '/api/login'}
          >
            Sign In
          </Button>
        </div>
      </div>
    </section>
  );
}

// Footer
function Footer({ onContact, onScheduleDemo }: { onContact: () => void; onScheduleDemo: () => void }) {
  return (
    <footer className="bg-muted/50 border-t">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src={logoImage} alt="Logo" className="h-8 w-8 rounded" />
              <span className="font-bold text-primary">POAssociation</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Modern community management for HOAs and POAs.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <button
                  onClick={onScheduleDemo}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Demo
                </button>
              </li>
            </ul>
          </div>

          {/* Solutions */}
          <div>
            <h4 className="font-semibold mb-4">Solutions</h4>
            <ul className="space-y-2">
              <li>
                <a href="#solutions" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Management Companies
                </a>
              </li>
              <li>
                <a href="#solutions" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  HOA Boards
                </a>
              </li>
              <li>
                <a href="#solutions" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  POA Boards
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/security" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Security
                </Link>
              </li>
              <li>
                <Link href="/legal" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Legal
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  About
                </Link>
              </li>
              <li>
                <button
                  onClick={onContact}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contact
                </button>
              </li>
              <li>
                <Link href="/security" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Security
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} POAssociation. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/legal?tab=privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/legal?tab=terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/legal" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Legal
            </Link>
            <Link href="/security" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main Landing Page
export default function Landing() {
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactMode, setContactMode] = useState<"contact" | "demo">("contact");

  const openContactModal = () => {
    setContactMode("contact");
    setContactModalOpen(true);
  };

  const openDemoModal = () => {
    setContactMode("demo");
    setContactModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <Navbar onScheduleDemo={openDemoModal} />
      <HeroSection onScheduleDemo={openDemoModal} />
      <CommunitySearch onSignupClick={openDemoModal} />
      <SocialProofBar />
      <FeaturesSection />
      <SolutionsSection />
      <PricingSection onContact={openContactModal} />
      <CTASection onScheduleDemo={openDemoModal} />
      <Footer onContact={openContactModal} onScheduleDemo={openDemoModal} />

      <ContactModal
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
        mode={contactMode}
      />
    </div>
  );
}
