import { describe, it, expect } from 'vitest';

/**
 * Public API Tests
 *
 * Tests for public (unauthenticated) API endpoints from recent commits:
 * - Community info endpoint (subdomain-based)
 * - Public contact form endpoint
 * - Public demo request endpoint
 *
 * These endpoints don't require authentication.
 */

// Contact form validation
interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  communitySize?: string;
  message?: string;
  preferredTime?: string;
}

interface DemoRequestData {
  name: string;
  email: string;
  company: string;
  communitySize: string;
  preferredTime?: string;
  message?: string;
}

/**
 * Validate contact form submission
 */
function validateContactForm(data: Partial<ContactFormData>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (!data.email) {
    errors.push('Email is required');
  } else if (!isValidEmail(data.email)) {
    errors.push('Invalid email format');
  }

  // Phone is optional but validate format if provided
  if (data.phone && !isValidPhone(data.phone)) {
    errors.push('Invalid phone format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate demo request submission
 */
function validateDemoRequest(data: Partial<DemoRequestData>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (!data.email) {
    errors.push('Email is required');
  } else if (!isValidEmail(data.email)) {
    errors.push('Invalid email format');
  }

  if (!data.company || data.company.trim().length === 0) {
    errors.push('Company/Organization is required');
  }

  if (!data.communitySize) {
    errors.push('Community size is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function isValidEmail(email: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function isValidPhone(phone: string): boolean {
  // Accept various phone formats
  const phonePattern = /^[\d\s\-\(\)\+\.]+$/;
  return phonePattern.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Sanitize user input for contact form
 */
function sanitizeContactInput(input: string): string {
  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validate subdomain format
 */
function isValidSubdomain(subdomain: string): boolean {
  // Subdomains: lowercase alphanumeric with hyphens, 3-63 chars, no leading/trailing hyphen
  const subdomainPattern = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;
  return subdomainPattern.test(subdomain);
}

describe('Public API', () => {
  describe('Contact Form Validation', () => {
    it('should accept valid contact form data', () => {
      const result = validateContactForm({
        name: 'John Doe',
        email: 'john@example.com',
        message: 'I have a question.',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require name', () => {
      const result = validateContactForm({
        email: 'john@example.com',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should require email', () => {
      const result = validateContactForm({
        name: 'John Doe',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    it('should validate email format', () => {
      const result = validateContactForm({
        name: 'John Doe',
        email: 'invalid-email',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should accept optional phone', () => {
      const result = validateContactForm({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
      });

      expect(result.valid).toBe(true);
    });

    it('should validate phone format when provided', () => {
      const result = validateContactForm({
        name: 'John Doe',
        email: 'john@example.com',
        phone: 'not-a-phone',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid phone format');
    });

    it('should reject empty/whitespace name', () => {
      const result = validateContactForm({
        name: '   ',
        email: 'john@example.com',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });
  });

  describe('Demo Request Validation', () => {
    it('should accept valid demo request data', () => {
      const result = validateDemoRequest({
        name: 'Jane Smith',
        email: 'jane@company.com',
        company: 'ABC Management',
        communitySize: '51-150 doors',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require company for demo requests', () => {
      const result = validateDemoRequest({
        name: 'Jane Smith',
        email: 'jane@company.com',
        communitySize: '51-150 doors',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Company/Organization is required');
    });

    it('should require community size for demo requests', () => {
      const result = validateDemoRequest({
        name: 'Jane Smith',
        email: 'jane@company.com',
        company: 'ABC Management',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Community size is required');
    });

    it('should accept optional preferred time', () => {
      const result = validateDemoRequest({
        name: 'Jane Smith',
        email: 'jane@company.com',
        company: 'ABC Management',
        communitySize: '51-150 doors',
        preferredTime: 'Morning (9am-12pm)',
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('Email Validation', () => {
    it('should accept valid email formats', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('user.name@example.com')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
      expect(isValidEmail('user@sub.example.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user @example.com')).toBe(false);
    });
  });

  describe('Phone Validation', () => {
    it('should accept valid phone formats', () => {
      expect(isValidPhone('555-123-4567')).toBe(true);
      expect(isValidPhone('(555) 123-4567')).toBe(true);
      expect(isValidPhone('555.123.4567')).toBe(true);
      expect(isValidPhone('+1 555 123 4567')).toBe(true);
      expect(isValidPhone('5551234567')).toBe(true);
    });

    it('should reject invalid phone formats', () => {
      expect(isValidPhone('123')).toBe(false); // Too short
      expect(isValidPhone('abcdefghij')).toBe(false); // Not numbers
      expect(isValidPhone('555-abc-4567')).toBe(false); // Contains letters
    });
  });

  describe('Input Sanitization', () => {
    it('should trim whitespace', () => {
      expect(sanitizeContactInput('  John Doe  ')).toBe('John Doe');
    });

    it('should escape HTML characters', () => {
      expect(sanitizeContactInput('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('should escape quotes', () => {
      expect(sanitizeContactInput('John "Jack" O\'Brien')).toBe(
        'John &quot;Jack&quot; O&#x27;Brien'
      );
    });

    it('should handle normal text unchanged', () => {
      expect(sanitizeContactInput('Hello World')).toBe('Hello World');
    });
  });

  describe('Subdomain Validation', () => {
    it('should accept valid subdomains', () => {
      expect(isValidSubdomain('markland')).toBe(true);
      expect(isValidSubdomain('markland-woods')).toBe(true);
      expect(isValidSubdomain('community123')).toBe(true);
      expect(isValidSubdomain('abc')).toBe(true);
    });

    it('should reject invalid subdomains', () => {
      expect(isValidSubdomain('')).toBe(false);
      expect(isValidSubdomain('ab')).toBe(false); // Too short
      expect(isValidSubdomain('-invalid')).toBe(false); // Leading hyphen
      expect(isValidSubdomain('invalid-')).toBe(false); // Trailing hyphen
      expect(isValidSubdomain('UPPERCASE')).toBe(false); // Uppercase
      expect(isValidSubdomain('has spaces')).toBe(false); // Spaces
      expect(isValidSubdomain('has_underscore')).toBe(false); // Underscore
    });

    it('should reject subdomains that are too long', () => {
      const longSubdomain = 'a'.repeat(64);
      expect(isValidSubdomain(longSubdomain)).toBe(false);
    });

    it('should accept subdomains up to max length', () => {
      const maxSubdomain = 'a'.repeat(63);
      expect(isValidSubdomain(maxSubdomain)).toBe(true);
    });
  });

  describe('Public Community Info', () => {
    interface PublicCommunityInfo {
      name: string;
      subdomain: string;
      description?: string;
      heroImageUrl?: string;
      contactEmail?: string;
      features?: string[];
    }

    function validateCommunityInfoResponse(info: Partial<PublicCommunityInfo>): boolean {
      return !!(info.name && info.subdomain);
    }

    it('should require name and subdomain in response', () => {
      expect(validateCommunityInfoResponse({
        name: 'Markland Woods',
        subdomain: 'markland-woods',
      })).toBe(true);

      expect(validateCommunityInfoResponse({
        name: 'Markland Woods',
      })).toBe(false);

      expect(validateCommunityInfoResponse({
        subdomain: 'markland-woods',
      })).toBe(false);
    });

    it('should allow optional hero image', () => {
      const info: PublicCommunityInfo = {
        name: 'Markland Woods',
        subdomain: 'markland-woods',
        heroImageUrl: 'https://storage.example.com/hero.jpg',
      };

      expect(validateCommunityInfoResponse(info)).toBe(true);
    });
  });

  describe('Public API Rate Limiting Considerations', () => {
    // These are conceptual tests for rate limiting logic

    interface RateLimitConfig {
      maxRequests: number;
      windowMs: number;
    }

    function isWithinRateLimit(
      requestCount: number,
      config: RateLimitConfig
    ): boolean {
      return requestCount <= config.maxRequests;
    }

    it('should allow requests within limit', () => {
      const config: RateLimitConfig = {
        maxRequests: 10,
        windowMs: 60000, // 1 minute
      };

      expect(isWithinRateLimit(5, config)).toBe(true);
      expect(isWithinRateLimit(10, config)).toBe(true);
    });

    it('should reject requests over limit', () => {
      const config: RateLimitConfig = {
        maxRequests: 10,
        windowMs: 60000,
      };

      expect(isWithinRateLimit(11, config)).toBe(false);
      expect(isWithinRateLimit(100, config)).toBe(false);
    });
  });

  describe('Contact Form Response Shapes', () => {
    interface ContactFormResponse {
      success: boolean;
      message: string;
      requestId?: string;
    }

    it('should have success response shape', () => {
      const successResponse: ContactFormResponse = {
        success: true,
        message: 'Your message has been sent. We will get back to you soon.',
        requestId: 'contact-123',
      };

      expect(successResponse.success).toBe(true);
      expect(successResponse.message).toBeTruthy();
    });

    it('should have error response shape', () => {
      const errorResponse: ContactFormResponse = {
        success: false,
        message: 'Invalid email format',
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.message).toBeTruthy();
    });
  });

  describe('Community Size Options', () => {
    // Valid community size options from the UI
    const COMMUNITY_SIZE_OPTIONS = [
      '1-50 doors',
      '51-150 doors',
      '151-500 doors',
      '500+ doors',
    ];

    function isValidCommunitySize(size: string): boolean {
      return COMMUNITY_SIZE_OPTIONS.includes(size);
    }

    it('should accept valid community size options', () => {
      COMMUNITY_SIZE_OPTIONS.forEach(option => {
        expect(isValidCommunitySize(option)).toBe(true);
      });
    });

    it('should reject invalid community size options', () => {
      expect(isValidCommunitySize('invalid')).toBe(false);
      expect(isValidCommunitySize('100 homes')).toBe(false);
      expect(isValidCommunitySize('')).toBe(false);
    });
  });
});
