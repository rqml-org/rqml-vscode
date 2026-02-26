// Agent webview entry point — React chat UI
import { createRoot } from 'react-dom/client';
import { AgentApp } from './AgentApp';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<AgentApp />);
}
