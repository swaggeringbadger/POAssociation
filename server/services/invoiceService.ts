/**
 * Invoice Service
 *
 * Generates and manages invoices for billing entities.
 * Integrates with Stripe for automatic billing:
 * - Auto-pay: Charges saved payment method automatically
 * - Manual pay: Sends invoice email with payment link
 */

import { db } from '../storage';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { consumptionDashboardService } from './consumptionDashboardService';
import { stripeService } from './stripeService';
import { InvoiceStatus } from '@shared/subscriptionTypes';

interface InvoiceWithLineItems {
  id: string;
  invoiceNumber: string;
  billedToTenantId: string;
  billedToTenantName?: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  status: InvoiceStatus;
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

interface InvoiceLineItem {
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

interface GenerateInvoiceOptions {
  billingEntityId: string;
  periodStart: Date;
  periodEnd: Date;
  demoCodeId?: string;
}

class InvoiceService {
  // ==========================================
  // INVOICE GENERATION
  // ==========================================

  /**
   * Generate a monthly invoice for a billing entity
   * Creates both local invoice record and Stripe invoice (if Stripe is configured)
   */
  async generateMonthlyInvoice(options: GenerateInvoiceOptions): Promise<InvoiceWithLineItems> {
    const { billingEntityId, periodStart, periodEnd, demoCodeId } = options;

    // Check if invoice already exists for this period
    const existingInvoice = await this.findInvoiceForPeriod(
      billingEntityId,
      periodStart,
      periodEnd
    );

    if (existingInvoice) {
      throw new Error(
        `Invoice already exists for period ${periodStart.toISOString()} - ${periodEnd.toISOString()}`
      );
    }

    // Get consumption data for the period
    const consumption = await consumptionDashboardService.getConsumptionSummary(billingEntityId);

    // Get billing entity to check auto-pay settings
    const [billingEntity] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, billingEntityId))
      .limit(1);

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    // Calculate due date based on payment terms (default 30 days)
    const paymentTermsDays = billingEntity?.paymentTermsDays || 30;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentTermsDays);

    // Prepare Stripe line items
    const stripeLineItems: Array<{
      description: string;
      amount: number;
      quantity?: number;
      metadata?: Record<string, string>;
    }> = [];

    // Build line items for each community
    const localLineItems: Array<{
      communityId: string;
      communityName: string;
      lineType: string;
      description: string;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
    }> = [];

    for (const community of consumption.communities) {
      // Subscription line item
      localLineItems.push({
        communityId: community.communityId,
        communityName: community.communityName,
        lineType: 'subscription',
        description: `${community.communityName} - ${community.tierName} (${community.doorCount} doors)`,
        quantity: 1,
        unitPrice: community.effectivePrice.toString(),
        totalPrice: community.effectivePrice.toString(),
      });

      stripeLineItems.push({
        description: `${community.communityName} - ${community.tierName} (${community.doorCount} doors)`,
        amount: Math.round(community.effectivePrice * 100), // Stripe uses cents
        quantity: 1,
        metadata: { community_id: community.communityId, line_type: 'subscription' },
      });

      // AI overage line item (if any)
      if (community.overageCredits > 0) {
        localLineItems.push({
          communityId: community.communityId,
          communityName: community.communityName,
          lineType: 'ai_overage',
          description: `${community.communityName} - AI Analysis Overage (${community.overageCredits} credits @ $${community.overageCostPerCredit.toFixed(2)})`,
          quantity: community.overageCredits,
          unitPrice: community.overageCostPerCredit.toString(),
          totalPrice: community.overageCost.toString(),
        });

        stripeLineItems.push({
          description: `${community.communityName} - AI Analysis Overage`,
          amount: Math.round(community.overageCostPerCredit * 100), // Stripe uses cents
          quantity: community.overageCredits,
          metadata: { community_id: community.communityId, line_type: 'ai_overage' },
        });
      }
    }

    // Create Stripe invoice if Stripe is configured
    let stripeInvoiceId: string | null = null;
    let stripeHostedInvoiceUrl: string | null = null;

    if (stripeService.isEnabled() && consumption.totalProjectedCharges > 0) {
      try {
        const stripeInvoice = await stripeService.createInvoice({
          tenantId: billingEntityId,
          lineItems: stripeLineItems,
          daysUntilDue: paymentTermsDays,
          autoCharge: billingEntity?.autoPayEnabled || false,
          metadata: {
            billing_period_start: periodStart.toISOString(),
            billing_period_end: periodEnd.toISOString(),
            invoice_number: invoiceNumber,
          },
        });
        stripeInvoiceId = stripeInvoice.id;
        stripeHostedInvoiceUrl = stripeInvoice.hosted_invoice_url || null;
        console.log(`[InvoiceService] Created Stripe invoice ${stripeInvoiceId} for ${billingEntityId}`);
      } catch (error) {
        // Log error but continue - we can still create local invoice
        console.error(`[InvoiceService] Failed to create Stripe invoice:`, error);
      }
    }

    // Create local invoice record
    const [invoice] = await db
      .insert(schema.invoices)
      .values({
        invoiceNumber,
        billedToTenantId: billingEntityId,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        status: stripeInvoiceId ? 'finalized' : 'draft',
        subtotal: consumption.totalBaseCharges.toString(),
        taxAmount: '0',
        discountAmount: '0',
        totalAmount: consumption.totalProjectedCharges.toString(),
        dueDate,
        demoCodeId,
        stripeInvoiceId,
        stripeHostedInvoiceUrl,
      })
      .returning();

    // Create line items
    const lineItems: InvoiceLineItem[] = [];
    let sortOrder = 0;

    for (const item of localLineItems) {
      const [lineItem] = await db
        .insert(schema.invoiceLineItems)
        .values({
          invoiceId: invoice.id,
          communityId: item.communityId,
          lineType: item.lineType,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          sortOrder: sortOrder++,
        })
        .returning();

      lineItems.push(this.mapLineItemToInterface(lineItem, item.communityName));
    }

    return this.mapInvoiceToInterface(invoice, lineItems, consumption.billingEntityName);
  }

  /**
   * Generate invoices for all billing entities with expired periods
   * Should be called by a scheduled job
   */
  async generatePendingInvoices(): Promise<number> {
    // Get all active subscriptions with expired periods
    const now = new Date();
    const expiredSubscriptions = await db
      .select()
      .from(schema.communitySubscriptions)
      .where(
        and(
          eq(schema.communitySubscriptions.status, 'active'),
          lte(schema.communitySubscriptions.currentPeriodEnd, now)
        )
      );

    // Group by billing entity (management company or self-managed community)
    const billingEntitiesProcessed = new Set<string>();
    let invoicesGenerated = 0;

    for (const sub of expiredSubscriptions) {
      // Get the community to determine billing entity
      const [community] = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, sub.communityId))
        .limit(1);

      if (!community) continue;

      // Determine billing entity
      const billingEntityId = community.managementCompanyId || community.id;

      if (billingEntitiesProcessed.has(billingEntityId)) continue;
      billingEntitiesProcessed.add(billingEntityId);

      try {
        await this.generateMonthlyInvoice({
          billingEntityId,
          periodStart: sub.currentPeriodStart,
          periodEnd: sub.currentPeriodEnd,
          demoCodeId: sub.demoCodeId || undefined,
        });
        invoicesGenerated++;
      } catch (error) {
        // Invoice might already exist, continue
        console.error(`Failed to generate invoice for ${billingEntityId}:`, error);
      }
    }

    return invoicesGenerated;
  }

  // ==========================================
  // INVOICE CRUD
  // ==========================================

  /**
   * Get invoice by ID with line items
   */
  async getInvoice(invoiceId: string): Promise<InvoiceWithLineItems | null> {
    const [invoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, invoiceId))
      .limit(1);

    if (!invoice) return null;

    // Get line items
    const lineItems = await db
      .select()
      .from(schema.invoiceLineItems)
      .where(eq(schema.invoiceLineItems.invoiceId, invoiceId))
      .orderBy(schema.invoiceLineItems.sortOrder);

    // Get billing entity name
    const [billingEntity] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, invoice.billedToTenantId))
      .limit(1);

    // Get community names for line items
    const lineItemsWithNames = await Promise.all(
      lineItems.map(async (item) => {
        let communityName: string | undefined;
        if (item.communityId) {
          const [community] = await db
            .select()
            .from(schema.tenants)
            .where(eq(schema.tenants.id, item.communityId))
            .limit(1);
          communityName = community?.name;
        }
        return this.mapLineItemToInterface(item, communityName);
      })
    );

    return this.mapInvoiceToInterface(invoice, lineItemsWithNames, billingEntity?.name);
  }

  /**
   * List invoices for a billing entity
   */
  async listInvoices(
    billedToTenantId: string,
    limit: number = 12
  ): Promise<InvoiceWithLineItems[]> {
    const invoices = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.billedToTenantId, billedToTenantId))
      .orderBy(desc(schema.invoices.createdAt))
      .limit(limit);

    return Promise.all(
      invoices.map(async (invoice) => {
        const lineItems = await db
          .select()
          .from(schema.invoiceLineItems)
          .where(eq(schema.invoiceLineItems.invoiceId, invoice.id))
          .orderBy(schema.invoiceLineItems.sortOrder);

        const lineItemsWithNames = await Promise.all(
          lineItems.map(async (item) => {
            let communityName: string | undefined;
            if (item.communityId) {
              const [community] = await db
                .select()
                .from(schema.tenants)
                .where(eq(schema.tenants.id, item.communityId))
                .limit(1);
              communityName = community?.name;
            }
            return this.mapLineItemToInterface(item, communityName);
          })
        );

        return this.mapInvoiceToInterface(invoice, lineItemsWithNames);
      })
    );
  }

  /**
   * Find invoice for a specific period
   */
  async findInvoiceForPeriod(
    billedToTenantId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<InvoiceWithLineItems | null> {
    const [invoice] = await db
      .select()
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.billedToTenantId, billedToTenantId),
          gte(schema.invoices.billingPeriodStart, periodStart),
          lte(schema.invoices.billingPeriodEnd, periodEnd)
        )
      )
      .limit(1);

    if (!invoice) return null;

    return this.getInvoice(invoice.id);
  }

  // ==========================================
  // STATUS MANAGEMENT
  // ==========================================

  /**
   * Finalize an invoice (locks it for editing)
   * Also finalizes the Stripe invoice if one exists
   */
  async finalizeInvoice(invoiceId: string): Promise<InvoiceWithLineItems> {
    // Get the invoice to check for Stripe ID
    const [existingInvoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, invoiceId))
      .limit(1);

    if (!existingInvoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    let stripeHostedInvoiceUrl = existingInvoice.stripeHostedInvoiceUrl;

    // Finalize Stripe invoice if exists
    if (existingInvoice.stripeInvoiceId && stripeService.isEnabled()) {
      try {
        const stripeInvoice = await stripeService.finalizeInvoice(existingInvoice.stripeInvoiceId);
        stripeHostedInvoiceUrl = stripeInvoice.hosted_invoice_url || stripeHostedInvoiceUrl;
        console.log(`[InvoiceService] Finalized Stripe invoice ${existingInvoice.stripeInvoiceId}`);
      } catch (error) {
        console.error(`[InvoiceService] Failed to finalize Stripe invoice:`, error);
      }
    }

    const [invoice] = await db
      .update(schema.invoices)
      .set({
        status: 'finalized',
        finalizedAt: new Date(),
        stripeHostedInvoiceUrl,
      })
      .where(eq(schema.invoices.id, invoiceId))
      .returning();

    return this.getInvoice(invoiceId) as Promise<InvoiceWithLineItems>;
  }

  /**
   * Mark invoice as sent
   */
  async markAsSent(invoiceId: string): Promise<InvoiceWithLineItems> {
    const [invoice] = await db
      .update(schema.invoices)
      .set({
        status: 'sent',
        sentAt: new Date(),
      })
      .where(eq(schema.invoices.id, invoiceId))
      .returning();

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    return this.getInvoice(invoiceId) as Promise<InvoiceWithLineItems>;
  }

  /**
   * Mark invoice as paid
   */
  async markAsPaid(
    invoiceId: string,
    paymentMethod?: string,
    paymentReference?: string
  ): Promise<InvoiceWithLineItems> {
    const [invoice] = await db
      .update(schema.invoices)
      .set({
        status: 'paid',
        paidAt: new Date(),
        paymentMethod: paymentMethod || null,
        paymentReference: paymentReference || null,
      })
      .where(eq(schema.invoices.id, invoiceId))
      .returning();

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    return this.getInvoice(invoiceId) as Promise<InvoiceWithLineItems>;
  }

  /**
   * Void an invoice
   * Also voids the Stripe invoice if one exists
   */
  async voidInvoice(invoiceId: string): Promise<InvoiceWithLineItems> {
    // Get the invoice to check for Stripe ID
    const [existingInvoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, invoiceId))
      .limit(1);

    if (!existingInvoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    // Void Stripe invoice if exists
    if (existingInvoice.stripeInvoiceId && stripeService.isEnabled()) {
      try {
        await stripeService.voidInvoice(existingInvoice.stripeInvoiceId);
        console.log(`[InvoiceService] Voided Stripe invoice ${existingInvoice.stripeInvoiceId}`);
      } catch (error) {
        console.error(`[InvoiceService] Failed to void Stripe invoice:`, error);
      }
    }

    const [invoice] = await db
      .update(schema.invoices)
      .set({
        status: 'void',
      })
      .where(eq(schema.invoices.id, invoiceId))
      .returning();

    return this.getInvoice(invoiceId) as Promise<InvoiceWithLineItems>;
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  /**
   * Generate a unique invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Get count of invoices this month
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.invoices)
      .where(
        and(
          gte(schema.invoices.createdAt, new Date(year, now.getMonth(), 1)),
          lte(schema.invoices.createdAt, new Date(year, now.getMonth() + 1, 0, 23, 59, 59))
        )
      );

    const sequence = ((countResult?.count as number) || 0) + 1;

    return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Map database invoice to interface
   */
  private mapInvoiceToInterface(
    invoice: schema.Invoice,
    lineItems: InvoiceLineItem[],
    billedToTenantName?: string
  ): InvoiceWithLineItems {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      billedToTenantId: invoice.billedToTenantId,
      billedToTenantName,
      billingPeriodStart: invoice.billingPeriodStart.toISOString(),
      billingPeriodEnd: invoice.billingPeriodEnd.toISOString(),
      status: invoice.status as InvoiceStatus,
      subtotal: parseFloat(invoice.subtotal),
      taxAmount: parseFloat(invoice.taxAmount),
      discountAmount: parseFloat(invoice.discountAmount),
      totalAmount: parseFloat(invoice.totalAmount),
      dueDate: invoice.dueDate?.toISOString() || null,
      paidAt: invoice.paidAt?.toISOString() || null,
      notes: invoice.notes,
      createdAt: invoice.createdAt?.toISOString() || new Date().toISOString(),
      finalizedAt: invoice.finalizedAt?.toISOString() || null,
      sentAt: invoice.sentAt?.toISOString() || null,
      stripeInvoiceId: invoice.stripeInvoiceId || null,
      stripeHostedInvoiceUrl: invoice.stripeHostedInvoiceUrl || null,
      lineItems,
    };
  }

  /**
   * Map database line item to interface
   */
  private mapLineItemToInterface(
    item: schema.InvoiceLineItem,
    communityName?: string
  ): InvoiceLineItem {
    return {
      id: item.id,
      invoiceId: item.invoiceId,
      communityId: item.communityId,
      communityName,
      lineType: item.lineType,
      description: item.description,
      quantity: item.quantity,
      unitPrice: parseFloat(item.unitPrice),
      totalPrice: parseFloat(item.totalPrice),
      tierId: item.tierId,
      sortOrder: item.sortOrder,
    };
  }
}

// Export singleton instance
export const invoiceService = new InvoiceService();
export default invoiceService;
