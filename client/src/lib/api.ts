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
  designGuidelinesUrl?: string | null;
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

  async getFormTemplateVersions(tenantId: string, projectType: string): Promise<FormTemplate[]> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/forms/${projectType}/versions`);
    if (!response.ok) throw new Error("Failed to fetch form template versions");
    return response.json();
  }

  async activateFormTemplate(id: string): Promise<{ message: string; template: FormTemplate }> {
    const response = await fetch(`${this.baseUrl}/forms/${id}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error("Failed to activate form template");
    return response.json();
  }

  async deleteFormTemplate(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/forms/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete form template");
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

  // ============================================================
  // AI FORM GENERATION API METHODS
  // ============================================================

  async getDesignGuidelinesUrl(tenantId: string): Promise<{ designGuidelinesUrl: string | null }> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/design-guidelines`);
    if (!response.ok) throw new Error("Failed to fetch design guidelines URL");
    return response.json();
  }

  async updateDesignGuidelinesUrl(tenantId: string, designGuidelinesUrl: string): Promise<Tenant> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/design-guidelines`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designGuidelinesUrl }),
    });
    if (!response.ok) throw new Error("Failed to update design guidelines URL");
    return response.json();
  }

  async generateForm(tenantId: string, applicationType: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/ai/generate-form`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, applicationType }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Form generation failed" }));
      throw new Error(error.error || "Form generation failed");
    }
    return response.json();
  }

  async listAiGenerations(tenantId?: string): Promise<any[]> {
    const url = tenantId
      ? `${this.baseUrl}/admin/ai-generations?tenantId=${tenantId}`
      : `${this.baseUrl}/admin/ai-generations`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch AI generations");
    return response.json();
  }

  async getAiGeneration(id: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/admin/ai-generations/${id}`);
    if (!response.ok) throw new Error("Failed to fetch AI generation");
    return response.json();
  }

  async approveAiGeneration(id: string): Promise<{ message: string; formTemplateId: string }> {
    const response = await fetch(`${this.baseUrl}/admin/ai-generations/${id}/approve`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to approve AI generation");
    return response.json();
  }

  // QR Code Upload Token Methods
  async createDocumentUploadToken(
    applicationId: string,
    documentRequirementName: string
  ): Promise<{
    token: string;
    uploadUrl: string;
    expiresAt: string;
    expiresInMs: number;
  }> {
    const response = await fetch(`${this.baseUrl}/applications/${applicationId}/upload-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentRequirementName }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create upload token');
    }
    return response.json();
  }

  async validateUploadToken(token: string): Promise<{
    documentRequirement: string;
    applicationTitle: string;
    applicationNumber: string;
    expiresAt: string;
    isValid: boolean;
  }> {
    const response = await fetch(`/api/upload/${token}`, {
      method: 'GET',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to validate upload token');
    }
    return response.json();
  }

  async uploadViaToken(token: string, file: File): Promise<any> {
    console.log('Uploading file via token:', {
      token,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    const formData = new FormData();
    formData.append('file', file);

    // Log FormData contents (for debugging)
    console.log('FormData created with file');

    const response = await fetch(`/api/upload/${token}`, {
      method: 'POST',
      body: formData,
    });

    console.log('Upload response status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error('Upload error response:', error);
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();
    console.log('Upload successful:', result);
    return result;
  }

  async checkUploadTokenStatus(token: string): Promise<{
    isUsed: boolean;
    isExpired: boolean;
    uploadedDocumentId: string | null;
    usedAt: string | null;
  }> {
    const response = await fetch(`/api/upload/${token}/status`, {
      method: 'GET',
    });
    if (!response.ok) {
      throw new Error('Failed to check upload status');
    }
    return response.json();
  }
}

export const api = new ApiClient();

/**
 * Generic API request helper
 * Used by components that need flexible API calls
 */
export async function apiRequest<T = any>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  data?: any
): Promise<T> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Document Management API
 */

// Upload a document for an application
export async function uploadDocument(
  applicationId: string,
  file: File,
  documentRequirementName: string
): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentRequirementName', documentRequirementName);

  const response = await fetch(`/api/applications/${applicationId}/documents`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || `Upload failed with status ${response.status}`);
  }

  return response.json();
}

// List all documents for an application
export async function listDocuments(applicationId: string): Promise<any[]> {
  return apiRequest('GET', `/api/applications/${applicationId}/documents`);
}

// Download a document
export function getDocumentDownloadUrl(documentId: string): string {
  return `/api/documents/${documentId}/download`;
}

// Delete a document
export async function deleteDocument(documentId: string): Promise<void> {
  return apiRequest('DELETE', `/api/documents/${documentId}`);
}

// ============================================================
// SIGNATURE API METHODS
// ============================================================

export interface Signature {
  id: string;
  applicationId: string;
  applicationEditId?: string | null;
  signedBy: string;
  signedByName: string;
  signedByEmail: string;
  type: 'signature' | 'initial';
  signatureImageUrl: string;
  signatureDataUrl?: string | null;
  signedAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  documentHash?: string | null;
  consentText: string;
  consentGiven: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSignatureRequest {
  applicationId: string;
  applicationEditId?: string;
  type: 'signature' | 'initial';
  signatureDataUrl: string;
  consentText: string;
  documentData: any;
}

// Create a signature or initial
export async function createSignature(data: CreateSignatureRequest): Promise<Signature> {
  return apiRequest('POST', '/api/signatures', data);
}

// Get signature by ID
export async function getSignature(id: string): Promise<Signature> {
  return apiRequest('GET', `/api/signatures/${id}`);
}

// Get application's primary signature
export async function getApplicationSignature(applicationId: string): Promise<Signature | null> {
  try {
    return await apiRequest('GET', `/api/applications/${applicationId}/signature`);
  } catch (error: any) {
    // Return null if signature not found (404)
    if (error.message?.includes('not found')) {
      return null;
    }
    throw error;
  }
}

// Get all signatures for an application
export async function listApplicationSignatures(applicationId: string): Promise<Signature[]> {
  return apiRequest('GET', `/api/applications/${applicationId}/signatures`);
}
