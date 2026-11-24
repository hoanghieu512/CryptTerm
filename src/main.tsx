import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/app';
import { startStateFrom } from './ui/model/start';
import './ui/terminal.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('ROOT ELEMENT NOT FOUND');
}

// Read once per page load, outside React, so StrictMode cannot repeat the read of the fragment.
const start = startStateFrom(location);

createRoot(container).render(
  <StrictMode>
    <App start={start} />
  </StrictMode>,
);
