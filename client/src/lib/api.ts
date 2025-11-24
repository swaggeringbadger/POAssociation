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

  async getManagedProperties(): Promise<Tenant[]> {
    const response = await fetch(`${this.baseUrl}/properties`);
    if (!response.ok) throw new Error("Failed to fetch managed properties");
    return response.json();
  }

  async getAllTenants(): Promise<Tenant[]> {
    const response = await fetch(`${this.baseUrl}/admin/tenants`);
    if (!response.ok) throw new Error("Failed to fetch all tenants");
    return response.json();
  }

  async createTenant(tenant: Partial<Tenant>): Promise<Tenant> {
    const response = await fetch(`${this.baseUrl}/tenants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tenant),
    });
    if (!response.ok) throw new Error("Failed to create tenant");
    return response.json();
  }

  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant> {
    const response = await fetch(`${this.baseUrl}/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error("Failed to update tenant");
    return response.json();
  }

  async deleteTenant(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/tenants/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete tenant");
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

  async getUserTenants(userId: string): Promise<Array<{
    id: string;
    userId: string;
    tenantId: string;
    role: string;
    createdAt: string;
    tenant: Tenant;
  }>> {
    const response = await fetch(`${this.baseUrl}/users/${userId}/tenants`);
    if (!response.ok) throw new Error("Failed to fetch user tenants");
    return response.json();
  }

  // Demo endpoints
  async validateDemoCode(code: string): Promise<{
    valid: boolean;
    codeId?: string;
    label?: string;
    personas?: Array<{ id: string; firstName: string; lastName: string; email: string }>;
    message?: string;
  }> {
    const response = await fetch(`${this.baseUrl}/demo/validate-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) throw new Error("Failed to validate demo code");
    return response.json();
  }

  async loginAsDemo(userId: string): Promise<{
    success: boolean;
    user: any;
    sessionId: string;
  }> {
    const response = await fetch(`${this.baseUrl}/demo/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) throw new Error("Failed to login as demo user");
    return response.json();
  }

  // Admin demo code management
  async listDemoCodes(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/admin/demo-codes`);
    if (!response.ok) throw new Error("Failed to list demo codes");
    return response.json();
  }

  async createDemoCode(data: {
    code: string;
    label: string;
    validFrom: string;
    validUntil: string;
    maxUses?: number;
    isActive?: boolean;
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/admin/demo-codes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create demo code");
    return response.json();
  }

  async updateDemoCode(id: string, data: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/admin/demo-codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update demo code");
    return response.json();
  }

  async deleteDemoCode(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/admin/demo-codes/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete demo code");
    return response.json();
  }

  async getDemoCodeStats(id: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/admin/demo-codes/${id}/stats`);
    if (!response.ok) throw new Error("Failed to get demo code stats");
    return response.json();
  }

  // User Management / Directory
  async getTenantUsers(tenantId: string): Promise<(User & { roles: string[] })[]> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/users`);
    if (!response.ok) throw new Error("Failed to fetch tenant users");
    return response.json();
  }

  async inviteUser(data: {
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  }): Promise<{ user: User; roleAssignments: any[] }> {
    const response = await fetch(`${this.baseUrl}/tenants/${data.tenantId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        roles: data.roles,
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to invite user");
    }
    return response.json();
  }

  async assignUserRole(userId: string, tenantId: string, role: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/users/${userId}/roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, role }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to assign role");
    }
    return response.json();
  }

  async removeUserRole(userId: string, tenantId: string, role: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/users/${userId}/roles/${role}?tenantId=${tenantId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to remove role");
    return response.json();
  }

  async removeUserFromTenant(tenantId: string, userId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/users/${userId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to remove user");
    return response.json();
  }

  // Auth helpers
  async isSuperAdmin(): Promise<{ isSuperAdmin: boolean }> {
    const response = await fetch(`${this.baseUrl}/auth/is-super-admin`);
    if (!response.ok) return { isSuperAdmin: false };
    return response.json();
  }

  async logout(): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/auth/logout`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to logout");
    return response.json();
  }
}

export const api = new ApiClient();
