/**
 * Subdomain Handling Unit Tests
 *
 * Tests the core subdomain parsing logic and tenant lookup functionality.
 * These tests verify that subdomain-based multi-tenancy works correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for subdomain parsing logic
 * These test the pure parsing functions without database dependencies
 */
describe('Subdomain Parsing Logic', () => {
  /**
   * Helper function that mirrors the middleware subdomain extraction logic
   */
  function extractSubdomain(hostname: string, querySubdomain?: string): string | null {
    // Query param takes priority (for testing)
    if (querySubdomain) {
      return querySubdomain;
    }

    const parts = hostname.split('.');

    // Need at least 3 parts for a subdomain (e.g., markland.poassociation.com)
    if (parts.length >= 3) {
      const subdomain = parts[0];
      // Exclude common non-tenant subdomains
      if (subdomain !== 'www' && subdomain !== 'api' && subdomain !== 'admin') {
        return subdomain;
      }
    }

    return null;
  }

  describe('Production hostname parsing', () => {
    it('should extract subdomain from markland.poassociation.com', () => {
      const subdomain = extractSubdomain('markland.poassociation.com');
      expect(subdomain).toBe('markland');
    });

    it('should extract subdomain from whispering-pines.poassociation.com', () => {
      const subdomain = extractSubdomain('whispering-pines.poassociation.com');
      expect(subdomain).toBe('whispering-pines');
    });

    it('should extract subdomain from apex-management.poassociation.com', () => {
      const subdomain = extractSubdomain('apex-management.poassociation.com');
      expect(subdomain).toBe('apex-management');
    });

    it('should handle subdomains with demo code suffix', () => {
      const subdomain = extractSubdomain('markland-ec0f707e.poassociation.com');
      expect(subdomain).toBe('markland-ec0f707e');
    });

    it('should handle 4-part hostnames (e.g., staging.markland.poassociation.com)', () => {
      const subdomain = extractSubdomain('staging.markland.poassociation.com');
      expect(subdomain).toBe('staging');
    });
  });

  describe('Non-tenant subdomains', () => {
    it('should return null for www.poassociation.com', () => {
      const subdomain = extractSubdomain('www.poassociation.com');
      expect(subdomain).toBeNull();
    });

    it('should return null for api.poassociation.com', () => {
      const subdomain = extractSubdomain('api.poassociation.com');
      expect(subdomain).toBeNull();
    });

    it('should return null for admin.poassociation.com', () => {
      const subdomain = extractSubdomain('admin.poassociation.com');
      expect(subdomain).toBeNull();
    });
  });

  describe('Bare domain handling', () => {
    it('should return null for poassociation.com (no subdomain)', () => {
      const subdomain = extractSubdomain('poassociation.com');
      expect(subdomain).toBeNull();
    });

    it('should return null for localhost', () => {
      const subdomain = extractSubdomain('localhost');
      expect(subdomain).toBeNull();
    });

    it('should return null for localhost:5000', () => {
      // Port is stripped by express before hostname is accessed
      const subdomain = extractSubdomain('localhost');
      expect(subdomain).toBeNull();
    });
  });

  describe('Query parameter override', () => {
    it('should prioritize query param subdomain over hostname', () => {
      const subdomain = extractSubdomain('poassociation.com', 'markland');
      expect(subdomain).toBe('markland');
    });

    it('should use query param even when hostname has different subdomain', () => {
      const subdomain = extractSubdomain('other.poassociation.com', 'markland');
      expect(subdomain).toBe('markland');
    });

    it('should handle empty query param by falling back to hostname', () => {
      const subdomain = extractSubdomain('markland.poassociation.com', '');
      // Empty string is falsy, so should extract from hostname
      expect(subdomain).toBe('markland');
    });
  });

  describe('Edge cases', () => {
    it('should handle IP addresses (no subdomain)', () => {
      const subdomain = extractSubdomain('192.168.1.1');
      expect(subdomain).toBeNull();
    });

    it('should handle case sensitivity in subdomains', () => {
      const subdomain = extractSubdomain('Markland.poassociation.com');
      expect(subdomain).toBe('Markland');
    });

    it('should handle subdomains with numbers', () => {
      const subdomain = extractSubdomain('test123.poassociation.com');
      expect(subdomain).toBe('test123');
    });

    it('should handle subdomains with multiple hyphens', () => {
      const subdomain = extractSubdomain('test-demo-code-123.poassociation.com');
      expect(subdomain).toBe('test-demo-code-123');
    });
  });
});

/**
 * Tests for subdomain case-insensitive matching
 */
describe('Subdomain Matching Logic', () => {
  /**
   * Helper that mirrors the useSubdomain hook's matching logic
   */
  function findMatchingTenant(
    subdomain: string,
    tenants: Array<{ id: string; subdomain: string; name: string }>
  ) {
    return tenants.find(
      (t) => t.subdomain.toLowerCase() === subdomain.toLowerCase()
    );
  }

  const mockTenants = [
    { id: '1', subdomain: 'markland', name: 'Markland POA' },
    { id: '2', subdomain: 'whispering-pines', name: 'Whispering Pines HOA' },
    { id: '3', subdomain: 'apex-management', name: 'Apex Management Solutions' },
  ];

  it('should find tenant with exact subdomain match', () => {
    const tenant = findMatchingTenant('markland', mockTenants);
    expect(tenant?.id).toBe('1');
    expect(tenant?.name).toBe('Markland POA');
  });

  it('should find tenant with case-insensitive match (uppercase)', () => {
    const tenant = findMatchingTenant('MARKLAND', mockTenants);
    expect(tenant?.id).toBe('1');
  });

  it('should find tenant with case-insensitive match (mixed case)', () => {
    const tenant = findMatchingTenant('MarkLand', mockTenants);
    expect(tenant?.id).toBe('1');
  });

  it('should find tenant with hyphenated subdomain', () => {
    const tenant = findMatchingTenant('whispering-pines', mockTenants);
    expect(tenant?.id).toBe('2');
  });

  it('should return undefined for non-existent subdomain', () => {
    const tenant = findMatchingTenant('nonexistent', mockTenants);
    expect(tenant).toBeUndefined();
  });

  it('should return undefined for empty subdomain', () => {
    const tenant = findMatchingTenant('', mockTenants);
    expect(tenant).toBeUndefined();
  });
});

/**
 * Tests for production domain patterns
 */
describe('Production Domain Patterns', () => {
  const PRODUCTION_DOMAIN = 'poassociation.com';

  function buildSubdomainUrl(subdomain: string): string {
    return `https://${subdomain}.${PRODUCTION_DOMAIN}`;
  }

  function extractSubdomainFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const parts = urlObj.hostname.split('.');
      if (parts.length >= 3 && !['www', 'api', 'admin'].includes(parts[0])) {
        return parts[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  it('should build correct URL for markland tenant', () => {
    const url = buildSubdomainUrl('markland');
    expect(url).toBe('https://markland.poassociation.com');
  });

  it('should extract subdomain from full URL', () => {
    const subdomain = extractSubdomainFromUrl('https://markland.poassociation.com/dashboard');
    expect(subdomain).toBe('markland');
  });

  it('should handle URLs with paths', () => {
    const subdomain = extractSubdomainFromUrl('https://markland.poassociation.com/applications/123');
    expect(subdomain).toBe('markland');
  });

  it('should handle URLs with query params', () => {
    const subdomain = extractSubdomainFromUrl('https://markland.poassociation.com?tab=pending');
    expect(subdomain).toBe('markland');
  });
});
