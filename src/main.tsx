import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/app';
import './ui/terminal.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('ROOT ELEMENT NOT FOUND');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
