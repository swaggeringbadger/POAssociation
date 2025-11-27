/**
 * Modern Email Templates for POA Association
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
    .header-icon {
      font-size: 48px;
      margin-bottom: 16px;
      line-height: 1;
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
                <div class="header-icon">🏘️</div>
                <h1 class="header-title">${communityName || 'POA Association'}</h1>
                <p class="header-subtitle">${title}</p>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td class="content">
                ${recipientName ? `<p class="greeting">Hi ${recipientName}! 👋</p>` : ''}

                <div class="main-message">
                  ${mainContent}
                </div>

                ${actionButton ? `
                  <div class="button-container">
                    <a href="${actionButton.url}" class="button">${actionButton.text} →</a>
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
                <div class="footer-brand">POA Association</div>
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
    title: "Application Received ✓",
    preheader: "Your application has been received and is under review.",
    recipientName,
    communityName,
    status: 'info',
    mainContent: `
      <p>🎉 We have successfully received your application for <span class="accent-text">"${applicationTitle}"</span> in <span class="accent-text">${communityName}</span>.</p>
      <div class="highlight-box">
        <p><strong>📋 What's Next?</strong><br>Your application is now under review. Our team will carefully examine your submission and will get back to you shortly with next steps.</p>
      </div>
      <p>In the meantime, you can check the status of your application anytime by logging into your account.</p>
    `,
    actionButton: {
      text: "View Application",
      url: applicationLink,
    },
    secondaryContent: `
      <strong>📬 Stay Updated</strong><br>We'll send you email notifications as your application progresses through each review stage. If you have any questions, please don't hesitate to reach out.
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
    communityName,
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
    communityName,
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
  applicationLink: string,
  communityName?: string
): string {
  return buildEmailTemplate({
    title: "New Comment Added",
    preheader: `${commenterName} commented on "${applicationTitle}"`,
    recipientName,
    communityName,
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
