import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Building, Users, Activity, Shield, Search, FileText, Key } from "lucide-react";
import { HomeHubCard } from "@/components/HomeHubCard";

export function SuperAdminDashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-none">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8" />
            <div>
              <CardTitle className="text-2xl">Super Admin Dashboard</CardTitle>
              <CardDescription className="text-amber-100">
                System-wide administration tools
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/management-companies">
          <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
            <CardHeader className="flex flex-row items-center gap-4">
              <Building className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-lg">Management Companies</CardTitle>
                <CardDescription>View and manage companies</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/communities">
          <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
            <CardHeader className="flex flex-row items-center gap-4">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-lg">Communities</CardTitle>
                <CardDescription>View and manage communities</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/ai-activity">
          <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
            <CardHeader className="flex flex-row items-center gap-4">
              <Activity className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-lg">AI Activity</CardTitle>
                <CardDescription>Monitor AI usage</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/demo-codes">
          <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
            <CardHeader className="flex flex-row items-center gap-4">
              <Key className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-lg">Demo Codes</CardTitle>
                <CardDescription>Manage demo access</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Additional Admin Tools */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/form-builder">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center gap-4">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-lg">Form Builder</CardTitle>
                <CardDescription>Create and manage application forms</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Bottom section with community selector and Hazel Hippo */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Community Selector Prompt */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              View as Community Member
            </CardTitle>
            <CardDescription>
              Select a community to view the dashboard from a member's perspective
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Use the community selector in the header to switch context, or browse communities in the admin section.
            </p>
            <div className="flex gap-2">
              <Link href="/admin/communities">
                <Button variant="outline">Browse Communities</Button>
              </Link>
              <Link href="/join">
                <Button variant="outline">Join a Community</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Hazel Hippo - available for super admins */}
        <HomeHubCard />
      </div>
    </div>
  );
}
