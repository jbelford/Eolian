import { describe, expect, it, vi } from 'vitest';
import { ButtonRegistry } from '@eolian/framework/button-registry';

describe('ButtonRegistry', () => {
  it('registers, replaces, looks up, and unregisters message buttons', () => {
    const registry = new ButtonRegistry();
    const first = { emoji: '1', onClick: vi.fn() };
    const replacement = { emoji: '2', onClick: vi.fn() };

    registry.register('message', new Map([['button', first]]));
    expect(registry.getButton('message', 'button')).toBe(first);

    registry.register('message', new Map([['replacement', replacement]]));
    expect(registry.getButton('message', 'button')).toBeUndefined();
    expect(registry.getButton('message', 'replacement')).toBe(replacement);

    registry.unregister('message');
    expect(registry.getButton('message', 'replacement')).toBeUndefined();
  });

  it('treats unknown messages and repeated unregisters as no-ops', () => {
    const registry = new ButtonRegistry();
    expect(registry.getButton('missing', 'button')).toBeUndefined();
    expect(() => registry.unregister('missing')).not.toThrow();
  });
});
