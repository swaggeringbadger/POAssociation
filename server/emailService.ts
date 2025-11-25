/**
 * SMTP2GO Email Service
 * Handles sending transactional emails for CivicFlow
 */

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
    communityName: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = `
      <h2>Application Received</h2>
      <p>Hi ${applicantName},</p>
      <p>We have received your application for <strong>"${applicationTitle}"</strong> in ${communityName}.</p>
      <p>Your application is now under review. You can check the status anytime by logging into your account.</p>
      <p>We will notify you via email when there are any updates.</p>
      <p>Thank you,<br>CivicFlow Team</p>
    `;

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
    communityName: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = `
      <h2>Application Approved</h2>
      <p>Hi ${applicantName},</p>
      <p>Great news! Your application for <strong>"${applicationTitle}"</strong> in ${communityName} has been <strong>approved</strong>.</p>
      <p>You can proceed with your project. Please keep a copy of your approval for your records.</p>
      <p>If you have any questions, please don't hesitate to contact us.</p>
      <p>Thank you,<br>CivicFlow Team</p>
    `;

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
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    const reasonText = reason ? `<p><strong>Reason:</strong> ${reason}</p>` : '';
    
    const html = `
      <h2>Application Status Update</h2>
      <p>Hi ${applicantName},</p>
      <p>We regret to inform you that your application for <strong>"${applicationTitle}"</strong> in ${communityName} has been <strong>rejected</strong>.</p>
      ${reasonText}
      <p>Please review the feedback and consider resubmitting with the requested changes, or contact us to discuss further.</p>
      <p>Thank you,<br>CivicFlow Team</p>
    `;

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
    const html = `
      <h2>New Application Step Assignment</h2>
      <p>Hi ${recipientName},</p>
      <p>You have been assigned to review the <strong>"${stepTitle}"</strong> step for the application <strong>"${applicationTitle}"</strong> in ${communityName}.</p>
      <p><a href="${applicationLink}" style="background-color: #1e3a8a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View Application</a></p>
      <p>Please review and take appropriate action as soon as possible.</p>
      <p>Thank you,<br>CivicFlow Team</p>
    `;

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
    const html = `
      <h2>New Comment on Application</h2>
      <p>Hi ${recipientName},</p>
      <p><strong>${commenterName}</strong> commented on <strong>"${applicationTitle}"</strong>:</p>
      <blockquote style="border-left: 4px solid #1e3a8a; padding-left: 15px; margin: 15px 0; color: #666;">
        ${comment}
      </blockquote>
      <p><a href="${applicationLink}" style="background-color: #1e3a8a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View Conversation</a></p>
      <p>Thank you,<br>CivicFlow Team</p>
    `;

    return this.send({
      to: recipientEmail,
      subject: `New Comment: ${applicationTitle}`,
      html,
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
