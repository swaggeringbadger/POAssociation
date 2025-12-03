/**
 * Billing Scheduler Service
 *
 * Manages scheduled billing jobs using node-cron.
 * - Daily: Reset expired billing cycles
 * - Monthly: Generate pending invoices
 */

import cron from 'node-cron';
import { communitySubscriptionService } from './communitySubscriptionService';
import { invoiceService } from './invoiceService';

class BillingScheduler {
  private isInitialized = false;
  private dailyCycleResetJob: cron.ScheduledTask | null = null;
  private monthlyInvoiceJob: cron.ScheduledTask | null = null;

  /**
   * Initialize all billing scheduled jobs
   * Should be called once at server startup
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log('[BillingScheduler] Already initialized, skipping...');
      return;
    }

    console.log('[BillingScheduler] Initializing billing scheduled jobs...');

    // Daily job: Check and reset expired billing cycles
    // Runs at 00:05 AM every day (5 minutes past midnight)
    this.dailyCycleResetJob = cron.schedule('5 0 * * *', async () => {
      await this.runDailyCycleReset();
    }, {
      scheduled: true,
      timezone: 'America/New_York', // Eastern Time
    });

    // Monthly job: Generate pending invoices
    // Runs at 01:00 AM on the 1st of every month
    this.monthlyInvoiceJob = cron.schedule('0 1 1 * *', async () => {
      await this.runMonthlyInvoiceGeneration();
    }, {
      scheduled: true,
      timezone: 'America/New_York',
    });

    this.isInitialized = true;
    console.log('[BillingScheduler] Billing jobs scheduled successfully');
    console.log('[BillingScheduler] - Daily cycle reset: 00:05 AM ET');
    console.log('[BillingScheduler] - Monthly invoice generation: 01:00 AM ET on 1st');

    // Run initial check on startup (after a short delay to let server fully start)
    setTimeout(async () => {
      console.log('[BillingScheduler] Running initial billing cycle check...');
      await this.runDailyCycleReset();
    }, 10000); // 10 second delay
  }

  /**
   * Run daily billing cycle reset
   * Resets AI credits and application counts for expired periods
   */
  async runDailyCycleReset(): Promise<void> {
    const startTime = Date.now();
    console.log('[BillingScheduler] Starting daily billing cycle reset...');

    try {
      const resetCount = await communitySubscriptionService.checkAndResetExpiredCycles();
      const duration = Date.now() - startTime;

      console.log(`[BillingScheduler] Daily cycle reset complete: ${resetCount} subscriptions reset in ${duration}ms`);
    } catch (error) {
      console.error('[BillingScheduler] Error during daily cycle reset:', error);
    }
  }

  /**
   * Run monthly invoice generation
   * Creates invoices for all billing entities with expired periods
   */
  async runMonthlyInvoiceGeneration(): Promise<void> {
    const startTime = Date.now();
    console.log('[BillingScheduler] Starting monthly invoice generation...');

    try {
      const invoiceCount = await invoiceService.generatePendingInvoices();
      const duration = Date.now() - startTime;

      console.log(`[BillingScheduler] Monthly invoice generation complete: ${invoiceCount} invoices created in ${duration}ms`);
    } catch (error) {
      console.error('[BillingScheduler] Error during invoice generation:', error);
    }
  }

  /**
   * Manually trigger a billing cycle reset (for testing/admin use)
   */
  async triggerCycleReset(): Promise<number> {
    console.log('[BillingScheduler] Manual billing cycle reset triggered');
    await this.runDailyCycleReset();
    return communitySubscriptionService.checkAndResetExpiredCycles();
  }

  /**
   * Manually trigger invoice generation (for testing/admin use)
   */
  async triggerInvoiceGeneration(): Promise<number> {
    console.log('[BillingScheduler] Manual invoice generation triggered');
    await this.runMonthlyInvoiceGeneration();
    return invoiceService.generatePendingInvoices();
  }

  /**
   * Stop all scheduled jobs (for graceful shutdown)
   */
  shutdown(): void {
    console.log('[BillingScheduler] Shutting down billing jobs...');

    if (this.dailyCycleResetJob) {
      this.dailyCycleResetJob.stop();
      this.dailyCycleResetJob = null;
    }

    if (this.monthlyInvoiceJob) {
      this.monthlyInvoiceJob.stop();
      this.monthlyInvoiceJob = null;
    }

    this.isInitialized = false;
    console.log('[BillingScheduler] Billing jobs stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isInitialized: boolean;
    dailyJobActive: boolean;
    monthlyJobActive: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      dailyJobActive: this.dailyCycleResetJob !== null,
      monthlyJobActive: this.monthlyInvoiceJob !== null,
    };
  }
}

// Export singleton instance
export const billingScheduler = new BillingScheduler();
export default billingScheduler;
