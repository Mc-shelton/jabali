import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import router from './router';
import { initAnalytics } from './lib/analytics';
import './index.scss';

// Wires up GA4 + Clarity once, at boot. No-ops unless an ID is configured and
// the visitor has consented — see lib/analytics.js.
initAnalytics();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
