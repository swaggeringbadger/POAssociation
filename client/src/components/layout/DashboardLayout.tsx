import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { NAV_ITEMS } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { useUserTenants } from "@/hooks/useUserTenants";
import { api } from "@/lib/api";
import { ChevronDown, User as UserIcon, Building, LogOut, Globe, Shield, Ticket } from "lucide-react";
import logoImage from "@assets/generated_images/abstract_geometric_building_logo_concept.png";
import type { User } from "@shared/schema";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { currentTenant, currentUserRole, availableTenants, setCurrentTenant } = useAppStore();
  const { user: authUser } = useAuth();
  const user = authUser as User | undefined;
  const { isLoading: tenantsLoading } = useUserTenants();

  // Check if user is super admin
  const { data: superAdminData } = useQuery({
    queryKey: ['/api/auth/is-super-admin'],
    queryFn: () => api.isSuperAdmin(),
    enabled: !!user,
  });

  const isSuperAdmin = superAdminData?.isSuperAdmin ?? false;

  // Get initials for avatar fallback
  const getInitials = () => {
    if (!user) return "U";
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.email || "User";

  // Format role display name
  const formatRole = (role: string) => {
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Show loading state while tenants are loading
  if (tenantsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show message if no tenants available
  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md p-8">
          <h2 className="text-2xl font-bold mb-4">No Communities Assigned</h2>
          <p className="text-muted-foreground mb-4">
            You don't have access to any communities yet. Please contact your administrator to get access.
          </p>
          <Button onClick={() => window.location.href = '/api/logout'}>
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        {/* Sidebar */}
        <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="h-16 flex items-center px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2 font-bold text-lg text-sidebar-primary-foreground">
              <img src={logoImage} className="w-8 h-8 rounded" alt="Logo" />
              <span>POA Association</span>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="px-2 py-4">
            {/* Tenant Switcher - Only show if user has multiple tenants */}
            {availableTenants.length > 1 && currentTenant && (
              <div className="mb-6 px-2">
                <label className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider mb-2 block">
                  Current Community
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between bg-sidebar-accent/50 border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-left h-auto py-3">
                      <div className="flex flex-col items-start overflow-hidden">
                        <span className="font-medium truncate w-full">{currentTenant.name}</span>
                        <span className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {currentTenant.subdomain}.poassociation.com
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64" align="start">
                    <DropdownMenuLabel>Switch Community</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableTenants.map(t => (
                      <DropdownMenuItem key={t.id} onClick={() => setCurrentTenant(t)}>
                        <Building className="mr-2 h-4 w-4" />
                        <div className="flex flex-col">
                          <span>{t.name}</span>
                          <span className="text-xs text-muted-foreground">{t.subdomain}.poassociation.com</span>
                        </div>
                        {currentTenant.id === t.id && <Badge variant="secondary" className="ml-auto text-[10px]">Active</Badge>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Navigation */}
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    >
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Admin Section - Only visible to super admins */}
            {isSuperAdmin && (
              <>
                <Separator className="my-4" />
                <div className="px-2 mb-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider">
                    <Shield className="h-3 w-3" />
                    <span>Admin</span>
                  </div>
                </div>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.startsWith('/admin/demo-codes')}
                      className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    >
                      <Link href="/admin/demo-codes">
                        <Ticket className="h-5 w-5" />
                        <span>Demo Codes</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 h-auto p-2 hover:bg-sidebar-accent">
                  <Avatar className="h-9 w-9 border border-sidebar-border">
                    <AvatarImage src={user?.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col overflow-hidden text-left flex-1">
                    <span className="text-sm font-medium truncate">{displayName}</span>
                    <span className="text-xs text-sidebar-foreground/60 truncate">
                      {currentUserRole ? formatRole(currentUserRole) : 'Loading...'}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserIcon className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => window.location.href = '/api/logout'}
                  data-testid="button-logout"
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {location === '/dashboard' ? 'Dashboard' : 
                 location.substring(1).charAt(0).toUpperCase() + location.substring(2)}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                <Globe className="h-3 w-3 mr-1" />
                Context: <span className="font-medium ml-1 text-foreground">{currentTenant.name}</span>
              </div>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <UserIcon className="h-5 w-5" />
              </Button>
            </div>
          </header>
          
          <div className="flex-1 overflow-auto p-6 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
