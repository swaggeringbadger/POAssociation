import { describe, it, expect } from 'vitest';
import { isUnauthorizedError } from '../../client/src/lib/authUtils';

/**
 * Auth Utilities Tests
 *
 * Tests for authentication helper functions
 */

describe('isUnauthorizedError', () => {
  it('should return true for 401 Unauthorized error', () => {
    const error = new Error('401: Unauthorized');
    expect(isUnauthorizedError(error)).toBe(true);
  });

  it('should return true for 401 error with additional message', () => {
    const error = new Error('401: Unauthorized - Invalid token');
    expect(isUnauthorizedError(error)).toBe(true);
  });

  it('should return false for 404 error', () => {
    const error = new Error('404: Not Found');
    expect(isUnauthorizedError(error)).toBe(false);
  });

  it('should return false for 500 error', () => {
    const error = new Error('500: Internal Server Error');
    expect(isUnauthorizedError(error)).toBe(false);
  });

  it('should return false for error without status code', () => {
    const error = new Error('Something went wrong');
    expect(isUnauthorizedError(error)).toBe(false);
  });

  it('should return false for empty error message', () => {
    const error = new Error('');
    expect(isUnauthorizedError(error)).toBe(false);
  });

  it('should be case sensitive', () => {
    const error = new Error('401: unauthorized');
    expect(isUnauthorizedError(error)).toBe(false);
  });
});
