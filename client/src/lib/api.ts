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
  heroImageUrl?: string | null;
  communitySettings?: {
    legalEntityType?: string;
    legalEntityName?: string;
    stateOfIncorporation?: string;
    taxId?: string;
    contactEmail?: string;
    contactPhone?: string;
    officeHours?: string;
    emergencyPhone?: string;
    physicalAddress?: { street?: string; city?: string; state?: string; zip?: string };
    mailingAddress?: { street?: string; city?: string; state?: string; zip?: string };
    description?: string;
    website?: string;
    yearEstablished?: number;
    numberOfLots?: number;
  } | null;
  createdAt: string;
  isActive: boolean;
}

export interface FormTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  projectType: string;
  schema: any;
  isActive: boolean;
  version: number;
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
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  profileImageUrl?: string | null;
  name: string;
  passwordHash: string | null;
  createdAt: string;
}

// Community Subscription (new token-based system)
export interface CommunityTier {
  id: string;
  tierCode: 'small' | 'medium' | 'large' | 'xl';
  name: string;
  minDoors: number;
  maxDoors: number | null;
  basePriceMonthly: number;
  basePriceYearly: number;
  includedCredits: number;
  defaultOverageCost: number;
  maxUsers: number | null;
  maxStorageGb: number | null;
}

export interface CommunitySubscription {
  id: string;
  communityId: string;
  tierId: string;
  tier?: CommunityTier;
  doorCount: number;
  status: 'active' | 'trial' | 'canceled' | 'paused';

  // Custom overrides
  customPriceMonthly: number | null;
  customAiCredits: number | null;
  customOverageCost: number | null;

  // Billing cycle
  currentPeriodStart: string;
  currentPeriodEnd: string;

  // Usage
  creditsUsed: number;
  applicationsThisMonth: number;

  // Computed effective values
  effectivePrice?: number;
  effectiveCredits?: number;
  effectiveOverageCost?: number;
  creditsRemaining?: number;
  overageCreditsUsed?: number;
  estimatedOverageCost?: number;
}

export interface PropertyRepAssignment {
  id: string;
  propertyId: string;
  userId: string;
  designation: string;
  title: string | null;
  assignedByUserId: string | null;
  assignedAt: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
  property?: Tenant;
}

export interface PropertyRepInfo {
  reps: PropertyRepAssignment[];
  fallbackRep: User | null;
  fallbackTitle: string | null;
}

export interface EmailTemplateParameter {
  key: string;
  label: string;
  type: 'string' | 'url' | 'select';
  options?: string[];
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  status: 'success' | 'info' | 'warning' | 'action';
  parameters: EmailTemplateParameter[];
  sampleData: Record<string, string>;
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

  async getManagedProperties(role?: string): Promise<Tenant[]> {
    const url = role
      ? `${this.baseUrl}/properties?role=${encodeURIComponent(role)}`
      : `${this.baseUrl}/properties`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch managed properties");
    return response.json();
  }

  async getAllTenants(): Promise<Tenant[]> {
    const response = await fetch(`${this.baseUrl}/admin/tenants`);
    if (!response.ok) throw new Error("Failed to fetch all tenants");
    return response.json();
  }

  async getAllAiAnalyses(limit = 100): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/admin/ai-analyses?limit=${limit}`);
    if (!response.ok) throw new Error("Failed to fetch AI analyses");
    return response.json();
  }

  // Email Template Dashboard
  async getEmailTemplates(): Promise<{ templates: EmailTemplate[] }> {
    const response = await fetch(`${this.baseUrl}/admin/email-templates`);
    if (!response.ok) throw new Error("Failed to fetch email templates");
    return response.json();
  }

  async previewEmailTemplate(templateId: string, sampleData: Record<string, string>): Promise<{ subject: string; html: string }> {
    const response = await fetch(`${this.baseUrl}/admin/email-templates/${templateId}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sampleData }),
    });
    if (!response.ok) throw new Error("Failed to preview email template");
    return response.json();
  }

  async sendTestEmail(templateId: string, sampleData: Record<string, string>): Promise<{ success: boolean; sentTo: string }> {
    const response = await fetch(`${this.baseUrl}/admin/email-templates/${templateId}/send-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sampleData }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to send test email");
    }
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

  async createFormTemplate(data: {
    tenantId: string;
    name: string;
    description: string;
    projectType: string;
    schema: any;
  }): Promise<FormTemplate> {
    const response = await fetch(`${this.baseUrl}/tenants/${data.tenantId}/forms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to create form template" }));
      throw new Error(error.error || "Failed to create form template");
    }
    return response.json();
  }

  async updateFormTemplate(id: string, data: {
    name?: string;
    description?: string;
    schema?: any;
  }): Promise<FormTemplate> {
    const response = await fetch(`${this.baseUrl}/forms/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to update form template" }));
      throw new Error(error.error || "Failed to update form template");
    }
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

  // ============================================================
  // PROPERTY REP ASSIGNMENT API METHODS
  // ============================================================

  // Get rep assignments for a property
  async getPropertyReps(propertyId: string): Promise<PropertyRepAssignment[]> {
    const response = await fetch(`${this.baseUrl}/properties/${propertyId}/reps`);
    if (!response.ok) throw new Error("Failed to fetch property reps");
    return response.json();
  }

  // Get rep info for homeowner display (includes fallback)
  async getPropertyRepInfo(propertyId: string): Promise<PropertyRepInfo> {
    const response = await fetch(`${this.baseUrl}/properties/${propertyId}/rep-info`);
    if (!response.ok) throw new Error("Failed to fetch property rep info");
    return response.json();
  }

  // Assign rep to property
  async assignRepToProperty(
    propertyId: string,
    data: { userId: string; designation?: string; title?: string; notes?: string }
  ): Promise<PropertyRepAssignment> {
    const response = await fetch(`${this.baseUrl}/properties/${propertyId}/reps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to assign rep to property");
    return response.json();
  }

  // Update rep assignment
  async updateRepAssignment(
    assignmentId: string,
    data: { designation?: string; title?: string; notes?: string; isActive?: boolean }
  ): Promise<PropertyRepAssignment> {
    const response = await fetch(`${this.baseUrl}/property-rep-assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update rep assignment");
    return response.json();
  }

  // Remove rep from property
  async removeRepAssignment(assignmentId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/property-rep-assignments/${assignmentId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to remove rep assignment");
    return response.json();
  }

  // Bulk assign rep to properties
  async bulkAssignRep(
    userId: string,
    propertyIds: string[],
    designation?: string
  ): Promise<PropertyRepAssignment[]> {
    const response = await fetch(`${this.baseUrl}/reps/${userId}/bulk-assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyIds, designation }),
    });
    if (!response.ok) throw new Error("Failed to bulk assign rep");
    return response.json();
  }

  // Get properties assigned to a user
  async getUserPropertyAssignments(userId: string): Promise<PropertyRepAssignment[]> {
    const response = await fetch(`${this.baseUrl}/users/${userId}/property-assignments`);
    if (!response.ok) throw new Error("Failed to fetch user property assignments");
    return response.json();
  }

  // Get default fallback rep for management company
  async getDefaultFallbackRep(managementCompanyId: string): Promise<{
    defaultRepUserId: string | null;
    defaultRepTitle: string | null;
    defaultRep: User | null;
  }> {
    const response = await fetch(`${this.baseUrl}/management-companies/${managementCompanyId}/default-rep`);
    if (!response.ok) throw new Error("Failed to fetch default rep");
    return response.json();
  }

  // Set default fallback rep for management company
  async setDefaultFallbackRep(
    managementCompanyId: string,
    userId: string | null,
    title?: string
  ): Promise<Tenant> {
    const response = await fetch(`${this.baseUrl}/management-companies/${managementCompanyId}/default-rep`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, title }),
    });
    if (!response.ok) throw new Error("Failed to set default rep");
    return response.json();
  }

  // Check if current user is assigned to property
  async checkPropertyAssignment(propertyId: string): Promise<{ isAssigned: boolean }> {
    const response = await fetch(`${this.baseUrl}/properties/${propertyId}/is-assigned`);
    if (!response.ok) return { isAssigned: false };
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
  // SUBSCRIPTION API METHODS
  // ============================================================

  async listSubscriptionPlans(tenantType?: 'management_company' | 'community'): Promise<any[]> {
    const url = tenantType
      ? `${this.baseUrl}/subscription-plans?tenantType=${tenantType}`
      : `${this.baseUrl}/subscription-plans`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch subscription plans");
    return response.json();
  }

  async getTenantSubscription(tenantId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/subscription`);
    if (!response.ok) throw new Error("Failed to fetch tenant subscription");
    return response.json();
  }

  async updateTenantSubscription(tenantId: string, planId: string, changeReason?: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, changeReason }),
    });
    if (!response.ok) throw new Error("Failed to update subscription");
    return response.json();
  }

  async checkFeatureAccess(tenantId: string, feature: string): Promise<{
    hasAccess: boolean;
    limit: number | null;
    current: number;
    reason?: string;
  }> {
    const response = await fetch(`${this.baseUrl}/tenants/${tenantId}/feature-access/${feature}`);
    if (!response.ok) throw new Error("Failed to check feature access");
    return response.json();
  }

  // Community Subscription (new token-based system)
  async getCommunitySubscription(communityId: string): Promise<CommunitySubscription | null> {
    const response = await fetch(`${this.baseUrl}/communities/${communityId}/subscription`, {
      credentials: 'include',
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Failed to fetch community subscription");
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

  // ============================================
  // CO-APPLICANT SYSTEM
  // ============================================

  // Household Members
  async getHouseholdMembers(tenantId: string): Promise<any[]> {
    const response = await fetch(`/api/households/${tenantId}/members`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get household members');
    }
    return response.json();
  }

  async inviteHouseholdMember(tenantId: string, data: {
    email: string;
    name?: string;
    relationship?: string;
  }): Promise<any> {
    const response = await fetch(`/api/households/${tenantId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to invite household member');
    }
    return response.json();
  }

  async removeHouseholdMember(tenantId: string, memberId: string): Promise<void> {
    const response = await fetch(`/api/households/${tenantId}/members/${memberId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove household member');
    }
  }

  async leaveHousehold(tenantId: string, memberId: string): Promise<void> {
    const response = await fetch(`/api/households/${tenantId}/members/${memberId}/leave`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to leave household');
    }
  }

  async getMyHouseholdMemberships(): Promise<any[]> {
    const response = await fetch('/api/households/my-memberships');
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get memberships');
    }
    return response.json();
  }

  // Contractors
  async getMyContractorProfile(): Promise<any> {
    const response = await fetch('/api/contractors/me');
    if (!response.ok) {
      if (response.status === 404) return null;
      const error = await response.json();
      throw new Error(error.error || 'Failed to get contractor profile');
    }
    return response.json();
  }

  async createContractorProfile(data: {
    companyName?: string;
    businessType?: string;
    areasOfExpertise?: string[];
    licenseNumber?: string;
    businessPhone?: string;
    businessEmail?: string;
    website?: string;
    serviceArea?: string;
    isPubliclySearchable?: boolean;
  }): Promise<any> {
    const response = await fetch('/api/contractors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create contractor profile');
    }
    return response.json();
  }

  async updateContractorProfile(id: string, data: any): Promise<any> {
    const response = await fetch(`/api/contractors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update contractor profile');
    }
    return response.json();
  }

  async searchContractors(query: string): Promise<any[]> {
    const response = await fetch(`/api/contractors/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to search contractors');
    }
    return response.json();
  }

  async generateReferralCode(contractorId: string, customCode?: string): Promise<{
    referralCode: string;
    referralUrl: string;
  }> {
    const response = await fetch(`/api/contractors/${contractorId}/referral-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customCode }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate referral code');
    }
    return response.json();
  }

  async getContractorDashboard(contractorId: string): Promise<any> {
    const response = await fetch(`/api/contractors/${contractorId}/dashboard`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get contractor dashboard');
    }
    return response.json();
  }

  async getContractorReferrals(contractorId: string): Promise<any> {
    const response = await fetch(`/api/contractors/${contractorId}/referrals`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get contractor referrals');
    }
    return response.json();
  }

  // Application Collaborators
  async getApplicationCollaborators(applicationId: string): Promise<any[]> {
    const response = await fetch(`/api/applications/${applicationId}/collaborators`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get collaborators');
    }
    return response.json();
  }

  async inviteContractorToApplication(applicationId: string, data: {
    email?: string;
    contractorId?: string;
    name?: string;
  }): Promise<any> {
    const response = await fetch(`/api/applications/${applicationId}/collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to invite contractor');
    }
    return response.json();
  }

  async removeContractorFromApplication(applicationId: string, collaboratorId: string): Promise<void> {
    const response = await fetch(`/api/applications/${applicationId}/collaborators/${collaboratorId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove contractor');
    }
  }

  // Invitations
  async resendInvitation(invitationId: string): Promise<any> {
    const response = await fetch(`/api/invitations/${invitationId}/resend`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to resend invitation');
    }
    return response.json();
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    const response = await fetch(`/api/invitations/${invitationId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to revoke invitation');
    }
  }
}

export const api = new ApiClient();

/**
 * Generic API request helper
 * Used by components that need flexible API calls
 */
export async function apiRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: any
): Promise<T> {
  const options: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
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
  documentData?: any;
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

// ============================================================
// COMPLIANCE API METHODS
// ============================================================

export interface ComplianceCategory {
  id: string;
  tenantId: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface ComplianceItem {
  id: string;
  scope: 'property' | 'management_company';
  propertyId: string | null;
  managementCompanyId: string | null;
  categoryId: string;
  title: string;
  description: string | null;
  dueDate: string;
  completedDate: string | null;
  status: 'pending' | 'upcoming' | 'overdue' | 'completed' | 'na';
  recurrencePattern: 'none' | 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
  recurrenceDay: number | null;
  recurrenceMonth: number | null;
  nextDueDate: string | null;
  priority: 'low' | 'normal' | 'high' | 'critical';
  reminderDays: number[] | null;
  notes: string | null;
  externalReference: string | null;
  createdByUserId: string | null;
  completedByUserId: string | null;
  demoCodeId: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  category?: ComplianceCategory;
  property?: { id: string; name: string };
  managementCompany?: { id: string; name: string };
}

export interface ComplianceDocument {
  id: string;
  complianceItemId: string;
  documentType: string;
  fileName: string;
  blobPath: string;
  containerName: string;
  fileSize: number;
  mimeType: string | null;
  validFrom: string | null;
  validUntil: string | null;
  uploadedByUserId: string | null;
  uploadedAt: string;
  demoCodeId: string | null;
}

export interface ComplianceDashboard {
  upcomingCount: number;
  overdueCount: number;
  completedThisMonthCount: number;
  upcomingItems: ComplianceItem[];
  overdueItems: ComplianceItem[];
}

export interface ComplianceItemFilters {
  scope?: 'property' | 'management_company';
  propertyId?: string;
  managementCompanyId?: string;
  categoryId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

// List all compliance categories
export async function listComplianceCategories(): Promise<ComplianceCategory[]> {
  return apiRequest('GET', '/api/compliance/categories');
}

// Create a compliance category
export async function createComplianceCategory(data: {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}): Promise<ComplianceCategory> {
  return apiRequest('POST', '/api/compliance/categories', data);
}

// Get compliance dashboard
export async function getComplianceDashboard(
  managementCompanyId?: string,
  propertyId?: string
): Promise<ComplianceDashboard> {
  const params = new URLSearchParams();
  if (managementCompanyId) params.append('managementCompanyId', managementCompanyId);
  if (propertyId) params.append('propertyId', propertyId);
  const queryString = params.toString();
  return apiRequest('GET', `/api/compliance/dashboard${queryString ? `?${queryString}` : ''}`);
}

// List compliance items with filters
export async function listComplianceItems(filters: ComplianceItemFilters = {}): Promise<ComplianceItem[]> {
  const params = new URLSearchParams();
  if (filters.scope) params.append('scope', filters.scope);
  if (filters.propertyId) params.append('propertyId', filters.propertyId);
  if (filters.managementCompanyId) params.append('managementCompanyId', filters.managementCompanyId);
  if (filters.categoryId) params.append('categoryId', filters.categoryId);
  if (filters.status) params.append('status', filters.status);
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  const queryString = params.toString();
  return apiRequest('GET', `/api/compliance/items${queryString ? `?${queryString}` : ''}`);
}

// Get single compliance item
export async function getComplianceItem(id: string): Promise<ComplianceItem & { documents: ComplianceDocument[] }> {
  return apiRequest('GET', `/api/compliance/items/${id}`);
}

// Create a compliance item
export async function createComplianceItem(data: {
  scope: 'property' | 'management_company';
  propertyId?: string;
  managementCompanyId?: string;
  categoryId: string;
  title: string;
  description?: string;
  dueDate: string;
  recurrencePattern?: 'none' | 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
  recurrenceDay?: number;
  recurrenceMonth?: number;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  reminderDays?: number[];
  notes?: string;
  externalReference?: string;
}): Promise<ComplianceItem> {
  return apiRequest('POST', '/api/compliance/items', data);
}

// Update a compliance item
export async function updateComplianceItem(
  id: string,
  data: Partial<{
    categoryId: string;
    title: string;
    description: string;
    dueDate: string;
    status: 'pending' | 'upcoming' | 'overdue' | 'completed' | 'na';
    recurrencePattern: 'none' | 'annual' | 'semi_annual' | 'quarterly' | 'monthly';
    recurrenceDay: number;
    recurrenceMonth: number;
    priority: 'low' | 'normal' | 'high' | 'critical';
    reminderDays: number[];
    notes: string;
    externalReference: string;
  }>
): Promise<ComplianceItem> {
  return apiRequest('PATCH', `/api/compliance/items/${id}`, data);
}

// Delete a compliance item
export async function deleteComplianceItem(id: string): Promise<void> {
  return apiRequest('DELETE', `/api/compliance/items/${id}`);
}

// Complete a compliance item
export async function completeComplianceItem(id: string, notes?: string): Promise<ComplianceItem> {
  return apiRequest('POST', `/api/compliance/items/${id}/complete`, { notes });
}

// Reopen a compliance item
export async function reopenComplianceItem(id: string): Promise<ComplianceItem> {
  return apiRequest('POST', `/api/compliance/items/${id}/reopen`);
}

// Upload a compliance document
export async function uploadComplianceDocument(
  itemId: string,
  file: File,
  documentType: string,
  validFrom?: string,
  validUntil?: string
): Promise<ComplianceDocument> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);
  if (validFrom) formData.append('validFrom', validFrom);
  if (validUntil) formData.append('validUntil', validUntil);

  const response = await fetch(`/api/compliance/items/${itemId}/documents`, {
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

// List compliance documents for an item
export async function listComplianceDocuments(itemId: string): Promise<ComplianceDocument[]> {
  return apiRequest('GET', `/api/compliance/items/${itemId}/documents`);
}

// Get compliance document download URL
export function getComplianceDocumentDownloadUrl(documentId: string): string {
  return `/api/compliance/documents/${documentId}/download`;
}

// Delete a compliance document
export async function deleteComplianceDocument(documentId: string): Promise<void> {
  return apiRequest('DELETE', `/api/compliance/documents/${documentId}`);
}

// ============================================================
// EVENTS / CALENDAR API METHODS
// ============================================================

export interface EventType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  defaultDuration: number | null;
  requiresAttendance: boolean;
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  tenantId: string;
  eventTypeId: string;
  title: string;
  description: string | null;
  startDatetime: string;
  endDatetime: string;
  allDay: boolean;
  timezone: string | null; // IANA timezone for DST-aware recurring events
  location: string | null;
  meetingUrl: string | null;
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  recurrenceRule: string | null;
  recurrenceEndDate: string | null;
  parentEventId: string | null;
  reminderDays: number[] | null;
  noticeRequiredDays: number | null;
  noticeSentAt: string | null;
  isPublic: boolean;
  createdByUserId: string | null;
  demoCodeId: string | null;
  createdAt: string;
  updatedAt: string;
  exceptionDates: string | null;
  originalOccurrenceDate: string | null;
  // Joined data
  eventType?: EventType;
  tenant?: { id: string; name: string };
  // Recurrence instance metadata (added by server during expansion)
  isRecurrenceInstance?: boolean;
  originalDate?: string; // YYYY-MM-DD of this occurrence
  seriesId?: string; // ID of the parent recurring event
}

export interface EventWithDetails extends CalendarEvent {
  attendees: EventAttendee[];
  documents: EventDocument[];
  applications: EventApplication[];
}

export interface EventAttendee {
  id: string;
  eventId: string;
  userId: string | null;
  email: string;
  name: string | null;
  role: 'organizer' | 'required' | 'optional' | 'presenter';
  responseStatus: 'pending' | 'accepted' | 'declined' | 'tentative';
  respondedAt: string | null;
  attended: boolean | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventDocument {
  id: string;
  eventId: string;
  documentType: 'agenda' | 'minutes' | 'recording' | 'presentation' | 'attendance_sheet' | 'packet' | 'other';
  fileName: string;
  blobPath: string;
  containerName: string;
  fileSize: number;
  mimeType: string | null;
  uploadedByUserId: string | null;
  uploadedAt: string;
  demoCodeId: string | null;
}

export interface EventApplication {
  id: string;
  eventId: string;
  applicationId: string;
  addedByUserId: string | null;
  addedAt: string;
  orderIndex: number | null;
  notes: string | null;
  decision: string | null;
  decisionNotes: string | null;
  // Joined application data
  application?: {
    id: string;
    formData: any;
    status: string;
    submittedAt: string;
  };
}

export interface EventFilters {
  tenantId?: string;
  eventTypeId?: string;
  status?: string;
  startAfter?: string;
  startBefore?: string;
}

// Get tenants user can create events for
export async function getEventTenants(): Promise<Array<{ id: string; name: string; type: string }>> {
  return apiRequest('GET', '/api/events/tenants');
}

// List all event types
export async function listEventTypes(): Promise<EventType[]> {
  return apiRequest('GET', '/api/events/types');
}

// Get event type by ID
export async function getEventType(id: string): Promise<EventType> {
  return apiRequest('GET', `/api/events/types/${id}`);
}

// List events with filters
export async function listEvents(filters: EventFilters = {}): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();
  if (filters.tenantId) params.append('tenantId', filters.tenantId);
  if (filters.eventTypeId) params.append('eventTypeId', filters.eventTypeId);
  if (filters.status) params.append('status', filters.status);
  if (filters.startAfter) params.append('startAfter', filters.startAfter);
  if (filters.startBefore) params.append('startBefore', filters.startBefore);
  const queryString = params.toString();
  return apiRequest('GET', `/api/events${queryString ? `?${queryString}` : ''}`);
}

// Get calendar events for a date range
export async function getCalendarEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ startDate, endDate });
  return apiRequest('GET', `/api/events/calendar?${params.toString()}`);
}

// Get single event with all details
export async function getEvent(id: string): Promise<EventWithDetails> {
  return apiRequest('GET', `/api/events/${id}`);
}

// Create an event
export async function createEvent(data: {
  tenantId: string;
  eventTypeId: string;
  title: string;
  description?: string;
  startDatetime: string;
  endDatetime: string;
  allDay?: boolean;
  location?: string;
  meetingUrl?: string;
  status?: 'draft' | 'scheduled';
  recurrenceRule?: string;
  recurrenceEndDate?: string;
  reminderDays?: number[];
  noticeRequiredDays?: number;
}): Promise<CalendarEvent> {
  return apiRequest('POST', '/api/events', data);
}

// Update an event
export async function updateEvent(
  id: string,
  data: Partial<{
    eventTypeId: string;
    title: string;
    description: string;
    startDatetime: string;
    endDatetime: string;
    allDay: boolean;
    location: string;
    meetingUrl: string;
    status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    recurrenceRule: string;
    recurrenceEndDate: string;
    reminderDays: number[];
    noticeRequiredDays: number;
  }>
): Promise<CalendarEvent> {
  return apiRequest('PATCH', `/api/events/${id}`, data);
}

// Delete an event
export async function deleteEvent(id: string): Promise<void> {
  return apiRequest('DELETE', `/api/events/${id}`);
}

// Complete an event
export async function completeEvent(id: string): Promise<CalendarEvent> {
  return apiRequest('POST', `/api/events/${id}/complete`);
}

// Cancel an event
export async function cancelEvent(id: string): Promise<CalendarEvent> {
  return apiRequest('POST', `/api/events/${id}/cancel`);
}

// ============================================================
// RECURRING EVENT OCCURRENCE API METHODS
// ============================================================

export type RecurrenceEditMode = 'single' | 'thisAndFuture' | 'all';

// Edit a single occurrence of a recurring event
export async function editEventOccurrence(
  eventId: string,
  originalDate: string,
  editMode: RecurrenceEditMode,
  updates: Partial<{
    title: string;
    description: string;
    startDatetime: string;
    endDatetime: string;
    allDay: boolean;
    location: string;
    meetingUrl: string;
    reminderDays: number[];
    noticeRequiredDays: number;
    isPublic: boolean;
    recurrenceRule: string | null;
    recurrenceEndDate: string | null;
  }>
): Promise<CalendarEvent> {
  return apiRequest('POST', `/api/events/${eventId}/occurrence`, {
    originalDate,
    editMode,
    ...updates,
  });
}

// Delete occurrence(s) of a recurring event
export async function deleteEventOccurrence(
  eventId: string,
  originalDate: string,
  deleteMode: RecurrenceEditMode
): Promise<void> {
  return apiRequest('DELETE', `/api/events/${eventId}/occurrence`, {
    originalDate,
    deleteMode,
  });
}

// ============================================================
// EVENT ATTENDEES API METHODS
// ============================================================

// List attendees for an event
export async function listEventAttendees(eventId: string): Promise<EventAttendee[]> {
  return apiRequest('GET', `/api/events/${eventId}/attendees`);
}

// Add attendee to event
export async function createEventAttendee(eventId: string, data: {
  userId?: string;
  email: string;
  name?: string;
  role?: 'organizer' | 'required' | 'optional' | 'presenter';
}): Promise<EventAttendee> {
  return apiRequest('POST', `/api/events/${eventId}/attendees`, data);
}

// Update attendee (RSVP, attendance)
export async function updateEventAttendee(
  eventId: string,
  attendeeId: string,
  data: Partial<{
    role: 'organizer' | 'required' | 'optional' | 'presenter';
    responseStatus: 'pending' | 'accepted' | 'declined' | 'tentative';
    attended: boolean;
    notes: string;
  }>
): Promise<EventAttendee> {
  return apiRequest('PATCH', `/api/events/${eventId}/attendees/${attendeeId}`, data);
}

// Remove attendee from event
export async function deleteEventAttendee(eventId: string, attendeeId: string): Promise<void> {
  return apiRequest('DELETE', `/api/events/${eventId}/attendees/${attendeeId}`);
}

// ============================================================
// EVENT DOCUMENTS API METHODS
// ============================================================

// List documents for an event
export async function listEventDocuments(eventId: string): Promise<EventDocument[]> {
  return apiRequest('GET', `/api/events/${eventId}/documents`);
}

// Upload document to event
export async function uploadEventDocument(
  eventId: string,
  file: File,
  documentType: 'agenda' | 'minutes' | 'recording' | 'presentation' | 'attendance_sheet' | 'packet' | 'other'
): Promise<EventDocument> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);

  const response = await fetch(`/api/events/${eventId}/documents`, {
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

// Get event document download URL
export function getEventDocumentDownloadUrl(documentId: string): string {
  return `/api/events/documents/${documentId}/download`;
}

// Delete an event document
export async function deleteEventDocument(documentId: string): Promise<void> {
  return apiRequest('DELETE', `/api/events/documents/${documentId}`);
}

// ============================================================
// EVENT APPLICATIONS (REVIEW PACKETS) API METHODS
// ============================================================

// List applications linked to an event
export async function listEventApplications(eventId: string): Promise<EventApplication[]> {
  return apiRequest('GET', `/api/events/${eventId}/applications`);
}

// Link application to event
export async function linkApplicationToEvent(eventId: string, data: {
  applicationId: string;
  orderIndex?: number;
  notes?: string;
}): Promise<EventApplication> {
  return apiRequest('POST', `/api/events/${eventId}/applications`, data);
}

// Update application link (order, notes, decision)
export async function updateEventApplication(
  eventId: string,
  linkId: string,
  data: Partial<{
    orderIndex: number;
    notes: string;
    decision: string;
    decisionNotes: string;
  }>
): Promise<EventApplication> {
  return apiRequest('PATCH', `/api/events/${eventId}/applications/${linkId}`, data);
}

// Unlink application from event
export async function unlinkApplicationFromEvent(eventId: string, linkId: string): Promise<void> {
  return apiRequest('DELETE', `/api/events/${eventId}/applications/${linkId}`);
}

// ============================================================
// CALENDAR FEED (iCal) API METHODS
// ============================================================

export interface CalendarFeedToken {
  token: string;
  feedUrl: string;
  createdAt: string;
  lastAccessedAt: string | null;
  accessCount: number;
  message?: string;
}

// Get or create calendar feed token for the current user
export async function getCalendarFeedToken(): Promise<CalendarFeedToken> {
  return apiRequest('GET', '/api/calendar-feed/token');
}

// Regenerate calendar feed token (invalidates old URL)
export async function regenerateCalendarFeedToken(): Promise<CalendarFeedToken> {
  return apiRequest('POST', '/api/calendar-feed/regenerate');
}

// ============================================================
// AI ANALYSIS API METHODS
// ============================================================

export interface AiCreditStatus {
  tenantId: string;
  creditsRemaining: number;
  creditsUsedThisCycle: number;
  monthlyAllowance: number;
  overageCostPerCredit: string;
  billingCycleStart: string;
  billingCycleEnd: string;
  hasOverride: boolean;
  overrideReason?: string;
}

export interface AiCreditCheck {
  hasCredits: boolean;
  creditsRemaining: number;
  isOverage: boolean;
  overageCost?: string;
}

export interface AiAnalysis {
  id: string;
  applicationId: string;
  tenantId: string;
  requestedByUserId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: {
    complianceScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    overallSummary: string;
    bylawCompliance: Array<{
      bylawId: string;
      sectionReference: string;
      bylawText?: string;
      compliant: boolean;
      explanation: string;
      concerns: string[];
    }>;
    riskAssessment: Array<{
      category: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      mitigation: string;
    }>;
    questionsConcerns: Array<{
      question: string;
      category: string;
      priority: 'low' | 'medium' | 'high';
    }>;
    recommendations: Array<{
      type: 'approve' | 'approve_with_conditions' | 'deny' | 'request_changes' | 'table';
      explanation: string;
      conditions?: string[];
    }>;
  };
  satelliteImageUrl?: string;
  mockupImageUrls?: string[];
  blueprintImageUrls?: string[];
  pdfReportUrl?: string;
  processingTimeMs?: number;
  totalCostUsd?: string;
  errorMessage?: string;
  userRating?: number;
  userFeedback?: string;
  propertyResearch?: {
    researchSummary: string;
    overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
    taxRecords: Array<{
      parcelId?: string;
      assessedValue?: string;
      marketValue?: string;
      taxYear?: number;
      annualTaxAmount?: string;
      taxStatus?: 'current' | 'delinquent' | 'unknown';
      lastPaymentDate?: string;
      exemptions: string[];
      notes?: string;
    }>;
    taxAnalysis?: string;
    liens: Array<{
      lienType: 'tax' | 'mechanics' | 'hoa' | 'judgment' | 'mortgage' | 'other';
      lienHolder: string;
      amount?: string;
      filedDate?: string;
      status: 'active' | 'released' | 'satisfied' | 'unknown';
      recordingNumber?: string;
      description: string;
    }>;
    lienAnalysis?: string;
    permits: Array<{
      permitNumber?: string;
      permitType: string;
      description: string;
      issueDate?: string;
      status: 'issued' | 'final' | 'expired' | 'pending' | 'revoked' | 'unknown';
      estimatedValue?: string;
      contractor?: string;
      notes?: string;
    }>;
    permitAnalysis?: string;
    deeds: Array<{
      recordingDate?: string;
      documentType: 'warranty_deed' | 'quitclaim_deed' | 'trust_deed' | 'special_warranty' | 'other';
      grantor?: string;
      grantee?: string;
      salePrice?: string;
      documentNumber?: string;
      notes?: string;
    }>;
    titleAnalysis?: string;
    surveyInfo?: {
      surveyDate?: string;
      surveyor?: string;
      platBook?: string;
      platPage?: string;
      lotNumber?: string;
      blockNumber?: string;
      subdivision?: string;
      lotSize?: string;
      setbacks?: {
        front?: string;
        rear?: string;
        leftSide?: string;
        rightSide?: string;
      };
      easements: string[];
      notes?: string;
    };
    surveyAnalysis?: string;
    legalIssues: Array<{
      issueType: 'code_violation' | 'lawsuit' | 'easement_dispute' | 'boundary_dispute' | 'environmental' | 'zoning' | 'hoa_violation' | 'other';
      description: string;
      status: 'open' | 'resolved' | 'pending' | 'unknown';
      filedDate?: string;
      resolvedDate?: string;
      parties: string[];
      caseNumber?: string;
      potentialImpact?: string;
    }>;
    legalAnalysis?: string;
    zoning?: {
      zoningCode?: string;
      zoningDescription?: string;
      allowedUses: string[];
      restrictions: string[];
      overlayDistricts: string[];
      floodZone?: string;
      maxBuildingHeight?: string;
      maxLotCoverage?: string;
      notes?: string;
    };
    zoningAnalysis?: string;
    ownershipHistory: Array<{
      ownerName: string;
      ownershipType?: 'individual' | 'joint' | 'trust' | 'llc' | 'corporation' | 'other';
      purchaseDate?: string;
      purchasePrice?: string;
      saleDate?: string;
      salePrice?: string;
      durationOwned?: string;
    }>;
    ownershipAnalysis?: string;
    keyFindings: Array<{
      category: 'tax' | 'lien' | 'permit' | 'deed' | 'survey' | 'legal' | 'zoning' | 'ownership' | 'other';
      title: string;
      description: string;
      severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
      relevanceToApplication: string;
      recommendation?: string;
      source?: string;
    }>;
    redFlags: Array<{
      issue: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      recommendation: string;
    }>;
    dataSources: Array<{
      name: string;
      url?: string;
      accessDate: string;
      reliability: 'official' | 'likely_accurate' | 'needs_verification' | 'estimated';
      notes?: string;
    }>;
    researchLimitations: string[];
    furtherResearchNeeded: Array<{
      area: string;
      reason: string;
      suggestedSource?: string;
    }>;
  };
  createdAt: string;
  queuedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AiAnalysisStatus {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queuePosition?: number;
  estimatedTimeSeconds?: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface TriggerAnalysisResponse {
  analysisId: string;
  status: 'queued';
  estimatedTimeSeconds: number;
  creditsRemaining: number;
  isOverage: boolean;
}

// Get AI credit status for current tenant
export async function getAiCreditStatus(): Promise<AiCreditStatus> {
  return apiRequest('GET', '/api/ai/credits');
}

// Quick check for AI credits availability
export async function checkAiCredits(): Promise<AiCreditCheck> {
  return apiRequest('GET', '/api/ai/credits/check');
}

// Trigger AI analysis for an application
export async function triggerAiAnalysis(
  applicationId: string,
  options?: {
    includeSatellite?: boolean;
    includeMockups?: boolean;
    includeBreakdownReport?: boolean;
    mockupQuality?: 'standard' | 'high';
  }
): Promise<TriggerAnalysisResponse> {
  return apiRequest('POST', `/api/applications/${applicationId}/analyze`, options || {});
}

// Get full analysis result
export async function getAiAnalysis(analysisId: string): Promise<AiAnalysis> {
  return apiRequest('GET', `/api/ai/analysis/${analysisId}`);
}

// Get analysis status (for polling)
export async function getAiAnalysisStatus(analysisId: string): Promise<AiAnalysisStatus> {
  return apiRequest('GET', `/api/ai/analysis/${analysisId}/status`);
}

// List analyses for an application
export async function listApplicationAnalyses(applicationId: string): Promise<AiAnalysis[]> {
  return apiRequest('GET', `/api/applications/${applicationId}/analyses`);
}

// Submit feedback for an analysis
export async function submitAnalysisFeedback(
  analysisId: string,
  rating: number,
  feedback?: string
): Promise<{ success: boolean }> {
  return apiRequest('POST', `/api/ai/analysis/${analysisId}/feedback`, { rating, feedback });
}

// Cancel a queued analysis
export async function cancelAiAnalysis(analysisId: string): Promise<{ success: boolean }> {
  return apiRequest('POST', `/api/ai/analysis/${analysisId}/cancel`);
}

// Application event for timeline
export interface ApplicationEvent {
  id: string;
  applicationId: string;
  tenantId: string;
  eventType: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  summary?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: string;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImageUrl?: string;
  };
}

// Timeline response combining events and analyses
export interface ApplicationTimeline {
  events: ApplicationEvent[];
  analyses: AiAnalysis[];
}

// Get application timeline (events and analyses)
export async function getApplicationTimeline(applicationId: string): Promise<ApplicationTimeline> {
  return apiRequest('GET', `/api/applications/${applicationId}/timeline`);
}

// ============================================
// SUBSCRIPTION & BILLING API
// ============================================

// Community tier definition
export interface CommunityTierDef {
  id: string;
  tierCode: 'small' | 'medium' | 'large' | 'xl';
  name: string;
  minDoors: number;
  maxDoors: number | null;
  basePriceMonthly: number;
  basePriceYearly: number;
  includedAiCredits: number;
  defaultOverageCost: number;
  maxUsers: number | null;
  maxStorageGb: number | null;
  isActive: boolean;
  sortOrder: number;
}

// Community subscription with computed effective values
export interface CommunitySubscriptionWithTier {
  id: string;
  communityId: string;
  tierId: string;
  tier?: CommunityTierDef;
  doorCount: number;
  status: 'active' | 'trial' | 'canceled' | 'paused';
  customPriceMonthly: number | null;
  customPriceYearly: number | null;
  customAiCredits: number | null;
  customOverageCost: number | null;
  pricingNote: string | null;
  billingCycleDay: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  creditsUsed: number;
  applicationsThisMonth: number;
  effectivePrice?: number;
  effectiveCredits?: number;
  effectiveOverageCost?: number;
  creditsRemaining?: number;
  overageCreditsUsed?: number;
  estimatedOverageCost?: number;
}

// Per-community consumption data
export interface CommunityConsumption {
  communityId: string;
  communityName: string;
  tierCode: 'small' | 'medium' | 'large' | 'xl';
  tierName: string;
  doorCount: number;
  basePrice: number;
  effectivePrice: number;
  hasCustomPricing: boolean;
  creditsIncluded: number;
  creditsUsed: number;
  creditsRemaining: number;
  overageCredits: number;
  overageCostPerCredit: number;
  overageCost: number;
  applicationsThisMonth: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  daysUntilReset: number;
  billingCycleProgress: number;
}

// Aggregated consumption summary
export interface BillingConsumptionSummary {
  billingEntityId: string;
  billingEntityName: string;
  billingEntityType: 'management_company' | 'community';
  communities: CommunityConsumption[];
  totalBaseCharges: number;
  totalOverageCharges: number;
  totalProjectedCharges: number;
  totalCreditsIncluded: number;
  totalCreditsUsed: number;
  totalOverageCredits: number;
  totalApplicationsThisMonth: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  daysRemaining: number;
}

// Monthly usage history
export interface UsageHistoryMonth {
  month: string;
  creditsUsed: number;
  overageCredits: number;
  overageCost: number;
  applicationsSubmitted: number;
  totalCost: number;
}

// Overage projection
export interface OverageProjection {
  communityId: string;
  currentCreditsUsed: number;
  creditsIncluded: number;
  daysElapsed: number;
  daysRemaining: number;
  dailyUsageRate: number;
  projectedTotalUsage: number;
  projectedOverageCredits: number;
  projectedOverageCost: number;
  willExceedLimit: boolean;
}

// Invoice line item
export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  communityId: string | null;
  communityName?: string;
  lineType: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  tierId: string | null;
  sortOrder: number;
}

// Invoice with line items
export interface InvoiceWithLineItems {
  id: string;
  invoiceNumber: string;
  billedToTenantId: string;
  billedToTenantName?: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  status: 'draft' | 'finalized' | 'sent' | 'paid' | 'void';
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  finalizedAt: string | null;
  sentAt: string | null;
  stripeInvoiceId: string | null;
  stripeHostedInvoiceUrl?: string | null;
  lineItems: InvoiceLineItem[];
}

// Get all community tiers
export async function getCommunityTiers(): Promise<CommunityTierDef[]> {
  return apiRequest('GET', '/api/subscription/tiers');
}

// Get subscription for a community
export async function getCommunitySubscription(communityId: string): Promise<CommunitySubscriptionWithTier> {
  return apiRequest('GET', `/api/communities/${communityId}/subscription`);
}

// Create subscription for a community
export async function createCommunitySubscription(
  communityId: string,
  doorCount: number,
  demoCodeId?: string
): Promise<CommunitySubscriptionWithTier> {
  return apiRequest('POST', `/api/communities/${communityId}/subscription`, { doorCount, demoCodeId });
}

// Update door count
export async function updateDoorCount(
  communityId: string,
  doorCount: number
): Promise<CommunitySubscriptionWithTier> {
  return apiRequest('PATCH', `/api/communities/${communityId}/subscription/doors`, { doorCount });
}

// Set custom pricing (super_admin)
export async function setCustomPricing(
  communityId: string,
  pricing: {
    customPriceMonthly?: number;
    customPriceYearly?: number;
    customAiCredits?: number;
    customOverageCost?: number;
    pricingNote?: string;
  }
): Promise<CommunitySubscriptionWithTier> {
  return apiRequest('PATCH', `/api/communities/${communityId}/subscription/pricing`, pricing);
}

// Clear custom pricing (super_admin)
export async function clearCustomPricing(communityId: string): Promise<CommunitySubscriptionWithTier> {
  return apiRequest('DELETE', `/api/communities/${communityId}/subscription/pricing`);
}

// Get consumption summary for account_admin
export async function getConsumptionSummary(): Promise<BillingConsumptionSummary> {
  return apiRequest('GET', '/api/billing/consumption');
}

// Get consumption for a specific community
export async function getCommunityConsumption(communityId: string): Promise<CommunityConsumption> {
  return apiRequest('GET', `/api/billing/consumption/${communityId}`);
}

// Get usage history for charts
export async function getUsageHistory(months: number = 6): Promise<UsageHistoryMonth[]> {
  return apiRequest('GET', `/api/billing/history?months=${months}`);
}

// Get overage projection for a community
export async function getOverageProjection(communityId: string): Promise<OverageProjection> {
  return apiRequest('GET', `/api/billing/projection/${communityId}`);
}

// List invoices
export async function listInvoices(limit: number = 12): Promise<InvoiceWithLineItems[]> {
  return apiRequest('GET', `/api/invoices?limit=${limit}`);
}

// Get invoice by ID
export async function getInvoice(invoiceId: string): Promise<InvoiceWithLineItems> {
  return apiRequest('GET', `/api/invoices/${invoiceId}`);
}

// Generate invoice
export async function generateInvoice(options?: {
  billingEntityId?: string;
  periodStart?: string;
  periodEnd?: string;
}): Promise<InvoiceWithLineItems> {
  return apiRequest('POST', '/api/invoices/generate', options || {});
}

// Finalize invoice
export async function finalizeInvoice(invoiceId: string): Promise<InvoiceWithLineItems> {
  return apiRequest('PATCH', `/api/invoices/${invoiceId}/finalize`);
}

// Mark invoice as paid
export async function markInvoicePaid(
  invoiceId: string,
  paymentMethod?: string,
  paymentReference?: string
): Promise<InvoiceWithLineItems> {
  return apiRequest('PATCH', `/api/invoices/${invoiceId}/paid`, { paymentMethod, paymentReference });
}

// Void invoice
export async function voidInvoice(invoiceId: string): Promise<InvoiceWithLineItems> {
  return apiRequest('PATCH', `/api/invoices/${invoiceId}/void`);
}

// Download invoice as PDF
export function downloadInvoicePdf(invoiceId: string, invoiceNumber: string): void {
  // Create a link and trigger download
  const link = document.createElement('a');
  link.href = `/api/invoices/${invoiceId}/download`;
  link.download = `invoice-${invoiceNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Send invoice via email
export async function sendInvoice(invoiceId: string): Promise<{ success: boolean; invoice: InvoiceWithLineItems }> {
  return apiRequest('POST', `/api/invoices/${invoiceId}/send`);
}

// ============================================
// TOUR PROGRESS API
// ============================================

export interface TourProgress {
  id: string;
  userId: string;
  pageKey: string;
  role: string;
  completedAt: string;
  demoCodeId?: string;
  createdAt: string;
}

export interface TourCompletionCheck {
  completed: boolean;
  completedAt: string | null;
}

export interface TourCompleteResponse {
  success: boolean;
  alreadyCompleted?: boolean;
  progress: TourProgress;
}

// Get all tour progress for the current user
export async function getTourProgressList(): Promise<TourProgress[]> {
  return apiRequest('GET', '/api/tour/progress');
}

// Check if a specific tour has been completed
export async function checkTourCompleted(pageKey: string, role: string): Promise<TourCompletionCheck> {
  return apiRequest('GET', `/api/tour/progress/${encodeURIComponent(pageKey)}/${encodeURIComponent(role)}`);
}

// Mark a tour as completed
export async function markTourComplete(
  pageKey: string,
  role: string,
  demoCodeId?: string
): Promise<TourCompleteResponse> {
  return apiRequest('POST', '/api/tour/complete', { pageKey, role, demoCodeId });
}

// Reset tour progress (for testing/development)
export async function resetTourProgress(pageKey?: string, role?: string): Promise<{ success: boolean }> {
  const params = new URLSearchParams();
  if (pageKey) params.append('pageKey', pageKey);
  if (role) params.append('role', role);
  const queryString = params.toString();
  return apiRequest('DELETE', `/api/tour/progress${queryString ? `?${queryString}` : ''}`);
}

// ============================================
// TOUR CONTENT API (For TourProvider)
// ============================================

export interface TourContentOverride {
  id: string;
  pageKey: string;
  role: string;
  pageTitle: string;
  isEnabled: boolean;
  steps: Array<{
    title: string;
    description: string;
    iconName: string;
  }>;
  updatedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

// Get tour content overrides (for TourProvider)
export async function getTourContentOverrides(): Promise<TourContentOverride[]> {
  return apiRequest('GET', '/api/tour/content');
}

// ============================================
// TOUR ADMIN API (Super Admin Only)
// ============================================

export interface AdminToursResponse {
  overrides: TourContentOverride[];
}

// Get all tours for admin (overrides from database)
export async function getAdminTours(): Promise<AdminToursResponse> {
  return apiRequest('GET', '/api/admin/tours');
}

// Update/create tour override
export async function updateAdminTour(
  pageKey: string,
  role: string,
  data: {
    pageTitle: string;
    isEnabled: boolean;
    steps: Array<{
      title: string;
      description: string;
      iconName: string;
    }>;
  }
): Promise<TourContentOverride> {
  return apiRequest('PUT', `/api/admin/tours/${encodeURIComponent(pageKey)}/${encodeURIComponent(role)}`, data);
}

// Reset tour to default (delete override)
export async function resetAdminTour(pageKey: string, role: string): Promise<{ success: boolean }> {
  return apiRequest('DELETE', `/api/admin/tours/${encodeURIComponent(pageKey)}/${encodeURIComponent(role)}`);
}
