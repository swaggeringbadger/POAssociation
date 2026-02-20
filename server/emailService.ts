/**
 * SMTP2GO Email Service
 * Handles sending transactional emails for POAssociation
 */

import {
  buildEmailTemplate,
  applicationSubmittedTemplate,
  applicationApprovedTemplate,
  applicationRejectedTemplate,
  stepAssignmentTemplate,
  commentNotificationTemplate,
  invoiceTemplate,
  paymentReceivedTemplate,
  bulkCommunityInviteTemplate,
  householdMemberInviteTemplate,
  householdMemberJoinedTemplate,
  contractorInviteTemplate,
  contractorInviteAcceptedTemplate,
  contractorReferralTemplate,
  contractorReferralSignupTemplate,
  delegatedEditNotificationTemplate,
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
  private fromEmail = 'noreply@poassociation.com';
  private fromName = 'POAssociation';

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
        ? payload.to
        : [payload.to];

      const requestBody = {
        api_key: this.apiKey,
        to: recipients,
        sender: payload.from || this.fromEmail,
        subject: payload.subject,
        html_body: payload.html,
        ...(payload.replyTo && { reply_to: payload.replyTo }),
      };

      console.log('[EmailService] Sending to SMTP2GO with payload:', { 
        to: requestBody.to, 
        subject: requestBody.subject,
        sender: requestBody.sender 
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
      applicationLink || 'https://poassociation.com'
    );

    return this.send({
      to: homeownerEmail,
      subject: `Application Received: ${communityName}`,
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
      applicationLink || 'https://poassociation.com'
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
      applicationLink || 'https://poassociation.com'
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

  /**
   * Send invoice email
   */
  async sendInvoice(
    recipientEmail: string,
    recipientName: string,
    billingEntityName: string,
    invoiceNumber: string,
    invoiceAmount: string,
    billingPeriod: string,
    dueDate: string,
    invoiceLink: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = invoiceTemplate(
      recipientName,
      billingEntityName,
      invoiceNumber,
      invoiceAmount,
      billingPeriod,
      dueDate,
      invoiceLink
    );

    return this.send({
      to: recipientEmail,
      subject: `Invoice ${invoiceNumber} - ${billingEntityName}`,
      html,
    });
  }

  /**
   * Send payment received confirmation
   */
  async sendPaymentReceived(
    recipientEmail: string,
    recipientName: string,
    billingEntityName: string,
    invoiceNumber: string,
    paymentAmount: string,
    paymentDate: string,
    receiptLink: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = paymentReceivedTemplate(
      recipientName,
      billingEntityName,
      invoiceNumber,
      paymentAmount,
      paymentDate,
      receiptLink
    );

    return this.send({
      to: recipientEmail,
      subject: `Payment Received - Invoice ${invoiceNumber}`,
      html,
    });
  }

  // ============================================
  // Invitation Emails
  // ============================================

  /**
   * Send bulk community invitation email
   */
  async sendBulkCommunityInvite(
    recipientEmail: string,
    recipientName: string,
    communityName: string,
    inviterName: string,
    inviteLink: string,
    communityDescription?: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = bulkCommunityInviteTemplate(
      recipientName,
      communityName,
      inviterName,
      inviteLink,
      communityDescription
    );

    return this.send({
      to: recipientEmail,
      subject: `You're Invited to Join ${communityName}`,
      html,
    });
  }

  /**
   * Send household member invitation email
   */
  async sendHouseholdMemberInvite(
    recipientEmail: string,
    recipientName: string,
    inviterName: string,
    communityName: string,
    relationship: string,
    inviteLink: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = householdMemberInviteTemplate(
      recipientName,
      inviterName,
      communityName,
      relationship,
      inviteLink
    );

    return this.send({
      to: recipientEmail,
      subject: `${inviterName} invited you to join their household`,
      html,
    });
  }

  /**
   * Send notification when household member joins
   */
  async sendHouseholdMemberJoined(
    recipientEmail: string,
    recipientName: string,
    memberName: string,
    memberEmail: string,
    communityName: string,
    dashboardLink: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = householdMemberJoinedTemplate(
      recipientName,
      memberName,
      memberEmail,
      communityName,
      dashboardLink
    );

    return this.send({
      to: recipientEmail,
      subject: `${memberName} joined your household`,
      html,
    });
  }

  /**
   * Send contractor application invitation email
   */
  async sendContractorInvite(
    recipientEmail: string,
    recipientName: string,
    inviterName: string,
    applicationTitle: string,
    communityName: string,
    inviteLink: string,
    projectDescription?: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = contractorInviteTemplate(
      recipientName,
      inviterName,
      applicationTitle,
      communityName,
      inviteLink,
      projectDescription
    );

    return this.send({
      to: recipientEmail,
      subject: `${inviterName} invited you to collaborate on "${applicationTitle}"`,
      html,
    });
  }

  /**
   * Send notification when contractor accepts invitation
   */
  async sendContractorInviteAccepted(
    recipientEmail: string,
    recipientName: string,
    contractorName: string,
    contractorCompany: string | undefined,
    applicationTitle: string,
    communityName: string,
    applicationLink: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = contractorInviteAcceptedTemplate(
      recipientName,
      contractorName,
      contractorCompany,
      applicationTitle,
      communityName,
      applicationLink
    );

    return this.send({
      to: recipientEmail,
      subject: `${contractorName} joined your application`,
      html,
    });
  }

  /**
   * Send contractor referral link email
   */
  async sendContractorReferralLink(
    recipientEmail: string,
    recipientName: string,
    referralCode: string,
    referralLink: string,
    dashboardLink: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = contractorReferralTemplate(
      recipientName,
      referralCode,
      referralLink,
      dashboardLink
    );

    return this.send({
      to: recipientEmail,
      subject: 'Your POAssociation Referral Link',
      html,
    });
  }

  /**
   * Send notification when a community signs up using referral code
   */
  async sendContractorReferralSignup(
    recipientEmail: string,
    recipientName: string,
    communityName: string,
    referralCode: string,
    dashboardLink: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = contractorReferralSignupTemplate(
      recipientName,
      communityName,
      referralCode,
      dashboardLink
    );

    return this.send({
      to: recipientEmail,
      subject: `New Referral: ${communityName} signed up!`,
      html,
    });
  }

  /**
   * Send notification when application is edited on behalf of homeowner
   */
  async sendDelegatedEditNotification(
    recipientEmail: string,
    recipientName: string,
    applicationTitle: string,
    editorName: string,
    editorRole: string,
    changedFields: string[],
    editReason: string | undefined,
    applicationLink: string,
    communityName: string
  ): Promise<{ success: boolean; error?: string }> {
    const html = delegatedEditNotificationTemplate(
      recipientName,
      applicationTitle,
      editorName,
      editorRole,
      changedFields,
      editReason,
      applicationLink,
      communityName
    );

    return this.send({
      to: recipientEmail,
      subject: `Your application "${applicationTitle}" was updated`,
      html,
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
