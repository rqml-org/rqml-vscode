// Trace Graph webview entry point
import { createRoot } from 'react-dom/client';
import { TraceGraph } from './TraceGraph';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<TraceGraph />);
}
