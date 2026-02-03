// Requirements Matrix webview entry point
import { createRoot } from 'react-dom/client';
import { MatrixView } from './MatrixView';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<MatrixView />);
}
