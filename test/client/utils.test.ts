import { describe, it, expect } from 'vitest';
import { cn } from '../../client/src/lib/utils';

/**
 * Utils Tests
 *
 * Tests for utility functions
 * Demonstrates testing of className merging utility
 */

describe('cn (className utility)', () => {
  it('should merge single className', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('should merge multiple classNames', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classNames', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('should filter out falsy values', () => {
    expect(cn('foo', false, 'bar', null, 'baz', undefined)).toBe('foo bar baz');
  });

  it('should merge Tailwind conflicting classes correctly', () => {
    // twMerge should keep the last value for conflicting classes
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('should handle array of classNames', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('should handle object with boolean values', () => {
    expect(cn({
      foo: true,
      bar: false,
      baz: true,
    })).toBe('foo baz');
  });

  it('should handle mixed inputs', () => {
    expect(cn(
      'base',
      ['array-class'],
      { 'object-class': true, 'false-class': false },
      'final'
    )).toBe('base array-class object-class final');
  });

  it('should handle empty inputs', () => {
    expect(cn()).toBe('');
  });

  it('should handle only falsy values', () => {
    expect(cn(false, null, undefined, '')).toBe('');
  });

  it('should handle duplicate classes', () => {
    // Note: clsx keeps duplicates, but order may vary
    const result = cn('foo', 'bar', 'foo');
    expect(result).toContain('foo');
    expect(result).toContain('bar');
  });
});
