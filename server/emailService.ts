/**
 * SMTP2GO Email Service
 * Handles sending transactional emails for CivicFlow
 */

import {
  buildEmailTemplate,
  applicationSubmittedTemplate,
  applicationApprovedTemplate,
  applicationRejectedTemplate,
  stepAssignmentTemplate,
  commentNotificationTemplate,
} from './emailTemplates';

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export class EmailService {
  private apiKey: string;
  private apiUrl = 'https://api.smtp2go.com/v3/email/send';
  private fromEmail = 'noreply@civicflow.com';
  private fromName = 'CivicFlow';

  constructor() {
    this.apiKey = process.env.SMTP2GO_API_KEY || '';
    if (!this.apiKey) {
      console.warn('SMTP2GO_API_KEY not configured. Email sending will be disabled.');
    }
  }

  /**
   * Send an email via SMTP2GO
   */
  async send(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.apiKey) {
      console.warn('Email sending disabled: SMTP2GO_API_KEY not configured');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const recipients = Array.isArray(payload.to) 
        ? payload.to.map(email => ({ email }))
        : [{ email: payload.to }];

      const requestBody = {
        api_key: this.apiKey,
        to: recipients,
        from: payload.from || `${this.fromName} <${this.fromEmail}>`,
        subject: payload.subject,
        html_body: payload.html,
        ...(payload.replyTo && { reply_to: payload.replyTo }),
      };

      console.log('[EmailService] Sending to SMTP2GO with payload:', { 
        to: requestBody.to, 
        subject: requestBody.subject,
        from: requestBody.from 
      });

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('SMTP2GO API error:', error);
        return { 
          success: false, 
          error: error.message || `HTTP ${response.status}` 
        };
      }

      const data = await response.json();
      return {
        success: true,
        messageId: data.request_id,
      };
    } catch (error: any) {
      console.error('Email service error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }
  }

  /**
   * Send application submission confirmation to homeowner
   */
  async sendApplicationSubmitted(
    homeownerEmail: string,
    applicationTitle: string,
    applicantName: string,
    communityName: string,
    applicationLink?: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = applicationSubmittedTemplate(
      applicantName,
      applicationTitle,
      communityName,
      applicationLink || 'https://civicflow.com'
    );

    return this.send({
      to: homeownerEmail,
      subject: `Application Received: ${applicationTitle}`,
      html,
    });
  }

  /**
   * Send application approval notification
   */
  async sendApplicationApproved(
    homeownerEmail: string,
    applicationTitle: string,
    applicantName: string,
    communityName: string,
    applicationLink?: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = applicationApprovedTemplate(
      applicantName,
      applicationTitle,
      communityName,
      applicationLink || 'https://civicflow.com'
    );

    return this.send({
      to: homeownerEmail,
      subject: `Approved: ${applicationTitle}`,
      html,
    });
  }

  /**
   * Send application rejection notification
   */
  async sendApplicationRejected(
    homeownerEmail: string,
    applicationTitle: string,
    applicantName: string,
    communityName: string,
    reason?: string,
    applicationLink?: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = applicationRejectedTemplate(
      applicantName,
      applicationTitle,
      communityName,
      reason,
      applicationLink || 'https://civicflow.com'
    );

    return this.send({
      to: homeownerEmail,
      subject: `Application Status: ${applicationTitle}`,
      html,
    });
  }

  /**
   * Send workflow step assignment notification to board members/staff
   */
  async sendStepAssignment(
    recipientEmail: string,
    recipientName: string,
    applicationTitle: string,
    stepTitle: string,
    communityName: string,
    applicationLink: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = stepAssignmentTemplate(
      recipientName,
      applicationTitle,
      stepTitle,
      communityName,
      applicationLink
    );

    return this.send({
      to: recipientEmail,
      subject: `Application Review Required: ${applicationTitle}`,
      html,
    });
  }

  /**
   * Send comment notification
   */
  async sendCommentNotification(
    recipientEmail: string,
    recipientName: string,
    commenterName: string,
    applicationTitle: string,
    comment: string,
    applicationLink: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = commentNotificationTemplate(
      recipientName,
      commenterName,
      applicationTitle,
      comment,
      applicationLink
    );

    return this.send({
      to: recipientEmail,
      subject: `New Comment: ${applicationTitle}`,
      html,
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
