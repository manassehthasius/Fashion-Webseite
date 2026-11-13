import { useEffect, useRef, useState } from 'react';
import type { Item } from '../lib/data';
import { ProductCard } from './ProductCard';
import type { StyleProfile } from '@shared/types';
import { combinedMatch, isPersonalized } from '@shared/personalize';
import { useUser } from '../lib/store';

export function ProductGrid({ items, pageSize = 48, profile, dense = false, resetKey }: { items: Item[]; pageSize?: number; profile?: StyleProfile; dense?: boolean; resetKey?: string }) {
  const [n, setN] = useState(pageSize);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setN(pageSize), [resetKey, pageSize]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setN((x) => Math.min(items.length, x + pageSize)), { rootMargin: '1200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length, pageSize]);
  const user = useUser();
  const usePersonal = profile && isPersonalized(profile, user.interests);
  return (
    <>
      <div className={`grid${dense ? ' dense' : ''}`}>
        {items.slice(0, n).map((p) => (
          <ProductCard key={p.id} p={p} match={usePersonal ? combinedMatch(p, profile!, user.interests) : null} compact={dense} />
        ))}
      </div>
      {n < items.length && (
        <div ref={sentinel} className="load-more">
          <button className="btn" onClick={() => setN((x) => x + pageSize)}>
            Mehr laden ({items.length - n})
          </button>
        </div>
      )}
    </>
  );
}

export function Rail({ items }: { items: Item[] }) {
  return (
    <div className="rail">
      {items.map((p) => (
        <ProductCard key={p.id} p={p} compact />
      ))}
    </div>
  );
}
