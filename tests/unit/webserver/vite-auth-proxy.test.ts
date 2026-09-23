import { resolveConfig } from 'vite';
import { describe, expect, it } from 'vitest';

describe('local browser OAuth proxy', () => {
  it('routes API and provider callbacks to the local bot without rewriting paths', async () => {
    const config = await resolveConfig(
      { configFile: 'vite.web.config.mts' },
      'serve',
      'development',
    );

    expect(config.server.port).toBe(5173);
    expect(config.server.strictPort).toBe(true);
    expect(config.server.proxy?.['/api']).toEqual({
      target: 'http://127.0.0.1:8080',
    });
    expect(config.server.proxy?.['/callback/']).toEqual({
      target: 'http://127.0.0.1:8080',
    });
    expect(Object.keys(config.server.proxy ?? {})).toEqual(['/api', '/callback/']);
  });
});
