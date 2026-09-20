import { E2ERequestType, E2ESource } from './harness-config';

export interface E2EChatRequest {
  eolianBotId: string;
  source: E2ESource;
  requestType: E2ERequestType;
  request: string;
}

export function createPlayCommand(request: E2EChatRequest): string {
  const mention = `<@${request.eolianBotId}>`;
  const value = request.request.trim();
  if (request.requestType === 'url') {
    return `${mention} play ${value}`;
  }
  return `${mention} play (${value}) ${request.source} fast`;
}

export function createCleanupCommand(eolianBotId: string, runId: string): string {
  return `<@${eolianBotId}> e2e-cleanup ${runId}`;
}
