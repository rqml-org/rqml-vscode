import React from 'react';
import { createRoot } from 'react-dom/client';
import { AgentView } from './AgentView';

const root = createRoot(document.getElementById('root')!);
root.render(<AgentView />);
