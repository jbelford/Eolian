import { describe, expect, it, vi } from 'vitest';
import { ButtonStyle } from '@eolian/framework/@types';
import {
  DiscordMessage,
  mapDiscordEmbed,
  mapDiscordEmbedButtons,
} from '@eolian/framework/discord-message';
import { DISCORD_CONTENT_MAX, DiscordSender } from '@eolian/framework/discord-sender';

function createDiscordMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'message',
    content: 'hello',
    editable: true,
    deletable: true,
    author: { id: 'author' },
    client: { user: { id: 'bot' } },
    react: vi.fn().mockResolvedValue(undefined),
    edit: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('DiscordMessage mapping', () => {
  it('maps and clamps embed properties without broad snapshots', () => {
    const embed = mapDiscordEmbed({
      color: 123,
      header: { text: 'Header', icon: 'https://example.test/header.png' },
      title: 't'.repeat(300),
      description: 'd'.repeat(2100),
      thumbnail: 'https://example.test/thumb.png',
      image: 'https://example.test/image.png',
      url: 'https://example.test',
      footer: { text: 'f'.repeat(2100), icon: 'https://example.test/footer.png' },
      fields: Array.from({ length: 30 }, (_, index) => ({
        name: `${index}${'n'.repeat(300)}`,
        value: 'v'.repeat(1100),
      })),
    }).toJSON();

    expect(embed.color).toBe(123);
    expect(embed.author).toEqual({
      name: 'Header',
      icon_url: 'https://example.test/header.png',
    });
    expect(embed.title).toHaveLength(256);
    expect(embed.description).toHaveLength(2048);
    expect(embed.footer?.text).toHaveLength(2048);
    expect(embed.fields).toHaveLength(25);
    expect(embed.fields?.[0].name).toHaveLength(256);
    expect(embed.fields?.[0].value).toHaveLength(1024);
  });

  it('maps buttons into rows of five with stable ids and styles', () => {
    const buttons = Array.from({ length: 6 }, (_, index) => ({
      emoji: `${index + 1}️⃣`,
      style: index === 0 ? ButtonStyle.DANGER : undefined,
      disabled: index === 1,
      onClick: vi.fn(),
    }));

    const result = mapDiscordEmbedButtons(buttons);
    expect(result.rows).toHaveLength(2);
    expect(result.mapping.get('button_0')).toBe(buttons[0]);
    expect(result.mapping.get('button_5')).toBe(buttons[5]);
    expect(result.rows[0].components).toHaveLength(5);
    expect(result.rows[0].components[0]).toMatchObject({
      custom_id: 'button_0',
      style: 4,
      disabled: false,
    });
    expect(result.rows[0].components[1]).toMatchObject({
      custom_id: 'button_1',
      style: 2,
      disabled: true,
    });
  });
});

describe('DiscordMessage', () => {
  it('edits text and embeds through the message and retains button components', async () => {
    const raw = createDiscordMessage();
    const registry = { register: vi.fn(), unregister: vi.fn() };
    const components = [{ type: 1 }];
    const message = new DiscordMessage(raw as never, {
      registry: registry as never,
      components: components as never,
    });

    await message.edit('updated');
    expect(raw.edit).toHaveBeenCalledWith({
      content: 'updated',
      embeds: [],
      components,
    });

    const button = { emoji: '✅', onClick: vi.fn() };
    await message.editEmbed({ title: 'Result', buttons: [button] });
    expect(registry.register).toHaveBeenCalledWith('message', new Map([['button_0', button]]));
    expect(raw.edit).toHaveBeenLastCalledWith(
      expect.objectContaining({ embeds: [expect.anything()], components: expect.any(Array) }),
    );
  });

  it('uses a button interaction update even when the underlying message is not editable', async () => {
    const raw = createDiscordMessage({ editable: false });
    const interaction = { update: vi.fn().mockResolvedValue(undefined) };
    const message = new DiscordMessage(raw as never, {
      registry: { register: vi.fn(), unregister: vi.fn() } as never,
      components: [],
      interaction: interaction as never,
    });

    await message.edit('updated');
    expect(interaction.update).toHaveBeenCalledWith({
      content: 'updated',
      embeds: [],
      components: [],
    });
    expect(raw.edit).not.toHaveBeenCalled();
  });

  it('releases buttons before deletion and suppresses Discord operation errors', async () => {
    const raw = createDiscordMessage({
      react: vi.fn().mockRejectedValue(new Error('react')),
      delete: vi.fn().mockRejectedValue(new Error('delete')),
    });
    const registry = { register: vi.fn(), unregister: vi.fn() };
    const message = new DiscordMessage(raw as never, {
      registry: registry as never,
      components: [{ type: 1 }] as never,
    });

    await expect(message.react('✅')).resolves.toBeUndefined();
    await expect(message.delete()).resolves.toBeUndefined();
    expect(registry.unregister).toHaveBeenCalledWith('message');
    expect(raw.delete).toHaveBeenCalledOnce();
  });

  it('does not edit or delete messages lacking the corresponding capability', async () => {
    const raw = createDiscordMessage({ editable: false, deletable: false });
    const message = new DiscordMessage(raw as never);
    await message.edit('ignored');
    await message.delete();
    expect(raw.edit).not.toHaveBeenCalled();
    expect(raw.delete).not.toHaveBeenCalled();
  });
});

describe('DiscordSender', () => {
  it('clamps text, forwards interaction options, and wraps the response', async () => {
    const raw = createDiscordMessage();
    const sender = { send: vi.fn().mockResolvedValue(raw) };
    const wrapper = new DiscordSender(sender);
    const result = await wrapper.send('x'.repeat(DISCORD_CONTENT_MAX + 10), {
      ephemeral: false,
      editReply: true,
    });

    const sent = sender.send.mock.calls[0][0].content as string;
    expect(sent).toHaveLength(DISCORD_CONTENT_MAX);
    expect(sent.endsWith('..')).toBe(true);
    expect(sender.send).toHaveBeenCalledWith({ content: sent }, false, true);
    expect(result?.id).toBe('message');
  });

  it('registers embed buttons only after the message is sent successfully', async () => {
    const raw = createDiscordMessage();
    const sender = { send: vi.fn().mockResolvedValue(raw) };
    const registry = { register: vi.fn(), unregister: vi.fn() };
    const button = { emoji: '✅', onClick: vi.fn() };
    const wrapper = new DiscordSender(sender, registry as never);

    const result = await wrapper.sendEmbed({ title: 'Title', buttons: [button] });
    expect(sender.send).toHaveBeenCalledWith(
      { embeds: [expect.anything()], components: expect.any(Array) },
      undefined,
    );
    expect(registry.register).toHaveBeenCalledWith('message', new Map([['button_0', button]]));
    result?.releaseButtons();
    expect(registry.unregister).toHaveBeenCalledWith('message');
  });

  it('returns undefined when Discord rejects sends', async () => {
    const sender = { send: vi.fn().mockRejectedValue(new Error('offline')) };
    const wrapper = new DiscordSender(sender);
    await expect(wrapper.send('message')).resolves.toBeUndefined();
    await expect(wrapper.sendEmbed({ title: 'embed' })).resolves.toBeUndefined();
  });
});
