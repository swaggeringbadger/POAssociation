import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Lock,
  Server,
  CreditCard,
  Bot,
  Globe,
  Database,
  Users,
  FileText,
  Mail,
  CheckCircle,
  Brain,
  Zap,
  Building2,
  Heart,
  Lightbulb,
  Eye,
  Layers,
  ArrowRight,
  BarChart3,
  CloudCog,
  Code2,
  Award,
} from "lucide-react";
import { Link } from "wouter";
import { ContactModal } from "@/components/ContactModal";

export default function AboutPage() {
  const currentYear = new Date().getFullYear();
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactMode, setContactMode] = useState<"contact" | "demo">("contact");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">POAssociation</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Back to Home
            </Link>
            <Button size="sm" onClick={() => { setContactMode("demo"); setContactModalOpen(true); }}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-primary/5 to-background py-16">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <Badge variant="secondary" className="mb-2">
            <Building2 className="h-3 w-3 mr-1" />
            About Us
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight">
            Purpose-Built for{" "}
            <span className="text-primary">Community Management</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            POAssociation is a modern platform designed to simplify how property owner associations
            manage applications, compliance, communications, and operations.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12 space-y-12">

        {/* Mission */}
        <Card>
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Our Mission</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Community associations run on paper forms, spreadsheets, and scattered email threads.
              Board members volunteer their time but lack the tools to manage operations efficiently.
              We built POAssociation to replace that complexity with a single intelligent platform —
              one that handles architectural reviews, compliance tracking, meeting management, and
              billing operations in one place.
            </p>
          </CardContent>
        </Card>

        {/* What We Do */}
        <div>
          <h2 className="text-2xl font-bold text-center mb-8">What We Do</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: Brain,
                title: "AI-Powered Reviews",
                desc: "Architectural applications analyzed by AI for compliance with community guidelines, giving boards consistent, detailed recommendations.",
              },
              {
                icon: Zap,
                title: "Workflow Automation",
                desc: "Custom workflows route applications through review, approval, and notification steps automatically — reducing manual follow-up.",
              },
              {
                icon: Building2,
                title: "Multi-Community Management",
                desc: "Management companies oversee multiple communities from a single dashboard with tenant-isolated data and role-based access.",
              },
            ].map((item, i) => (
              <Card key={i}>
                <CardContent className="pt-6 pb-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-semibold mb-2">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Values */}
        <div>
          <h2 className="text-2xl font-bold text-center mb-8">Our Values</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Eye,
                title: "Transparency",
                desc: "Clear pricing, honest capabilities, and open communication with every community we serve.",
              },
              {
                icon: Shield,
                title: "Security",
                desc: "Enterprise-grade protection for community data.",
                link: { href: "/security", label: "Learn more" },
              },
              {
                icon: Lightbulb,
                title: "Innovation",
                desc: "AI and automation applied thoughtfully to real community management challenges.",
              },
              {
                icon: Users,
                title: "Community",
                desc: "Built for the people who volunteer their time to make neighborhoods better.",
              },
            ].map((value, i) => (
              <Card key={i}>
                <CardContent className="pt-6 pb-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <value.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="font-semibold mb-1">{value.title}</p>
                  <p className="text-xs text-muted-foreground">{value.desc}</p>
                  {value.link && (
                    <Link href={value.link.href} className="text-xs text-primary hover:underline mt-2 inline-block">
                      {value.link.label} →
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* By the Numbers */}
        <Card>
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-center mb-8">By the Numbers</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
              {[
                { value: "9", label: "User Roles" },
                { value: "21", label: "AI Prompts" },
                { value: "Multi-Tenant", label: "Architecture" },
                { value: "Full-Stack", label: "TypeScript" },
              ].map((stat, i) => (
                <div key={i}>
                  <p className="text-3xl font-bold text-primary">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Technology */}
        <div>
          <h2 className="text-2xl font-bold text-center mb-8">Our Technology</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: CloudCog,
                title: "Cloud Infrastructure",
                desc: "Hosted on scalable cloud infrastructure with automated deployments and monitoring.",
              },
              {
                icon: Database,
                title: "PostgreSQL",
                desc: "Neon serverless PostgreSQL with SSL encryption, automated backups, and point-in-time recovery.",
              },
              {
                icon: Lock,
                title: "Security-First Design",
                desc: "OIDC authentication, tenant isolation, RBAC, and encrypted connections at every layer.",
              },
              {
                icon: Bot,
                title: "AI Integration",
                desc: "Anthropic Claude powers application analysis, property research, and compliance recommendations.",
              },
              {
                icon: CreditCard,
                title: "Stripe Payments",
                desc: "PCI DSS Level 1 compliant payment processing — card data never touches our servers.",
              },
              {
                icon: Code2,
                title: "RESTful API Architecture",
                desc: "Clean API layer with Zod validation, typed endpoints, and consistent error handling.",
              },
            ].map((tech, i) => (
              <Card key={i}>
                <CardContent className="pt-6 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <tech.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold mb-1">{tech.title}</p>
                      <p className="text-xs text-muted-foreground">{tech.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Team Positioning */}
        <Card>
          <CardContent className="p-6 sm:p-8 text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mx-auto mb-4">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Built by People Who Understand Communities</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Our team combines deep expertise in community association management, enterprise software
              development, and regulatory compliance. We've lived the challenges that board members
              and property managers face — and built the tools to solve them.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "HOA Management",
                "Full-Stack Development",
                "Cloud Architecture",
                "AI Integration",
                "Community Governance",
                "Multi-Tenant SaaS",
              ].map((badge, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {badge}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card>
          <CardContent className="p-6 sm:p-8 text-center space-y-4">
            <h2 className="text-2xl font-bold">Ready to modernize your community?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              See how POAssociation can streamline your architectural reviews, automate compliance,
              and give your board the tools they need.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => { setContactMode("demo"); setContactModalOpen(true); }}
                className="gap-2"
              >
                Schedule a Demo
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => { setContactMode("contact"); setContactModalOpen(true); }}
                className="gap-2"
              >
                Contact Us
              </Button>
            </div>
          </CardContent>
        </Card>

      </main>

      <ContactModal
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
        mode={contactMode}
      />

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              &copy; {currentYear} POAssociation. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <Link href="/security" className="hover:text-foreground transition-colors">
              Security
            </Link>
            <Link href="/legal" className="hover:text-foreground transition-colors">
              Legal
            </Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
