import { describe, expect, it } from 'vitest';
import { DEEP_GROUPS, deepGroupOf, deepGroupsFor } from '../shared/deep';
import { buildShop, candidateDomains, nameMatches } from '../engine/discover';
import { totalPages } from '../engine/deep';
import { landedCost, STATIC_FX } from '../shared/pricing';
import type { Category, Shop } from '../shared/types';

describe('Gesamtsortiment-Gruppen', () => {
  it('ordnet jede Kategorie genau einer Gruppe zu', () => {
    const all = Object.values(DEEP_GROUPS).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(deepGroupOf('trousers')).toBe('hosen');
    expect(deepGroupOf('sneakers')).toBe('schuhe');
    expect(deepGroupOf('other' as Category)).toBe('basics');
  });
  it('lädt nur die passenden Gruppen', () => {
    expect(deepGroupsFor(['trousers', 'jeans'])).toEqual(['hosen']);
    expect(deepGroupsFor(['sneakers', 'coat']).sort()).toEqual(['jacken', 'schuhe']);
    expect(deepGroupsFor(undefined)).toEqual(Object.keys(DEEP_GROUPS));
  });
  it('berechnet die Feed-Seiten mit Shopify-Limit', () => {
    expect(totalPages(undefined)).toBe(0);
    expect(totalPages(600)).toBe(3);
    expect(totalPages(25001)).toBe(100);
    expect(totalPages(80000)).toBe(100);
  });
});

describe('Shop-Entdeckung', () => {
  it('erzeugt plausible Domains für Marken', () => {
    expect(candidateDomains('Wood Wood')).toEqual(expect.arrayContaining(['woodwood.com', 'wood-wood.com', 'woodwood.dk']));
    expect(candidateDomains('Arte Antwerp')[0]).toBe('arteantwerp.com');
    expect(candidateDomains('Pop Trading Company')).toContain('poptradingcompany.com');
  });
  it('erkennt, ob ein Shop zur Marke gehört', () => {
    expect(nameMatches('Arte Antwerp', 'Arte Antwerp', 'arte-antwerp.com')).toBe(true);
    expect(nameMatches('ARTE', 'Arte Antwerp', 'arte-antwerp.com')).toBe(true);
    expect(nameMatches('Wood Wood', 'Wood Wood Official Store', 'woodwood.com')).toBe(true);
    expect(nameMatches('Norse Projects', 'Random Outlet', 'norseprojects.de')).toBe(false);
    expect(nameMatches('Rains', 'Spain Domains', 'rains.es')).toBe(false); // Domain allein reicht nicht
    expect(nameMatches('Han', 'Hanover Tools', 'hanovertools.com')).toBe(false);
  });
  it('baut einen vollständigen Shop mit Schätzungen und Kennzeichnung', () => {
    const s = buildShop('Arte Antwerp', 'arte-antwerp.com', 'BE', 'EUR', ['streetwear'], ['Kith', 'Goodhood'], true) as Shop;
    expect(s.id).toBe('x-arteantwerp');
    expect(s.duty).toBe('dap');
    expect(s.homeVat).toBe(0.21);
    expect(s.exportVatRemoved).toBe(true);
    expect(s.shipping.verified).toBe(false);
    expect(s.trust?.level).toBe('auto');
    expect(s.discovered?.via).toEqual(['Kith', 'Goodhood']);
    expect(s.discovered?.checks).toContain('AGB');
    const c = landedCost(100, s, STATIC_FX);
    expect(c.total).toBeGreaterThan(80);
    const us = buildShop('Taylor', 'taylor.com', 'US', 'USD', [], ['Kith'], false) as Shop;
    expect(us.homeVat).toBe(0);
    expect(us.exportVatRemoved).toBe(false);
    const ch = buildShop('Zimtstern', 'zimtstern.ch', 'CH', 'CHF', [], ['Langbrett'], false) as Shop;
    expect(ch.duty).toBe('domestic');
  });
});
