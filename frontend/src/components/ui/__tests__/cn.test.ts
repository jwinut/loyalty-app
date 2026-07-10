import { describe, it, expect } from 'vitest';
import { cn } from '../cn';

describe('cn', () => {
  it('should join plain string arguments with a single space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should drop falsy values (undefined, null, false, empty string)', () => {
    expect(cn('foo', undefined, null, false, '', 'bar')).toBe('foo bar');
  });

  it('should include class names gated by a truthy condition', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('should exclude class names gated by a falsy condition', () => {
    const isActive = false;
    expect(cn('base', isActive && 'active')).toBe('base');
  });

  it('should flatten arrays of class values', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('should return an empty string when given no meaningful input', () => {
    expect(cn(undefined, null, false)).toBe('');
  });
});
