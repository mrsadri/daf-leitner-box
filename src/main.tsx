import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { I18nProvider } from './i18n/I18nProvider';
import { initPwa } from './services/pwa';
import { removeLegacyStorage } from './services/legacyCleanup';
import './index.css';

removeLegacyStorage();
initPwa();

createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
