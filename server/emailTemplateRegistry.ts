/**
 * Email Template Registry
 * Central registry of all email templates with metadata for admin dashboard
 */

import {
  applicationSubmittedTemplate,
  applicationApprovedTemplate,
  applicationRejectedTemplate,
  stepAssignmentTemplate,
  commentNotificationTemplate,
  workflowChangedTemplate,
  invoiceTemplate,
  paymentReceivedTemplate,
  contactFormTemplate,
  bulkCommunityInviteTemplate,
  householdMemberInviteTemplate,
  householdMemberJoinedTemplate,
  contractorInviteTemplate,
  contractorInviteAcceptedTemplate,
  contractorReferralTemplate,
  contractorReferralSignupTemplate,
  delegatedEditNotificationTemplate,
} from './emailTemplates';

export interface TemplateParameter {
  key: string;
  label: string;
  type: 'string' | 'url' | 'select';
  options?: string[];
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  status: 'success' | 'info' | 'warning' | 'action';
  parameters: TemplateParameter[];
  sampleData: Record<string, string>;
  generate: (data: Record<string, string>) => { subject: string; html: string };
}

export const emailTemplateRegistry: Record<string, TemplateDefinition> = {
  applicationSubmitted: {
    id: 'applicationSubmitted',
    name: 'Application Submitted',
    description: 'Sent to homeowner when they submit an application for review',
    status: 'info',
    parameters: [
      { key: 'recipientName', label: 'Recipient Name', type: 'string' },
      { key: 'applicationTitle', label: 'Application Title', type: 'string' },
      { key: 'communityName', label: 'Community Name', type: 'string' },
      { key: 'applicationLink', label: 'Application URL', type: 'url' },
    ],
    sampleData: {
      recipientName: 'John Smith',
      applicationTitle: 'Fence Installation',
      communityName: 'Oakwood HOA',
      applicationLink: 'https://poassociation.com/applications/123',
    },
    generate: (data) => ({
      subject: `Application Received: ${data.communityName}`,
      html: applicationSubmittedTemplate(
        data.recipientName,
        data.applicationTitle,
        data.communityName,
        data.applicationLink
      ),
    }),
  },

  applicationApproved: {
    id: 'applicationApproved',
    name: 'Application Approved',
    description: 'Sent to homeowner when their application is approved',
    status: 'success',
    parameters: [
      { key: 'recipientName', label: 'Recipient Name', type: 'string' },
      { key: 'applicationTitle', label: 'Application Title', type: 'string' },
      { key: 'communityName', label: 'Community Name', type: 'string' },
      { key: 'applicationLink', label: 'Application URL', type: 'url' },
    ],
    sampleData: {
      recipientName: 'John Smith',
      applicationTitle: 'Fence Installation',
      communityName: 'Oakwood HOA',
      applicationLink: 'https://poassociation.com/applications/123',
    },
    generate: (data) => ({
      subject: `Approved: ${data.applicationTitle}`,
      html: applicationApprovedTemplate(
        data.recipientName,
        data.applicationTitle,
        data.communityName,
        data.applicationLink
      ),
    }),
  },

  applicationRejected: {
    id: 'applicationRejected',
    name: 'Application Rejected',
    description: 'Sent to homeowner when their application is not approved',
    status: 'warning',
    parameters: [
      { key: 'recipientName', label: 'Recipient Name', type: 'string' },
      { key: 'applicationTitle', label: 'Application Title', type: 'string' },
      { key: 'communityName', label: 'Community Name', type: 'string' },
      { key: 'reason', label: 'Rejection Reason', type: 'string' },
      { key: 'applicationLink', label: 'Application URL', type: 'url' },
    ],
    sampleData: {
      recipientName: 'John Smith',
      applicationTitle: 'Fence Installation',
      communityName: 'Oakwood HOA',
      reason: 'The proposed fence height exceeds the 6-foot maximum allowed by community guidelines. Please resubmit with a compliant design.',
      applicationLink: 'https://poassociation.com/applications/123',
    },
    generate: (data) => ({
      subject: `Application Status: ${data.applicationTitle}`,
      html: applicationRejectedTemplate(
        data.recipientName,
        data.applicationTitle,
        data.communityName,
        data.reason || undefined,
        data.applicationLink
      ),
    }),
  },

  stepAssignment: {
    id: 'stepAssignment',
    name: 'Step Assignment',
    description: 'Sent to board member or staff when assigned to review a workflow step',
    status: 'action',
    parameters: [
      { key: 'recipientName', label: 'Recipient Name', type: 'string' },
      { key: 'applicationTitle', label: 'Application Title', type: 'string' },
      { key: 'stepTitle', label: 'Step Title', type: 'string' },
      { key: 'communityName', label: 'Community Name', type: 'string' },
      { key: 'applicationLink', label: 'Application URL', type: 'url' },
    ],
    sampleData: {
      recipientName: 'Sarah Johnson',
      applicationTitle: 'Fence Installation',
      stepTitle: 'ARC Review',
      communityName: 'Oakwood HOA',
      applicationLink: 'https://poassociation.com/applications/123',
    },
    generate: (data) => ({
      subject: `Application Review Required: ${data.applicationTitle}`,
      html: stepAssignmentTemplate(
        data.recipientName,
        data.applicationTitle,
        data.stepTitle,
        data.communityName,
        data.applicationLink
      ),
    }),
  },

  commentNotification: {
    id: 'commentNotification',
    name: 'Comment Notification',
    description: 'Sent when someone adds a comment to an application',
    status: 'info',
    parameters: [
      { key: 'recipientName', label: 'Recipient Name', type: 'string' },
      { key: 'commenterName', label: 'Commenter Name', type: 'string' },
      { key: 'applicationTitle', label: 'Application Title', type: 'string' },
      { key: 'comment', label: 'Comment Text', type: 'string' },
      { key: 'applicationLink', label: 'Application URL', type: 'url' },
    ],
    sampleData: {
      recipientName: 'John Smith',
      commenterName: 'Sarah Johnson',
      applicationTitle: 'Fence Installation',
      comment: 'Could you please provide more details about the fence material you plan to use?',
      applicationLink: 'https://poassociation.com/applications/123',
    },
    generate: (data) => ({
      subject: `New Comment: ${data.applicationTitle}`,
      html: commentNotificationTemplate(
        data.recipientName,
        data.commenterName,
        data.applicationTitle,
        data.comment,
        data.applicationLink
      ),
    }),
  },

  workflowChanged: {
    id: 'workflowChanged',
    name: 'Workflow Changed',
    description: 'Sent to admins when the active workflow configuration is changed',
    status: 'info',
    parameters: [
      { key: 'recipientName', label: 'Recipient Name', type: 'string' },
      { key: 'communityName', label: 'Community Name', type: 'string' },
      { key: 'previousWorkflowName', label: 'Previous Workflow', type: 'string' },
      { key: 'newWorkflowName', label: 'New Workflow', type: 'string' },
      { key: 'changedByName', label: 'Changed By', type: 'string' },
      { key: 'settingsLink', label: 'Settings URL', type: 'url' },
    ],
    sampleData: {
      recipientName: 'Board Admin',
      communityName: 'Oakwood HOA',
      previousWorkflowName: 'Simple Approval',
      newWorkflowName: 'Full ARC Review',
      changedByName: 'Sarah Johnson',
      settingsLink: 'https://poassociation.com/settings/workflow',
    },
    generate: (data) => ({
      subject: `Workflow Updated - ${data.communityName}`,
      html: workflowChangedTemplate(
        data.recipientName,
        data.communityName,
        data.previousWorkflowName || null,
        data.newWorkflowName,
        data.changedByName,
        data.settingsLink
      ),
    }),
  },

  invoice: {
    id: 'invoice',
    name: 'Invoice',
    description: 'Sent to billing contacts when an invoice is ready for payment',
    status: 'action',
    parameters: [
      { key: 'recipientName', label: 'Recipient Name', type: 'string' },
      { key: 'billingEntityName', label: 'Billing Entity', type: 'string' },
      { key: 'invoiceNumber', label: 'Invoice Number', type: 'string' },
      { key: 'invoiceAmount', label: 'Amount', type: 'string' },
      { key: 'billingPeriod', label: 'Billing Period', type: 'string' },
      { key: 'dueDate', label: 'Due Date', type: 'string' },
      { key: 'invoiceLink', label: 'Invoice URL', type: 'url' },
    ],
    sampleData: {
      recipientName: 'Finance Team',
      billingEntityName: 'Oakwood HOA',
      invoiceNumber: 'INV-2025-001234',
      invoiceAmount: '$299.00',
      billingPeriod: 'January 2025',
      dueDate: 'February 15, 2025',
      invoiceLink: 'https://poassociation.com/billing/invoices/123',
    },
    generate: (data) => ({
      subject: `Invoice ${data.invoiceNumber} - ${data.billingEntityName}`,
      html: invoiceTemplate(
        data.recipientName,
        data.billingEntityName,
        data.invoiceNumber,
        data.invoiceAmount,
        data.billingPeriod,
        data.dueDate,
        data.invoiceLink
      ),
    }),
  },

  paymentReceived: {
    id: 'paymentReceived',
    name: 'Payment Received',
    description: 'Sent when a payment is successfully processed',
    status: 'success',
    parameters: [
      { key: 'recipientName', label: 'Recipient Name', type: 'string' },
      { key: 'billingEntityName', label: 'Billing Entity', type: 'string' },
      { key: 'invoiceNumber', label: 'Invoice Number', type: 'string' },
      { key: 'paymentAmount', label: 'Payment Amount', type: 'string' },
      { key: 'paymentDate', label: 'Payment Date', type: 'string' },
      { key: 'receiptLink', label: 'Receipt URL', type: 'url' },
    ],
    sampleData: {
      recipientName: 'Finance Team',
      billingEntityName: 'Oakwood HOA',
      invoiceNumber: 'INV-2025-001234',
      paymentAmount: '$299.00',
      paymentDate: 'January 28, 2025',
      receiptLink: 'https://poassociation.com/billing/receipts/456',
    },
    generate: (data) => ({
      subject: `Payment Received - Invoice ${data.invoiceNumber}`,
      html: paymentReceivedTemplate(
        data.recipientName,
        data.billingEntityName,
        data.invoiceNumber,
        data.paymentAmount,
        data.paymentDate,
        data.receiptLink
      ),
    }),
  },

  contactForm: {
    id: 'contactForm',
    name: 'Contact Form',
    description: 'Internal notification when someone submits a contact or demo request',
    status: 'action',
    parameters: [
      { key: 'mode', label: 'Form Type', type: 'select', options: ['contact', 'demo'] },
      { key: 'name', label: 'Submitter Name', type: 'string' },
      { key: 'email', label: 'Submitter Email', type: 'string' },
      { key: 'phone', label: 'Phone Number', type: 'string' },
      { key: 'company', label: 'Organization', type: 'string' },
      { key: 'communitySize', label: 'Community Size', type: 'string' },
      { key: 'message', label: 'Message', type: 'string' },
      { key: 'preferredTime', label: 'Preferred Contact Time', type: 'string' },
    ],
    sampleData: {
      mode: 'demo',
      name: 'Michael Brown',
      email: 'michael@example.com',
      phone: '(555) 123-4567',
      company: 'Sunset Ridge HOA',
      communitySize: '150-300 homes',
      message: 'We are interested in modernizing our approval process. Can you show us how your platform works?',
      preferredTime: 'Weekday mornings',
    },
    generate: (data) => ({
      subject: data.mode === 'demo'
        ? `New Demo Request from ${data.name}`
        : `New Contact Form from ${data.name}`,
      html: contactFormTemplate(
        data.mode as 'contact' | 'demo',
        {
          name: data.name,
          email: data.email,
          phone: data.phone || undefined,
          company: data.company || undefined,
          communitySize: data.communitySize || undefined,
          message: data.message || undefined,
          preferredTime: data.preferredTime || undefined,
        }
      ),
    }),
  },

  // ============================================
  // Invitation Templates
  // ============================================

  bulkCommunityInvite: {
    id: 'bulkCommunityInvite',
    name: 'Bulk Community Invite',
    description: 'Sent when a new POA/HOA onboards and invites all their members',
    status: 'action',
    parameters: [
      { key: 'recipientName', label: 'Recipient Name', type: 'string' },
      { key: 'communityName', label: 'Community Name', type: 'string' },
      { key: 'inviterName', label: 'Inviter Name', type: 'string' },
      { key: 'inviteLink', label: 'Invite URL', type: 'url' },
      { key: 'communityDescription', label: 'Community Description', type: 'string' },
    ],
    sampleData: {
      recipientName: 'John Smith',
      communityName: 'Oakwood HOA',
      inviterName: 'Sarah Johnson',
      inviteLink: 'https://poassociation.com/invite/abc123',
      communityDescription: 'Welcome to Oakwood HOA! We are a community of 150 homes dedicated to maintaining our beautiful neighborhood.',
    },
    generate: (data) => ({
      subject: `You're Invited to Join ${data.communityName}`,
      html: bulkCommunityInviteTemplate(
        data.recipientName,
        data.communityName,
        data.inviterName,
        data.inviteLink,
        data.communityDescription || undefined
      ),
    }),
  },

  householdMemberInvite: {
    id: 'householdMemberInvite',
    name: 'Household Member Invite',
    description: 'Sent when a homeowner invites a spouse/family member to share their applications',
    status: 'action',
    parameters: [
      { key: 'recipientName', label: 'Recipient Name', type: 'string' },
      { key: 'inviterName', label: 'Inviter Name', type: 'string' },
      { key: 'communityName', label: 'Community Name', type: 'string' },
      { key: 'relationship', label: 'Relationship', type: 'string' },
      { key: 'inviteLink', label: 'Invite URL', type: 'url' },
    ],
    sampleData: {
      recipientName: 'Jane Smith',
      inviterName: 'John Smith',
      communityName: 'Oakwood HOA',
      relationship: 'spouse',
      inviteLink: 'https://poassociation.com/invite/household/xyz789',
    },
    generate: (data) => ({
      subject: `${data.inviterName} invited you to join their household`,
      html: householdMemberInviteTemplate(
        data.recipientName,
        data.inviterName,
        data.communityName,
        data.relationship,
        data.inviteLink
      ),
    }),
  },

  householdMemberJoined: {
    id: 'householdMemberJoined',
    name: 'Household Member Joined',
    description: 'Sent to the primary homeowner when a household member accepts their invitation',
    status: 'success',
    parameters: [
      { key: 'recipientName', label: 'Recipient Name', type: 'string' },
      { key: 'memberName', label: 'Member Name', type: 'string' },
      { key: 'memberEmail', label: 'Member Email', type: 'string' },
      { key: 'communityName', label: 'Community Name', type: 'string' },
      { key: 'dashboardLink', label: 'Dashboard URL', type: 'url' },
    ],
    sampleData: {
      recipientName: 'John Smith',
      memberName: 'Jane Smith',
      memberEmail: 'jane@example.com',
      communityName: 'Oakwood HOA',
      dashboardLink: 'https://poassociation.com/settings/household',
    },
    generate: (data) => ({
      subject: `${data.memberName} joined your household`,
      html: householdMemberJoinedTemplate(
        data.recipientName,
        data.memberName,
        data.memberEmail,
        data.communityName,
        data.dashboardLink
      ),
    }),
  },

  contractorInvite: {
    id: 'contractorInvite',
    name: 'Contractor Application Invite',
    description: 'Sent when a homeowner invites a contractor to collaborate on an application',
    status: 'action',
    parameters: [
      { key: 'recipientName', label: 'Contractor Name', type: 'string' },
      { key: 'inviterName', label: 'Homeowner Name', type: 'string' },
      { key: 'applicationTitle', label: 'Application Title', type: 'string' },
      { key: 'communityName', label: 'Community Name', type: 'string' },
      { key: 'inviteLink', label: 'Invite URL', type: 'url' },
      { key: 'projectDescription', label: 'Project Description', type: 'string' },
    ],
    sampleData: {
      recipientName: 'Mike Builder',
      inviterName: 'John Smith',
      applicationTitle: 'Fence Installation',
      communityName: 'Oakwood HOA',
      inviteLink: 'https://poassociation.com/invite/contractor/def456',
      projectDescription: '6-foot cedar privacy fence along the rear property line, approximately 120 linear feet.',
    },
    generate: (data) => ({
      subject: `${data.inviterName} invited you to collaborate on "${data.applicationTitle}"`,
      html: contractorInviteTemplate(
        data.recipientName,
        data.inviterName,
        data.applicationTitle,
        data.communityName,
        data.inviteLink,
        data.projectDescription || undefined
      ),
    }),
  },

  contractorInviteAccepted: {
    id: 'contractorInviteAccepted',
    name: 'Contractor Invite Accepted',
    description: 'Sent to the homeowner when a contractor accepts their invitation',
    status: 'success',
    parameters: [
      { key: 'recipientName', label: 'Homeowner Name', type: 'string' },
      { key: 'contractorName', label: 'Contractor Name', type: 'string' },
      { key: 'contractorCompany', label: 'Contractor Company', type: 'string' },
      { key: 'applicationTitle', label: 'Application Title', type: 'string' },
      { key: 'communityName', label: 'Community Name', type: 'string' },
      { key: 'applicationLink', label: 'Application URL', type: 'url' },
    ],
    sampleData: {
      recipientName: 'John Smith',
      contractorName: 'Mike Builder',
      contractorCompany: 'Builder Bros LLC',
      applicationTitle: 'Fence Installation',
      communityName: 'Oakwood HOA',
      applicationLink: 'https://poassociation.com/applications/123',
    },
    generate: (data) => ({
      subject: `${data.contractorName} joined your application`,
      html: contractorInviteAcceptedTemplate(
        data.recipientName,
        data.contractorName,
        data.contractorCompany || undefined,
        data.applicationTitle,
        data.communityName,
        data.applicationLink
      ),
    }),
  },

  contractorReferral: {
    id: 'contractorReferral',
    name: 'Contractor Referral Link',
    description: 'Sent to contractors with their referral link to share with POAs/HOAs',
    status: 'info',
    parameters: [
      { key: 'recipientName', label: 'Contractor Name', type: 'string' },
      { key: 'referralCode', label: 'Referral Code', type: 'string' },
      { key: 'referralLink', label: 'Referral URL', type: 'url' },
      { key: 'dashboardLink', label: 'Dashboard URL', type: 'url' },
    ],
    sampleData: {
      recipientName: 'Mike Builder',
      referralCode: 'BUILDER123',
      referralLink: 'https://poassociation.com/r/BUILDER123',
      dashboardLink: 'https://poassociation.com/contractor/referrals',
    },
    generate: (data) => ({
      subject: 'Your POAssociation Referral Link',
      html: contractorReferralTemplate(
        data.recipientName,
        data.referralCode,
        data.referralLink,
        data.dashboardLink
      ),
    }),
  },

  contractorReferralSignup: {
    id: 'contractorReferralSignup',
    name: 'Referral Signup Notification',
    description: 'Sent to contractor when a POA signs up using their referral code',
    status: 'success',
    parameters: [
      { key: 'recipientName', label: 'Contractor Name', type: 'string' },
      { key: 'communityName', label: 'Community Name', type: 'string' },
      { key: 'referralCode', label: 'Referral Code', type: 'string' },
      { key: 'dashboardLink', label: 'Dashboard URL', type: 'url' },
    ],
    sampleData: {
      recipientName: 'Mike Builder',
      communityName: 'Sunset Ridge HOA',
      referralCode: 'BUILDER123',
      dashboardLink: 'https://poassociation.com/contractor/referrals',
    },
    generate: (data) => ({
      subject: `New Referral: ${data.communityName} signed up!`,
      html: contractorReferralSignupTemplate(
        data.recipientName,
        data.communityName,
        data.referralCode,
        data.dashboardLink
      ),
    }),
  },

  delegatedEditNotification: {
    id: 'delegatedEditNotification',
    name: 'Delegated Edit Notification',
    description: 'Sent to homeowner when a management rep edits their application on their behalf',
    status: 'info',
    parameters: [
      { key: 'recipientName', label: 'Recipient Name', type: 'string' },
      { key: 'applicationTitle', label: 'Application Title', type: 'string' },
      { key: 'editorName', label: 'Editor Name', type: 'string' },
      { key: 'editorRole', label: 'Editor Role', type: 'string' },
      { key: 'changedFields', label: 'Changed Fields', type: 'string' },
      { key: 'editReason', label: 'Edit Reason', type: 'string' },
      { key: 'applicationLink', label: 'Application URL', type: 'url' },
      { key: 'communityName', label: 'Community Name', type: 'string' },
    ],
    sampleData: {
      recipientName: 'John Smith',
      applicationTitle: 'Fence Installation',
      editorName: 'Sarah Johnson',
      editorRole: 'Management Representative',
      changedFields: 'Property Address, Project Description',
      editReason: 'Updated address to match county records',
      applicationLink: 'https://poassociation.com/applications/123',
      communityName: 'Oakwood HOA',
    },
    generate: (data) => ({
      subject: `Your Application Was Updated: ${data.applicationTitle}`,
      html: delegatedEditNotificationTemplate(
        data.recipientName,
        data.applicationTitle,
        data.editorName,
        data.editorRole,
        data.changedFields.split(', '),
        data.editReason || undefined,
        data.applicationLink,
        data.communityName
      ),
    }),
  },
};

/**
 * Get all templates as an array (for listing)
 */
export function getAllTemplates(): Omit<TemplateDefinition, 'generate'>[] {
  return Object.values(emailTemplateRegistry).map(({ generate, ...rest }) => rest);
}

/**
 * Get a specific template by ID
 */
export function getTemplate(id: string): TemplateDefinition | undefined {
  return emailTemplateRegistry[id];
}

/**
 * Generate email preview for a template
 */
export function generatePreview(
  templateId: string,
  sampleData: Record<string, string>
): { subject: string; html: string } | null {
  const template = emailTemplateRegistry[templateId];
  if (!template) return null;

  // Merge provided data with defaults
  const mergedData = { ...template.sampleData, ...sampleData };
  return template.generate(mergedData);
}
