import { describe, it, expect } from 'vitest';
import { formatEnumValue } from '../../client/src/lib/formatters';

/**
 * Formatter Utility Tests
 *
 * Tests for string formatting functions
 * Following best practices: clear descriptions, edge cases, type safety
 */

describe('formatEnumValue', () => {
  it('should format snake_case to Title Case', () => {
    expect(formatEnumValue('in_progress')).toBe('In Progress');
  });

  it('should format multiple words correctly', () => {
    expect(formatEnumValue('this_is_the_new_format')).toBe('This Is The New Format');
  });

  it('should handle single word', () => {
    expect(formatEnumValue('draft')).toBe('Draft');
  });

  it('should handle all uppercase', () => {
    expect(formatEnumValue('PENDING_REVIEW')).toBe('Pending Review');
  });

  it('should handle mixed case', () => {
    expect(formatEnumValue('Mixed_Case_VALUE')).toBe('Mixed Case Value');
  });

  it('should handle empty string', () => {
    expect(formatEnumValue('')).toBe('');
  });

  it('should handle string with no underscores', () => {
    expect(formatEnumValue('submitted')).toBe('Submitted');
  });

  it('should handle multiple consecutive underscores', () => {
    expect(formatEnumValue('test__value')).toBe('Test  Value');
  });

  it('should handle trailing underscore', () => {
    expect(formatEnumValue('test_value_')).toBe('Test Value ');
  });

  it('should handle leading underscore', () => {
    expect(formatEnumValue('_test_value')).toBe(' Test Value');
  });
});
