import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Eye,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  Fingerprint,
  CloudCog,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { ContactModal } from "@/components/ContactModal";

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">{title}</h3>
      </div>
      <div className="pl-13 space-y-3 text-muted-foreground leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function InfoCard({ title, items }: { title?: string; items: string[] }) {
  return (
    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
      {title && <p className="font-medium text-foreground text-sm">{title}</p>}
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SecurityPage() {
  const currentYear = new Date().getFullYear();
  const [contactModalOpen, setContactModalOpen] = useState(false);

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
            <Button size="sm" onClick={() => setContactModalOpen(true)}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-primary/5 to-background py-16">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <Badge variant="secondary" className="mb-2">
            <Lock className="h-3 w-3 mr-1" />
            Defense in Depth
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight">
            Security at <span className="text-primary">POAssociation</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your community data is protected by multiple layers of security — from encrypted connections
            and isolated tenants to PCI-compliant payment processing and stateless AI requests.
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="max-w-4xl mx-auto px-4 -mt-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Lock, title: "256-bit SSL/TLS", desc: "All data encrypted in transit" },
            { icon: KeyRound, title: "Zero Passwords Stored", desc: "OIDC authentication only" },
            { icon: CreditCard, title: "PCI via Stripe", desc: "Payment data never touches our servers" },
            { icon: Layers, title: "Tenant Isolation", desc: "Complete data separation" },
          ].map((card, i) => (
            <Card key={i} className="text-center">
              <CardContent className="pt-6 pb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <card.icon className="h-6 w-6 text-primary" />
                </div>
                <p className="font-semibold">{card.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{card.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <Card>
          <CardContent className="p-6 sm:p-8 space-y-8">

            {/* Infrastructure & Encryption */}
            <Section icon={Server} title="Infrastructure & Encryption">
              <p>
                Our platform runs on enterprise-grade cloud infrastructure with encryption at every layer.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <InfoCard
                  title="Database"
                  items={[
                    "Neon PostgreSQL with mandatory SSL connections",
                    "Data encrypted at rest with AES-256",
                    "Automated daily backups with point-in-time recovery",
                  ]}
                />
                <InfoCard
                  title="Network & Storage"
                  items={[
                    "HTTPS enforced on all endpoints",
                    "Azure Blob Storage with private containers",
                    "Time-limited signed URLs for document access",
                  ]}
                />
              </div>
            </Section>

            <Separator />

            {/* Authentication & Access Control */}
            <Section icon={Fingerprint} title="Authentication & Access Control">
              <p>
                We use OpenID Connect (OIDC) for authentication — we never store, process, or even see your password.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <InfoCard
                  title="Authentication"
                  items={[
                    "OIDC via Replit Auth — no password database",
                    "PostgreSQL-backed server-side sessions",
                    "httpOnly, Secure, SameSite cookies",
                    "7-day session expiration",
                  ]}
                />
                <InfoCard
                  title="Authorization"
                  items={[
                    "9-role RBAC system (super admin through homeowner)",
                    "Multi-tenant query scoping on every request",
                    "Role-based access checks on protected API routes",
                    "Tenant isolation verified before data access",
                  ]}
                />
              </div>
            </Section>

            <Separator />

            {/* Data Protection */}
            <Section icon={Database} title="Data Protection">
              <p>
                Every query and input is validated and scoped to prevent unauthorized access and injection attacks.
              </p>
              <div className="space-y-4 mt-4">
                <InfoCard
                  items={[
                    "Drizzle ORM with parameterized queries — no raw SQL",
                    "Zod schema validation on all API endpoints",
                    "Tenant-scoped storage paths prevent cross-tenant document access",
                    "Server-side HTML sanitization on all user-submitted text fields",
                  ]}
                />
              </div>
            </Section>

            <Separator />

            {/* Payment Security */}
            <Section icon={CreditCard} title="Payment Security">
              <p>
                Payment processing is handled entirely by Stripe, a PCI DSS Level 1 certified provider.
              </p>
              <div className="bg-muted/30 rounded-lg p-4 mt-4">
                <div className="grid sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-foreground">Stripe Elements</p>
                    <p className="text-muted-foreground">Card fields hosted by Stripe — card numbers never touch our servers</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">PCI DSS Level 1</p>
                    <p className="text-muted-foreground">Stripe maintains the highest level of PCI compliance</p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Tokenized Storage</p>
                    <p className="text-muted-foreground">We only store Stripe customer/subscription IDs, never payment details</p>
                  </div>
                </div>
              </div>
            </Section>

            <Separator />

            {/* AI & Data Privacy */}
            <Section icon={Bot} title="AI & Data Privacy">
              <p>
                Our AI features use Anthropic's Claude API with strict data handling practices.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <InfoCard
                  title="How We Use AI"
                  items={[
                    "Stateless API requests — no persistent AI memory",
                    "Data sent only for the specific analysis requested",
                    "Anthropic does not use API inputs for model training",
                  ]}
                />
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-foreground">AI Disclaimer</p>
                      <p className="text-muted-foreground">
                        AI-generated analyses are for informational purposes only and do not constitute
                        professional, legal, or architectural advice. Always verify results independently.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Separator />

            {/* Application Security */}
            <Section icon={ShieldCheck} title="Application Security">
              <p>
                We follow OWASP best practices to protect against common web application vulnerabilities.
              </p>
              <div className="space-y-4 mt-4">
                <InfoCard
                  items={[
                    "Content Security Policy headers via helmet.js on all responses",
                    "XSS protection through React output encoding and server-side HTML sanitization",
                    "Secure cookie configuration (httpOnly, Secure, SameSite=Lax)",
                    "CSRF protection via SameSite cookies and origin validation on mutation requests",
                    "Stripe and SMTP2GO webhook signature validation",
                    "Zod schema validation on all API request bodies",
                  ]}
                />
              </div>
            </Section>

            <Separator />

            {/* Compliance & Standards */}
            <Section icon={FileText} title="Compliance & Standards">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <p className="font-medium mb-2">CCPA / GDPR</p>
                  <p className="text-sm text-muted-foreground">
                    Users can access, export, correct, or delete their personal data.
                    We do not sell personal information. See our{" "}
                    <Link href="/legal?tab=privacy" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>{" "}
                    for full details.
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="font-medium mb-2">Data Retention</p>
                  <p className="text-sm text-muted-foreground">
                    We maintain clear retention periods for all data categories with automatic cleanup.
                    Review our{" "}
                    <Link href="/legal?tab=data-retention" className="text-primary hover:underline">
                      Data Retention Policy
                    </Link>{" "}
                    for specifics.
                  </p>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-xs">Roadmap</Badge>
                  <p className="font-medium text-foreground text-sm">Security Roadmap</p>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  We're continuously improving our security posture. Planned enhancements include:
                </p>
                <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                  {[
                    "Two-factor authentication (2FA)",
                    "Uniform RBAC middleware across all API routes",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            <Separator />

            {/* Reporting Security Concerns */}
            <Section icon={Eye} title="Reporting Security Concerns">
              <div className="p-4 rounded-lg border space-y-3">
                <p className="text-sm">
                  If you discover a security vulnerability, please report it responsibly.
                  We take all reports seriously and commit to a <strong>48-hour initial response</strong>.
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="font-medium text-foreground">security@poassociation.com</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Please include a description of the issue, steps to reproduce, and any supporting evidence.
                  Do not publicly disclose vulnerabilities until we've had a chance to address them.
                </p>
              </div>
            </Section>

            <Separator />

            {/* CTA */}
            <div className="bg-primary/5 rounded-lg p-6 text-center space-y-3">
              <p className="font-medium">Have security questions?</p>
              <p className="text-sm text-muted-foreground">
                Our team is happy to discuss our security practices in detail.
              </p>
              <Button onClick={() => setContactModalOpen(true)} variant="outline" className="gap-2">
                <Mail className="h-4 w-4" />
                Contact Us
              </Button>
            </div>

          </CardContent>
        </Card>
      </main>

      <ContactModal
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
        mode="contact"
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
            <Link href="/about" className="hover:text-foreground transition-colors">
              About
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
