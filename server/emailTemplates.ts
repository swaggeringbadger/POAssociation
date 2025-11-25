/**
 * Elegant Email Templates for CivicFlow
 * Professional, classy design for all transactional emails
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
}

const BASE_COLOR = "#1e3a8a"; // Deep navy
const ACCENT_COLOR = "#f59e0b"; // Amber
const TEXT_DARK = "#1f2937";
const TEXT_LIGHT = "#6b7280";
const BORDER_COLOR = "#e5e7eb";

/**
 * Build a professional, elegant HTML email template
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
  } = props;

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
      font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
      background-color: #f9fafb;
      color: ${TEXT_DARK};
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
      color: ${BASE_COLOR};
      text-decoration: none;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, ${BASE_COLOR} 0%, #1e40af 100%);
      padding: 40px 30px;
      text-align: center;
      border-bottom: 4px solid ${ACCENT_COLOR};
    }
    .header-title {
      font-size: 28px;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .header-subtitle {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
      margin: 8px 0 0 0;
    }
    .content {
      padding: 40px 30px;
      border-bottom: 1px solid ${BORDER_COLOR};
    }
    .greeting {
      font-size: 16px;
      color: ${TEXT_DARK};
      margin: 0 0 20px 0;
      line-height: 1.6;
    }
    .main-message {
      font-size: 15px;
      color: ${TEXT_DARK};
      line-height: 1.8;
      margin: 20px 0;
    }
    .accent-text {
      font-weight: 600;
      color: ${BASE_COLOR};
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, ${BASE_COLOR} 0%, #1e40af 100%);
      color: #ffffff;
      padding: 14px 32px;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(30, 58, 138, 0.3);
      transition: all 0.3s ease;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(30, 58, 138, 0.4);
    }
    .secondary-content {
      font-size: 14px;
      color: ${TEXT_LIGHT};
      line-height: 1.6;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid ${BORDER_COLOR};
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid ${BORDER_COLOR};
    }
    .footer-text {
      font-size: 13px;
      color: ${TEXT_LIGHT};
      margin: 8px 0;
      line-height: 1.6;
    }
    .footer-link {
      color: ${BASE_COLOR};
      text-decoration: none;
      font-weight: 500;
    }
    .divider {
      background-color: ${BORDER_COLOR};
      height: 1px;
      margin: 20px 0;
    }
    .highlight-box {
      background-color: #f0f9ff;
      border-left: 4px solid ${ACCENT_COLOR};
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .highlight-box p {
      margin: 0;
      font-size: 14px;
      color: ${TEXT_DARK};
      line-height: 1.6;
    }
    @media (max-width: 600px) {
      .email-container {
        width: 100% !important;
      }
      .content {
        padding: 24px 16px !important;
      }
      .header {
        padding: 24px 16px !important;
      }
      .header-title {
        font-size: 22px !important;
      }
      .button {
        width: 100%;
        box-sizing: border-box;
      }
    }
  </style>
</head>
<body>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f9fafb;">
    <tr>
      <td style="padding: 20px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="email-container" style="margin: 0 auto;">
          <!-- Header -->
          <tr>
            <td class="header">
              <h1 class="header-title">${communityName || 'CivicFlow'}</h1>
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
    mainContent: `
      <p>We have received your application for <span class="accent-text">"${applicationTitle}"</span> in <span class="accent-text">${communityName}</span>.</p>
      <div class="highlight-box">
        <p>Your application is now under review. Our team will carefully examine your submission and will get back to you shortly with next steps.</p>
      </div>
      <p>In the meantime, you can check the status of your application anytime by logging into your account.</p>
    `,
    actionButton: {
      text: "View Application",
      url: applicationLink,
    },
    secondaryContent: `
      We'll send you email notifications as your application progresses through each review stage. If you have any questions, please don't hesitate to reach out.
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
    mainContent: `
      <p>Congratulations! Your application for <span class="accent-text">"${applicationTitle}"</span> in <span class="accent-text">${communityName}</span> has been <span class="accent-text">approved</span>.</p>
      <div class="highlight-box">
        <p>You may now proceed with your project. Please keep a copy of your approval for your records.</p>
      </div>
      <p>If you have any questions or need any assistance, please don't hesitate to contact us.</p>
    `,
    actionButton: {
      text: "View Approval Details",
      url: applicationLink,
    },
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
    mainContent: `
      <p>We have reviewed your application for <span class="accent-text">"${applicationTitle}"</span> in <span class="accent-text">${communityName}</span>.</p>
      <div class="highlight-box">
        <p>Unfortunately, your application has been <span class="accent-text">rejected</span> at this time.</p>
      </div>
      ${reason ? `<p><strong>Feedback:</strong> ${reason}</p>` : ''}
      <p>We encourage you to review the feedback and consider resubmitting with the requested changes, or contact us to discuss further.</p>
    `,
    actionButton: {
      text: "Review Details",
      url: applicationLink,
    },
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
    mainContent: `
      <p>You have been assigned to review the <span class="accent-text">"${stepTitle}"</span> step for the application <span class="accent-text">"${applicationTitle}"</span> in <span class="accent-text">${communityName}</span>.</p>
      <div class="highlight-box">
        <p>Please review the application details and take appropriate action as soon as possible.</p>
      </div>
      <p>Your timely review helps us process applications efficiently and serve our community better.</p>
    `,
    actionButton: {
      text: "Review Application",
      url: applicationLink,
    },
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
  applicationLink: string
): string {
  return buildEmailTemplate({
    title: "New Comment Added",
    preheader: `${commenterName} commented on "${applicationTitle}"`,
    recipientName,
    mainContent: `
      <p><span class="accent-text">${commenterName}</span> has left a comment on <span class="accent-text">"${applicationTitle}"</span>:</p>
      <div class="highlight-box">
        <p>${comment}</p>
      </div>
      <p>View the full conversation and respond to continue the discussion.</p>
    `,
    actionButton: {
      text: "View Conversation",
      url: applicationLink,
    },
  });
}
