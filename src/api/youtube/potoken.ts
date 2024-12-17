import { JSDOM } from 'jsdom';
import { Innertube } from 'youtubei.js';
import { BG, FetchFunction } from 'bgutils-js';
import { logger } from '@eolian/common/logger';
import { randomUUID } from 'crypto';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { environment } from '@eolian/common/env';

type TokenData = {
  timestamp: number;
  poToken?: string;
  placeholderPoToken: string;
  visitorData?: string;
};

let tokenData: Promise<TokenData> | undefined;

const REFRESH_TIME = 1000 * 60 * 60 * 24;

export async function generatePoToken(fetchFunc?: FetchFunction): Promise<TokenData> {
  if (tokenData) {
    const result = await tokenData;
    if (Date.now() - result.timestamp < REFRESH_TIME) {
      return result;
    }
  }
  tokenData = generateTokenInternal(fetchFunc);
  return tokenData;
}

export function createProxyUrl(): string | undefined {
  if (!environment.proxy) {
    return undefined;
  }
  const sessId = `sessid-${randomUUID()}`;
  const { user, password, name } = environment.proxy;
  return `http://${user}-cc-us-${sessId}:${password}@${name}`;
}

export function createFetchFunction(proxy?: string): FetchFunction {
  const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;
  return async (input, init) => {
    const notRequest = typeof input === 'string' || input instanceof URL;
    const url = notRequest ? input : input.url;

    const modifiedInit = {
      ...init,
      method: init?.method,
      agent,
    };

    if (!notRequest) {
      modifiedInit.method = input.method;
    }

    const response = await fetch(url, modifiedInit as any);
    return response as any;
  };
}

async function generateTokenInternal(fetchFunc?: FetchFunction): Promise<TokenData> {
  const innertube = await Innertube.create({ retrieve_player: false });

  const requestKey = 'O43z0dpjhgX20SCx4KAo';
  const visitorData = innertube.session.context.client.visitorData;

  const dom = new JSDOM();

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });

  const bgConfig = {
    fetch: fetchFunc,
    globalObj: globalThis,
    identifier: visitorData,
    requestKey,
  };

  // @ts-ignore
  const challenge = await BG.Challenge.create(bgConfig);

  if (!challenge) throw new Error('Could not get challenge');

  if (challenge.script) {
    const script = challenge.script.find(sc => sc !== null);
    if (script) new Function(script)();
  } else {
    console.warn('Unable to load Botguard.');
  }

  const poToken = await BG.PoToken.generate({
    program: challenge.challenge,
    globalName: challenge.globalName,
    // @ts-ignore
    bgConfig,
  });

  // @ts-ignore
  const placeholderPoToken = BG.PoToken.generatePlaceholder(visitorData);

  logger.info(
    `NEW TOKENS GENERATED\nPoToken %s\nPlaceholder %s\nVisitorData: %s`,
    poToken,
    placeholderPoToken,
    visitorData,
  );

  return {
    timestamp: Date.now(),
    visitorData,
    placeholderPoToken,
    poToken,
  };
}
