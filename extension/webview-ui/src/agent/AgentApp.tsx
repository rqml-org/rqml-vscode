// Root layout: chat area + input box
import React, { useEffect, useMemo } from 'react';
import { ChatMessages } from './ChatMessages';
import { InputBox } from './InputBox';
import { useAgentMessages } from './useAgentMessages';
import { useVscodeTheme } from '../shared/useVscodeTheme';
import { updateMermaidTheme } from './mermaidRenderer';
import './agent.css';

export const AgentApp: React.FC = () => {
  const {
    messages,
    endpointStatus,
    commandNames,
    isLoading,
    startupStatus,
    sendPrompt,
    acceptChange,
    rejectChange,
    allowAllChanges,
    approveToolCall,
    rejectToolCall,
    allowAllToolCalls,
    respondToChoice,
  } = useAgentMessages();

  // Initialize mermaid with VS Code theme colors
  const theme = useVscodeTheme();
  useEffect(() => {
    const bg = theme.background.replace('#', '');
    const r = parseInt(bg.substring(0, 2), 16) || 0;
    const g = parseInt(bg.substring(2, 4), 16) || 0;
    const b = parseInt(bg.substring(4, 6), 16) || 0;
    const isDark = (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;

    updateMermaidTheme({
      isDark,
      foreground: theme.foreground,
      background: theme.editorBackground,
      primaryColor: theme.buttonBackground,
      primaryTextColor: theme.buttonForeground,
      lineColor: theme.panelBorder,
    });
  }, [theme]);

  // Derive status message for the input box
  const statusMessage = useMemo(() => {
    if (!endpointStatus.configured) {
      return 'No LLM endpoint configured';
    }
    const model = endpointStatus.model || 'no model';
    const provider = endpointStatus.name || '';
    return `${model}${provider ? ` (${provider})` : ''}`;
  }, [endpointStatus]);

  // Spec health: placeholder 0 for now (will be wired to spec service)
  const specHealth = 0;

  return (
    <div className="agent-root">
      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        startupStatus={startupStatus}
        onAcceptChange={acceptChange}
        onRejectChange={rejectChange}
        onAllowAllChanges={allowAllChanges}
        onApproveToolCall={approveToolCall}
        onRejectToolCall={rejectToolCall}
        onAllowAllToolCalls={allowAllToolCalls}
        onRespondToChoice={respondToChoice}
      />
      <InputBox
        onSubmit={sendPrompt}
        isLoading={isLoading}
        endpointStatus={endpointStatus}
        commandNames={commandNames}
        specHealth={specHealth}
        statusMessage={statusMessage}
      />
    </div>
  );
};
