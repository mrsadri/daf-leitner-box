import {createRoot} from 'react-dom/client';
import App from './app/App.tsx';
import { I18nProvider } from './i18n/I18nProvider';
import { initPwa } from './features/settings/pwa';
import { removeLegacyStorage } from './core/legacyCleanup';
import './index.css';

removeLegacyStorage();
initPwa();

createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
