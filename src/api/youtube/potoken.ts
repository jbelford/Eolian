import { JSDOM } from 'jsdom';
import { Innertube } from 'youtubei.js';
import { BG } from 'bgutils-js';
import { logger } from '@eolian/common/logger';

type TokenData = {
  timestamp: number;
  poToken?: string;
  placeholderPoToken: string;
  visitorData?: string;
}

let tokenData: Promise<TokenData> | undefined;

const REFRESH_TIME = 1000 * 60 * 60 * 24;

export async function generatePoToken(): Promise<TokenData> {
  if (tokenData) {
    const result = await tokenData;
    if (Date.now() - result.timestamp < REFRESH_TIME) {
      return result;
    }
  }
  tokenData = generateTokenInternal()
  return tokenData;
}

async function generateTokenInternal(): Promise<TokenData> {
  const innertube = await Innertube.create({ retrieve_player: false });

  const requestKey = 'O43z0dpjhgX20SCx4KAo';
  const visitorData = innertube.session.context.client.visitorData;

  const dom = new JSDOM();

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document
  });

  const bgConfig = {
    // @ts-ignore
    fetch: (url, options) => fetch(url, options),
    globalObj: globalThis,
    identifier: visitorData,
    requestKey,
  };

    // @ts-ignore
  const challenge = await BG.Challenge.create(bgConfig);

  if (!challenge)
    throw new Error('Could not get challenge');

  if (challenge.script) {
    const script = challenge.script.find((sc) => sc !== null);
    if (script)
      new Function(script)();
  } else {
    console.warn('Unable to load Botguard.');
  }

  const poToken = await BG.PoToken.generate({
    program: challenge.challenge,
    globalName: challenge.globalName,
    // @ts-ignore
    bgConfig
  });

    // @ts-ignore
  const placeholderPoToken = BG.PoToken.generatePlaceholder(visitorData);

  logger.info(
    `NEW TOKENS GENERATED\nPoToken %s\nPlaceholder %s\nVisitorData: %s`,
    poToken,
    placeholderPoToken,
    visitorData
  );

  return {
    timestamp: Date.now(),
    visitorData,
    placeholderPoToken,
    poToken,
  };
}
