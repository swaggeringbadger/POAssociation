import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Shield, FileText, Database, MessageSquare, Mail, Clock, Globe, Lock, CreditCard, Server, MapPin, Bot, Bell, Trash2, Archive, AlertCircle, Phone, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { ContactModal } from "@/components/ContactModal";

// Get subdomain from current hostname
function getSubdomain(): string | null {
  const hostname = window.location.hostname;
  const urlParams = new URLSearchParams(window.location.search);
  const querySubdomain = urlParams.get('subdomain');
  if (querySubdomain) {
    return querySubdomain;
  }
  const parts = hostname.split('.');
  if (parts.length >= 3 && parts[0] !== 'www') {
    return parts[0];
  }
  return null;
}

// Get the tab from URL query parameter
function getDefaultTab(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const tab = urlParams.get('tab');
  if (tab && ['privacy', 'terms', 'data-retention', 'sms'].includes(tab)) {
    return tab;
  }
  return 'privacy';
}

interface TenantInfo {
  id: string;
  name: string;
  subdomain: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

// Section component for consistent styling
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

// Info card for highlighting key information
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

// Data table for retention periods
function DataTable({ rows }: { rows: { type: string; period: string; reason: string }[] }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left p-3 font-medium">Data Type</th>
            <th className="text-left p-3 font-medium">Retention</th>
            <th className="text-left p-3 font-medium hidden sm:table-cell">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t">
              <td className="p-3">{row.type}</td>
              <td className="p-3 text-primary font-medium">{row.period}</td>
              <td className="p-3 text-muted-foreground hidden sm:table-cell">{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LegalPage() {
  const subdomain = getSubdomain();
  const currentYear = new Date().getFullYear();
  const lastUpdated = "December 8, 2025";
  const defaultTab = getDefaultTab();
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const { data: tenant } = useQuery<TenantInfo>({
    queryKey: ['tenant-info', subdomain],
    queryFn: async () => {
      const response = await fetch(`/api/public/${subdomain}/info`);
      if (!response.ok) throw new Error('Tenant not found');
      return response.json();
    },
    enabled: !!subdomain,
    retry: false,
  });

  const companyName = tenant?.name || "POAssociation";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">{companyName}</span>
          </Link>
          <span className="text-sm text-muted-foreground">Legal Documents</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Legal Documents</h1>
          <p className="text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="privacy" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Privacy</span>
            </TabsTrigger>
            <TabsTrigger value="terms" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Terms</span>
            </TabsTrigger>
            <TabsTrigger value="data-retention" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Data</span>
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">SMS</span>
            </TabsTrigger>
          </TabsList>

          {/* Privacy Policy */}
          <TabsContent value="privacy">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <Shield className="h-6 w-6 text-primary" />
                  Privacy Policy
                </CardTitle>
                <p className="text-muted-foreground mt-2">
                  {companyName} is committed to protecting your privacy. This policy explains how we collect,
                  use, and safeguard your information.
                </p>
              </CardHeader>
              <CardContent className="space-y-8">

                <Section icon={Database} title="Information We Collect">
                  <p>We collect information you provide directly and data generated through your use of our services.</p>

                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <InfoCard
                      title="Account & Profile"
                      items={[
                        "Name and email address",
                        "Phone number (optional)",
                        "Profile image",
                        "Notification preferences"
                      ]}
                    />
                    <InfoCard
                      title="Property & Applications"
                      items={[
                        "Property addresses",
                        "Application submissions",
                        "Uploaded documents",
                        "Electronic signatures"
                      ]}
                    />
                  </div>

                  <div className="bg-muted/30 rounded-lg p-4 mt-4">
                    <p className="text-sm">
                      <span className="font-medium text-foreground">Automatically collected:</span> Device information,
                      browser type, IP address, session data, and general usage patterns.
                    </p>
                  </div>
                </Section>

                <Separator />

                <Section icon={Server} title="How We Use Your Data">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      "Provide and maintain our services",
                      "Process architectural applications",
                      "Send status notifications",
                      "Process payments securely",
                      "Analyze applications with AI tools",
                      "Ensure platform security"
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                <Separator />

                <Section icon={Globe} title="Third-Party Services">
                  <p>We partner with trusted providers to deliver our services:</p>

                  <div className="grid gap-3 mt-4">
                    {[
                      { icon: CreditCard, name: "Stripe", desc: "Secure payment processing" },
                      { icon: Server, name: "Microsoft Azure", desc: "Document storage" },
                      { icon: Mail, name: "SMTP2GO", desc: "Email delivery" },
                      { icon: MapPin, name: "Google Maps", desc: "Address verification" },
                      { icon: Bot, name: "Anthropic", desc: "AI-powered analysis" }
                    ].map((service, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <service.icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <span className="font-medium text-foreground">{service.name}</span>
                          <span className="text-muted-foreground"> — {service.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                <Separator />

                <Section icon={Lock} title="Security & Cookies">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="font-medium text-foreground text-sm">Security Measures</p>
                      <ul className="space-y-1 text-sm">
                        <li>• HTTPS encryption</li>
                        <li>• Role-based access controls</li>
                        <li>• Regular security audits</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-foreground text-sm">Cookies</p>
                      <ul className="space-y-1 text-sm">
                        <li>• Essential session cookies only</li>
                        <li>• HTTP-only and secure</li>
                        <li>• 7-day expiration</li>
                      </ul>
                    </div>
                  </div>
                </Section>

                <Separator />

                <Section icon={Shield} title="Your Rights">
                  <div className="space-y-4">
                    <InfoCard
                      title="All Users Can"
                      items={[
                        "Access and download your personal data",
                        "Correct inaccurate information",
                        "Request deletion of your data",
                        "Opt out of non-essential communications",
                        "Export your data in portable format"
                      ]}
                    />

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg border">
                        <p className="font-medium mb-2">California Residents (CCPA)</p>
                        <p className="text-sm text-muted-foreground">
                          Right to know, delete, and opt-out. We do not sell personal information.
                        </p>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <p className="font-medium mb-2">EU Residents (GDPR)</p>
                        <p className="text-sm text-muted-foreground">
                          Rights to access, rectification, erasure, portability, and objection.
                        </p>
                      </div>
                    </div>
                  </div>
                </Section>

                <Separator />

                <div className="bg-primary/5 rounded-lg p-6 text-center space-y-3">
                  <p className="font-medium">Questions about your privacy?</p>
                  <Button onClick={() => setContactModalOpen(true)} variant="outline" className="gap-2">
                    <Mail className="h-4 w-4" />
                    Contact Us
                  </Button>
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* Terms of Service */}
          <TabsContent value="terms">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <FileText className="h-6 w-6 text-primary" />
                  Terms of Service
                </CardTitle>
                <p className="text-muted-foreground mt-2">
                  By using {companyName}, you agree to these terms. Please read them carefully.
                </p>
              </CardHeader>
              <CardContent className="space-y-8">

                <Section icon={FileText} title="Our Services">
                  <p>
                    {companyName} provides a software platform for property owner associations (POAs)
                    and homeowner associations (HOAs) to manage their communities.
                  </p>

                  <div className="grid sm:grid-cols-3 gap-3 mt-4">
                    {[
                      "Architectural reviews",
                      "Event management",
                      "Compliance tracking",
                      "Member directories",
                      "Document storage",
                      "AI-powered analysis"
                    ].map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/30 text-sm">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </Section>

                <Separator />

                <Section icon={Shield} title="Your Account">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border space-y-2">
                      <p className="font-medium text-foreground">You Agree To</p>
                      <ul className="space-y-1 text-sm">
                        <li>• Provide accurate information</li>
                        <li>• Keep credentials confidential</li>
                        <li>• Notify us of unauthorized access</li>
                      </ul>
                    </div>
                    <div className="p-4 rounded-lg border space-y-2">
                      <p className="font-medium text-foreground">Prohibited Actions</p>
                      <ul className="space-y-1 text-sm">
                        <li>• Unlawful use of services</li>
                        <li>• Uploading malicious content</li>
                        <li>• Impersonating others</li>
                      </ul>
                    </div>
                  </div>
                </Section>

                <Separator />

                <Section icon={CreditCard} title="Billing & Subscriptions">
                  <div className="space-y-4">
                    <div className="bg-muted/30 rounded-lg p-4">
                      <div className="grid sm:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-foreground">Payment</p>
                          <p className="text-muted-foreground">Processed securely via Stripe</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Billing Cycle</p>
                          <p className="text-muted-foreground">Monthly or annual options</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Renewal</p>
                          <p className="text-muted-foreground">Automatic unless cancelled</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
                      <p className="text-sm">
                        <span className="font-medium">AI Credits:</span> Each plan includes monthly AI analysis credits.
                        Additional usage is billed at $1.25–$2.00 per analysis.
                      </p>
                    </div>
                  </div>
                </Section>

                <Separator />

                <Section icon={Bot} title="AI Features Disclaimer">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                      <div className="space-y-2 text-sm">
                        <p className="font-medium text-foreground">Important Notice</p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• AI analyses are for <strong>informational purposes only</strong></li>
                          <li>• Results do not constitute legal, architectural, or professional advice</li>
                          <li>• AI-generated visualizations are approximations</li>
                          <li>• Always verify property research data independently</li>
                          <li>• Consult qualified professionals for important decisions</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </Section>

                <Separator />

                <Section icon={FileText} title="Intellectual Property">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/30">
                      <p className="font-medium text-foreground mb-2">Our Property</p>
                      <p className="text-sm">
                        The platform, software, design, and branding are owned by {companyName}
                        and protected by intellectual property laws.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/30">
                      <p className="font-medium text-foreground mb-2">Your Content</p>
                      <p className="text-sm">
                        You retain ownership of content you upload. You grant us license to store
                        and process it to provide our services.
                      </p>
                    </div>
                  </div>
                </Section>

                <Separator />

                <Section icon={AlertCircle} title="Liability & Disputes">
                  <div className="space-y-3 text-sm">
                    <p>
                      Services are provided "as is" without warranties. Our liability is limited to
                      fees paid in the 12 months preceding any claim.
                    </p>
                    <p>
                      Disputes are resolved through binding arbitration under American Arbitration
                      Association rules. Terms are governed by Delaware law.
                    </p>
                  </div>
                </Section>

                <Separator />

                <Section icon={Clock} title="Termination">
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div className="p-4 rounded-lg border">
                      <p className="font-medium text-foreground mb-2">By You</p>
                      <p className="text-muted-foreground">
                        Cancel anytime through account settings. Request data export before termination.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border">
                      <p className="font-medium text-foreground mb-2">By Us</p>
                      <p className="text-muted-foreground">
                        We may suspend accounts for Terms violations with reasonable notice.
                      </p>
                    </div>
                  </div>
                </Section>

                <Separator />

                <div className="bg-primary/5 rounded-lg p-6 text-center space-y-3">
                  <p className="font-medium">Questions about these terms?</p>
                  <Button onClick={() => setContactModalOpen(true)} variant="outline" className="gap-2">
                    <Mail className="h-4 w-4" />
                    Contact Us
                  </Button>
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Retention Policy */}
          <TabsContent value="data-retention">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <Database className="h-6 w-6 text-primary" />
                  Data Retention Policy
                </CardTitle>
                <p className="text-muted-foreground mt-2">
                  How long we keep your data and our practices for deletion and archival.
                </p>
              </CardHeader>
              <CardContent className="space-y-8">

                <Section icon={Clock} title="Retention Periods">
                  <DataTable rows={[
                    { type: "Active Account", period: "While subscribed", reason: "Service delivery" },
                    { type: "Inactive Account", period: "90 days", reason: "Recovery period" },
                    { type: "Demo Account", period: "30 days", reason: "Evaluation period" },
                    { type: "Applications", period: "7 years", reason: "Legal compliance" },
                    { type: "Financial Records", period: "7 years", reason: "Tax requirements" },
                    { type: "Signatures", period: "7 years", reason: "Legal validity" },
                    { type: "Session Data", period: "7 days", reason: "Authentication" },
                    { type: "Audit Logs", period: "2 years", reason: "Security" },
                    { type: "Documents", period: "Subscription + 90 days", reason: "Service delivery" },
                  ]} />
                </Section>

                <Separator />

                <Section icon={Archive} title="After Subscription Ends">
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-3 gap-4">
                      {[
                        { step: "1", title: "Grace Period", desc: "90 days to reactivate or export" },
                        { step: "2", title: "Data Export", desc: "Download your data anytime" },
                        { step: "3", title: "Deletion", desc: "Non-essential data removed" }
                      ].map((item, i) => (
                        <div key={i} className="p-4 rounded-lg border text-center">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center mx-auto mb-2">
                            {item.step}
                          </div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.desc}</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-muted/30 rounded-lg p-4 text-sm">
                      <p>
                        <span className="font-medium text-foreground">Note:</span> Some data may be retained
                        longer if required by law, regulation, or pending legal matters.
                      </p>
                    </div>
                  </div>
                </Section>

                <Separator />

                <Section icon={Trash2} title="Deletion Requests">
                  <div className="space-y-4">
                    <p>Request deletion of your personal data by contacting us. We process requests within 30 days.</p>

                    <div className="p-4 rounded-lg border">
                      <p className="font-medium text-foreground mb-3">Deletion may be limited by:</p>
                      <div className="grid sm:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Legal requirements</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Active contracts</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Business obligations</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>

                <Separator />

                <Section icon={Server} title="Backups">
                  <div className="grid sm:grid-cols-3 gap-4 text-center">
                    {[
                      { type: "Daily", period: "30 days" },
                      { type: "Weekly", period: "90 days" },
                      { type: "Monthly", period: "1 year" }
                    ].map((backup, i) => (
                      <div key={i} className="p-4 rounded-lg bg-muted/30">
                        <p className="font-medium text-foreground">{backup.type} Backups</p>
                        <p className="text-2xl font-bold text-primary mt-1">{backup.period}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm mt-4">
                    Deleted data may persist in backups until the retention period expires.
                  </p>
                </Section>

                <Separator />

                <div className="bg-primary/5 rounded-lg p-6 text-center space-y-3">
                  <p className="font-medium">Request data deletion or export</p>
                  <Button onClick={() => setContactModalOpen(true)} variant="outline" className="gap-2">
                    <Mail className="h-4 w-4" />
                    Contact Us
                  </Button>
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* SMS Policy */}
          <TabsContent value="sms">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <MessageSquare className="h-6 w-6 text-primary" />
                  SMS Policy
                </CardTitle>
                <p className="text-muted-foreground mt-2">
                  How we use text messaging to communicate with you and your rights regarding SMS.
                </p>
              </CardHeader>
              <CardContent className="space-y-8">

                <Section icon={Bell} title="Message Types">
                  <p>By opting in, you may receive text messages for:</p>

                  <div className="grid sm:grid-cols-2 gap-3 mt-4">
                    {[
                      { icon: Lock, title: "Security Alerts", desc: "Login codes, account security" },
                      { icon: FileText, title: "Application Updates", desc: "Status changes, approvals" },
                      { icon: Clock, title: "Meeting Reminders", desc: "Upcoming events, RSVPs" },
                      { icon: AlertCircle, title: "Compliance Alerts", desc: "Deadline notifications" }
                    ].map((type, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <type.icon className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium text-foreground">{type.title}</p>
                          <p className="text-sm text-muted-foreground">{type.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                <Separator />

                <Section icon={CheckCircle} title="Opting In">
                  <div className="space-y-4">
                    <InfoCard
                      items={[
                        "Enable SMS in your profile settings",
                        "Provide phone number during registration",
                        "Respond to an opt-in prompt"
                      ]}
                    />

                    <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        SMS consent is never required to use our services or make purchases.
                      </p>
                    </div>
                  </div>
                </Section>

                <Separator />

                <Section icon={MessageSquare} title="Message Frequency">
                  <div className="bg-muted/30 rounded-lg p-6 text-center">
                    <p className="text-3xl font-bold text-primary">0–20</p>
                    <p className="text-muted-foreground">messages per month (estimated)</p>
                    <p className="text-sm mt-2">Frequency varies based on your activity and preferences</p>
                  </div>
                </Section>

                <Separator />

                <Section icon={Phone} title="Opt Out & Help">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-6 rounded-lg border text-center">
                      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
                        <span className="font-bold text-red-600 dark:text-red-400">STOP</span>
                      </div>
                      <p className="font-medium">To Unsubscribe</p>
                      <p className="text-sm text-muted-foreground">Reply STOP to any message</p>
                    </div>
                    <div className="p-6 rounded-lg border text-center">
                      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-3">
                        <span className="font-bold text-blue-600 dark:text-blue-400">HELP</span>
                      </div>
                      <p className="font-medium">For Assistance</p>
                      <p className="text-sm text-muted-foreground">Reply HELP to any message</p>
                    </div>
                  </div>
                </Section>

                <Separator />

                <Section icon={CreditCard} title="Rates & Carriers">
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
                      <p className="text-sm">
                        <span className="font-medium">Message and data rates may apply.</span> Standard carrier
                        rates apply based on your mobile plan. {companyName} does not charge for SMS.
                      </p>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      <p className="mb-2">Compatible with major carriers including:</p>
                      <div className="flex flex-wrap gap-2">
                        {["AT&T", "Verizon", "T-Mobile", "Sprint", "US Cellular"].map((carrier, i) => (
                          <span key={i} className="px-3 py-1 rounded-full bg-muted">{carrier}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Section>

                <Separator />

                <Section icon={Shield} title="Privacy & Compliance">
                  <div className="space-y-3 text-sm">
                    <InfoCard
                      title="We Never"
                      items={[
                        "Sell your phone number to third parties",
                        "Share your number for marketing",
                        "Send promotional messages without consent"
                      ]}
                    />

                    <p className="text-muted-foreground mt-4">
                      We comply with the Telephone Consumer Protection Act (TCPA) and maintain records
                      of all consent and opt-out requests.
                    </p>
                  </div>
                </Section>

                <Separator />

                <div className="bg-primary/5 rounded-lg p-6 text-center space-y-3">
                  <p className="font-medium">Questions about SMS?</p>
                  <Button onClick={() => setContactModalOpen(true)} variant="outline" className="gap-2">
                    <Mail className="h-4 w-4" />
                    Contact Us
                  </Button>
                </div>

              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
              &copy; {currentYear} {companyName}. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
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
