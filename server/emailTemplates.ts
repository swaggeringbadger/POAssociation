/**
 * Modern Email Templates for POAssociation
 * Vibrant, engaging design for all transactional emails
 */

export interface EmailTemplateProps {
  title: string;
  preheader: string;
  mainContent: string;
  actionButton?: {
    text: string;
    url: string;
  };
  secondaryContent?: string;
  recipientName?: string;
  communityName?: string;
  status?: 'success' | 'info' | 'warning' | 'action';
}

// Modern vibrant color palette
const PRIMARY_BLUE = "#3b82f6"; // Bright blue
const PRIMARY_PURPLE = "#8b5cf6"; // Vibrant purple
const SUCCESS_GREEN = "#10b981"; // Fresh green
const WARNING_AMBER = "#f59e0b"; // Warm amber
const INFO_CYAN = "#06b6d4"; // Bright cyan
const TEXT_DARK = "#1f2937";
const TEXT_LIGHT = "#6b7280";
const BORDER_COLOR = "#e5e7eb";
const BACKGROUND_LIGHT = "#f8fafc";

/**
 * Build a modern, vibrant HTML email template
 */
export function buildEmailTemplate(props: EmailTemplateProps): string {
  const {
    title,
    preheader,
    mainContent,
    actionButton,
    secondaryContent,
    recipientName,
    communityName,
    status = 'info',
  } = props;

  // Determine header gradient based on status
  const headerGradients = {
    success: `linear-gradient(135deg, ${SUCCESS_GREEN} 0%, #059669 100%)`,
    info: `linear-gradient(135deg, ${PRIMARY_BLUE} 0%, ${PRIMARY_PURPLE} 100%)`,
    warning: `linear-gradient(135deg, ${WARNING_AMBER} 0%, #dc2626 100%)`,
    action: `linear-gradient(135deg, ${INFO_CYAN} 0%, ${PRIMARY_BLUE} 100%)`,
  };

  const buttonGradients = {
    success: `linear-gradient(135deg, ${SUCCESS_GREEN} 0%, #059669 100%)`,
    info: `linear-gradient(135deg, ${PRIMARY_BLUE} 0%, ${PRIMARY_PURPLE} 100%)`,
    warning: `linear-gradient(135deg, ${WARNING_AMBER} 0%, #ea580c 100%)`,
    action: `linear-gradient(135deg, ${INFO_CYAN} 0%, ${PRIMARY_BLUE} 100%)`,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${preheader}">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', 'Helvetica Neue', sans-serif;
      background-color: ${BACKGROUND_LIGHT};
      color: ${TEXT_DARK};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    table {
      border-collapse: collapse;
    }
    img {
      border: 0;
      display: block;
      max-width: 100%;
    }
    a {
      color: ${PRIMARY_BLUE};
      text-decoration: none;
    }
    .email-wrapper {
      background: linear-gradient(180deg, ${BACKGROUND_LIGHT} 0%, #ffffff 100%);
      padding: 40px 20px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    .header {
      background: ${headerGradients[status]};
      padding: 48px 40px;
      text-align: center;
      position: relative;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: -20px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 40px;
      background: #ffffff;
      border-radius: 50%;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header-title {
      font-size: 32px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 8px 0;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header-subtitle {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.95);
      margin: 0;
      font-weight: 500;
    }
    .content {
      padding: 56px 40px 40px;
    }
    .greeting {
      font-size: 18px;
      color: ${TEXT_DARK};
      margin: 0 0 24px 0;
      line-height: 1.6;
      font-weight: 600;
    }
    .main-message {
      font-size: 16px;
      color: ${TEXT_DARK};
      line-height: 1.8;
      margin: 24px 0;
    }
    .main-message p {
      margin: 16px 0;
    }
    .accent-text {
      font-weight: 700;
      color: ${PRIMARY_BLUE};
      background: linear-gradient(135deg, ${PRIMARY_BLUE} 0%, ${PRIMARY_PURPLE} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .button-container {
      text-align: center;
      margin: 36px 0;
    }
    .button {
      display: inline-block;
      background: ${buttonGradients[status]};
      color: #ffffff;
      padding: 16px 40px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 700;
      text-decoration: none;
      border: none;
      cursor: pointer;
      box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3), 0 4px 6px -2px rgba(59, 130, 246, 0.2);
      transition: all 0.3s ease;
      letter-spacing: 0.3px;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 25px -5px rgba(59, 130, 246, 0.4), 0 10px 10px -5px rgba(59, 130, 246, 0.3);
    }
    .secondary-content {
      font-size: 14px;
      color: ${TEXT_LIGHT};
      line-height: 1.7;
      margin-top: 32px;
      padding: 24px;
      background-color: ${BACKGROUND_LIGHT};
      border-radius: 12px;
      border: 1px solid ${BORDER_COLOR};
    }
    .footer {
      background: linear-gradient(180deg, #ffffff 0%, ${BACKGROUND_LIGHT} 100%);
      padding: 40px;
      text-align: center;
    }
    .footer-brand {
      font-size: 20px;
      font-weight: 800;
      background: linear-gradient(135deg, ${PRIMARY_BLUE} 0%, ${PRIMARY_PURPLE} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 16px;
    }
    .footer-text {
      font-size: 13px;
      color: ${TEXT_LIGHT};
      margin: 8px 0;
      line-height: 1.6;
    }
    .footer-link {
      color: ${PRIMARY_BLUE};
      text-decoration: none;
      font-weight: 600;
    }
    .highlight-box {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border-left: 5px solid ${PRIMARY_BLUE};
      padding: 24px;
      margin: 24px 0;
      border-radius: 12px;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    }
    .highlight-box p {
      margin: 0;
      font-size: 15px;
      color: ${TEXT_DARK};
      line-height: 1.7;
      font-weight: 500;
    }
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 8px 0;
    }
    .badge-success {
      background: linear-gradient(135deg, ${SUCCESS_GREEN} 0%, #059669 100%);
      color: #ffffff;
    }
    .badge-info {
      background: linear-gradient(135deg, ${INFO_CYAN} 0%, ${PRIMARY_BLUE} 100%);
      color: #ffffff;
    }
    .badge-warning {
      background: linear-gradient(135deg, ${WARNING_AMBER} 0%, #dc2626 100%);
      color: #ffffff;
    }
    @media (max-width: 600px) {
      .email-wrapper {
        padding: 20px 10px;
      }
      .email-container {
        border-radius: 12px;
      }
      .content {
        padding: 40px 24px 24px !important;
      }
      .header {
        padding: 32px 24px !important;
      }
      .header-title {
        font-size: 24px !important;
      }
      .header-subtitle {
        font-size: 14px !important;
      }
      .button {
        width: 100%;
        box-sizing: border-box;
        padding: 14px 24px;
      }
      .highlight-box {
        padding: 16px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="email-container" style="margin: 0 auto;">
            <!-- Header -->
            <tr>
              <td class="header">
                <h1 class="header-title">${communityName || 'POAssociation'}</h1>
                <p class="header-subtitle">${title}</p>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td class="content">
                ${recipientName ? `<p class="greeting">Hi ${recipientName},</p>` : ''}

                <div class="main-message">
                  ${mainContent}
                </div>

                ${actionButton ? `
                  <div class="button-container">
                    <a href="${actionButton.url}" class="button">${actionButton.text}</a>
                  </div>
                ` : ''}

                ${secondaryContent ? `
                  <div class="secondary-content">
                    ${secondaryContent}
                  </div>
                ` : ''}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td class="footer">
                <div class="footer-brand">POAssociation</div>
                <p class="footer-text">
                  You're receiving this email because you have an account with your community association.
                </p>
                <p class="footer-text">
                  © ${new Date().getFullYear()} poassociation.com. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/**
 * Application Submission Confirmation
 */
export function applicationSubmittedTemplate(
  recipientName: string,
  applicationTitle: string,
  communityName: string,
  applicationLink: string
): string {
  return buildEmailTemplate({
    title: "Application Received",
    preheader: "Your application has been received and is under review.",
    recipientName,
    communityName,
    status: 'info',
    mainContent: `
      <p>We have successfully received your application for <span class="accent-text">"${applicationTitle}"</span> in <span class="accent-text">${communityName}</span>.</p>
      <div class="highlight-box">
        <p><strong>What's Next?</strong><br>Your application is now under review. Our team will carefully examine your submission and will get back to you shortly with next steps.</p>
      </div>
      <p>In the meantime, you can check the status of your application anytime by logging into your account.</p>
    `,
    actionButton: {
      text: "View Application",
      url: applicationLink,
    },
    secondaryContent: `
      <strong>Stay Updated</strong><br>We'll send you email notifications as your application progresses through each review stage. If you have any questions, please don't hesitate to reach out.
    `,
  });
}

/**
 * Application Approved
 */
export function applicationApprovedTemplate(
  recipientName: string,
  applicationTitle: string,
  communityName: string,
  applicationLink: string
): string {
  return buildEmailTemplate({
    title: "Application Approved",
    preheader: "Great news! Your application has been approved.",
    recipientName,
    communityName,
    status: 'success',
    mainContent: `
      <p><strong>Congratulations!</strong> Your application for <span class="accent-text">"${applicationTitle}"</span> in <span class="accent-text">${communityName}</span> has been <strong>approved</strong>.</p>
      <div class="highlight-box">
        <p><strong>You're All Set!</strong><br>You may now proceed with your project. Please keep a copy of your approval for your records and follow any conditions or guidelines outlined in the approval.</p>
      </div>
      <p>If you have any questions or need any assistance getting started, please don't hesitate to contact us.</p>
    `,
    actionButton: {
      text: "View Approval Details",
      url: applicationLink,
    },
    secondaryContent: `
      <strong>Helpful Tip</strong><br>Make sure to review any conditions or requirements included in your approval before starting work.
    `,
  });
}

/**
 * Application Rejected
 */
export function applicationRejectedTemplate(
  recipientName: string,
  applicationTitle: string,
  communityName: string,
  reason: string | undefined,
  applicationLink: string
): string {
  return buildEmailTemplate({
    title: "Application Status Update",
    preheader: "Your application status has been updated.",
    recipientName,
    communityName,
    status: 'warning',
    mainContent: `
      <p>We have carefully reviewed your application for <span class="accent-text">"${applicationTitle}"</span> in <span class="accent-text">${communityName}</span>.</p>
      <div class="highlight-box">
        <p><strong>Not Approved</strong><br>Unfortunately, your application has not been approved at this time.</p>
      </div>
      ${reason ? `<p><strong>Reviewer Feedback:</strong><br>${reason}</p>` : ''}
      <p>We encourage you to review the feedback carefully. You're welcome to resubmit with the requested changes or contact us to discuss further.</p>
    `,
    actionButton: {
      text: "Review Full Details",
      url: applicationLink,
    },
    secondaryContent: `
      <strong>Want to Resubmit?</strong><br>You can address the feedback and submit a revised application. We're here to help you succeed!
    `,
  });
}

/**
 * Workflow Step Assignment
 */
export function stepAssignmentTemplate(
  recipientName: string,
  applicationTitle: string,
  stepTitle: string,
  communityName: string,
  applicationLink: string
): string {
  return buildEmailTemplate({
    title: "Action Required",
    preheader: "You have been assigned a new application review step.",
    recipientName,
    communityName,
    status: 'action',
    mainContent: `
      <p>You have been assigned to review the <span class="accent-text">"${stepTitle}"</span> step for the application <span class="accent-text">"${applicationTitle}"</span> in <span class="accent-text">${communityName}</span>.</p>
      <div class="highlight-box">
        <p><strong>Action Needed</strong><br>Please review the application details and take appropriate action as soon as possible to keep things moving smoothly.</p>
      </div>
      <p>Your timely review helps us process applications efficiently and serve our community better. Thank you for your dedication!</p>
    `,
    actionButton: {
      text: "Start Review Now",
      url: applicationLink,
    },
    secondaryContent: `
      <strong>Quick Reviews Matter</strong><br>Your prompt attention helps homeowners get responses faster and keeps our community running smoothly.
    `,
  });
}

/**
 * Comment Notification
 */
export function commentNotificationTemplate(
  recipientName: string,
  commenterName: string,
  applicationTitle: string,
  comment: string,
  applicationLink: string,
  communityName?: string
): string {
  return buildEmailTemplate({
    title: "New Comment",
    preheader: `${commenterName} commented on "${applicationTitle}"`,
    recipientName,
    communityName,
    status: 'info',
    mainContent: `
      <p><span class="accent-text">${commenterName}</span> has left a comment on <span class="accent-text">"${applicationTitle}"</span>:</p>
      <div class="highlight-box">
        <p><em>"${comment}"</em></p>
      </div>
      <p>View the full conversation and respond to continue the discussion.</p>
    `,
    actionButton: {
      text: "View & Reply",
      url: applicationLink,
    },
    secondaryContent: `
      <strong>Stay Engaged</strong><br>Quick responses help keep communication flowing and resolve questions faster.
    `,
  });
}

/**
 * Workflow Changed Notification
 * Sent to account admins and board members when the active workflow is changed
 */
export function workflowChangedTemplate(
  recipientName: string,
  communityName: string,
  previousWorkflowName: string | null,
  newWorkflowName: string,
  changedByName: string,
  settingsLink: string
): string {
  return buildEmailTemplate({
    title: "Workflow Updated",
    preheader: `The approval workflow for ${communityName} has been changed.`,
    recipientName,
    communityName,
    status: 'info',
    mainContent: `
      <p>The approval workflow for <span class="accent-text">${communityName}</span> has been updated by <span class="accent-text">${changedByName}</span>.</p>
      <div class="highlight-box">
        <p><strong>Workflow Change</strong><br>
        ${previousWorkflowName
          ? `Previous: <em>${previousWorkflowName}</em><br>`
          : 'Previous: <em>No workflow assigned</em><br>'}
        New: <strong>${newWorkflowName}</strong></p>
      </div>
      <p>All new applications submitted to this community will now follow the <strong>${newWorkflowName}</strong> workflow. Existing applications in progress will continue using their original workflow.</p>
    `,
    actionButton: {
      text: "View Workflow Settings",
      url: settingsLink,
    },
    secondaryContent: `
      <strong>Need to Review?</strong><br>If you have questions about this change, please contact your property administrator.
    `,
  });
}

/**
 * Invoice Email Template
 * Sent to billing contacts when an invoice is ready
 */
export function invoiceTemplate(
  recipientName: string,
  billingEntityName: string,
  invoiceNumber: string,
  invoiceAmount: string,
  billingPeriod: string,
  dueDate: string,
  invoiceLink: string
): string {
  return buildEmailTemplate({
    title: "Your Invoice is Ready",
    preheader: `Invoice ${invoiceNumber} for ${billingPeriod} is now available.`,
    recipientName,
    communityName: billingEntityName,
    status: 'action',
    mainContent: `
      <p>Your invoice for <span class="accent-text">${billingEntityName}</span> is now ready for review.</p>
      <div class="highlight-box" style="text-align: center;">
        <p style="margin-bottom: 8px;"><strong>Invoice #${invoiceNumber}</strong></p>
        <p style="font-size: 28px; font-weight: bold; color: #3b82f6; margin: 8px 0;">${invoiceAmount}</p>
        <p style="color: #6b7280; font-size: 14px;">Billing Period: ${billingPeriod}</p>
        <p style="color: #6b7280; font-size: 14px;">Due Date: <strong>${dueDate}</strong></p>
      </div>
      <p>Click the button below to view your invoice details and download a PDF copy.</p>
    `,
    actionButton: {
      text: "View Invoice",
      url: invoiceLink,
    },
    secondaryContent: `
      <strong>Payment Options</strong><br>You can pay your invoice online via ACH or credit card. If you have any questions about this invoice, please contact billing@poassociation.com.
    `,
  });
}

/**
 * Payment Received Template
 * Sent when a payment is successfully processed
 */
export function paymentReceivedTemplate(
  recipientName: string,
  billingEntityName: string,
  invoiceNumber: string,
  paymentAmount: string,
  paymentDate: string,
  receiptLink: string
): string {
  return buildEmailTemplate({
    title: "Payment Received",
    preheader: `Thank you! Your payment of ${paymentAmount} has been received.`,
    recipientName,
    communityName: billingEntityName,
    status: 'success',
    mainContent: `
      <p>We have received your payment. Thank you for your prompt payment!</p>
      <div class="highlight-box" style="text-align: center;">
        <p style="margin-bottom: 8px;"><strong>Payment Confirmation</strong></p>
        <p style="font-size: 28px; font-weight: bold; color: #10b981; margin: 8px 0;">${paymentAmount}</p>
        <p style="color: #6b7280; font-size: 14px;">Invoice: #${invoiceNumber}</p>
        <p style="color: #6b7280; font-size: 14px;">Payment Date: ${paymentDate}</p>
      </div>
      <p>A receipt has been generated and is available for download in your billing dashboard.</p>
    `,
    actionButton: {
      text: "View Receipt",
      url: receiptLink,
    },
    secondaryContent: `
      <strong>Thank You</strong><br>We appreciate your continued partnership. If you have any questions, please don't hesitate to reach out.
    `,
  });
}

/**
 * Contact Form / Demo Request Template
 * Sent to the sales/support team when someone submits a contact or demo request
 */
export function contactFormTemplate(
  mode: 'contact' | 'demo',
  formData: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    communitySize?: string;
    message?: string;
    preferredTime?: string;
  }
): string {
  const isDemo = mode === 'demo';
  const title = isDemo ? 'New Demo Request' : 'New Contact Form Submission';

  const detailsHtml = `
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><strong>Name:</strong></td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">${formData.name}</td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><strong>Email:</strong></td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><a href="mailto:${formData.email}">${formData.email}</a></td>
      </tr>
      ${formData.phone ? `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><strong>Phone:</strong></td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">${formData.phone}</td>
      </tr>
      ` : ''}
      ${formData.company ? `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><strong>Organization:</strong></td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">${formData.company}</td>
      </tr>
      ` : ''}
      ${formData.communitySize ? `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><strong>Community Size:</strong></td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">${formData.communitySize}</td>
      </tr>
      ` : ''}
      ${formData.preferredTime ? `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><strong>Preferred Time:</strong></td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">${formData.preferredTime}</td>
      </tr>
      ` : ''}
    </table>
  `;

  return buildEmailTemplate({
    title,
    preheader: isDemo
      ? `${formData.name} from ${formData.company || 'unknown organization'} wants a demo`
      : `${formData.name} sent a message via the contact form`,
    status: 'action',
    mainContent: `
      <p>A new ${isDemo ? 'demo request' : 'contact form submission'} has been received:</p>
      <div class="highlight-box">
        ${detailsHtml}
      </div>
      ${formData.message ? `
        <p><strong>Message:</strong></p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <p style="margin: 0; white-space: pre-wrap;">${formData.message}</p>
        </div>
      ` : ''}
    `,
    actionButton: {
      text: `Reply to ${formData.name}`,
      url: `mailto:${formData.email}?subject=${encodeURIComponent(isDemo ? 'RE: Your POAssociation Demo Request' : 'RE: Your POAssociation Inquiry')}`,
    },
    secondaryContent: `
      <strong>Response Time</strong><br>${isDemo
        ? 'Demo requests should be responded to within 24 business hours.'
        : 'Contact form submissions should be acknowledged within 48 hours.'}
    `,
  });
}

// ============================================
// Invitation Email Templates
// ============================================

/**
 * Bulk Community Invitation
 * Sent when a new POA/HOA onboards and invites all their members
 */
export function bulkCommunityInviteTemplate(
  recipientName: string,
  communityName: string,
  inviterName: string,
  inviteLink: string,
  communityDescription?: string
): string {
  return buildEmailTemplate({
    title: "You're Invited!",
    preheader: `${inviterName} has invited you to join ${communityName} on POAssociation`,
    recipientName,
    communityName,
    status: 'action',
    mainContent: `
      <p>Great news! <span class="accent-text">${inviterName}</span> has invited you to join <span class="accent-text">${communityName}</span> on POAssociation.</p>
      ${communityDescription ? `
        <div class="highlight-box">
          <p>${communityDescription}</p>
        </div>
      ` : ''}
      <p>POAssociation is a modern platform that makes it easy to:</p>
      <ul style="margin: 16px 0; padding-left: 24px; color: ${TEXT_DARK};">
        <li style="margin: 8px 0;">Submit architectural modification requests online</li>
        <li style="margin: 8px 0;">Track the status of your applications in real-time</li>
        <li style="margin: 8px 0;">Communicate directly with your community board</li>
        <li style="margin: 8px 0;">Access community documents and guidelines</li>
      </ul>
      <p>Click the button below to create your account and get started!</p>
    `,
    actionButton: {
      text: "Accept Invitation",
      url: inviteLink,
    },
    secondaryContent: `
      <strong>Questions?</strong><br>If you have any questions about this invitation, please contact your community administrator or reply to this email.
    `,
  });
}

/**
 * Household Member Invitation
 * Sent when a homeowner invites a spouse/family member to share their applications
 */
export function householdMemberInviteTemplate(
  recipientName: string,
  inviterName: string,
  communityName: string,
  relationship: string,
  inviteLink: string
): string {
  return buildEmailTemplate({
    title: "Join Your Household",
    preheader: `${inviterName} has invited you to join their household on POAssociation`,
    recipientName,
    communityName,
    status: 'action',
    mainContent: `
      <p><span class="accent-text">${inviterName}</span> has invited you to join their household as their <span class="accent-text">${relationship}</span> on POAssociation.</p>
      <div class="highlight-box">
        <p><strong>What does this mean?</strong><br>
        As a household member, you'll have full access to:</p>
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          <li>All past and future applications submitted by your household</li>
          <li>The ability to submit new applications on behalf of your home</li>
          <li>Real-time updates and notifications about your projects</li>
        </ul>
      </div>
      <p>Click below to accept this invitation and join the household.</p>
    `,
    actionButton: {
      text: "Join Household",
      url: inviteLink,
    },
    secondaryContent: `
      <strong>Not expecting this?</strong><br>If you don't recognize this invitation or believe it was sent in error, you can safely ignore this email.
    `,
  });
}

/**
 * Household Member Joined Notification
 * Sent to the primary homeowner when a household member accepts their invitation
 */
export function householdMemberJoinedTemplate(
  recipientName: string,
  memberName: string,
  memberEmail: string,
  communityName: string,
  dashboardLink: string
): string {
  return buildEmailTemplate({
    title: "Household Member Joined",
    preheader: `${memberName} has joined your household on POAssociation`,
    recipientName,
    communityName,
    status: 'success',
    mainContent: `
      <p>Great news! <span class="accent-text">${memberName}</span> (${memberEmail}) has accepted your invitation and joined your household.</p>
      <div class="highlight-box">
        <p><strong>What's next?</strong><br>
        ${memberName} now has full access to your household's applications. They can view all past submissions and create new applications on behalf of your home.</p>
      </div>
      <p>You can manage your household members anytime from your account settings.</p>
    `,
    actionButton: {
      text: "View Household Settings",
      url: dashboardLink,
    },
    secondaryContent: `
      <strong>Need to make changes?</strong><br>You can remove household members or invite additional family members from your household settings.
    `,
  });
}

/**
 * Contractor Application Invitation
 * Sent when a homeowner invites a contractor to collaborate on a specific application
 */
export function contractorInviteTemplate(
  recipientName: string,
  inviterName: string,
  applicationTitle: string,
  communityName: string,
  inviteLink: string,
  projectDescription?: string
): string {
  return buildEmailTemplate({
    title: "Collaborate on a Project",
    preheader: `${inviterName} has invited you to collaborate on "${applicationTitle}"`,
    recipientName,
    status: 'action',
    mainContent: `
      <p><span class="accent-text">${inviterName}</span> has invited you to collaborate on their application for <span class="accent-text">"${applicationTitle}"</span> in <span class="accent-text">${communityName}</span>.</p>
      ${projectDescription ? `
        <div class="highlight-box">
          <p><strong>Project Details:</strong><br>${projectDescription}</p>
        </div>
      ` : ''}
      <p>As a collaborator, you'll be able to:</p>
      <ul style="margin: 16px 0; padding-left: 24px; color: ${TEXT_DARK};">
        <li style="margin: 8px 0;">View and edit the application details</li>
        <li style="margin: 8px 0;">Upload documents and plans</li>
        <li style="margin: 8px 0;">Receive updates on the application status</li>
        <li style="margin: 8px 0;">Communicate with the homeowner and reviewers</li>
      </ul>
      <p>Click below to accept this invitation and start collaborating.</p>
    `,
    actionButton: {
      text: "Accept & Collaborate",
      url: inviteLink,
    },
    secondaryContent: `
      <strong>Build Your Reputation</strong><br>Successfully completed projects help build your contractor profile on POAssociation, making it easier for other homeowners to find and hire you.
    `,
  });
}

/**
 * Contractor Invitation Accepted Notification
 * Sent to the homeowner when a contractor accepts their invitation
 */
export function contractorInviteAcceptedTemplate(
  recipientName: string,
  contractorName: string,
  contractorCompany: string | undefined,
  applicationTitle: string,
  communityName: string,
  applicationLink: string
): string {
  const contractorDisplay = contractorCompany
    ? `${contractorName} from ${contractorCompany}`
    : contractorName;

  return buildEmailTemplate({
    title: "Contractor Joined",
    preheader: `${contractorDisplay} has joined your application`,
    recipientName,
    communityName,
    status: 'success',
    mainContent: `
      <p><span class="accent-text">${contractorDisplay}</span> has accepted your invitation and joined your application for <span class="accent-text">"${applicationTitle}"</span>.</p>
      <div class="highlight-box">
        <p><strong>What's next?</strong><br>
        Your contractor can now view and contribute to your application. They'll be able to upload documents, edit details, and receive status updates alongside you.</p>
      </div>
      <p>You can view the application and communicate with your contractor by clicking below.</p>
    `,
    actionButton: {
      text: "View Application",
      url: applicationLink,
    },
    secondaryContent: `
      <strong>Working Together</strong><br>Collaborating with your contractor through POAssociation helps ensure everyone stays on the same page throughout the approval process.
    `,
  });
}

/**
 * Contractor Referral Email
 * Sent to contractors with their referral link to share with POAs/HOAs
 */
export function contractorReferralTemplate(
  recipientName: string,
  referralCode: string,
  referralLink: string,
  dashboardLink: string
): string {
  return buildEmailTemplate({
    title: "Your Referral Link",
    preheader: "Share your referral link and earn rewards when communities sign up",
    recipientName,
    status: 'info',
    mainContent: `
      <p>Thanks for being part of the POAssociation contractor network! Here's your personal referral link to share with property owners associations and HOAs.</p>
      <div class="highlight-box" style="text-align: center;">
        <p style="margin-bottom: 8px;"><strong>Your Referral Code</strong></p>
        <p style="font-size: 24px; font-weight: bold; color: #3b82f6; margin: 8px 0; font-family: monospace;">${referralCode}</p>
        <p style="font-size: 12px; color: #6b7280; word-break: break-all;">${referralLink}</p>
      </div>
      <p><strong>How it works:</strong></p>
      <ul style="margin: 16px 0; padding-left: 24px; color: ${TEXT_DARK};">
        <li style="margin: 8px 0;">Share your link with POAs, HOAs, or property managers</li>
        <li style="margin: 8px 0;">When they sign up using your link, you get credit</li>
        <li style="margin: 8px 0;">Earn rewards for each qualified referral</li>
        <li style="margin: 8px 0;">Track your referrals from your dashboard</li>
      </ul>
    `,
    actionButton: {
      text: "View Referral Dashboard",
      url: dashboardLink,
    },
    secondaryContent: `
      <strong>Pro Tip</strong><br>The best referrals come from communities you already work with. They've seen your quality work and trust your recommendations!
    `,
  });
}

/**
 * Contractor Referral Signup Notification
 * Sent to contractor when a POA signs up using their referral code
 */
export function contractorReferralSignupTemplate(
  recipientName: string,
  communityName: string,
  referralCode: string,
  dashboardLink: string
): string {
  return buildEmailTemplate({
    title: "New Referral Signup!",
    preheader: `${communityName} signed up using your referral code`,
    recipientName,
    status: 'success',
    mainContent: `
      <p>Congratulations! A new community has signed up for POAssociation using your referral code.</p>
      <div class="highlight-box" style="text-align: center;">
        <p style="margin-bottom: 8px;"><strong>New Community</strong></p>
        <p style="font-size: 20px; font-weight: bold; color: #10b981; margin: 8px 0;">${communityName}</p>
        <p style="font-size: 12px; color: #6b7280;">Referral Code: ${referralCode}</p>
      </div>
      <p>This referral is now being tracked. Once the community completes their onboarding and becomes a qualified referral, you'll be notified about your reward.</p>
    `,
    actionButton: {
      text: "View All Referrals",
      url: dashboardLink,
    },
    secondaryContent: `
      <strong>Keep It Going!</strong><br>Every community you refer helps grow the network and earns you rewards. Keep sharing your referral link!
    `,
  });
}

/**
 * Delegated Edit Notification
 * Sent to homeowner when a management rep edits their application on their behalf
 */
export function delegatedEditNotificationTemplate(
  recipientName: string,
  applicationTitle: string,
  editorName: string,
  editorRole: string,
  changedFields: string[],
  editReason: string | undefined,
  applicationLink: string,
  communityName: string
): string {
  const roleDisplayNames: Record<string, string> = {
    management_rep: 'Management Representative',
    management_manager: 'Management Manager',
    account_admin: 'Account Administrator',
    super_admin: 'System Administrator',
    poa_board_member: 'Board Member',
    poa_board_contributor: 'ARC Committee Member',
  };

  const roleDisplay = roleDisplayNames[editorRole] || editorRole;

  const fieldsList = changedFields
    .map(field => `<li style="margin-bottom: 4px;">${field}</li>`)
    .join('');

  return buildEmailTemplate({
    title: "Your Application Was Updated",
    preheader: `${editorName} made changes to your application on your behalf`,
    recipientName,
    communityName,
    status: 'info',
    mainContent: `
      <p><strong>${editorName}</strong> (${roleDisplay}) has made changes to your application on your behalf.</p>
      <div class="highlight-box">
        <p style="margin-bottom: 8px;"><strong>Application</strong></p>
        <p style="font-size: 18px; font-weight: bold; color: #3b82f6; margin: 8px 0;">${applicationTitle}</p>
      </div>
      <p style="margin-top: 20px;"><strong>Fields Updated:</strong></p>
      <ul style="margin: 8px 0; padding-left: 20px; color: #4b5563;">
        ${fieldsList}
      </ul>
      ${editReason ? `
        <p style="margin-top: 16px;"><strong>Reason:</strong></p>
        <p style="color: #6b7280; font-style: italic;">"${editReason}"</p>
      ` : ''}
      <p style="margin-top: 20px;">You can view the updated application details by clicking the button below.</p>
    `,
    actionButton: {
      text: "View Application",
      url: applicationLink,
    },
    secondaryContent: `
      <strong>Questions?</strong><br>If you have any questions about these changes, please contact ${communityName} directly.
    `,
  });
}
