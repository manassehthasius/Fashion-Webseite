// Schlanke Linien-Icons (eigene SVGs, keine externe Bibliothek).
const P: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2',
  heart: 'M12 20s-7-4.4-9.2-8.6C1.2 8.3 3 4.8 6.4 4.5c2-.2 3.6.9 4.6 2.4 1-1.5 2.6-2.6 4.6-2.4 3.4.3 5.2 3.8 3.6 6.9C19 15.6 12 20 12 20Z',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5',
  home: 'M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8Z',
  tag: 'M3.5 12.5 12 4h7.5a.5.5 0 0 1 .5.5V12l-8.5 8.5a1 1 0 0 1-1.4 0l-6.6-6.6a1 1 0 0 1 0-1.4ZM16 8.5h.01',
  recycle: 'M7 19H4.5l2.6-4.5M17 19h2.5l-2.6-4.5M12 4l1.3 2.2M9 8.5 12 4l3 4.5M7.5 14.5l-2.4 4.5h5.4M16.5 14.5l2.4 4.5h-5.4M9 8.5 7.4 11.3M15 8.5l1.6 2.8',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4V8Zm8 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  layers: 'm12 4 8 4-8 4-8-4 8-4Zm-8 8 8 4 8-4M4 16l8 4 8-4',
  scale: 'M12 4v16M6 20h12M5 8h14M5 8l-3 6a3 3 0 0 0 6 0L5 8Zm14 0-3 6a3 3 0 0 0 6 0l-3-6Z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  filter: 'M4 6h16M7 12h10M10 18h4',
  chevron: 'm9 6 6 6-6 6',
  back: 'm15 6-6 6 6 6',
  external: 'M14 5h5v5M19 5l-8 8M18 14v5H5V6h5',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
  truck: 'M3 6h11v10H3V6Zm11 4h4l3 3v3h-7v-6ZM7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v6m0-9h.01',
  arrowDown: 'M12 5v14m-6-6 6 6 6-6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-13v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  upload: 'M12 16V4m-5 5 5-5 5 5M5 20h14',
  refresh: 'M20 11a8 8 0 0 0-14.6-4.5L4 8m0-4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16m0 4v-4h-4',
  star: 'm12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.5L12 16l-5 2.9 1.2-5.5L4 9.6 9.6 9 12 4Z',
};

export function Icon({ name, size = 20, stroke = 1.6, fill = 'none', className }: { name: keyof typeof P | string; size?: number; stroke?: number; fill?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={P[name] ?? P.info} />
    </svg>
  );
}
