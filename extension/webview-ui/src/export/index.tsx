import React from 'react';
import { createRoot } from 'react-dom/client';
import { ExportWizard } from './ExportWizard';
import './export.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ExportWizard />);
}
