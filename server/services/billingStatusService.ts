/**
 * Billing Status Service
 *
 * Handles billing status checks and graceful degradation for delinquent accounts.
 *
 * Policy:
 * - Residents can ALWAYS submit applications (never block)
 * - When account is delinquent:
 *   - Board/management see "Application received" but NO details
 *   - Only super_admin and account_admin can see full details
 * - When account is suspended: Same as delinquent but more severe messaging
 */

import { db } from '../storage';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';

export type BillingStatus = 'active' | 'delinquent' | 'suspended';

export interface BillingStatusInfo {
  status: BillingStatus;
  isDelinquent: boolean;
  isSuspended: boolean;
  canViewApplicationDetails: boolean;
  message?: string;
}

// Roles that can always see full application details regardless of billing status
const BILLING_EXEMPT_ROLES = ['super_admin', 'account_admin'];

// Roles that are affected by billing status restrictions
const BILLING_RESTRICTED_ROLES = [
  'management_manager',
  'management_rep',
  'poa_board_member',
  'poa_board_contributor',
];

// Resident roles - never restricted (they can always see their own applications)
const RESIDENT_ROLES = ['homeowner', 'tenant_resident'];

class BillingStatusService {
  /**
   * Get billing status for a tenant
   */
  async getTenantBillingStatus(tenantId: string): Promise<BillingStatus> {
    const [tenant] = await db
      .select({ billingStatus: schema.tenants.billingStatus })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);

    return (tenant?.billingStatus as BillingStatus) || 'active';
  }

  /**
   * Check if a user can view full application details based on billing status and role
   *
   * @param tenantId - The tenant (community) the application belongs to
   * @param userRole - The user's role in that tenant
   * @param isOwnApplication - Whether this is the user's own application
   */
  async canViewApplicationDetails(
    tenantId: string,
    userRole: string,
    isOwnApplication: boolean = false
  ): Promise<BillingStatusInfo> {
    const status = await this.getTenantBillingStatus(tenantId);
    const isDelinquent = status === 'delinquent';
    const isSuspended = status === 'suspended';

    // Account is in good standing - everyone can view
    if (status === 'active') {
      return {
        status,
        isDelinquent: false,
        isSuspended: false,
        canViewApplicationDetails: true,
      };
    }

    // Billing-exempt roles (super_admin, account_admin) can always view
    if (BILLING_EXEMPT_ROLES.includes(userRole)) {
      return {
        status,
        isDelinquent,
        isSuspended,
        canViewApplicationDetails: true,
        message: isSuspended
          ? 'This account is suspended. Please resolve billing issues.'
          : 'This account has overdue invoices. Please resolve billing issues.',
      };
    }

    // Residents can always see their own applications
    if (RESIDENT_ROLES.includes(userRole) && isOwnApplication) {
      return {
        status,
        isDelinquent,
        isSuspended,
        canViewApplicationDetails: true,
      };
    }

    // Board/management roles are restricted when delinquent/suspended
    if (BILLING_RESTRICTED_ROLES.includes(userRole)) {
      return {
        status,
        isDelinquent,
        isSuspended,
        canViewApplicationDetails: false,
        message: isSuspended
          ? 'Account suspended. Application details are hidden until billing is resolved.'
          : 'Account has overdue invoices. Application details are hidden until billing is resolved.',
      };
    }

    // Default: allow (for any roles we might have missed)
    return {
      status,
      isDelinquent,
      isSuspended,
      canViewApplicationDetails: true,
    };
  }

  /**
   * Redact application details for users who can't view them
   * Returns a minimal version of the application
   */
  redactApplicationDetails(application: any): any {
    return {
      id: application.id,
      tenantId: application.tenantId,
      formTemplateId: application.formTemplateId,
      status: application.status,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      // Redact sensitive fields
      data: null,
      formData: null,
      submitterFirstName: null,
      submitterLastName: null,
      submitterEmail: null,
      submitterPhone: null,
      propertyAddress: 'Address hidden - billing issue',
      aiAnalysisId: null,
      // Include a flag so frontend knows this is redacted
      _redacted: true,
      _redactReason: 'billing_delinquent',
    };
  }

  /**
   * Update billing status for a tenant
   */
  async updateBillingStatus(tenantId: string, status: BillingStatus): Promise<void> {
    await db
      .update(schema.tenants)
      .set({ billingStatus: status })
      .where(eq(schema.tenants.id, tenantId));

    console.log(`[BillingStatusService] Updated tenant ${tenantId} billing status to: ${status}`);
  }

  /**
   * Check all tenants for overdue invoices and update billing status
   * Should be called by a scheduled job
   */
  async checkAndUpdateDelinquentAccounts(): Promise<{ updated: number }> {
    // Get all invoices that are overdue (due date passed, status is sent or finalized)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const overdueInvoices = await db
      .select({
        tenantId: schema.invoices.billedToTenantId,
        dueDate: schema.invoices.dueDate,
      })
      .from(schema.invoices)
      .where(eq(schema.invoices.status, 'sent'));

    // Filter to actually overdue ones
    const delinquentTenants = new Set<string>();
    const now = new Date();

    for (const invoice of overdueInvoices) {
      if (invoice.dueDate && invoice.dueDate < now) {
        delinquentTenants.add(invoice.tenantId);
      }
    }

    // Update status for delinquent tenants
    let updated = 0;
    for (const tenantId of delinquentTenants) {
      const currentStatus = await this.getTenantBillingStatus(tenantId);
      if (currentStatus === 'active') {
        await this.updateBillingStatus(tenantId, 'delinquent');
        updated++;
      }
    }

    console.log(`[BillingStatusService] Marked ${updated} accounts as delinquent`);
    return { updated };
  }
}

// Export singleton instance
export const billingStatusService = new BillingStatusService();
export default billingStatusService;
