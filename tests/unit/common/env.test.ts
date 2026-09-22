import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('environment session secret validation', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('rejects SESSION_SECRET values shorter than 32 UTF-8 bytes without logging the value', async () => {
    const value = 'é'.repeat(15);
    vi.stubEnv('SESSION_SECRET', value);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit:1');
    }) as never);

    await expect(import('@eolian/common/env')).rejects.toThrow('exit:1');

    expect(log).toHaveBeenCalledWith('Invalid env: SESSION_SECRET must be at least 32 UTF-8 bytes');
    expect(log.mock.calls.flat().join(' ')).not.toContain(value);
  });

  it('accepts a SESSION_SECRET containing exactly 32 UTF-8 bytes', async () => {
    const value = 'é'.repeat(16);
    vi.stubEnv('SESSION_SECRET', value);

    const { environment } = await import('@eolian/common/env');

    expect(Buffer.byteLength(environment.sessionSecret, 'utf8')).toBe(32);
    expect(environment.sessionSecret).toBe(value);
  });
});
