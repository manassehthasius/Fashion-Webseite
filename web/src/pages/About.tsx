import { useData } from '../lib/data';
import { chf, ago } from '../lib/format';
import { CH_IMPORT } from '@shared/pricing';

export function About() {
  const data = useData();
  const shops = [...data.shops].sort((a, b) => a.segment.localeCompare(b.segment) || a.name.localeCompare(b.name));
  return (
    <div className="container" style={{ maxWidth: 980 }}>
      <div className="page-head">
        <div>
          <h1 style={{ fontSize: 'clamp(32px,4vw,46px)' }}>Methode & Transparenz</h1>
          <p>Wie Stilkompass Daten sammelt, Gesamtpreise berechnet und Qualität bewertet – und was (noch) nicht möglich ist.</p>
        </div>
      </div>
      <div className="stack" style={{ gap: 18 }}>
        <section className="panel">
          <h3 style={{ marginBottom: 8 }}>Datenquellen</h3>
          <p className="small muted">
            Echte Produktdaten aus den öffentlichen Storefront-Feeds kuratierter Shops (Shopify <code>/products.json</code>). Die Lieferung in die Schweiz wird bei jedem Lauf über die offiziellen Lieferländer des Shops (<code>/meta.json</code>) geprüft, robots.txt wird respektiert, pro Shop höchstens ein Abruf alle 30 Minuten mit Pausen zwischen den Seiten. Wo ein Shop einen Schweizer Markt hat, nutzt Stilkompass dessen echte CHF-Preise. Sonst wird mit dem Tageskurs umgerechnet (Wechselkurse aus dem öffentlichen Shopify-Kursfeed, Fallback: manuell gepflegte Kurse).
          </p>
          <p className="small muted"><b>Seriositätsprüfung (11/2026):</b> Jeder Shop hat Rückgabe-, Datenschutz- und AGB-Seiten sowie Kontakt- oder Firmenangaben. Händler und Secondhand-Shops wurden zusätzlich anhand von Kundenbewertungen geprüft. Entfernt wurden HEWI (Trustpilot 2.2/5, Beschwerden zu Echtheit und Lieferung) und Baghunter (keine überprüfbaren Bewertungen). Goodhood und Overkill haben gemischte Bewertungen und sind gekennzeichnet.</p>
          <p className="small muted">Ricardo, tutti.ch, Vinted, Vestiaire Collective, Grailed und eBay bieten keine kostenlose, frei nutzbare Such-API. Scraping wäre ein Verstoss gegen ihre Nutzungsbedingungen. Stilkompass öffnet deshalb deren eigene Suche mit deinen Suchbegriffen (Direktlinks).</p>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="compare-table">
              <thead>
                <tr><th>Shop</th><th>Typ</th><th>Vertrauen</th><th>Produkte</th><th>Preise</th><th>Versand CH</th><th>Status</th></tr>
              </thead>
              <tbody>
                {shops.map((s) => (
                  <tr key={s.id}>
                    <td><a href={`https://${s.domain}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>{s.name}</a> <span className="faint tiny">{s.country}</span></td>
                    <td className="small">{s.segment === 'secondhand' ? 'Secondhand' : 'Neu'}</td>
                    <td className="small">{s.trust ? <span style={{ color: s.trust.level === 'verified' ? 'var(--good)' : 'var(--warn)' }} title={s.trust.note}>{s.trust.level === 'verified' ? '✓ ' : '⚠ '}{s.trust.basis}</span> : '–'}</td>
                    <td className="num small">{s.health?.products ?? '–'}</td>
                    <td className="small">{s.market ? `CHF (CH-Markt, ${s.market.mode === 'ddp' ? 'inkl. MWST' : 'zzgl. Import'})` : s.currency === 'CHF' ? 'CHF' : `${s.currency} → CHF, ${s.duty === 'ddp' ? 'DDP' : s.duty === 'dap' ? 'zzgl. Import' : ''}`}</td>
                    <td className="small">{s.shipping.cost === 0 ? 'gratis' : `${s.shipping.currency} ${s.shipping.cost}`}{s.shipping.freeFrom ? `, gratis ab ${s.shipping.freeFrom}` : ''} {s.shipping.verified ? '✓' : <span className="faint">(geschätzt)</span>}</td>
                    <td className="small">{s.health?.ok ? <span style={{ color: 'var(--good)' }}>aktuell</span> : <span style={{ color: 'var(--warn)' }}>{s.health?.error ?? 'veraltet'}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.generatedAt && <p className="tiny faint" style={{ marginTop: 8 }}>Letzte Aktualisierung {ago(Date.parse(data.generatedAt) / 1000)} · Kurse {data.fx?.source === 'shopify' ? 'Tageskurs' : 'Fixkurs'} vom {data.fx?.date} (EUR {data.fx?.toCHF.EUR?.toFixed(4)}, GBP {data.fx?.toCHF.GBP?.toFixed(4)}, USD {data.fx?.toCHF.USD?.toFixed(4)})</p>}
        </section>

        <section className="panel">
          <h3 style={{ marginBottom: 8 }}>Gesamtpreis in die Schweiz</h3>
          <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
            <li><b>Artikel:</b> CHF-Preis des Schweizer Shop-Markts oder umgerechneter Preis. Bei EU/UK-Shops ohne CH-Markt wird angenommen, dass die Heimat-MWST beim Export abgezogen wird (markiert als Schätzung).</li>
            <li><b>Versand:</b> laut Versandbedingungen des Shops (✓) oder geschätzt, inklusive Gratisversand-Schwelle.</li>
            <li><b>Zoll:</b> CHF 0 – die Schweiz hat Industriezölle (inkl. Kleidung und Schuhe) per 1.1.2024 abgeschafft.</li>
            <li><b>Einfuhr-MWST:</b> {CH_IMPORT.vatRate * 100} % auf Warenwert inkl. Versand, nicht erhoben bis CHF {CH_IMPORT.vatMinTax} Steuer (≈ Warenwert bis CHF 62).</li>
            <li><b>Verzollungsgebühr:</b> Post-Tarif CHF {CH_IMPORT.postFeeEU.toFixed(2)} (EU) bzw. {CH_IMPORT.postFeeOther.toFixed(2)} (übrige Länder) + 3 % des Warenwerts, max. {chf(CH_IMPORT.postFeeMax)}. Kuriere können mehr verlangen.</li>
            <li><b>DDP-Shops</b> (z. B. Drake's) liefern verzollt – keine Kosten bei der Lieferung.</li>
            <li>Der Warenkorb-Rechner zeigt, wie viel du sparst, wenn du mehrere Teile beim selben Shop bestellst.</li>
          </ul>
        </section>

        <section className="panel">
          <h3 style={{ marginBottom: 8 }}>Qualitätsscore (0–100)</h3>
          <p className="small muted" style={{ marginTop: 0 }}>Berechnet aus den verfügbaren Produktdaten, jede Komponente ist gekennzeichnet als <b>Daten</b>, <b>kuratiert</b> oder <b>Schätzung</b>. Liegt der datenbasierte Anteil unter 50 %, zeigt Stilkompass „≈“ bzw. „Schätzung“.</p>
          <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
            <li><b>Material (35):</b> Zusammensetzung mit Prozenten, bewertet nach Einsatzzweck (z. B. Merino/Kaschmir hoch, Acryl im Strick tief, technisches Nylon bei Jacken passend).</li>
            <li><b>Verarbeitung (20):</b> erkannte Merkmale wie Goodyear-rahmengenäht, Selvedge, Fully Fashioned, Kappnähte, Stoffgewicht (g/m², oz), Premium-Stoffe.</li>
            <li><b>Marke & Ruf (20):</b> kuratierte Reputation (1–5) für Materialqualität und Langlebigkeit.</li>
            <li><b>Herkunft & Zertifikate (10):</b> Herstellungsland und Zertifikate (GOTS, bluesign, RWS, Fair Wear, B Corp …).</li>
            <li><b>Langlebigkeit/Zustand (15):</b> bei Secondhand der angegebene Zustand, bei Neuware Reparatur-/Garantieangebote.</li>
          </ul>
          <p className="small muted">„Preis-Leistung“ vergleicht die Qualität mit dem Median-Gesamtpreis der Kategorie.</p>
        </section>

        <section className="panel">
          <h3 style={{ marginBottom: 8 }}>KI ohne laufende Kosten</h3>
          <p className="small muted" style={{ margin: 0 }}>
            Die Bildsuche nutzt das Open-Source-Modell <b>Marqo-FashionSigLIP</b>, das direkt in deinem Browser läuft (einmaliger Download, danach gecacht). Die Engine berechnet die Bild-Embeddings der Produkte vorab. Suche, Outfits, Personalisierung und Qualitätsscore laufen regelbasiert im Browser. Es gibt keine Claude-/KI-API-Aufrufe und keine Abos.
          </p>
        </section>

        <section className="panel">
          <h3 style={{ marginBottom: 8 }}>Grenzen (ehrlich gesagt)</h3>
          <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
            <li><b>Ricardo, Vinted, Vestiaire, tutti, Grailed, eBay:</b> keine Produktdaten im Katalog (keine freie API). Daher nur Direktsuche, und für diese Plattformen keine automatischen Alarme. Tipp: Ricardo und Vinted bieten eigene, kostenlose Suchabos.</li>
            <li><b>Vinted</b> liefert nicht in die Schweiz (Stand 11/2026).</li>
            <li><b>Zalando, Zara, H&M, Bershka, Pull&Bear, Mango, About You, ASOS, Manor & Co.</b> (über 35 Shops): Sie verbieten automatisches Auslesen und bieten keinen offenen Feed. Deshalb öffnet Stilkompass bei jeder Suche mit einem Klick ihre eigene Suche (oder eine Google-Suche nur auf diesem Shop). Preise, Qualitätsscore und Alarme gibt es dort nicht automatisch – für einen Preisvergleich über alle Shops hilft Google Shopping.</li>
            <li>Versandkosten sind bei manchen Shops geschätzt (gekennzeichnet). Grössenangaben folgen dem jeweiligen Shop (EU/UK/US gemischt).</li>
            <li>Aktualisierung „alle 30 Minuten“: GitHub Actions startet geplante Läufe teils mit einigen Minuten Verzögerung.</li>
            <li>Web-Push auf dem iPhone funktioniert nur, wenn Stilkompass zum Home-Bildschirm hinzugefügt wurde (iOS 16.4+).</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
