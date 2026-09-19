import { describe, expect, it } from 'vitest';
import { KEYWORDS, KEYWORDS_MAPPED, KEYWORD_GROUPS } from '@eolian/command-options/keywords';
import { KeywordGroup, SyntaxType } from '@eolian/command-options/@types';

describe('command keywords', () => {
  it('renders keyword, traditional, slash, and short forms', () => {
    expect(KEYWORDS.ENABLE.text(SyntaxType.KEYWORD)).toBe('enable');
    expect(KEYWORDS.ENABLE.text(SyntaxType.KEYWORD, true)).toBe('on');
    expect(KEYWORDS.ENABLE.text(SyntaxType.TRADITIONAL)).toBe('-enable');
    expect(KEYWORDS.ENABLE.text(SyntaxType.TRADITIONAL, true)).toBe('-on');
    expect(KEYWORDS.ENABLE.text(SyntaxType.SLASH)).toBe('switch:enable');
    expect(KEYWORDS.CLEAR.text(SyntaxType.SLASH)).toBe('clear:True');
  });

  it('maps canonical and short names to the same keyword', () => {
    expect(KEYWORDS_MAPPED.ENABLE).toBe(KEYWORDS.ENABLE);
    expect(KEYWORDS_MAPPED.ON).toBe(KEYWORDS.ENABLE);
    expect(KEYWORDS_MAPPED.N).toBe(KEYWORDS.NEXT);
    expect(KEYWORDS_MAPPED.F).toBe(KEYWORDS.FAST);
  });

  it('describes every public keyword group', () => {
    for (const group of [
      KeywordGroup.Source,
      KeywordGroup.Type,
      KeywordGroup.Switch,
      KeywordGroup.Increment,
      KeywordGroup.Search,
    ]) {
      expect(KEYWORD_GROUPS[group].details).not.toHaveLength(0);
    }
  });

  it('rejects unknown syntax values', () => {
    expect(() => KEYWORDS.CLEAR.text(99 as SyntaxType)).toThrow("Unknown syntax type '99'!");
  });
});
