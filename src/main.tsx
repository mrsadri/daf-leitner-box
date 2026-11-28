/**
 * Browser entry: removes storage of retired features, starts the PWA helpers and analytics, renders the app.
 */
import {createRoot} from 'react-dom/client';
import App from './app/App.tsx';
import { RecoveryBoundary } from './shared/ui/RecoveryBoundary';
import { I18nProvider } from './i18n/I18nProvider';
import { initPwa } from './features/settings/pwa';
import { removeLegacyStorage } from './core/legacyCleanup';
import { initClarity } from './shared/lib/clarity';
import './index.css';

removeLegacyStorage();
initPwa();
initClarity();

createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <RecoveryBoundary><App /></RecoveryBoundary>
  </I18nProvider>
);
