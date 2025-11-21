import { useState } from "react";
import { Link, useLocation } from "wouter";
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
import { NAV_ITEMS, MOCK_USER, TENANTS, Role } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store";
import { ChevronDown, User as UserIcon, Building, LogOut, Globe } from "lucide-react";
import logoImage from "@assets/generated_images/abstract_geometric_building_logo_concept.png";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { currentTenant, currentUserRole, setCurrentTenant, setCurrentUserRole } = useAppStore();

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        {/* Sidebar */}
        <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="h-16 flex items-center px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2 font-bold text-lg text-sidebar-primary-foreground">
              <img src={logoImage} className="w-8 h-8 rounded" alt="Logo" />
              <span>CivicFlow</span>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="px-2 py-4">
            {/* Tenant Switcher Mockup */}
            <div className="mb-6 px-2">
              <label className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider mb-2 block">
                Current Portal (Simulated)
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between bg-sidebar-accent/50 border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-left h-auto py-3">
                    <div className="flex flex-col items-start overflow-hidden">
                      <span className="font-medium truncate w-full">{currentTenant.name}</span>
                      <span className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {currentTenant.subdomain}.civicflow.com
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="start">
                  <DropdownMenuLabel>Switch Subdomain Context</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {TENANTS.map(t => (
                    <DropdownMenuItem key={t.id} onClick={() => setCurrentTenant(t)}>
                      <Building className="mr-2 h-4 w-4" />
                      <div className="flex flex-col">
                        <span>{t.name}</span>
                        <span className="text-xs text-muted-foreground">{t.subdomain}.civicflow.com</span>
                      </div>
                      {currentTenant.id === t.id && <Badge variant="secondary" className="ml-auto text-[10px]">Active</Badge>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

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
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-4">
             {/* Role Switcher for Demo */}
             <div className="mb-4 p-2 bg-sidebar-accent/20 rounded-md border border-dashed border-sidebar-border">
                <label className="text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-wider block mb-1">
                  Demo: Current Role
                </label>
                <select 
                  className="w-full bg-transparent text-xs text-sidebar-foreground border-none p-0 focus:ring-0 cursor-pointer"
                  value={currentUserRole}
                  onChange={(e) => setCurrentUserRole(e.target.value as Role)}
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="account_admin">Account Admin</option>
                  <option value="management_manager">Mgmt Manager</option>
                  <option value="poa_board_member">Board Member</option>
                  <option value="homeowner">Homeowner</option>
                </select>
             </div>

            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border border-sidebar-border">
                <AvatarImage src={MOCK_USER.avatarUrl} />
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">JD</AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">{MOCK_USER.name}</span>
                <span className="text-xs text-sidebar-foreground/60 truncate">
                  {currentUserRole.replace('_', ' ')}
                </span>
              </div>
            </div>
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
