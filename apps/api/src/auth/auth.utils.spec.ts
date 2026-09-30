import { createOpaqueToken, hashToken, normalizeEmail } from './auth.utils';

describe('auth utilities', () => {
  it('normalizes email addresses and hashes opaque session tokens', () => {
    const token = createOpaqueToken();
    expect(normalizeEmail(' Admin@EventFlow.test ')).toBe('admin@eventflow.test');
    expect(token).toHaveLength(43);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
});
