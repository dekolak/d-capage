import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider, useAuth } from './lib/auth';
import { LangueProvider } from './lib/i18n';
import { EspaceProvider } from './lib/espace';
import './styles.css';

/** Langue du compte connecté (sinon celle du téléphone). */
function AvecLangue() {
  const { moi } = useAuth();
  return (
    <LangueProvider compte={moi?.langue}>
      <App />
    </LangueProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <EspaceProvider>
        <AuthProvider>
          <AvecLangue />
        </AuthProvider>
      </EspaceProvider>
    </BrowserRouter>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js');
