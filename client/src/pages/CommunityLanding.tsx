import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
  ArrowRight,
  Calendar,
  CalendarPlus,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  User
} from "lucide-react";
import { format } from "date-fns";
import logoImage from "@assets/generated_images/abstract_geometric_building_logo_concept.png";
import defaultHeroImage from "@assets/generated_images/modern_suburban_homes_with_green_lawns_and_blue_sky.png";

interface PublicCommunityInfo {
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    heroImageUrl: string | null;
    designGuidelinesUrl: string | null;
    communitySettings: {
      description?: string;
      legalEntityType?: 'poa' | 'hoa';
      legalEntityName?: string;
      contactEmail?: string;
      contactPhone?: string;
      officeHours?: string;
      emergencyPhone?: string;
      physicalAddress?: {
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
      };
      website?: string;
    } | null;
  };
  nextEvent: {
    id: string;
    title: string;
    startDatetime: string;
    endDatetime: string;
    location: string | null;
    meetingUrl: string | null;
    eventType: {
      name: string;
      slug: string;
    } | null;
  } | null;
}

interface CommunityLandingProps {
  subdomain: string;
}

export default function CommunityLanding({ subdomain }: CommunityLandingProps) {
  const { data, isLoading, error } = useQuery<PublicCommunityInfo>({
    queryKey: ['publicCommunityInfo', subdomain],
    queryFn: async () => {
      const response = await fetch(`/api/public/${subdomain}/info`);
      if (!response.ok) {
        throw new Error('Community not found');
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading community info...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <h1 className="text-2xl font-bold text-foreground mb-4">Community Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The community you're looking for doesn't exist or is unavailable.
        </p>
        <Button asChild>
          <Link href="/">
            Go to Main Site
          </Link>
        </Button>
      </div>
    );
  }

  const { tenant, nextEvent } = data;
  const settings = tenant.communitySettings || {};
  const heroImage = tenant.heroImageUrl || defaultHeroImage;
  const entityType = settings.legalEntityType === 'hoa' ? 'HOA' : 'POA';

  // Format address
  const address = settings.physicalAddress;
  const formattedAddress = address
    ? [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ')
    : null;

  // Generate Google Calendar URL for the event
  const getGoogleCalendarUrl = (event: typeof nextEvent) => {
    if (!event) return null;
    const startDate = new Date(event.startDatetime);
    const endDate = new Date(event.endDatetime);
    const formatForGoogle = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${formatForGoogle(startDate)}/${formatForGoogle(endDate)}`,
      details: `${tenant.name} event`,
      location: event.location || '',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Navigation */}
      <nav className="border-b sticky top-0 bg-background/80 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="Logo" className="h-8 w-8 rounded" />
            <span className="text-xl font-bold text-primary font-heading">{tenant.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild>
              <Link href="/apply">
                Submit Request
              </Link>
            </Button>
            <Button onClick={() => window.location.href = '/api/login'}>
              Sign In <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative">
        <div className="relative h-[400px] overflow-hidden">
          <img
            src={heroImage}
            alt={tenant.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                Welcome to {tenant.name}
              </h1>
              {settings.description && (
                <p className="text-xl text-muted-foreground max-w-2xl">
                  {settings.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Next Meeting Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Next Meeting
                </CardTitle>
                <CardDescription>
                  Upcoming community event
                </CardDescription>
              </CardHeader>
              <CardContent>
                {nextEvent ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">{nextEvent.title}</h3>
                      {nextEvent.eventType && (
                        <span className="text-sm text-muted-foreground">
                          {nextEvent.eventType.name}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(nextEvent.startDatetime), 'EEEE, MMMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {format(new Date(nextEvent.startDatetime), 'h:mm a')}
                        {' - '}
                        {format(new Date(nextEvent.endDatetime), 'h:mm a')}
                      </div>
                      {nextEvent.location && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {nextEvent.location}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={getGoogleCalendarUrl(nextEvent) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <CalendarPlus className="h-4 w-4 mr-2" />
                          Add to Calendar
                        </a>
                      </Button>
                      {nextEvent.meetingUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={nextEvent.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Join Meeting
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No upcoming meetings scheduled at this time.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Contact Information Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Contact Information
                </CardTitle>
                <CardDescription>
                  Get in touch with {entityType} management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {settings.contactPhone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`tel:${settings.contactPhone}`}
                        className="text-foreground hover:text-primary transition-colors"
                      >
                        {settings.contactPhone}
                      </a>
                    </div>
                  )}

                  {settings.contactEmail && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`mailto:${settings.contactEmail}`}
                        className="text-foreground hover:text-primary transition-colors"
                      >
                        {settings.contactEmail}
                      </a>
                    </div>
                  )}

                  {settings.officeHours && (
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{settings.officeHours}</span>
                    </div>
                  )}

                  {formattedAddress && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>{formattedAddress}</span>
                    </div>
                  )}

                  {!settings.contactPhone && !settings.contactEmail && !formattedAddress && (
                    <p className="text-muted-foreground">
                      Contact information not available.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links Section */}
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
                <CardDescription>
                  Common actions and resources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <Button asChild>
                    <Link href="/apply">
                      <FileText className="h-4 w-4 mr-2" />
                      Submit a Request
                    </Link>
                  </Button>

                  {tenant.designGuidelinesUrl && (
                    <Button variant="outline" asChild>
                      <a
                        href={tenant.designGuidelinesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Guidelines
                      </a>
                    </Button>
                  )}

                  <Button variant="outline" onClick={() => window.location.href = '/api/login'}>
                    <User className="h-4 w-4 mr-2" />
                    Resident Portal
                  </Button>

                  {settings.website && (
                    <Button variant="outline" asChild>
                      <a
                        href={settings.website}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Community Website
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-secondary/50 border-t py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} {tenant.name}.
            {' '}Powered by{' '}
            <a
              href="/"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              POA Association
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
