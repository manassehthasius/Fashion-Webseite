// Direkt-Suchlinks zu Plattformen ohne freie öffentliche API (legal: wir öffnen nur deren eigene Suche).
// Stand 11/2026. URL-Formate können sich ändern; Links öffnen in neuem Tab.

export interface PlatformLink {
  id: string;
  name: string;
  segment: 'secondhand' | 'new' | 'compare';
  shipsToCH: boolean;
  note: string;
  url: string;
}

export interface LinkQuery {
  q: string;
  maxPrice?: number;
  size?: string;
}

const enc = encodeURIComponent;

export function platformLinks({ q, maxPrice }: LinkQuery): PlatformLink[] {
  const query = q.trim() || 'kleidung';
  return [
    {
      id: 'google', name: 'Google Shopping', segment: 'compare', shipsToCH: true,
      note: 'Vergleicht Angebote fast aller Onlineshops, auch solcher ohne öffentlichen Feed. Versand in die Schweiz je Angebot prüfen.',
      url: `https://www.google.com/search?tbm=shop&hl=de&gl=ch&q=${enc(query)}`,
    },
    {
      id: 'toppreise', name: 'toppreise.ch', segment: 'compare', shipsToCH: true,
      note: 'Schweizer Preisvergleich mit Schweizer Händlern (Preise in CHF).',
      url: `https://www.toppreise.ch/produktsuche?q=${enc(query)}`,
    },
    {
      id: 'ricardo', name: 'Ricardo', segment: 'secondhand', shipsToCH: true,
      note: 'Grösster Schweizer Marktplatz. Tipp: Suchabo auf Ricardo speichern (gratis E-Mail-Alarm).',
      url: `https://www.ricardo.ch/de/s/${enc(query)}`,
    },
    {
      id: 'tutti', name: 'tutti.ch', segment: 'secondhand', shipsToCH: true,
      note: 'Schweizer Kleinanzeigen, oft Abholung oder Versand per Post.',
      url: `https://www.tutti.ch/de/q/suche?query=${enc(query)}`,
    },
    {
      id: 'vestiaire', name: 'Vestiaire Collective', segment: 'secondhand', shipsToCH: true,
      note: 'Designer-Secondhand mit Echtheitsprüfung, liefert in die Schweiz (Import-MWST möglich).',
      url: `https://de.vestiairecollective.com/search/?q=${enc(query)}`,
    },
    {
      id: 'ebay', name: 'eBay.ch (gebraucht)', segment: 'secondhand', shipsToCH: true,
      note: 'Filter: Kleidung & Accessoires, Zustand gebraucht. Versand in die Schweiz je Angebot prüfen.',
      url: `https://www.ebay.ch/sch/i.html?_nkw=${enc(query)}&_sacat=11450&LH_ItemCondition=3000${maxPrice ? `&_udhi=${maxPrice}` : ''}`,
    },
    {
      id: 'grailed', name: 'Grailed', segment: 'secondhand', shipsToCH: true,
      note: 'Herren-Designer & Streetwear, internationaler Versand (Zoll/MWST bei Lieferung).',
      url: `https://www.grailed.com/shop?query=${enc(query)}`,
    },
    {
      id: 'vinted', name: 'Vinted', segment: 'secondhand', shipsToCH: false,
      note: 'Kein Versand in die Schweiz (Stand 11/2026) – nur mit Paketweiterleitung über eine EU-Adresse.',
      url: `https://www.vinted.de/catalog?search_text=${enc(query)}${maxPrice ? `&price_to=${maxPrice}` : ''}`,
    },
    {
      id: 'zalando', name: 'Zalando.ch', segment: 'new', shipsToCH: true,
      note: 'Gratisversand & -retouren in der Schweiz.',
      url: `https://www.zalando.ch/katalog/?q=${enc(query)}`,
    },
    {
      id: 'galaxus', name: 'Galaxus', segment: 'new', shipsToCH: true,
      note: 'Schweizer Onlinehändler mit Mode-Sortiment.',
      url: `https://www.galaxus.ch/de/search?q=${enc(query)}`,
    },
  ];
}
