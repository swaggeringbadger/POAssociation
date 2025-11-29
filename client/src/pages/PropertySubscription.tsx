import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import SubscriptionManagement from "@/components/SubscriptionManagement";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PropertySubscription() {
  const { setCurrentPageTitle } = useAppStore();
  const [, params] = useRoute("/properties/:propertyId/subscription");
  const propertyId = params?.propertyId;

  // Fetch property details
  const { data: property } = useQuery({
    queryKey: ['tenant', propertyId],
    queryFn: async () => {
      if (!propertyId) throw new Error('No property ID');
      const properties = await api.getManagedProperties();
      return properties.find((p: any) => p.id === propertyId);
    },
    enabled: !!propertyId,
  });

  // Temporarily set this property as the current tenant for the subscription component
  const { currentTenant, setCurrentTenant } = useAppStore();
  const [originalTenant] = useState(currentTenant);

  useEffect(() => {
    if (property) {
      setCurrentTenant(property);
      setCurrentPageTitle(`Subscription Settings - ${property.name}`);
    }

    // Restore original tenant when unmounting
    return () => {
      if (originalTenant) {
        setCurrentTenant(originalTenant);
      }
      setCurrentPageTitle(null);
    };
  }, [property, setCurrentPageTitle, setCurrentTenant, originalTenant]);

  if (!property) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground">Loading property details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.href = "/properties"}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Properties
        </Button>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Subscription & Feature Settings
          </h1>
          <p className="text-muted-foreground">
            Manage subscription and feature settings for {property.name}
          </p>
        </div>
      </div>

      <SubscriptionManagement />
    </div>
  );
}
