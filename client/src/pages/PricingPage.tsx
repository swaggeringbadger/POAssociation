import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ContactModal } from "@/components/ContactModal";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Check,
  Zap,
  Sparkles,
  Brain,
  FileText,
  Calendar,
  Shield,
  Users,
  Building2,
  Settings,
  BarChart3,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Mail,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import logoImage from "@assets/generated_images/abstract_geometric_building_logo_concept.png";

// Tier display type
interface TierDisplay {
  name: string;
  doors: string;
  price: number;
  yearly: number;
  credits: number;
  overage: number;
  popular: boolean;
  description: string;
}

// Fetch tiers from API
async function fetchPricingTiers(): Promise<TierDisplay[]> {
  const response = await fetch('/api/subscription/tiers');
  if (!response.ok) {
    throw new Error('Failed to fetch pricing tiers');
  }
  const tiers = await response.json();

  // Transform API response to display format
  return tiers.map((tier: any) => ({
    name: tier.name.replace(' Community', ''),
    doors: tier.maxDoors ? `${tier.minDoors}-${tier.maxDoors}` : `${tier.minDoors}+`,
    price: tier.basePriceMonthly,
    yearly: tier.basePriceYearly,
    credits: tier.includedCredits,
    overage: tier.defaultOverageCost,
    popular: tier.tierCode === 'medium',
    description: getDescription(tier.tierCode),
  }));
}

function getDescription(tierCode: string): string {
  const descriptions: Record<string, string> = {
    small: 'Perfect for small communities',
    medium: 'For growing communities',
    large: 'For established communities',
    xl: 'For large communities',
  };
  return descriptions[tierCode] || '';
}

// Hook to fetch pricing tiers
function usePricingTiers() {
  return useQuery({
    queryKey: ['pricing-tiers'],
    queryFn: fetchPricingTiers,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

const CREDIT_OPERATIONS = [
  {
    category: "AI Application Analysis",
    icon: Brain,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    note: "Each analysis run consumes credits. Re-analyzing a revised application uses additional credits.",
    operations: [
      {
        name: "Standard Analysis",
        credits: 1,
        description: "AI compliance review with satellite imagery of the property",
      },
      {
        name: "Full Analysis",
        credits: 2,
        description: "Everything in Standard plus AI mockup rendering, property research, and detailed breakdown report",
      },
    ],
  },
  {
    category: "AI Form Generation",
    icon: Sparkles,
    color: "text-amber-500",
    note: undefined,
    bgColor: "bg-amber-500/10",
    operations: [
      {
        name: "Generate Form Template",
        credits: 1,
        description: "AI creates a custom application form based on your community's design guidelines",
      },
    ],
  },
];

const FREE_FEATURES = [
  {
    category: "Application Management",
    icon: FileText,
    features: [
      "Submit, edit, and track applications",
      "Comments and threaded discussions",
      "Document uploads (50MB per file)",
      "Electronic signatures",
      "QR code mobile document upload",
      "Application status notifications",
    ],
  },
  {
    category: "Workflow & Approvals",
    icon: Settings,
    features: [
      "Custom workflow designer",
      "Multi-step approval workflows",
      "Role-based step assignments",
      "Conditional branching logic",
      "Automatic notifications",
    ],
  },
  {
    category: "Calendar & Events",
    icon: Calendar,
    features: [
      "Event scheduling and management",
      "Attendee tracking with RSVP",
      "iCal feed export",
      "Meeting documents and minutes",
      "Link applications to meetings",
    ],
  },
  {
    category: "Compliance Tracking",
    icon: Shield,
    features: [
      "Compliance item management",
      "Deadline tracking with reminders",
      "Recurring requirements",
      "Document validity tracking",
      "Compliance dashboard",
    ],
  },
  {
    category: "Directory & Team",
    icon: Users,
    features: [
      "Community directory",
      "Property representative assignments",
      "Team management",
      "Role-based access control",
    ],
  },
  {
    category: "Settings & Branding",
    icon: Building2,
    features: [
      "Custom logo and branding",
      "Community landing page",
      "Design guidelines integration",
      "Configurable notifications",
    ],
  },
];

const FAQS = [
  {
    question: "Do unused credits roll over?",
    answer: "No, credits reset each billing cycle. We keep it simple - use them or lose them.",
  },
  {
    question: "Can I upgrade or downgrade my tier?",
    answer: "Yes, you can change tiers at any time. Changes take effect on your next billing cycle.",
  },
  {
    question: "What happens if I run out of credits?",
    answer: "You can continue using AI features - they'll be charged at your tier's overage rate.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes! Every new account gets a 14-day free trial with full access to all features and 10 credits.",
  },
  {
    question: "Do you offer annual billing?",
    answer: "Yes, annual billing saves you approximately 2 months (16.7% discount).",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards and ACH bank transfers for annual plans.",
  },
];

// Navigation
function Navbar() {
  const [, navigate] = useLocation();

  return (
    <nav className="border-b sticky top-0 bg-background/80 backdrop-blur z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <img src={logoImage} alt="Logo" className="h-8 w-8 rounded" />
          <span className="text-xl font-bold text-primary font-heading">POAssociation</span>
        </button>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/")}>
            Back to Home
          </Button>
          <Button onClick={() => window.location.href = '/login'}>
            Get Started <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

// Hero Section
function PricingHero() {
  return (
    <section className="pt-16 pb-8 text-center">
      <div className="max-w-4xl mx-auto px-4">
        <Badge variant="secondary" className="mb-4">
          Simple, Transparent Pricing
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Every feature included.{" "}
          <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            Pay for what you use.
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Choose your tier based on community size. All features are included -
          credits are only for AI-powered operations.
        </p>
      </div>
    </section>
  );
}

// Billing Toggle
function BillingToggle({
  isAnnual,
  setIsAnnual
}: {
  isAnnual: boolean;
  setIsAnnual: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4 mb-8">
      <span className={cn("text-sm font-medium", !isAnnual && "text-foreground", isAnnual && "text-muted-foreground")}>
        Monthly
      </span>
      <button
        onClick={() => setIsAnnual(!isAnnual)}
        className={cn(
          "relative w-14 h-7 rounded-full transition-colors",
          isAnnual ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform shadow-sm",
            isAnnual && "translate-x-7"
          )}
        />
      </button>
      <span className={cn("text-sm font-medium", isAnnual && "text-foreground", !isAnnual && "text-muted-foreground")}>
        Annual
        <Badge variant="secondary" className="ml-2 text-xs">Save 17%</Badge>
      </span>
    </div>
  );
}

// Tier Cards
function TierCards({ isAnnual }: { isAnnual: boolean }) {
  const { data: tiers, isLoading, error } = usePricingTiers();

  if (isLoading) {
    return (
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="flex flex-col">
                <CardHeader className="pb-4">
                  <Skeleton className="h-6 w-24 mb-2" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-32 mt-4" />
                </CardHeader>
                <CardContent className="flex-1">
                  <Skeleton className="h-16 w-full mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || !tiers) {
    return (
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-muted-foreground">Unable to load pricing. Please refresh the page.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="pb-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => (
            <Card
              key={tier.name}
              className={cn(
                "relative flex flex-col transition-all hover:shadow-lg",
                tier.popular && "border-primary shadow-lg ring-2 ring-primary/20 scale-[1.02]"
              )}
            >
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 shadow-sm">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription className="text-sm">{tier.doors} doors</CardDescription>
                <div className="pt-4">
                  <span className="text-4xl font-bold">
                    ${isAnnual ? Math.round(tier.yearly / 12) : tier.price}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                  {isAnnual && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Billed annually (${tier.yearly}/year)
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-500/10">
                    <Zap className="h-5 w-5 text-violet-500" />
                    <div>
                      <p className="font-semibold text-sm">{tier.credits} credits/month</p>
                      <p className="text-xs text-muted-foreground">
                        ${tier.overage.toFixed(2)}/credit overage
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-2 pt-2">
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      All features included
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      Custom workflows
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      AI analysis & forms
                    </li>
                  </ul>
                </div>

                <Button
                  className="w-full mt-6"
                  variant={tier.popular ? "default" : "outline"}
                  onClick={() => window.location.href = '/login'}
                >
                  Start Free Trial
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include a 14-day free trial. No credit card required.
        </p>
      </div>
    </section>
  );
}

// Credit Operations Section
function CreditOperationsSection() {
  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            <Zap className="h-3 w-3 mr-1" />
            Credit System
          </Badge>
          <h2 className="text-3xl font-bold mb-4">What Uses Credits?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Credits power our AI features. Every other feature in the platform is
            included free with your subscription.
          </p>
        </div>

        <div className="space-y-6">
          {CREDIT_OPERATIONS.map((category) => (
            <Card key={category.category} className="overflow-hidden">
              <CardHeader className={cn("pb-4", category.bgColor)}>
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-background/80", category.color)}>
                    <category.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{category.category}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {category.operations.map((op) => (
                    <div
                      key={op.name}
                      className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{op.name}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">{op.description}</p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "shrink-0 text-base font-bold px-4 py-2",
                          category.bgColor,
                          category.color
                        )}
                      >
                        {op.credits} {op.credits === 1 ? "credit" : "credits"}
                      </Badge>
                    </div>
                  ))}
                </div>
                {category.note && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                      <HelpCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      {category.note}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-violet-500/20">
              <HelpCircle className="h-6 w-6 text-violet-500" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">How credits work</h3>
              <p className="text-sm text-muted-foreground">
                Each subscription tier includes a monthly credit allowance. Credits are used only for
                AI-powered features like application analysis and form generation. If you use more than
                your included credits, additional usage is billed at your tier's overage rate. Credits
                reset on your billing cycle date.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Free Features Section
function FreeFeaturesSection() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  return (
    <section className="py-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            <Check className="h-3 w-3 mr-1" />
            Included Free
          </Badge>
          <h2 className="text-3xl font-bold mb-4">Everything Else is Included</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            No feature gating, no upsells. Every feature below is included in all subscription tiers.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FREE_FEATURES.map((category) => (
            <Card
              key={category.category}
              className="cursor-pointer hover:shadow-md transition-all"
              onClick={() => setExpandedCategory(
                expandedCategory === category.category ? null : category.category
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <category.icon className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-base">{category.category}</CardTitle>
                  </div>
                  {expandedCategory === category.category ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              {expandedCategory === category.category && (
                <CardContent className="pt-2">
                  <ul className="space-y-2">
                    {category.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// FAQ Section
function FAQSection() {
  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            <HelpCircle className="h-3 w-3 mr-1" />
            FAQ
          </Badge>
          <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {FAQS.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`faq-${index}`}
              className="bg-background rounded-lg border px-4"
            >
              <AccordionTrigger className="text-left font-medium hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

// Enterprise CTA
function EnterpriseCTA({ onContactSales }: { onContactSales: () => void }) {
  return (
    <section className="py-16">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="bg-gradient-to-br from-primary/5 via-purple-500/5 to-violet-500/5 border-primary/20">
          <CardContent className="p-8 sm:p-12">
            <div className="flex flex-col sm:flex-row items-center gap-8">
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-2xl font-bold mb-2">Need a Custom Plan?</h3>
                <p className="text-muted-foreground mb-4">
                  For communities with 1000+ doors or special requirements, contact us for enterprise pricing.
                </p>
                <ul className="flex flex-wrap gap-x-6 gap-y-2 justify-center sm:justify-start text-sm text-muted-foreground">
                  <li className="flex items-center gap-1">
                    <Check className="h-4 w-4 text-green-500" />
                    Dedicated account manager
                  </li>
                  <li className="flex items-center gap-1">
                    <Check className="h-4 w-4 text-green-500" />
                    Custom credit allowances
                  </li>
                  <li className="flex items-center gap-1">
                    <Check className="h-4 w-4 text-green-500" />
                    Volume discounts
                  </li>
                  <li className="flex items-center gap-1">
                    <Check className="h-4 w-4 text-green-500" />
                    Priority support
                  </li>
                </ul>
              </div>
              <Button size="lg" className="shrink-0" onClick={onContactSales}>
                <Mail className="mr-2 h-4 w-4" />
                Contact Sales
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="Logo" className="h-6 w-6 rounded" />
          <span className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} POAssociation. All rights reserved.
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/legal?tab=privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/legal?tab=terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link href="/legal" className="hover:text-foreground transition-colors">Legal</Link>
          <a href="#" className="hover:text-foreground transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}

// Main Page Component
export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <PricingHero />
        <BillingToggle isAnnual={isAnnual} setIsAnnual={setIsAnnual} />
        <TierCards isAnnual={isAnnual} />
        <CreditOperationsSection />
        <FreeFeaturesSection />
        <FAQSection />
        <EnterpriseCTA onContactSales={() => setContactModalOpen(true)} />
      </main>
      <Footer />

      <ContactModal
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
        mode="contact"
      />
    </div>
  );
}
