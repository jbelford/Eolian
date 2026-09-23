export const validateDiscordClientId = (clientId: string | undefined): string => {
  if (!clientId || !/^[1-9]\d{16,19}$/.test(clientId)) {
    throw new Error(
      'VITE_DISCORD_CLIENT_ID must be a Discord application ID (17–20 decimal digits).',
    );
  }

  return clientId;
};
