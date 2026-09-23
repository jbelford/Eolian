import { validateDiscordClientId } from './discord-client-id.mts';

const INVITE_SCOPES = 'bot applications.commands';
const INVITE_PERMISSIONS = '3665216';

export const createDiscordInviteUrl = (clientId: string | undefined): string => {
  const params = new URLSearchParams({
    client_id: validateDiscordClientId(clientId),
    scope: INVITE_SCOPES,
    permissions: INVITE_PERMISSIONS,
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
};

export const discordInviteUrl = createDiscordInviteUrl(import.meta.env.VITE_DISCORD_CLIENT_ID);
