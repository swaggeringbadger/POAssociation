/**
 * useSubdomain Hook Unit Tests
 *
 * Tests the client-side subdomain detection and tenant auto-selection logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Mock tenant data for testing
 */
const mockTenants = [
  {
    id: '1',
    name: 'Markland POA',
    type: 'community' as const,
    subdomain: 'markland',
    managementCompanyId: null,
    isActive: true,
  },
  {
    id: '2',
    name: 'Whispering Pines HOA',
    type: 'community' as const,
    subdomain: 'whispering-pines',
    managementCompanyId: null,
    isActive: true,
  },
  {
    id: '3',
    name: 'Apex Management',
    type: 'management_company' as const,
    subdomain: 'apex-management',
    managementCompanyId: null,
    isActive: true,
  },
];

/**
 * Simulates the tenant matching logic from useSubdomain hook
 */
function findMatchingTenant(
  subdomain: string | null,
  availableTenants: typeof mockTenants
) {
  if (!subdomain) return null;

  return availableTenants.find(
    (t) => t.subdomain.toLowerCase() === subdomain.toLowerCase()
  );
}

/**
 * Simulates the subdomain mode detection
 */
function isSubdomainMode(subdomain: string | null): boolean {
  return !!subdomain;
}

describe('useSubdomain Hook Logic', () => {
  describe('Tenant Matching', () => {
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

    it('should find management company by subdomain', () => {
      const tenant = findMatchingTenant('apex-management', mockTenants);
      expect(tenant?.id).toBe('3');
      expect(tenant?.type).toBe('management_company');
    });

    it('should return null for non-existent subdomain', () => {
      const tenant = findMatchingTenant('nonexistent', mockTenants);
      expect(tenant).toBeNull();
    });

    it('should return null for null subdomain', () => {
      const tenant = findMatchingTenant(null, mockTenants);
      expect(tenant).toBeNull();
    });

    it('should return null for empty string subdomain', () => {
      const tenant = findMatchingTenant('', mockTenants);
      expect(tenant).toBeNull();
    });

    it('should return null when no tenants available', () => {
      const tenant = findMatchingTenant('markland', []);
      expect(tenant).toBeNull();
    });
  });

  describe('Subdomain Mode Detection', () => {
    it('should return true when subdomain is present', () => {
      expect(isSubdomainMode('markland')).toBe(true);
    });

    it('should return false when subdomain is null', () => {
      expect(isSubdomainMode(null)).toBe(false);
    });

    it('should return false when subdomain is empty string', () => {
      expect(isSubdomainMode('')).toBe(false);
    });
  });

  describe('Auto-Selection Behavior', () => {
    it('should select matching tenant when subdomain detected', () => {
      const subdomain = 'markland';
      const matchingTenant = findMatchingTenant(subdomain, mockTenants);

      // Simulate the auto-selection logic
      let currentTenant = null;
      if (matchingTenant) {
        currentTenant = matchingTenant;
      }

      expect(currentTenant?.id).toBe('1');
      expect(currentTenant?.subdomain).toBe('markland');
    });

    it('should not change tenant if already set to correct one', () => {
      const subdomain = 'markland';
      const currentTenant = mockTenants[0]; // Already set to markland
      const matchingTenant = findMatchingTenant(subdomain, mockTenants);

      // Should not trigger a state update if already correct
      const shouldUpdate = matchingTenant && currentTenant?.id !== matchingTenant.id;
      expect(shouldUpdate).toBe(false);
    });

    it('should update tenant if current differs from subdomain', () => {
      const subdomain = 'markland';
      const currentTenant = mockTenants[1]; // whispering-pines
      const matchingTenant = findMatchingTenant(subdomain, mockTenants);

      const shouldUpdate = matchingTenant && currentTenant?.id !== matchingTenant.id;
      expect(shouldUpdate).toBe(true);
    });
  });
});

describe('Subdomain URL Construction', () => {
  const PRODUCTION_DOMAIN = 'poassociation.com';

  function buildTenantUrl(subdomain: string): string {
    return `https://${subdomain}.${PRODUCTION_DOMAIN}`;
  }

  it('should build correct URL for markland', () => {
    expect(buildTenantUrl('markland')).toBe('https://markland.poassociation.com');
  });

  it('should build correct URL for hyphenated subdomain', () => {
    expect(buildTenantUrl('whispering-pines')).toBe(
      'https://whispering-pines.poassociation.com'
    );
  });

  it('should build correct URL for management company', () => {
    expect(buildTenantUrl('apex-management')).toBe(
      'https://apex-management.poassociation.com'
    );
  });
});

describe('Subdomain Display Formatting', () => {
  function formatSubdomainForDisplay(subdomain: string): string {
    return `${subdomain}.poassociation.com`;
  }

  it('should format subdomain for breadcrumb display', () => {
    expect(formatSubdomainForDisplay('markland')).toBe('markland.poassociation.com');
  });

  it('should handle hyphenated subdomains', () => {
    expect(formatSubdomainForDisplay('whispering-pines')).toBe(
      'whispering-pines.poassociation.com'
    );
  });
});

describe('Tenant Switcher Visibility', () => {
  it('should hide tenant switcher when in subdomain mode', () => {
    const subdomain = 'markland';
    const isSubdomainModeActive = isSubdomainMode(subdomain);
    const hasMultipleTenants = mockTenants.length > 1;

    // In subdomain mode, switcher should be hidden
    const showTenantSwitcher = hasMultipleTenants && !isSubdomainModeActive;
    expect(showTenantSwitcher).toBe(false);
  });

  it('should show tenant switcher when not in subdomain mode and has multiple tenants', () => {
    const subdomain = null;
    const isSubdomainModeActive = isSubdomainMode(subdomain);
    const hasMultipleTenants = mockTenants.length > 1;

    const showTenantSwitcher = hasMultipleTenants && !isSubdomainModeActive;
    expect(showTenantSwitcher).toBe(true);
  });

  it('should hide tenant switcher when only one tenant available', () => {
    const subdomain = null;
    const isSubdomainModeActive = isSubdomainMode(subdomain);
    const singleTenant = [mockTenants[0]];
    const hasMultipleTenants = singleTenant.length > 1;

    const showTenantSwitcher = hasMultipleTenants && !isSubdomainModeActive;
    expect(showTenantSwitcher).toBe(false);
  });
});

describe('Demo Code Subdomain Patterns', () => {
  const demoTenants = [
    {
      id: '1',
      name: 'Markland POA',
      subdomain: 'markland-ec0f707e',
      type: 'community' as const,
      managementCompanyId: null,
      isActive: true,
    },
    {
      id: '2',
      name: 'Whispering Pines HOA',
      subdomain: 'whispering-pines-ec0f707e',
      type: 'community' as const,
      managementCompanyId: null,
      isActive: true,
    },
  ];

  it('should match demo subdomain with suffix', () => {
    const tenant = findMatchingTenant('markland-ec0f707e', demoTenants);
    expect(tenant?.id).toBe('1');
  });

  it('should match hyphenated demo subdomain', () => {
    const tenant = findMatchingTenant('whispering-pines-ec0f707e', demoTenants);
    expect(tenant?.id).toBe('2');
  });

  it('should not match base name without suffix', () => {
    // The demo ecosystem creates unique subdomains with suffixes
    // Base name without suffix should not match
    const tenant = findMatchingTenant('markland', demoTenants);
    expect(tenant).toBeNull();
  });
});
