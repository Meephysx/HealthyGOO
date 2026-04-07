import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { NutritionProvider } from './context/NutritionContext';
import './index.css';
import { AuthProvider } from './context/AuthContext';

if ('serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  }).catch((error) => {
    console.warn('Unable to unregister service workers in dev mode:', error);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <NutritionProvider>
        <App />
      </NutritionProvider>
    </AuthProvider>
  </React.StrictMode>,
);