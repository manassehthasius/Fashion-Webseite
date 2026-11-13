import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import './styles.css';
import { App } from './App';
import { loadCatalog, refreshIfStale } from './lib/data';
import { initSync } from './lib/sync';

// Theme (hell/dunkel/automatisch)
const theme = localStorage.getItem('stilkompass:theme');
if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;

createRoot(document.getElementById('root')!).render(<App />);
void loadCatalog();
void initSync();

// Service Worker: Offline-Cache + Push-Benachrichtigungen
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
  // Katalog im Hintergrund aktualisieren, wenn die App wieder sichtbar wird
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshIfStale();
  });
}
