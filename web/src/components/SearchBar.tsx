import { useEffect, useState } from 'react';
import { Icon } from './Icon';

const EXAMPLES = [
  'Merino Pullover Herren unter 150',
  'Leinenhemd weiss',
  'Wollmantel Damen hochwertig',
  'Selvedge Jeans',
  'Kaschmir Schal',
  'Lederstiefel braun Grösse 43',
  'Daunenjacke ohne Zoll',
];

export function SearchBar({ initial = '', onSubmit, large = false, compact = false, autoFocus = false, placeholder }: { initial?: string; onSubmit: (q: string) => void; large?: boolean; compact?: boolean; autoFocus?: boolean; placeholder?: string }) {
  const [q, setQ] = useState(initial);
  useEffect(() => setQ(initial), [initial]);
  const [ph] = useState(() => placeholder ?? `z. B. „${EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]}“`);
  return (
    <form
      className={`search${large ? ' lg' : ''}`}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(q.trim());
      }}
    >
      <Icon name="search" size={large ? 20 : 18} className="faint" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={compact ? 'Suchen …' : ph}
        aria-label="Kleidung suchen"
        autoFocus={autoFocus}
        enterKeyHint="search"
        style={{ marginLeft: 10 }}
      />
      {q && (
        <button type="button" className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => { setQ(''); onSubmit(''); }} aria-label="Suche löschen">
          <Icon name="close" size={16} />
        </button>
      )}
      <button className="go" type="submit">Suchen</button>
    </form>
  );
}
