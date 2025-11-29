/**
 * PropertyActionsCard - Quick action buttons for property management
 *
 * Actions:
 * - Manage Subscription (primary)
 * - Manage Users
 * - Manage Forms
 * - View Applications
 * - Compliance Items
 */

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import {
  Settings,
  Users,
  FileText,
  FileCheck,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { Tenant } from "@/lib/api";

interface PropertyActionsCardProps {
  property: Tenant;
}

export function PropertyActionsCard({ property }: PropertyActionsCardProps) {
  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Primary Action */}
        <Button className="w-full justify-start" asChild>
          <Link href={`/properties/${property.id}/subscription`}>
            <Settings className="mr-2 h-4 w-4" />
            Manage Subscription
          </Link>
        </Button>

        {/* Secondary Actions */}
        <Button variant="outline" className="w-full justify-start" asChild>
          <Link href="/directory">
            <Users className="mr-2 h-4 w-4" />
            Manage Users
          </Link>
        </Button>

        <Button variant="outline" className="w-full justify-start" asChild>
          <Link href="/forms">
            <FileText className="mr-2 h-4 w-4" />
            Manage Forms
          </Link>
        </Button>

        <Separator className="my-2" />

        {/* Tertiary Actions */}
        <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
          <Link href="/applications">
            <FileCheck className="mr-2 h-4 w-4" />
            View Applications
          </Link>
        </Button>

        <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
          <Link href="/compliance">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Compliance Items
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
