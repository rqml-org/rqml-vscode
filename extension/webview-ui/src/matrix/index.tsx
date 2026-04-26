// REQ-MAT-001: Traceability Matrix webview entry point.
import { createRoot } from 'react-dom/client';
import { MatrixApp } from './MatrixApp';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<MatrixApp />);
}
