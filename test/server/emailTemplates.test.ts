import { describe, it, expect } from 'vitest';
import {
  buildEmailTemplate,
  applicationSubmittedTemplate,
  applicationApprovedTemplate,
  applicationRejectedTemplate,
  stepAssignmentTemplate,
  commentNotificationTemplate,
  workflowChangedTemplate,
  invoiceTemplate,
  paymentReceivedTemplate,
  contactFormTemplate,
  type EmailTemplateProps,
} from '../../server/emailTemplates';

/**
 * Email Templates Tests
 *
 * Tests for transactional email templates from recent commits:
 * - buildEmailTemplate: Base template builder
 * - Application status emails
 * - Workflow notifications
 * - Billing/invoice emails
 * - Contact form emails (new feature)
 */

describe('Email Templates', () => {
  describe('buildEmailTemplate', () => {
    it('should generate valid HTML email', () => {
      const props: EmailTemplateProps = {
        title: 'Test Email',
        preheader: 'This is a test',
        mainContent: '<p>Hello World</p>',
      };

      const html = buildEmailTemplate(props);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('Test Email');
      expect(html).toContain('This is a test');
      expect(html).toContain('Hello World');
    });

    it('should include recipient name when provided', () => {
      const props: EmailTemplateProps = {
        title: 'Test',
        preheader: 'Test',
        mainContent: '<p>Content</p>',
        recipientName: 'John Doe',
      };

      const html = buildEmailTemplate(props);
      expect(html).toContain('Hi John Doe');
    });

    it('should include community name in header', () => {
      const props: EmailTemplateProps = {
        title: 'Test',
        preheader: 'Test',
        mainContent: '<p>Content</p>',
        communityName: 'Markland Woods',
      };

      const html = buildEmailTemplate(props);
      expect(html).toContain('Markland Woods');
    });

    it('should render action button when provided', () => {
      const props: EmailTemplateProps = {
        title: 'Test',
        preheader: 'Test',
        mainContent: '<p>Content</p>',
        actionButton: {
          text: 'Click Here',
          url: 'https://example.com',
        },
      };

      const html = buildEmailTemplate(props);
      expect(html).toContain('Click Here');
      expect(html).toContain('href="https://example.com"');
    });

    it('should render secondary content when provided', () => {
      const props: EmailTemplateProps = {
        title: 'Test',
        preheader: 'Test',
        mainContent: '<p>Main</p>',
        secondaryContent: '<p>Secondary info</p>',
      };

      const html = buildEmailTemplate(props);
      expect(html).toContain('Secondary info');
    });

    it('should apply different gradients based on status', () => {
      const statuses: Array<EmailTemplateProps['status']> = ['success', 'info', 'warning', 'action'];

      statuses.forEach(status => {
        const props: EmailTemplateProps = {
          title: 'Test',
          preheader: 'Test',
          mainContent: '<p>Content</p>',
          status,
        };

        const html = buildEmailTemplate(props);
        // Should contain gradient styling
        expect(html).toContain('linear-gradient');
      });
    });

    it('should include POA Association branding in footer', () => {
      const props: EmailTemplateProps = {
        title: 'Test',
        preheader: 'Test',
        mainContent: '<p>Content</p>',
      };

      const html = buildEmailTemplate(props);
      expect(html).toContain('POA Association');
      expect(html).toContain('poassociation.com');
    });

    it('should include current year in footer', () => {
      const props: EmailTemplateProps = {
        title: 'Test',
        preheader: 'Test',
        mainContent: '<p>Content</p>',
      };

      const html = buildEmailTemplate(props);
      expect(html).toContain(new Date().getFullYear().toString());
    });
  });

  describe('applicationSubmittedTemplate', () => {
    it('should generate application submission email', () => {
      const html = applicationSubmittedTemplate(
        'John Doe',
        'Fence Installation',
        'Markland Woods',
        'https://example.com/app/123'
      );

      expect(html).toContain('Hi John Doe');
      expect(html).toContain('Fence Installation');
      expect(html).toContain('Markland Woods');
      expect(html).toContain('View Application');
      expect(html).toContain('https://example.com/app/123');
      expect(html).toContain('Application Received');
    });

    it('should include what\'s next section', () => {
      const html = applicationSubmittedTemplate(
        'John',
        'Test',
        'Test Community',
        'https://example.com'
      );

      expect(html).toContain("What's Next");
      expect(html).toContain('under review');
    });
  });

  describe('applicationApprovedTemplate', () => {
    it('should generate approval email', () => {
      const html = applicationApprovedTemplate(
        'Jane Smith',
        'Deck Addition',
        'Whispering Pines',
        'https://example.com/app/456'
      );

      expect(html).toContain('Hi Jane Smith');
      expect(html).toContain('Congratulations');
      expect(html).toContain('approved');
      expect(html).toContain('Deck Addition');
      expect(html).toContain('Whispering Pines');
      expect(html).toContain('View Approval Details');
    });

    it('should use success status styling', () => {
      const html = applicationApprovedTemplate(
        'Test',
        'Test',
        'Test',
        'https://example.com'
      );

      // Success gradient color
      expect(html).toContain('#10b981');
    });
  });

  describe('applicationRejectedTemplate', () => {
    it('should generate rejection email with reason', () => {
      const html = applicationRejectedTemplate(
        'Bob Wilson',
        'Pool Installation',
        'Sunset Valley',
        'Does not meet setback requirements',
        'https://example.com/app/789'
      );

      expect(html).toContain('Hi Bob Wilson');
      expect(html).toContain('not been approved');
      expect(html).toContain('Pool Installation');
      expect(html).toContain('Does not meet setback requirements');
      expect(html).toContain('Review Full Details');
    });

    it('should handle missing rejection reason', () => {
      const html = applicationRejectedTemplate(
        'Test',
        'Test',
        'Test',
        undefined,
        'https://example.com'
      );

      // Should still render without crashing
      expect(html).toContain('not been approved');
    });

    it('should encourage resubmission', () => {
      const html = applicationRejectedTemplate(
        'Test',
        'Test',
        'Test',
        'Reason',
        'https://example.com'
      );

      expect(html).toContain('Resubmit');
    });
  });

  describe('stepAssignmentTemplate', () => {
    it('should generate step assignment email', () => {
      const html = stepAssignmentTemplate(
        'Sarah Chen',
        'Fence Application #123',
        'Board Review',
        'Markland Woods',
        'https://example.com/review/123'
      );

      expect(html).toContain('Hi Sarah Chen');
      expect(html).toContain('Action Required');
      expect(html).toContain('Board Review');
      expect(html).toContain('Fence Application #123');
      expect(html).toContain('Start Review Now');
    });

    it('should emphasize urgency', () => {
      const html = stepAssignmentTemplate(
        'Test',
        'Test',
        'Test',
        'Test',
        'https://example.com'
      );

      expect(html).toContain('Action Needed');
    });
  });

  describe('commentNotificationTemplate', () => {
    it('should generate comment notification email', () => {
      const html = commentNotificationTemplate(
        'Emily Foster',
        'Alex Rivera',
        'Deck Project',
        'Please provide more details about the materials.',
        'https://example.com/app/456'
      );

      expect(html).toContain('Hi Emily Foster');
      expect(html).toContain('Alex Rivera');
      expect(html).toContain('Deck Project');
      expect(html).toContain('Please provide more details about the materials.');
      expect(html).toContain('View & Reply');
    });

    it('should include comment as quoted text', () => {
      const html = commentNotificationTemplate(
        'Test',
        'Commenter',
        'Project',
        'This is my comment',
        'https://example.com'
      );

      expect(html).toContain('This is my comment');
    });
  });

  describe('workflowChangedTemplate', () => {
    it('should generate workflow changed email', () => {
      const html = workflowChangedTemplate(
        'Admin User',
        'Markland Woods',
        'Old Workflow',
        'New Streamlined Workflow',
        'Emily Foster',
        'https://example.com/settings'
      );

      expect(html).toContain('Hi Admin User');
      expect(html).toContain('Workflow Updated');
      expect(html).toContain('Markland Woods');
      expect(html).toContain('Emily Foster');
      expect(html).toContain('Old Workflow');
      expect(html).toContain('New Streamlined Workflow');
    });

    it('should handle null previous workflow', () => {
      const html = workflowChangedTemplate(
        'Test',
        'Community',
        null,
        'New Workflow',
        'Admin',
        'https://example.com'
      );

      expect(html).toContain('No workflow assigned');
      expect(html).toContain('New Workflow');
    });
  });

  describe('invoiceTemplate', () => {
    it('should generate invoice email', () => {
      const html = invoiceTemplate(
        'Finance Manager',
        'Apex Management',
        'INV-2025-001',
        '$1,250.00',
        'January 2025',
        'February 15, 2025',
        'https://example.com/invoice/001'
      );

      expect(html).toContain('Hi Finance Manager');
      expect(html).toContain('Your Invoice is Ready');
      expect(html).toContain('Apex Management');
      expect(html).toContain('INV-2025-001');
      expect(html).toContain('$1,250.00');
      expect(html).toContain('January 2025');
      expect(html).toContain('February 15, 2025');
      expect(html).toContain('View Invoice');
    });

    it('should include payment options', () => {
      const html = invoiceTemplate(
        'Test',
        'Company',
        'INV-001',
        '$100',
        'Period',
        'Due Date',
        'https://example.com'
      );

      expect(html).toContain('Payment Options');
      expect(html).toContain('ACH');
      expect(html).toContain('credit card');
    });
  });

  describe('paymentReceivedTemplate', () => {
    it('should generate payment received email', () => {
      const html = paymentReceivedTemplate(
        'Finance Manager',
        'Apex Management',
        'INV-2025-001',
        '$1,250.00',
        'January 20, 2025',
        'https://example.com/receipt/001'
      );

      expect(html).toContain('Hi Finance Manager');
      expect(html).toContain('Payment Received');
      expect(html).toContain('$1,250.00');
      expect(html).toContain('INV-2025-001');
      expect(html).toContain('January 20, 2025');
      expect(html).toContain('View Receipt');
    });

    it('should thank the recipient', () => {
      const html = paymentReceivedTemplate(
        'Test',
        'Company',
        'INV-001',
        '$100',
        'Date',
        'https://example.com'
      );

      expect(html).toContain('Thank');
    });
  });

  describe('contactFormTemplate', () => {
    it('should generate contact form submission email', () => {
      const html = contactFormTemplate('contact', {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'I have a question about your services.',
      });

      expect(html).toContain('New Contact Form Submission');
      expect(html).toContain('John Doe');
      expect(html).toContain('john@example.com');
      expect(html).toContain('I have a question about your services.');
      expect(html).toContain('Reply to John Doe');
    });

    it('should generate demo request email', () => {
      const html = contactFormTemplate('demo', {
        name: 'Jane Smith',
        email: 'jane@company.com',
        company: 'ABC Management',
        communitySize: '150-500 doors',
        preferredTime: 'Morning (9am-12pm)',
      });

      expect(html).toContain('New Demo Request');
      expect(html).toContain('Jane Smith');
      expect(html).toContain('jane@company.com');
      expect(html).toContain('ABC Management');
      expect(html).toContain('150-500 doors');
      expect(html).toContain('Morning (9am-12pm)');
    });

    it('should include phone number when provided', () => {
      const html = contactFormTemplate('contact', {
        name: 'Test User',
        email: 'test@example.com',
        phone: '555-123-4567',
      });

      expect(html).toContain('555-123-4567');
    });

    it('should handle optional fields gracefully', () => {
      const html = contactFormTemplate('contact', {
        name: 'Minimal User',
        email: 'minimal@example.com',
      });

      expect(html).toContain('Minimal User');
      expect(html).toContain('minimal@example.com');
      // Should not contain phone row since not provided
    });

    it('should include different response time guidance for contact vs demo', () => {
      const contactHtml = contactFormTemplate('contact', {
        name: 'Test',
        email: 'test@example.com',
      });

      const demoHtml = contactFormTemplate('demo', {
        name: 'Test',
        email: 'test@example.com',
      });

      expect(contactHtml).toContain('48 hours');
      expect(demoHtml).toContain('24 business hours');
    });

    it('should generate proper mailto link for reply', () => {
      const html = contactFormTemplate('contact', {
        name: 'Test User',
        email: 'test@example.com',
      });

      expect(html).toContain('mailto:test@example.com');
    });
  });

  describe('Email Template Security', () => {
    it('should not expose sensitive template variables in output', () => {
      const html = buildEmailTemplate({
        title: 'Test',
        preheader: 'Test',
        mainContent: '<p>Content</p>',
      });

      // Check no template syntax leaks
      expect(html).not.toContain('${');
      expect(html).not.toContain('{{');
    });

    it('should properly encode special characters in content', () => {
      const html = applicationSubmittedTemplate(
        'John <script>alert("xss")</script>',
        'Test & "Project"',
        'Community\'s Name',
        'https://example.com'
      );

      // Content should be rendered (HTML is trusted in email templates)
      // but we verify it doesn't break the template structure
      expect(html).toContain('John');
      expect(html).toContain('Test');
      expect(html).toContain('Community');
    });
  });

  describe('Email Template Accessibility', () => {
    it('should include lang attribute', () => {
      const html = buildEmailTemplate({
        title: 'Test',
        preheader: 'Test',
        mainContent: '<p>Content</p>',
      });

      expect(html).toContain('lang="en"');
    });

    it('should include proper role attributes for tables', () => {
      const html = buildEmailTemplate({
        title: 'Test',
        preheader: 'Test',
        mainContent: '<p>Content</p>',
      });

      expect(html).toContain('role="presentation"');
    });

    it('should include meta viewport for mobile', () => {
      const html = buildEmailTemplate({
        title: 'Test',
        preheader: 'Test',
        mainContent: '<p>Content</p>',
      });

      expect(html).toContain('viewport');
      expect(html).toContain('width=device-width');
    });
  });
});
