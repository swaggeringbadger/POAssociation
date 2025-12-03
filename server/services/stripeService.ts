/**
 * Stripe Service
 *
 * Handles all Stripe API interactions for billing:
 * - Customer management
 * - Payment method management
 * - Invoice creation and auto-charging
 * - Setup intents for adding payment methods
 *
 * Environment Variables:
 * Development (test mode):
 *   STRIPE_SECRET_KEY_DEV=sk_test_xxx
 *   STRIPE_PUBLISHABLE_KEY_DEV=pk_test_xxx
 *   STRIPE_WEBHOOK_SECRET_DEV=whsec_xxx
 *
 * Production (live mode):
 *   STRIPE_SECRET_KEY=sk_live_xxx
 *   STRIPE_PUBLISHABLE_KEY=pk_live_xxx
 *   STRIPE_WEBHOOK_SECRET=whsec_xxx
 *
 * The service automatically selects the right keys based on NODE_ENV.
 */

import Stripe from 'stripe';
import { db } from '../storage';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';

// Determine which keys to use based on environment
const isDevelopment = process.env.NODE_ENV !== 'production';

// Get the appropriate Stripe keys
const stripeSecretKey = isDevelopment
  ? (process.env.STRIPE_SECRET_KEY_DEV || process.env.STRIPE_SECRET_KEY || '')
  : (process.env.STRIPE_SECRET_KEY || '');

const stripePublishableKey = isDevelopment
  ? (process.env.STRIPE_PUBLISHABLE_KEY_DEV || process.env.STRIPE_PUBLISHABLE_KEY || '')
  : (process.env.STRIPE_PUBLISHABLE_KEY || '');

const stripeWebhookSecret = isDevelopment
  ? (process.env.STRIPE_WEBHOOK_SECRET_DEV || process.env.STRIPE_WEBHOOK_SECRET || '')
  : (process.env.STRIPE_WEBHOOK_SECRET || '');

// Initialize Stripe with the appropriate API key
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-04-30.basil',
});

// Export for use in routes
export function getStripePublishableKey(): string | null {
  return stripePublishableKey || null;
}

export function getStripeWebhookSecret(): string | null {
  return stripeWebhookSecret || null;
}

export interface CreateCustomerOptions {
  tenantId: string;
  email: string;
  name: string;
  metadata?: Record<string, string>;
}

export interface CreateInvoiceOptions {
  tenantId: string;
  lineItems: Array<{
    description: string;
    amount: number; // in cents
    quantity?: number;
    metadata?: Record<string, string>;
  }>;
  daysUntilDue?: number; // for manual pay, default 30
  autoCharge?: boolean; // if true, charges saved payment method
  metadata?: Record<string, string>;
}

class StripeService {
  private isConfigured: boolean;
  private isTestMode: boolean;

  constructor() {
    this.isConfigured = !!stripeSecretKey;
    this.isTestMode = stripeSecretKey.startsWith('sk_test_');

    if (!this.isConfigured) {
      console.warn('[StripeService] No Stripe secret key configured. Stripe features disabled.');
      console.warn('[StripeService] Set STRIPE_SECRET_KEY_DEV for development or STRIPE_SECRET_KEY for production.');
    } else {
      const mode = this.isTestMode ? 'TEST' : 'LIVE';
      console.log(`[StripeService] Initialized in ${mode} mode (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
    }
  }

  /**
   * Check if running in Stripe test mode
   */
  isInTestMode(): boolean {
    return this.isTestMode;
  }

  /**
   * Check if Stripe is configured
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }

  // ==========================================
  // CUSTOMER MANAGEMENT
  // ==========================================

  /**
   * Create a Stripe customer for a billing entity (tenant)
   */
  async createCustomer(options: CreateCustomerOptions): Promise<Stripe.Customer> {
    if (!this.isConfigured) {
      throw new Error('Stripe is not configured');
    }

    const customer = await stripe.customers.create({
      email: options.email,
      name: options.name,
      metadata: {
        tenant_id: options.tenantId,
        ...options.metadata,
      },
    });

    // Store the Stripe customer ID in our database
    await db
      .update(schema.tenants)
      .set({ stripeCustomerId: customer.id })
      .where(eq(schema.tenants.id, options.tenantId));

    console.log(`[StripeService] Created customer ${customer.id} for tenant ${options.tenantId}`);
    return customer;
  }

  /**
   * Get or create a Stripe customer for a tenant
   */
  async getOrCreateCustomer(tenantId: string): Promise<Stripe.Customer> {
    if (!this.isConfigured) {
      throw new Error('Stripe is not configured');
    }

    // Check if tenant already has a Stripe customer
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    if (tenant.stripeCustomerId) {
      // Return existing customer
      return await stripe.customers.retrieve(tenant.stripeCustomerId) as Stripe.Customer;
    }

    // Create new customer
    return await this.createCustomer({
      tenantId,
      email: tenant.contactEmail || `billing-${tenantId}@poassociation.com`,
      name: tenant.name,
    });
  }

  /**
   * Get Stripe customer by tenant ID
   */
  async getCustomer(tenantId: string): Promise<Stripe.Customer | null> {
    if (!this.isConfigured) {
      return null;
    }

    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenantId))
      .limit(1);

    if (!tenant?.stripeCustomerId) {
      return null;
    }

    return await stripe.customers.retrieve(tenant.stripeCustomerId) as Stripe.Customer;
  }

  // ==========================================
  // PAYMENT METHOD MANAGEMENT
  // ==========================================

  /**
   * Create a SetupIntent for adding a payment method
   * Returns client_secret for use with Stripe Elements
   */
  async createSetupIntent(tenantId: string): Promise<Stripe.SetupIntent> {
    if (!this.isConfigured) {
      throw new Error('Stripe is not configured');
    }

    const customer = await this.getOrCreateCustomer(tenantId);

    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card', 'us_bank_account'],
      metadata: {
        tenant_id: tenantId,
      },
    });

    console.log(`[StripeService] Created SetupIntent ${setupIntent.id} for tenant ${tenantId}`);
    return setupIntent;
  }

  /**
   * List payment methods for a tenant
   */
  async listPaymentMethods(tenantId: string): Promise<Stripe.PaymentMethod[]> {
    if (!this.isConfigured) {
      return [];
    }

    const customer = await this.getCustomer(tenantId);
    if (!customer) {
      return [];
    }

    const cardMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'card',
    });

    const bankMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: 'us_bank_account',
    });

    return [...cardMethods.data, ...bankMethods.data];
  }

  /**
   * Set default payment method for a customer
   */
  async setDefaultPaymentMethod(tenantId: string, paymentMethodId: string): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Stripe is not configured');
    }

    const customer = await this.getCustomer(tenantId);
    if (!customer) {
      throw new Error('No Stripe customer found for tenant');
    }

    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Update our database to mark auto-pay enabled
    await db
      .update(schema.tenants)
      .set({ autoPayEnabled: true })
      .where(eq(schema.tenants.id, tenantId));

    console.log(`[StripeService] Set default payment method ${paymentMethodId} for tenant ${tenantId}`);
  }

  /**
   * Remove a payment method
   */
  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Stripe is not configured');
    }

    await stripe.paymentMethods.detach(paymentMethodId);
    console.log(`[StripeService] Removed payment method ${paymentMethodId}`);
  }

  // ==========================================
  // INVOICE MANAGEMENT
  // ==========================================

  /**
   * Create and optionally auto-charge a Stripe invoice
   */
  async createInvoice(options: CreateInvoiceOptions): Promise<Stripe.Invoice> {
    if (!this.isConfigured) {
      throw new Error('Stripe is not configured');
    }

    const customer = await this.getOrCreateCustomer(options.tenantId);

    // Check if customer has a default payment method for auto-charge
    const hasPaymentMethod = !!(customer.invoice_settings?.default_payment_method);
    const shouldAutoCharge = options.autoCharge !== false && hasPaymentMethod;

    // Create invoice items first
    for (const item of options.lineItems) {
      await stripe.invoiceItems.create({
        customer: customer.id,
        amount: item.amount,
        currency: 'usd',
        description: item.description,
        quantity: item.quantity || 1,
        metadata: item.metadata,
      });
    }

    // Create the invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: shouldAutoCharge ? 'charge_automatically' : 'send_invoice',
      days_until_due: shouldAutoCharge ? undefined : (options.daysUntilDue || 30),
      auto_advance: true, // Automatically finalize and (if auto-charge) attempt payment
      metadata: {
        tenant_id: options.tenantId,
        ...options.metadata,
      },
    });

    console.log(`[StripeService] Created invoice ${invoice.id} for tenant ${options.tenantId} (auto_charge: ${shouldAutoCharge})`);
    return invoice;
  }

  /**
   * Finalize a draft invoice (locks it for payment)
   */
  async finalizeInvoice(stripeInvoiceId: string): Promise<Stripe.Invoice> {
    if (!this.isConfigured) {
      throw new Error('Stripe is not configured');
    }

    const invoice = await stripe.invoices.finalizeInvoice(stripeInvoiceId);
    console.log(`[StripeService] Finalized invoice ${stripeInvoiceId}`);
    return invoice;
  }

  /**
   * Send an invoice email via Stripe
   */
  async sendInvoice(stripeInvoiceId: string): Promise<Stripe.Invoice> {
    if (!this.isConfigured) {
      throw new Error('Stripe is not configured');
    }

    const invoice = await stripe.invoices.sendInvoice(stripeInvoiceId);
    console.log(`[StripeService] Sent invoice ${stripeInvoiceId}`);
    return invoice;
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(stripeInvoiceId: string): Promise<Stripe.Invoice> {
    if (!this.isConfigured) {
      throw new Error('Stripe is not configured');
    }

    return await stripe.invoices.retrieve(stripeInvoiceId);
  }

  /**
   * Void an invoice
   */
  async voidInvoice(stripeInvoiceId: string): Promise<Stripe.Invoice> {
    if (!this.isConfigured) {
      throw new Error('Stripe is not configured');
    }

    const invoice = await stripe.invoices.voidInvoice(stripeInvoiceId);
    console.log(`[StripeService] Voided invoice ${stripeInvoiceId}`);
    return invoice;
  }

  // ==========================================
  // WEBHOOK HANDLING
  // ==========================================

  /**
   * Construct webhook event from request
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    if (!stripeWebhookSecret) {
      throw new Error('Stripe webhook secret not configured. Set STRIPE_WEBHOOK_SECRET_DEV or STRIPE_WEBHOOK_SECRET.');
    }

    return stripe.webhooks.constructEvent(
      payload,
      signature,
      stripeWebhookSecret
    );
  }

  /**
   * Handle invoice.paid webhook
   */
  async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const tenantId = invoice.metadata?.tenant_id;
    if (!tenantId) {
      console.warn(`[StripeService] Invoice ${invoice.id} has no tenant_id in metadata`);
      return;
    }

    // Find our invoice record linked to this Stripe invoice
    const [ourInvoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.stripeInvoiceId, invoice.id))
      .limit(1);

    if (ourInvoice) {
      // Update our invoice status
      await db
        .update(schema.invoices)
        .set({
          status: 'paid',
          paidAt: new Date(),
          paymentMethod: invoice.payment_intent ? 'stripe' : 'unknown',
          paymentReference: invoice.payment_intent as string || null,
        })
        .where(eq(schema.invoices.id, ourInvoice.id));

      console.log(`[StripeService] Marked invoice ${ourInvoice.id} as paid (Stripe: ${invoice.id})`);
    }
  }

  /**
   * Handle invoice.payment_failed webhook
   */
  async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const tenantId = invoice.metadata?.tenant_id;
    if (!tenantId) {
      console.warn(`[StripeService] Invoice ${invoice.id} has no tenant_id in metadata`);
      return;
    }

    console.log(`[StripeService] Payment failed for invoice ${invoice.id}, tenant ${tenantId}`);

    // TODO: Send payment failure notification email
    // TODO: Update tenant billing status if multiple failures
  }

  /**
   * Handle payment_method.attached webhook
   */
  async handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    const customerId = paymentMethod.customer as string;
    if (!customerId) return;

    // Find tenant by Stripe customer ID
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.stripeCustomerId, customerId))
      .limit(1);

    if (tenant) {
      console.log(`[StripeService] Payment method ${paymentMethod.id} attached for tenant ${tenant.id}`);
    }
  }
}

// Export singleton instance
export const stripeService = new StripeService();
export default stripeService;
