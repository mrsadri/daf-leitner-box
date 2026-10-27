import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { I18nProvider } from './i18n/I18nProvider';
import { initPwa } from './services/pwa';
import './index.css';

initPwa();

createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
