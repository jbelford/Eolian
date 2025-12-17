import { JSDOM } from 'jsdom';
import { Innertube } from 'youtubei.js';
import {
  BG,
  BgConfig,
  buildURL,
  FetchFunction,
  GOOG_API_KEY,
  USER_AGENT,
  WebPoSignalOutput,
} from 'bgutils-js';
import { logger } from '@eolian/common/logger';
import { randomUUID } from 'crypto';
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { environment } from '@eolian/common/env';

type TokenData = {
  timestamp: number;
  poToken: string;
  visitorData: string;
};

let tokenData: Promise<TokenData> | undefined;

const REFRESH_TIME = 1000 * 60 * 60 * 24;

export async function generatePoToken(
  fetchFunc: FetchFunction,
  complex = true,
): Promise<TokenData> {
  if (tokenData) {
    const result = await tokenData;
    if (Date.now() - result.timestamp < REFRESH_TIME) {
      return result;
    }
  }
  tokenData = complex ? generateTokenComplex(fetchFunc) : generateTokenInternal(fetchFunc);
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

async function generateTokenInternal(fetchFunc: FetchFunction): Promise<TokenData> {
  const innertube = await Innertube.create({ retrieve_player: false });

  const requestKey = 'O43z0dpjhgX20SCx4KAo';
  const visitorData = innertube.session.context.client.visitorData;
  if (!visitorData) {
    throw new Error('Could not get visitor data');
  }

  const dom = new JSDOM();

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
  });

  const bgConfig: BgConfig = {
    fetch: fetchFunc,
    globalObj: globalThis,
    identifier: visitorData,
    requestKey,
  };

  const bgChallenge = await BG.Challenge.create(bgConfig);

  if (!bgChallenge) throw new Error('Could not get challenge');

  const interpreterJavascript =
    bgChallenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;

  if (interpreterJavascript) {
    new Function(interpreterJavascript)();
  } else {
    throw new Error('Could not load VM');
  }

  const { poToken } = await BG.PoToken.generate({
    program: bgChallenge.program,
    globalName: bgChallenge.globalName,
    bgConfig,
  });

  logger.info(`NEW TOKENS GENERATED\nPoToken %s\nVisitorData: %s`, poToken, visitorData);

  return {
    timestamp: Date.now(),
    visitorData,
    poToken,
  };
}

export async function generateTokenComplex(fetchFunc: FetchFunction): Promise<TokenData> {
  const innertubeClient = await Innertube.create({
    enable_session_cache: false,
    fetch: fetchFunc,
    user_agent: USER_AGENT,
    retrieve_player: false,
    cookie: environment.tokens.youtube.cookie || undefined,
    // cookie: innertubeClientCookies || undefined,
    // player_id: PLAYER_ID,
  });

  const visitorData = innertubeClient.session.context.client.visitorData;

  if (!visitorData) {
    throw new Error('Could not get visitor data');
  }

  const dom = new JSDOM(
    '<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>',
    {
      url: 'https://www.youtube.com/',
      referrer: 'https://www.youtube.com/',
      userAgent: USER_AGENT,
    },
  );

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    // location: dom.window.location, // --- doesn't seem to be necessary and the Web Worker doesn't like it
    origin: dom.window.origin,
  });

  if (!Reflect.has(globalThis, 'navigator')) {
    Object.defineProperty(globalThis, 'navigator', {
      value: dom.window.navigator,
    });
  }

  const challengeResponse =
    await innertubeClient.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');
  if (!challengeResponse.bg_challenge) {
    throw new Error('Could not get challenge');
  }

  const interpreterUrl =
    challengeResponse.bg_challenge.interpreter_url
      .private_do_not_access_or_else_trusted_resource_url_wrapped_value;
  const bgScriptResponse = await fetchFunc(`https:${interpreterUrl}`);
  const interpreterJavascript = await bgScriptResponse.text();

  if (interpreterJavascript) {
    new Function(interpreterJavascript)();
  } else throw new Error('Could not load VM');

  // Botguard currently surfaces a "Not implemented" error here, due to the environment
  // not having a valid Canvas API in JSDOM. At the time of writing, this doesn't cause
  // any issues as the Canvas check doesn't appear to be an enforced element of the checks
  console.log(
    '[INFO] the "Not implemented: HTMLCanvasElement.prototype.getContext" error is normal. Please do not open a bug report about it.',
  );
  const botguard = await BG.BotGuardClient.create({
    program: challengeResponse.bg_challenge.program,
    globalName: challengeResponse.bg_challenge.global_name,
    globalObj: globalThis,
  });

  const webPoSignalOutput: WebPoSignalOutput = [];
  const botguardResponse = await botguard.snapshot({ webPoSignalOutput });
  const requestKey = 'O43z0dpjhgX20SCx4KAo';

  const integrityTokenResponse = await fetchFunc(buildURL('GenerateIT', true), {
    method: 'POST',
    headers: {
      'content-type': 'application/json+protobuf',
      'x-goog-api-key': GOOG_API_KEY,
      'x-user-agent': 'grpc-web-javascript/0.1',
      'user-agent': USER_AGENT,
    },
    body: JSON.stringify([requestKey, botguardResponse]),
  });
  const integrityTokenBody = await integrityTokenResponse.json();
  if (typeof integrityTokenBody[0] !== 'string') throw new Error('Could not get integrity token');

  const integrityTokenBasedMinter = await BG.WebPoMinter.create(
    {
      integrityToken: integrityTokenBody[0],
    },
    webPoSignalOutput,
  );

  const sessionPoToken = await integrityTokenBasedMinter.mintAsWebsafeString(visitorData);

  logger.info(`NEW TOKENS GENERATED\nPoToken %s\nVisitorData: %s`, sessionPoToken, visitorData);

  return {
    poToken: sessionPoToken,
    visitorData,
    timestamp: Date.now(),
  };
}
