import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
  ArrowRight,
  Building2,
  Mail,
  MapPin,
  Phone,
  Users
} from "lucide-react";
import logoImage from "@assets/generated_images/abstract_geometric_building_logo_concept.png";

interface PublicManagementInfo {
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    heroImageUrl: string | null;
    communitySettings: {
      description?: string;
      contactEmail?: string;
      contactPhone?: string;
      officeHours?: string;
      physicalAddress?: {
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
      };
      website?: string;
    } | null;
  };
  managedCommunities: Array<{
    id: string;
    name: string;
    subdomain: string;
  }>;
}

interface ManagementLandingProps {
  subdomain: string;
}

export default function ManagementLanding({ subdomain }: ManagementLandingProps) {
  const { data, isLoading, error } = useQuery<PublicManagementInfo>({
    queryKey: ['public-management-info', subdomain],
    queryFn: async () => {
      const response = await fetch(`/api/public/management/${subdomain}/info`);
      if (!response.ok) {
        throw new Error('Management company not found');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Management Company Not Found</CardTitle>
            <CardDescription>
              The management company "{subdomain}" could not be found.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button>Return to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { tenant, managedCommunities } = data;
  const settings = tenant.communitySettings || {};

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt={tenant.name} className="h-10 w-10 rounded-lg" />
            <div>
              <h1 className="font-semibold text-lg">{tenant.name}</h1>
              <p className="text-xs text-muted-foreground">Property Management</p>
            </div>
          </div>
          <Button onClick={() => window.location.href = '/login'}>
            Sign In <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Building2 className="h-16 w-16 mx-auto mb-6 text-primary" />
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            Welcome to {tenant.name}
          </h2>
          {settings.description && (
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {settings.description}
            </p>
          )}
        </div>
      </section>

      {/* Managed Communities */}
      {managedCommunities.length > 0 && (
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4">
            <h3 className="text-2xl font-semibold text-center mb-8">
              Communities We Manage
            </h3>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {managedCommunities.map((community) => (
                <Card key={community.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      {community.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Link href={`/community/${community.subdomain}`}>
                      <Button variant="outline" className="w-full">
                        Visit Community Portal
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact Information */}
      <section className="py-16 bg-muted/50">
        <div className="max-w-4xl mx-auto px-4">
          <h3 className="text-2xl font-semibold text-center mb-8">
            Contact Us
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            {settings.contactEmail && (
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <Mail className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <a href={`mailto:${settings.contactEmail}`} className="font-medium hover:underline">
                      {settings.contactEmail}
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}
            {settings.contactPhone && (
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <Phone className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <a href={`tel:${settings.contactPhone}`} className="font-medium hover:underline">
                      {settings.contactPhone}
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}
            {settings.physicalAddress && (
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <MapPin className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">
                      {settings.physicalAddress.street}<br />
                      {settings.physicalAddress.city}, {settings.physicalAddress.state} {settings.physicalAddress.zip}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            {settings.officeHours && (
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <Building2 className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Office Hours</p>
                    <p className="font-medium">{settings.officeHours}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            Powered by{" "}
            <a
              href="/"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              POAssociation
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
