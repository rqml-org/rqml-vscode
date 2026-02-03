// Document View webview entry point
import { createRoot } from 'react-dom/client';
import { DocumentView } from './DocumentView';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<DocumentView />);
}
