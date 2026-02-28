// Root layout: chat area + input box
import React, { useMemo } from 'react';
import { ChatMessages } from './ChatMessages';
import { InputBox } from './InputBox';
import { useAgentMessages } from './useAgentMessages';
import './agent.css';

export const AgentApp: React.FC = () => {
  const {
    messages,
    endpointStatus,
    commandNames,
    isLoading,
    sendPrompt,
    acceptChange,
    rejectChange,
    allowAllChanges,
    approveToolCall,
    rejectToolCall,
    allowAllToolCalls,
    respondToChoice,
  } = useAgentMessages();

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
