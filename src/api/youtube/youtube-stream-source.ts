import { logger } from '@eolian/common/logger';
import { Readable } from 'stream';
import { StreamSource } from '../@types';
import { Innertube, Platform, Types, UniversalCache } from 'youtubei.js';
import { createFetchFunction, createProxyUrl, generatePoToken } from './potoken';
import { httpRequest } from '@eolian/http';
import { environment } from '@eolian/common/env';

Platform.shim.eval = async (
  data: Types.BuildScriptResult,
  env: Record<string, Types.VMPrimative>,
) => {
  const properties = [];

  if (env.n) {
    properties.push(`n: exportedVars.nFunction("${env.n}")`);
  }

  if (env.sig) {
    properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
  }

  const code = `${data.output}\nreturn { ${properties.join(', ')} }`;

  return new Function(code)();
};

const cache = new UniversalCache(true);

export class YouTubeStreamSource implements StreamSource {
  constructor(
    private readonly url: string,
    private readonly id: string,
  ) {}

  async get(seek?: number): Promise<Readable> {
    logger.info('Getting youtube stream %s - %s', this.url, this.id);

    const proxy = createProxyUrl();
    const fetch = createFetchFunction(proxy);
    const config: Types.InnerTubeConfig = {
      cache,
      generate_session_locally: true,
      cookie: environment.tokens.youtube.cookie || undefined,
      fetch,
    };
    if (environment.flags.enablePoTokenGen) {
      const { poToken, visitorData } = await generatePoToken(fetch, false);
      config.po_token = poToken;
      config.visitor_data = visitorData;
    }

    const innertube = await Innertube.create(config);

    const info = await innertube.getBasicInfo(this.id);
    const audioStreamingURL = await info
      .chooseFormat({ quality: 'best' })
      .decipher(innertube.session.player);
    return httpRequest(audioStreamingURL, { proxy });
  }
}
