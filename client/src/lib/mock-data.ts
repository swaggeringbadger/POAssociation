
import { Home, FileText, Settings, Users, LayoutDashboard, Building2, ShieldCheck } from "lucide-react";

// Types for our mockup
export type Role = 
  | 'super_admin'
  | 'account_admin'
  | 'management_rep'
  | 'management_manager'
  | 'poa_board_member'
  | 'poa_board_contributor'
  | 'homeowner'
  | 'delegated_rep';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  avatarUrl?: string;
}

export interface Tenant {
  id: string;
  name: string;
  type: 'management_company' | 'community';
  subdomain: string;
}

// Mock Data
export const MOCK_USER: User = {
  id: 'u1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  roles: ['account_admin', 'homeowner'], // Multi-role demonstration
};

export const TENANTS: Tenant[] = [
  { id: 't1', name: 'Apex Management Solutions', type: 'management_company', subdomain: 'apex' },
  { id: 't2', name: 'Whispering Pines HOA', type: 'community', subdomain: 'whispering-pines' },
  { id: 't3', name: 'Oak Ridge Estates', type: 'community', subdomain: 'oak-ridge' },
];

export const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Applications', icon: FileText, href: '/applications' },
  { label: 'Submit Request', icon: FileText, href: '/apply' },
  { label: 'Directory', icon: Users, href: '/directory' },
  { label: 'Properties', icon: Building2, href: '/properties' },
  { label: 'Compliance', icon: ShieldCheck, href: '/compliance' },
  { label: 'Form Wizard', icon: Settings, href: '/admin/form-builder' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

// Placeholder for the "Revolutionary Form Wizard" JSON structure
export const ARCH_REQUEST_FORM_SCHEMA = {
  title: "Architectural Modification Request",
  description: "Submit your plans for exterior modifications.",
  sections: [
    {
      id: "project_details",
      title: "Project Details",
      fields: [
        { id: "project_type", type: "select", label: "Project Type", options: ["Fence", "Painting", "Landscaping", "Addition", "Other"] },
        { id: "description", type: "textarea", label: "Detailed Description" },
        { id: "contractor", type: "text", label: "Contractor Name" }
      ]
    },
    {
      id: "documents",
      title: "Documentation",
      fields: [
        { id: "plat_map", type: "file", label: "Plat Map / Survey" },
        { id: "materials", type: "file", label: "Material Samples / Photos" }
      ]
    }
  ]
};
