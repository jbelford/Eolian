import { SOURCE_DETAILS } from '@eolian/api';
import { TrackSource } from '@eolian/api/@types';
import { EolianUserError } from '@eolian/common/errors';
import { logger } from '@eolian/common/logger';
import {
  createAuthEmbed,
  createAuthCompleteEmbed,
  createAuthExpiredEmbed,
  createAuthErrorEmbed,
} from '@eolian/embed';
import {
  IAuthorizationProvider,
  IAuthService,
  TokenResponseWithRefresh,
} from '@eolian/http/@types';
import { ContextUser, ContextSendable, EmbedMessage } from './@types';

export class DiscordAuthorizationProvider implements IAuthorizationProvider {
  private readonly name: string;

  constructor(
    private readonly user: ContextUser,
    private readonly service: IAuthService,
    private readonly type: TrackSource,
    public sendable: ContextSendable,
  ) {
    this.name = SOURCE_DETAILS[type].name;
  }

  async authorize(): Promise<TokenResponseWithRefresh> {
    logger.info('[%s] Authorizing %s', this.user.id, this.name);

    await this.sendable.send(`${this.name} authorization required! Check your DMs`);

    const result = this.service.authorize();
    const embedMessage: EmbedMessage = createAuthEmbed(result.link, this.type);
    const message = await this.user.sendEmbed(embedMessage);
    if (!message) {
      throw new EolianUserError(
        `I failed to send ${this.name} authorization link to you via DM! Are you blocking me? 😢`,
      );
    }
    try {
      const response = await result.response;

      await Promise.allSettled([
        this.user.setToken(response.refresh_token, this.type),
        message?.editEmbed(createAuthCompleteEmbed(this.type)),
      ]);

      return response;
    } catch (e) {
      if (e === 'timeout') {
        logger.info('[%s] %s authorization timed out', this.user.id, this.name);
        await message.editEmbed(createAuthExpiredEmbed(this.type));
      } else {
        logger.warn(`[%s] %s failed to authorize: %s`, this.user.id, this.name, e);
        await message.editEmbed(createAuthErrorEmbed(this.type));
      }
      throw new EolianUserError(
        `${this.name} authorization failed! Be sure to check your DMs and try again.`,
      );
    }
  }
}
