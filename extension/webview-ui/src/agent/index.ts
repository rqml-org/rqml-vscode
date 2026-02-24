import { createAgentTerminal } from './agentTerminal';

const root = document.getElementById('root');
if (root) {
  root.style.width = '100%';
  root.style.height = '100%';
  root.style.overflow = 'hidden';
  createAgentTerminal(root);
}