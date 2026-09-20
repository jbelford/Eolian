import { describe, expect, it, vi } from 'vitest';
import { MessageFlags } from 'discord.js';
import { DiscordInteractionSender } from '@eolian/framework/interaction/discord-interaction-sender';

function createInteraction(overrides: Record<string, unknown> = {}) {
  return {
    replied: false,
    deferred: false,
    ephemeral: false,
    reply: vi.fn().mockResolvedValue({ resource: { message: { id: 'reply' } } }),
    editReply: vi.fn().mockResolvedValue({ id: 'edited' }),
    followUp: vi.fn().mockResolvedValue({ id: 'follow-up' }),
    ...overrides,
  };
}

describe('DiscordInteractionSender', () => {
  it('uses an initial response and defaults buttonless messages to ephemeral', async () => {
    const interaction = createInteraction();
    const message = await new DiscordInteractionSender(interaction as never).send({
      content: 'hello',
    });

    expect(message).toEqual({ id: 'reply' });
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'hello',
      flags: MessageFlags.Ephemeral,
      withResponse: true,
    });
  });

  it('forces button responses to be public and rejects buttons after an ephemeral defer', async () => {
    const components = [{}] as never;
    const initial = createInteraction();
    await new DiscordInteractionSender(initial as never).send({ components }, true);
    expect(initial.reply).toHaveBeenCalledWith({
      components,
      flags: undefined,
      withResponse: true,
    });

    const deferred = createInteraction({ deferred: true, ephemeral: true });
    await expect(
      new DiscordInteractionSender(deferred as never).send({ components }),
    ).rejects.toThrow('Buttons on ephemeral message are not allowed');
  });

  it('edits a deferred response and does not add flags to edit payloads', async () => {
    const interaction = createInteraction({ deferred: true });
    expect(
      await new DiscordInteractionSender(interaction as never).send({ content: 'deferred' }, false),
    ).toEqual({ id: 'edited' });
    expect(interaction.editReply).toHaveBeenCalledWith({ content: 'deferred' });
  });

  it('edits an existing reply only when requested, otherwise follows up', async () => {
    const interaction = createInteraction({ replied: true });
    const sender = new DiscordInteractionSender(interaction as never);

    expect(await sender.send({ content: 'edit' }, undefined, true)).toEqual({ id: 'edited' });
    expect(interaction.editReply).toHaveBeenCalledWith({ content: 'edit' });

    expect(await sender.send({ content: 'next' }, false)).toEqual({ id: 'follow-up' });
    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'next',
      flags: undefined,
      withResponse: true,
    });
  });

  it('fails explicitly when an initial reply has no message resource', async () => {
    const interaction = createInteraction({
      reply: vi.fn().mockResolvedValue({ resource: null }),
    });
    await expect(
      new DiscordInteractionSender(interaction as never).send({ content: 'hello' }),
    ).rejects.toThrow('No response resource from interaction reply');
  });
});
