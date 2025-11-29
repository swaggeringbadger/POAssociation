import { describe, it, expect } from 'vitest';
import {
  getLegalEntityLabel,
  getLegalEntityType,
  getLegalEntityFullLabel,
  replacePOALabel,
  formatRoleLabel,
} from '../../client/src/hooks/useLegalEntityLabel';

/**
 * Legal Entity Label Tests
 *
 * These tests ensure that POA/HOA labels are correctly displayed based on
 * the tenant's communitySettings.legalEntityType setting.
 *
 * Critical: The app historically only supported "POA" terminology.
 * We need to ensure "HOA" is displayed when the tenant setting dictates.
 */

// Test fixtures
const createTenant = (legalEntityType?: 'poa' | 'hoa') => ({
  id: 'test-tenant-id',
  name: 'Test Community',
  subdomain: 'test',
  type: 'community' as const,
  communitySettings: legalEntityType ? { legalEntityType } : undefined,
});

const poaTenant = createTenant('poa');
const hoaTenant = createTenant('hoa');
const noSettingsTenant = createTenant();
const nullTenant = null;
const undefinedTenant = undefined;

describe('getLegalEntityLabel', () => {
  describe('with POA tenant', () => {
    it('should return "POA" when legalEntityType is "poa"', () => {
      expect(getLegalEntityLabel(poaTenant)).toBe('POA');
    });
  });

  describe('with HOA tenant', () => {
    it('should return "HOA" when legalEntityType is "hoa"', () => {
      expect(getLegalEntityLabel(hoaTenant)).toBe('HOA');
    });
  });

  describe('with missing settings', () => {
    it('should return "POA" when communitySettings is undefined', () => {
      expect(getLegalEntityLabel(noSettingsTenant)).toBe('POA');
    });

    it('should return "POA" when tenant is null', () => {
      expect(getLegalEntityLabel(nullTenant)).toBe('POA');
    });

    it('should return "POA" when tenant is undefined', () => {
      expect(getLegalEntityLabel(undefinedTenant)).toBe('POA');
    });

    it('should return "POA" when communitySettings exists but legalEntityType is undefined', () => {
      const tenantWithEmptySettings = {
        ...poaTenant,
        communitySettings: {},
      };
      expect(getLegalEntityLabel(tenantWithEmptySettings)).toBe('POA');
    });
  });

  describe('edge cases', () => {
    it('should return "POA" for empty object tenant', () => {
      expect(getLegalEntityLabel({})).toBe('POA');
    });

    it('should handle deeply nested undefined gracefully', () => {
      const tenantWithNullSettings = {
        ...poaTenant,
        communitySettings: null,
      };
      expect(getLegalEntityLabel(tenantWithNullSettings)).toBe('POA');
    });
  });
});

describe('getLegalEntityType', () => {
  describe('with POA tenant', () => {
    it('should return "poa" when legalEntityType is "poa"', () => {
      expect(getLegalEntityType(poaTenant)).toBe('poa');
    });
  });

  describe('with HOA tenant', () => {
    it('should return "hoa" when legalEntityType is "hoa"', () => {
      expect(getLegalEntityType(hoaTenant)).toBe('hoa');
    });
  });

  describe('with missing settings', () => {
    it('should return "poa" when communitySettings is undefined', () => {
      expect(getLegalEntityType(noSettingsTenant)).toBe('poa');
    });

    it('should return "poa" when tenant is null', () => {
      expect(getLegalEntityType(nullTenant)).toBe('poa');
    });

    it('should return "poa" when tenant is undefined', () => {
      expect(getLegalEntityType(undefinedTenant)).toBe('poa');
    });
  });
});

describe('getLegalEntityFullLabel', () => {
  describe('with POA tenant', () => {
    it('should return "Property Owners Association" for POA', () => {
      expect(getLegalEntityFullLabel(poaTenant)).toBe('Property Owners Association');
    });
  });

  describe('with HOA tenant', () => {
    it('should return "Homeowners Association" for HOA', () => {
      expect(getLegalEntityFullLabel(hoaTenant)).toBe('Homeowners Association');
    });
  });

  describe('with missing settings', () => {
    it('should return "Property Owners Association" as default', () => {
      expect(getLegalEntityFullLabel(nullTenant)).toBe('Property Owners Association');
    });
  });
});

describe('replacePOALabel', () => {
  describe('with POA tenant', () => {
    it('should not change "POA" text when tenant is POA', () => {
      expect(replacePOALabel('POA Board Meeting', poaTenant)).toBe('POA Board Meeting');
    });

    it('should not change "poa" lowercase when tenant is POA', () => {
      expect(replacePOALabel('The poa rules', poaTenant)).toBe('The poa rules');
    });

    it('should replace multiple occurrences of POA', () => {
      expect(replacePOALabel('POA Board and POA Members', poaTenant)).toBe('POA Board and POA Members');
    });
  });

  describe('with HOA tenant', () => {
    it('should replace "POA" with "HOA" when tenant is HOA', () => {
      expect(replacePOALabel('POA Board Meeting', hoaTenant)).toBe('HOA Board Meeting');
    });

    it('should replace "poa" lowercase with "hoa" when tenant is HOA', () => {
      expect(replacePOALabel('The poa rules', hoaTenant)).toBe('The hoa rules');
    });

    it('should replace multiple occurrences of POA with HOA', () => {
      expect(replacePOALabel('POA Board and POA Members', hoaTenant)).toBe('HOA Board and HOA Members');
    });

    it('should replace mixed case occurrences correctly', () => {
      expect(replacePOALabel('POA and poa and POA', hoaTenant)).toBe('HOA and hoa and HOA');
    });
  });

  describe('word boundary matching', () => {
    it('should not replace POA within other words', () => {
      // Words like "APOAP" should not be affected
      expect(replacePOALabel('APOAP', hoaTenant)).toBe('APOAP');
    });

    it('should replace POA at word boundaries', () => {
      expect(replacePOALabel('The POA is great', hoaTenant)).toBe('The HOA is great');
    });

    it('should handle POA at start of string', () => {
      expect(replacePOALabel('POA meeting today', hoaTenant)).toBe('HOA meeting today');
    });

    it('should handle POA at end of string', () => {
      expect(replacePOALabel('Welcome to the POA', hoaTenant)).toBe('Welcome to the HOA');
    });
  });

  describe('with missing settings', () => {
    it('should default to POA when tenant is null', () => {
      expect(replacePOALabel('POA Board', nullTenant)).toBe('POA Board');
    });

    it('should default to POA when tenant is undefined', () => {
      expect(replacePOALabel('POA Board', undefinedTenant)).toBe('POA Board');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(replacePOALabel('', hoaTenant)).toBe('');
    });

    it('should handle string with no POA mentions', () => {
      expect(replacePOALabel('Hello World', hoaTenant)).toBe('Hello World');
    });
  });
});

describe('formatRoleLabel', () => {
  describe('basic role formatting', () => {
    it('should format "homeowner" correctly', () => {
      expect(formatRoleLabel('homeowner', poaTenant)).toBe('Homeowner');
      expect(formatRoleLabel('homeowner', hoaTenant)).toBe('Homeowner');
    });

    it('should format "delegated_rep" correctly', () => {
      expect(formatRoleLabel('delegated_rep', poaTenant)).toBe('Delegated Representative');
      expect(formatRoleLabel('delegated_rep', hoaTenant)).toBe('Delegated Representative');
    });

    it('should format "management_rep" correctly', () => {
      expect(formatRoleLabel('management_rep', poaTenant)).toBe('Management Representative');
    });

    it('should format "management_manager" correctly', () => {
      expect(formatRoleLabel('management_manager', poaTenant)).toBe('Management Manager');
    });

    it('should format "management_employee" correctly', () => {
      expect(formatRoleLabel('management_employee', poaTenant)).toBe('Management Employee');
    });

    it('should format "account_admin" correctly', () => {
      expect(formatRoleLabel('account_admin', poaTenant)).toBe('Account Administrator');
    });

    it('should format "super_admin" correctly', () => {
      expect(formatRoleLabel('super_admin', poaTenant)).toBe('Super Administrator');
    });
  });

  describe('entity-specific roles with POA tenant', () => {
    it('should format "poa_board_member" as "POA Board Member"', () => {
      expect(formatRoleLabel('poa_board_member', poaTenant)).toBe('POA Board Member');
    });

    it('should format "poa_board_contributor" as "POA Board Contributor"', () => {
      expect(formatRoleLabel('poa_board_contributor', poaTenant)).toBe('POA Board Contributor');
    });

    it('should format "hoa_board_member" as "POA Board Member" (uses tenant setting)', () => {
      expect(formatRoleLabel('hoa_board_member', poaTenant)).toBe('POA Board Member');
    });
  });

  describe('entity-specific roles with HOA tenant', () => {
    it('should format "poa_board_member" as "HOA Board Member"', () => {
      expect(formatRoleLabel('poa_board_member', hoaTenant)).toBe('HOA Board Member');
    });

    it('should format "poa_board_contributor" as "HOA Board Contributor"', () => {
      expect(formatRoleLabel('poa_board_contributor', hoaTenant)).toBe('HOA Board Contributor');
    });

    it('should format "hoa_board_member" as "HOA Board Member"', () => {
      expect(formatRoleLabel('hoa_board_member', hoaTenant)).toBe('HOA Board Member');
    });
  });

  describe('fallback formatting for unknown roles', () => {
    it('should convert snake_case to Title Case for unknown roles', () => {
      expect(formatRoleLabel('unknown_role', poaTenant)).toBe('Unknown Role');
    });

    it('should handle single word unknown roles', () => {
      expect(formatRoleLabel('admin', poaTenant)).toBe('Admin');
    });

    it('should handle multiple underscores', () => {
      expect(formatRoleLabel('very_long_role_name', poaTenant)).toBe('Very Long Role Name');
    });
  });

  describe('with missing tenant settings', () => {
    it('should default to POA for entity-specific roles when tenant is null', () => {
      expect(formatRoleLabel('poa_board_member', nullTenant)).toBe('POA Board Member');
    });

    it('should default to POA for entity-specific roles when tenant is undefined', () => {
      expect(formatRoleLabel('poa_board_contributor', undefinedTenant)).toBe('POA Board Contributor');
    });

    it('should default to POA when communitySettings is missing', () => {
      expect(formatRoleLabel('poa_board_member', noSettingsTenant)).toBe('POA Board Member');
    });
  });
});

describe('Integration scenarios', () => {
  describe('Workflow stage labels', () => {
    // These are the stage names that appear in the Applications page
    const stageNames = [
      'POA Board Review',
      'HOA Board Review',
    ];

    it('should replace POA Board Review with HOA Board Review for HOA tenants', () => {
      expect(replacePOALabel('POA Board Review', hoaTenant)).toBe('HOA Board Review');
    });

    it('should keep POA Board Review for POA tenants', () => {
      expect(replacePOALabel('POA Board Review', poaTenant)).toBe('POA Board Review');
    });

    it('should handle mixed stage names appropriately', () => {
      const stages = ['Management Review', 'POA Board Review', 'Final Decision'];
      const hoaStages = stages.map(s => replacePOALabel(s, hoaTenant));

      expect(hoaStages).toEqual(['Management Review', 'HOA Board Review', 'Final Decision']);
    });
  });

  describe('Role display in Directory', () => {
    // Simulating the role display logic in Directory.tsx
    const formatRole = (role: string, tenant: any) => {
      const formatted = role
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      const label = getLegalEntityLabel(tenant);
      return formatted.replace(/\bPoa\b/g, label).replace(/\bHoa\b/g, label);
    };

    it('should format poa_board_member correctly for POA tenant', () => {
      expect(formatRole('poa_board_member', poaTenant)).toBe('POA Board Member');
    });

    it('should format poa_board_member correctly for HOA tenant', () => {
      expect(formatRole('poa_board_member', hoaTenant)).toBe('HOA Board Member');
    });

    it('should format poa_board_contributor correctly for HOA tenant', () => {
      expect(formatRole('poa_board_contributor', hoaTenant)).toBe('HOA Board Contributor');
    });

    it('should not affect non-POA/HOA roles', () => {
      expect(formatRole('homeowner', hoaTenant)).toBe('Homeowner');
      expect(formatRole('management_manager', hoaTenant)).toBe('Management Manager');
    });
  });

  describe('DashboardLayout role formatting', () => {
    // This simulates the formatRole function in DashboardLayout.tsx
    const formatRoleDashboard = (role: string, legalEntityLabel: string) => {
      const formatted = role
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      return formatted.replace(/\bPoa\b/g, legalEntityLabel).replace(/\bHoa\b/g, legalEntityLabel);
    };

    it('should display "HOA Board Member" for HOA tenant', () => {
      const label = getLegalEntityLabel(hoaTenant);
      expect(formatRoleDashboard('poa_board_member', label)).toBe('HOA Board Member');
    });

    it('should display "POA Board Member" for POA tenant', () => {
      const label = getLegalEntityLabel(poaTenant);
      expect(formatRoleDashboard('poa_board_member', label)).toBe('POA Board Member');
    });
  });

  describe('Properties page entity badge', () => {
    it('should show "POA" badge for POA community', () => {
      expect(getLegalEntityLabel(poaTenant)).toBe('POA');
    });

    it('should show "HOA" badge for HOA community', () => {
      expect(getLegalEntityLabel(hoaTenant)).toBe('HOA');
    });
  });

  describe('EditPropertyModal preview text', () => {
    it('should show correct entity label in preview text for POA', () => {
      const legalEntityLabel = getLegalEntityLabel(poaTenant);
      const previewText = `${legalEntityLabel} Board Member`;
      expect(previewText).toBe('POA Board Member');
    });

    it('should show correct entity label in preview text for HOA', () => {
      const legalEntityLabel = getLegalEntityLabel(hoaTenant);
      const previewText = `${legalEntityLabel} Board Member`;
      expect(previewText).toBe('HOA Board Member');
    });
  });
});

describe('All role types comprehensive test', () => {
  // Ensure all roles defined in the system work correctly
  const allRoles = [
    'homeowner',
    'delegated_rep',
    'poa_board_member',
    'poa_board_contributor',
    'hoa_board_member',
    'management_rep',
    'management_manager',
    'management_employee',
    'account_admin',
    'super_admin',
  ];

  describe('with POA tenant', () => {
    allRoles.forEach(role => {
      it(`should format "${role}" without errors for POA tenant`, () => {
        const result = formatRoleLabel(role, poaTenant);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        // Entity-specific roles should contain "POA" for POA tenants
        if (role.includes('board')) {
          expect(result).toContain('POA');
        }
      });
    });
  });

  describe('with HOA tenant', () => {
    allRoles.forEach(role => {
      it(`should format "${role}" without errors for HOA tenant`, () => {
        const result = formatRoleLabel(role, hoaTenant);
        expect(result).toBeTruthy();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        // Entity-specific roles should contain "HOA" for HOA tenants
        if (role.includes('board')) {
          expect(result).toContain('HOA');
        }
      });
    });
  });
});

describe('Regression: Historical POA-only behavior', () => {
  // These tests specifically verify that previous POA-only behavior
  // now correctly handles HOA when the setting is configured

  it('should NOT show "POA" when tenant is configured as HOA', () => {
    const stageLabel = replacePOALabel('POA Board Review', hoaTenant);
    expect(stageLabel).not.toBe('POA Board Review');
    expect(stageLabel).toBe('HOA Board Review');
  });

  it('should NOT show "POA Board Member" role for HOA tenant', () => {
    const roleLabel = formatRoleLabel('poa_board_member', hoaTenant);
    expect(roleLabel).not.toBe('POA Board Member');
    expect(roleLabel).toBe('HOA Board Member');
  });

  it('should NOT show "POA Board Contributor" role for HOA tenant', () => {
    const roleLabel = formatRoleLabel('poa_board_contributor', hoaTenant);
    expect(roleLabel).not.toBe('POA Board Contributor');
    expect(roleLabel).toBe('HOA Board Contributor');
  });

  it('should show correct entity label in all contexts for HOA tenant', () => {
    // Simulate various UI contexts
    const contexts = [
      'POA Board Review',
      'Pending POA Approval',
      'POA Meeting Notes',
      'Contact the POA',
      'Your POA account',
    ];

    contexts.forEach(context => {
      const result = replacePOALabel(context, hoaTenant);
      expect(result).not.toContain('POA');
      expect(result).toContain('HOA');
    });
  });
});
