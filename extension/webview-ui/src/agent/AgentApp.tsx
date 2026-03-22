// Root layout: chat area + input box
import React, { useState, useCallback, useEffect } from 'react';
import { ChatMessages } from './ChatMessages';
import { InputBox } from './InputBox';
import { useAgentMessages } from './useAgentMessages';
import type { FileAttachment } from './useAgentMessages';
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
    availableModels,
    selectedModelId,
    specHealth,
    planExists,
    openPlan,
    sendPrompt,
    stopGeneration,
    acceptChange,
    rejectChange,
    allowAllChanges,
    approveToolCall,
    rejectToolCall,
    allowAllToolCalls,
    selectModel,
    respondToChoice,
  } = useAgentMessages();

  // Persistent file attachments — survive across prompt submissions
  const [attachedFiles, setAttachedFiles] = useState<FileAttachment[]>([]);

  const handleAttachFile = useCallback((path: string, isDirectory: boolean) => {
    setAttachedFiles(prev => {
      if (prev.some(f => f.path === path)) return prev;
      return [...prev, { path, isDirectory }];
    });
  }, []);

  const handleRemoveFile = useCallback((path: string) => {
    setAttachedFiles(prev => prev.filter(f => f.path !== path));
  }, []);

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
        onStop={stopGeneration}
        isLoading={isLoading}
        endpointStatus={endpointStatus}
        commandNames={commandNames}
        availableModels={availableModels}
        selectedModelId={selectedModelId}
        onSelectModel={selectModel}
        attachedFiles={attachedFiles}
        onAttachFile={handleAttachFile}
        onRemoveFile={handleRemoveFile}
        specHealth={specHealth}
        planExists={planExists}
        onOpenPlan={openPlan}
      />
    </div>
  );
};
