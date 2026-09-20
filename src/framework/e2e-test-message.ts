export interface E2ETestMessageConfig {
  guildId: string;
  textChannelId: string;
  actorId: string;
}

export interface E2ETestMessage {
  author: {
    bot: boolean;
    id: string;
  };
  guildId: string | null;
  channelId: string;
  content: string;
}

export function matchesE2ETestActor(
  message: E2ETestMessage,
  config: E2ETestMessageConfig,
): boolean {
  return (
    message.author.bot &&
    message.author.id === config.actorId &&
    message.guildId === config.guildId &&
    message.channelId === config.textChannelId
  );
}

export function getE2ECleanupRunId(
  message: E2ETestMessage,
  config: E2ETestMessageConfig,
  eolianBotId: string,
): string | undefined {
  if (!matchesE2ETestActor(message, config)) {
    return undefined;
  }
  const mention = `<@!?${eolianBotId}>`;
  return message.content
    .trim()
    .match(new RegExp(`^${mention}\\s+e2e-cleanup\\s+([0-9a-f-]{36})$`, 'i'))?.[1];
}
