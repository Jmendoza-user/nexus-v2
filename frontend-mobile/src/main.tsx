// ============================================================
// NEXUS V2.0 — frontend-mobile bootstrap
// ============================================================
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/tokens.css';
import './styles/components.css';
import './styles/app-shell.css';

import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
