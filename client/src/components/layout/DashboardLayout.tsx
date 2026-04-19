import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TourProvider, TourModal, FloatingHelpButton } from "@/components/tour";
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
import { NAV_ITEMS, SUPER_ADMIN_NAV_ITEMS, CONTRACTOR_NAV_ITEMS } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { useUserTenants } from "@/hooks/useUserTenants";
import { useSubdomain } from "@/hooks/useSubdomain";
import { useFormatRoleLabel } from "@/hooks/useLegalEntityLabel";
import { api, queryClient } from "@/lib/api";
import { ChevronDown, User as UserIcon, Building, LogOut, Globe, Shield, Ticket, Filter, Settings, Users, Wrench } from "lucide-react";
import logoImage from "@assets/generated_images/POAssociationLogo.png";
import ManagementSettingsModal from "@/components/ManagementSettingsModal";
import type { User } from "@shared/schema";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { currentTenant, currentUserRole, availableTenants, availableRolesForCurrentTenant, selectedPropertyFilter, currentPageTitle, setCurrentTenant, setCurrentUserRole, setSelectedPropertyFilter, clearState } = useAppStore();
  const { user: authUser } = useAuth();
  const user = authUser as User | undefined;
  const { isLoading: tenantsLoading } = useUserTenants();
  const { subdomain, isSubdomainMode } = useSubdomain();
  const [showCompanySettings, setShowCompanySettings] = useState(false);

  // Check if user is a management manager viewing a management company
  const isManagementManager = currentUserRole === 'management_manager' || currentUserRole === 'account_admin';
  const managementCompanyId = currentTenant?.type === 'management_company' ? currentTenant.id : currentTenant?.managementCompanyId;

  // Fetch managed properties for property filter (management company users only)
  const { data: managedProperties = [] } = useQuery({
    queryKey: ["managedProperties"],
    queryFn: () => api.getManagedProperties(),
    enabled: !!user && (currentUserRole === 'management_manager' || currentUserRole === 'management_rep' || currentUserRole === 'account_admin'),
  });

  // Handle logout - clear all state before redirecting
  const handleLogout = async () => {
    try {
      // Clear Zustand store and localStorage
      clearState();
      // Clear React Query cache
      queryClient.clear();
      // Clear saved demo code
      localStorage.removeItem('poa-demo-code');
      // Destroy session on backend
      await api.logout();
      // Redirect to landing page with logout flag to prevent redirect loop
      window.location.href = '/?logout=true';
    } catch (error) {
      console.error('Logout error:', error);
      // Even if API call fails, still clear frontend state and redirect
      localStorage.removeItem('poa-demo-code');
      window.location.href = '/?logout=true';
    }
  };

  // Check if user is super admin
  const { data: superAdminData } = useQuery({
    queryKey: ['/api/auth/is-super-admin'],
    queryFn: () => api.isSuperAdmin(),
    enabled: !!user,
  });

  const isSuperAdmin = superAdminData?.isSuperAdmin ?? false;

  // Check if user has a contractor profile (contractors don't need tenant assignments)
  const { data: contractorProfile, isLoading: contractorLoading } = useQuery({
    queryKey: ['myContractorProfile'],
    queryFn: () => api.getMyContractorProfile(),
    enabled: !!user,
  });

  const isContractor = !!contractorProfile;

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

  // Format role display name using central role label system (respects POA/HOA + ARC)
  const formatRole = useFormatRoleLabel();

  // Get role icon/emoji
  const getRoleIcon = (role: string) => {
    const icons: Record<string, string> = {
      'homeowner': '🏠',
      'poa_board_member': '👔',
      'poa_board_contributor': '📋',
      'management_manager': '🏢',
      'management_rep': '💼',
      'account_admin': '⚙️',
      'delegated_rep': '📝',
      'super_admin': '👑',
      'contractor': '🔧',
    };
    return icons[role] || '👤';
  };

  // Show loading state while tenants or contractor profile are loading
  if (tenantsLoading || contractorLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show message if no tenants available (but allow super admins and contractors through)
  if (!currentTenant && !isSuperAdmin && !isContractor) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md p-8">
          <h2 className="text-2xl font-bold mb-4">No Communities Assigned</h2>
          <p className="text-muted-foreground mb-4">
            You don't have access to any communities yet. You can search for and join your community, or contact your administrator for access.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button asChild>
              <a href="/join">Find & Join Community</a>
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Contractors without community assignments should be redirected to contractor dashboard
  // But don't redirect if already on a contractor route (prevents loop)
  const isOnContractorRoute = location.startsWith('/contractor');
  if (!currentTenant && isContractor && !isOnContractorRoute) {
    // Auto-redirect to contractor dashboard
    window.location.href = '/contractor';
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting to contractor dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <TourProvider>
      <SidebarProvider defaultOpen>
        <div className="flex min-h-screen w-full bg-background text-foreground">
        {/* Sidebar */}
        <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="flex-col gap-2 p-2 border-b border-sidebar-border">
            <div className="flex items-center gap-2 font-bold text-lg text-sidebar-primary-foreground">
              <img src={logoImage} className="w-8 h-8 rounded" alt="Logo" />
              <span>POAssociation.com</span>
            </div>

            {/* Property Filter - Only show for management company users */}
            {currentTenant?.type === 'management_company' && managedProperties.length > 0 && (
              <div className="w-full px-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between bg-sidebar-accent/30 border-sidebar-border hover:bg-sidebar-accent">
                      <span className="flex items-center gap-2 text-xs">
                        <Filter className="h-3 w-3" />
                        {selectedPropertyFilter
                          ? managedProperties.find(p => p.id === selectedPropertyFilter)?.name || 'All Properties'
                          : 'All Properties'
                        }
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Filter by Property</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSelectedPropertyFilter(null)}>
                      <span className={selectedPropertyFilter === null ? 'font-semibold' : ''}>
                        All Properties
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {managedProperties.filter(p => p.type === 'community').map(property => (
                      <DropdownMenuItem
                        key={property.id}
                        onClick={() => setSelectedPropertyFilter(property.id)}
                      >
                        <span className={selectedPropertyFilter === property.id ? 'font-semibold' : ''}>
                          {property.name}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </SidebarHeader>
          
          <SidebarContent className="px-2 py-4">
            {/* Tenant Switcher - Only show if user has multiple tenants AND not in subdomain mode */}
            {!isSubdomainMode && availableTenants.length > 1 && currentTenant && (
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
              {(currentUserRole === 'contractor' ? CONTRACTOR_NAV_ITEMS : NAV_ITEMS).filter(item =>
                // Filter menu items based on user's role
                currentUserRole && item.roles?.includes(currentUserRole)
              ).map((item) => {
                const isActive = location === item.href;
                
                // For Settings item, management managers should open Company Settings modal
                if (item.href === '/settings' && isManagementManager && managementCompanyId) {
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        onClick={() => setShowCompanySettings(true)}
                        className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer"
                        data-testid="nav-company-settings"
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
                
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

            {/* System Admin Section - Only visible to super admins */}
            {isSuperAdmin && (
              <>
                <Separator className="my-4" />
                <div className="px-2 mb-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider">
                    <Shield className="h-3 w-3" />
                    <span>System Admin</span>
                  </div>
                </div>
                <SidebarMenu>
                  {SUPER_ADMIN_NAV_ITEMS.map((item) => {
                    const isActive = location === item.href || location.startsWith(item.href);
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
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-4 space-y-3">
            {/* Role Switcher - Show if user has multiple roles OR has contractor profile */}
            {(availableRolesForCurrentTenant.length > 1 || isContractor) && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider px-2">
                  Active Role
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between bg-sidebar-accent/50 border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground h-auto py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{currentUserRole === 'contractor' ? '🔧' : getRoleIcon(currentUserRole)}</span>
                        <span className="text-sm font-medium">{currentUserRole === 'contractor' ? 'Contractor' : formatRole(currentUserRole)}</span>
                      </div>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64" align="start">
                    <DropdownMenuLabel>Switch Role Context</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableRolesForCurrentTenant.map(role => (
                      <DropdownMenuItem
                        key={role}
                        onClick={async () => {
                          // Update session on backend
                          try {
                            await fetch('/api/auth/switch-role', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ role }),
                            });
                          } catch (error) {
                            console.error('Failed to switch role on backend:', error);
                          }

                          // Update client-side store
                          setCurrentUserRole(role);
                          window.location.href = '/dashboard';
                        }}
                        className="cursor-pointer"
                      >
                        <span className="mr-2 text-base">{getRoleIcon(role)}</span>
                        <span>{formatRole(role)}</span>
                        {currentUserRole === role && (
                          <Badge variant="secondary" className="ml-auto text-[10px]">Active</Badge>
                        )}
                      </DropdownMenuItem>
                    ))}
                    {/* Contractor option - only show if user has contractor profile */}
                    {isContractor && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={async () => {
                            // Update session on backend
                            try {
                              await fetch('/api/auth/switch-role', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ role: 'contractor' }),
                              });
                            } catch (error) {
                              console.error('Failed to switch role on backend:', error);
                            }

                            // Update client-side store
                            setCurrentUserRole('contractor');
                            window.location.href = '/contractor';
                          }}
                          className="cursor-pointer"
                        >
                          <span className="mr-2 text-base">🔧</span>
                          <span>Contractor ({contractorProfile?.companyName || 'My Business'})</span>
                          {currentUserRole === 'contractor' && (
                            <Badge variant="secondary" className="ml-auto text-[10px]">Active</Badge>
                          )}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* User Profile Menu */}
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
                      {currentUserRole === 'contractor' ? (
                        contractorProfile?.companyName || 'Contractor'
                      ) : (availableRolesForCurrentTenant.length + (isContractor ? 1 : 0)) > 1 ? (
                        `${availableRolesForCurrentTenant.length + (isContractor ? 1 : 0)} roles`
                      ) : (
                        currentUserRole ? formatRole(currentUserRole) : 'Loading...'
                      )}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => window.location.href = "/profile"}
                  data-testid="button-profile-settings"
                >
                  <UserIcon className="mr-2 h-4 w-4" />
                  Profile Settings
                </DropdownMenuItem>
                {currentUserRole === 'homeowner' && (
                  <DropdownMenuItem
                    onClick={() => window.location.href = "/settings/household"}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Household Members
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => window.location.href = "/contractor/profile"}
                >
                  <Wrench className="mr-2 h-4 w-4" />
                  {isContractor ? 'Contractor Profile' : 'Become a Contractor'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
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
                {currentPageTitle ? currentPageTitle :
                 (() => {
                   // Extract the last meaningful segment of the path (ignore UUIDs)
                   const segments = location.substring(1).split('/').filter(Boolean);
                   const meaningful = segments.filter(s => !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s));
                   const last = meaningful[meaningful.length - 1] || segments[0] || 'Dashboard';
                   // Convert kebab-case to Title Case
                   return last.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                 })()}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                <Globe className="h-3 w-3 mr-1" />
                {isSubdomainMode ? (
                  <>
                    <span className="font-medium text-foreground">{subdomain}.poassociation.com</span>
                  </>
                ) : currentTenant ? (
                  <>
                    Context: <span className="font-medium ml-1 text-foreground">{currentTenant.name}</span>
                  </>
                ) : null}
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

      {/* Management Company Settings Modal */}
      {managementCompanyId && (
        <ManagementSettingsModal
          open={showCompanySettings}
          onOpenChange={setShowCompanySettings}
          managementCompanyId={managementCompanyId}
        />
      )}
      </SidebarProvider>

      {/* Tour System */}
      <TourModal />
      <FloatingHelpButton />
    </TourProvider>
  );
}
