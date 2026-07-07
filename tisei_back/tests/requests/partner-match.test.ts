import { describe, expect, it } from 'vitest';
import { matchesPartnerAliases, normalizeBrandKey } from '../../src/modules/requests/partner-match.js';

describe('partner-match', () => {
  const kfcAliases = ['KFC', 'кфс', 'kentucky fried chicken'];

  it('normalizes spaces and case', () => {
    expect(normalizeBrandKey("  KFC  Астана ")).toBe('kfcастана');
    expect(normalizeBrandKey('Коста   Кофе')).toBe('костакофе');
  });

  it('matches brand variations', () => {
    expect(matchesPartnerAliases('KFC Mega Astana', kfcAliases)).toBe(true);
    expect(matchesPartnerAliases('заявка от кфс проспект', kfcAliases)).toBe(true);
    expect(matchesPartnerAliases("Hardee's Астана", ["Hardee's", 'харди', 'hardees'])).toBe(true);
    expect(matchesPartnerAliases('Golpas ТРЦ', ['golpas', 'голпас'])).toBe(true);
    expect(matchesPartnerAliases('Обычное кафе', kfcAliases)).toBe(false);
  });
});
