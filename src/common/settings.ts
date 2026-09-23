import { SyntaxType } from '@eolian/command-options/@types';

export const DJ_ROLE_LIMIT = 10;

export type SyntaxName = 'keyword' | 'traditional';

export function syntaxName(type: SyntaxType): SyntaxName {
  if (type === SyntaxType.KEYWORD) {
    return 'keyword';
  }
  if (type === SyntaxType.TRADITIONAL) {
    return 'traditional';
  }
  throw new Error('Unsupported syntax type');
}

export function parseSyntaxName(value: string): SyntaxType {
  switch (value.toLowerCase()) {
    case 'keyword':
      return SyntaxType.KEYWORD;
    case 'traditional':
      return SyntaxType.TRADITIONAL;
    default:
      throw new Error('Unsupported syntax type');
  }
}

export function validatePrefix(prefix: string): void {
  if (Array.from(prefix).length !== 1) {
    throw new Error('Prefix must be length 1');
  }
}

export function validateVolume(volume: number): void {
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
    throw new Error('Volume must be between 0 and 1');
  }
}

export function normalizeDjRoleIds(roleIds: string[]): string[] {
  const unique = [...new Set(roleIds)];
  if (unique.length !== roleIds.length) {
    throw new Error('DJ roles must be unique');
  }
  if (unique.length > DJ_ROLE_LIMIT) {
    throw new Error(`You may only have up to ${DJ_ROLE_LIMIT} DJ roles`);
  }
  return unique;
}
