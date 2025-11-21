import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

export interface Tenant {
  id: string;
  name: string;
  type: "management_company" | "community";
  subdomain: string;
  managementCompanyId: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface FormTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  schema: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  tenantId: string;
  formTemplateId: string;
  submittedByUserId: string;
  formData: any;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewNotes: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  createdAt: string;
}

class ApiClient {
  private baseUrl = "/api";

  async getTenants(): Promise<Tenant[]> {
    const response = await fetch(`${this.baseUrl}/tenants`);
    if (!response.ok) throw new Error("Failed to fetch tenants");
    return response.json();
  }

  async getTenantBySubdomain(subdomain: string): Promise<Tenant> {
    const response = await fetch(`${this.baseUrl}/tenants/subdomain/${subdomain}`);
    if (!response.ok) throw new Error("Failed to fetch tenant");
    return response.json();
  }

  async getFormTemplatesForTenant(tenantId: string): Promise<FormTemplate[]> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/forms`);
    if (!response.ok) throw new Error("Failed to fetch form templates");
    return response.json();
  }

  async getFormTemplate(id: string): Promise<FormTemplate> {
    const response = await fetch(`${this.baseUrl}/forms/${id}`);
    if (!response.ok) throw new Error("Failed to fetch form template");
    return response.json();
  }

  async submitApplication(application: {
    tenantId: string;
    formTemplateId: string;
    submittedByUserId: string;
    formData: any;
    status?: string;
  }): Promise<Application> {
    const response = await fetch(`${this.baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(application),
    });
    if (!response.ok) throw new Error("Failed to submit application");
    return response.json();
  }

  async getApplication(id: string): Promise<Application> {
    const response = await fetch(`${this.baseUrl}/applications/${id}`);
    if (!response.ok) throw new Error("Failed to fetch application");
    return response.json();
  }

  async getApplicationsForTenant(tenantId: string): Promise<Application[]> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/applications`);
    if (!response.ok) throw new Error("Failed to fetch applications");
    return response.json();
  }
}

export const api = new ApiClient();
