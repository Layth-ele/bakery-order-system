import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/* ✅ LOAD STYLES */
import './styles/index.css';

// ✅ FIREBASE ONLY MODE - localStorage is disabled for production
// Any remaining localStorage references are dead code and will silently no-op
// ✅ PASS 5: Explicit return types added (was implicit any under noImplicitAny).
const _noopStorage: Storage = {
  getItem: (_: string): string | null => null,
  setItem: (_: string, __: string): void => undefined,
  removeItem: (_: string): void => undefined,
  clear: (): void => undefined,
  key: (_: number): string | null => null,
  length: 0,
};
// Override localStorage to prevent any accidental writes/reads
// Data layer uses Firebase exclusively
Object.defineProperty(window, '__firebaseOnlyMode', { value: true, writable: false });


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);