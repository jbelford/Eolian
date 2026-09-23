import { SyntaxName } from '@eolian/common/settings';
import { AppDatabase } from '@eolian/data/@types';
import { IAuthServiceProvider } from '@eolian/framework/@types';
import { DiscordManagement } from '@eolian/framework/discord-management';
import { AuthSecurity } from '../auth/@types';

export type ProviderName = 'spotify' | 'soundcloud';

export interface AccountSettingsDTO {
  syntax: SyntaxName | null;
  providers: Record<ProviderName, { linked: boolean; linkAvailable: boolean }>;
}

export interface GuildSettingsDTO {
  prefix: string;
  volume: number;
  syntax: SyntaxName;
  preferredChannelId: string | null;
  djRoleIds: string[];
  djAllowLimited: boolean;
}

export interface SettingsPluginOptions {
  authProviders: IAuthServiceProvider;
  database: AppDatabase;
  management: DiscordManagement;
  security: AuthSecurity;
}
