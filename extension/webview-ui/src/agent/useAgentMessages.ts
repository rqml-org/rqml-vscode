// Core state hook for agent messages and streaming
import { useState, useEffect, useCallback, useRef } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';

export interface ChangeInfo {
  changeId: string;
  description: string;
  diff?: string;
  status: 'pending' | 'applied' | 'rejected';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'command';
  content: string;
  streaming?: boolean;
  change?: ChangeInfo;
}

export interface EndpointStatus {
  configured: boolean;
  name?: string;
  model?: string;
}

export interface AgentState {
  messages: Message[];
  endpointStatus: EndpointStatus;
  commandNames: string[];
  isLoading: boolean;
}

let msgCounter = 0;
function nextId(): string {
  return `msg-${++msgCounter}`;
}

export function useAgentMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [endpointStatus, setEndpointStatus] = useState<EndpointStatus>({ configured: false });
  const [commandNames, setCommandNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const autoApproveRef = useRef(false);
  const vscode = getVsCodeApi();

  useEffect(() => {
    // Request initial state
    vscode.postMessage({ type: 'requestEndpoints' });
    vscode.postMessage({ type: 'requestCommandList' });

    function handleMessage(event: MessageEvent) {
      const msg = event.data;
      switch (msg.type) {
        case 'agentStreaming': {
          const { id, content } = msg.payload as { id: string; content: string };
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.id === `stream-${id}` && last.streaming) {
              // Update existing streaming message
              return [...prev.slice(0, -1), { ...last, content }];
            }
            // New stream — create message
            setIsLoading(false);
            return [...prev, { id: `stream-${id}`, role: 'assistant', content, streaming: true }];
          });
          break;
        }

        case 'agentStreamEnd': {
          const { id, content, change } = msg.payload as {
            id: string;
            content: string;
            change?: { changeId: string; description: string; diff?: string; status: string };
          };
          setIsLoading(false);
          setMessages(prev => {
            const last = prev[prev.length - 1];
            const changeInfo: ChangeInfo | undefined = change
              ? { changeId: change.changeId, description: change.description, diff: change.diff, status: 'pending' }
              : undefined;

            // Auto-approve if enabled
            if (changeInfo && autoApproveRef.current) {
              vscode.postMessage({ type: 'acceptChange', payload: { changeId: change!.changeId } });
              changeInfo.status = 'applied';
            }

            if (last?.id === `stream-${id}`) {
              return [...prev.slice(0, -1), { ...last, content, streaming: false, change: changeInfo }];
            }
            return [...prev, { id: `stream-${id}`, role: 'assistant', content, streaming: false, change: changeInfo }];
          });
          break;
        }

        case 'agentResponse': {
          const { content } = msg.payload as { content: string };
          setIsLoading(false);
          setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content }]);
          break;
        }

        case 'commandResponse': {
          const { content } = msg.payload as { content: string };
          setIsLoading(false);
          setMessages(prev => [...prev, { id: nextId(), role: 'command', content }]);
          break;
        }

        case 'systemMessage': {
          const { content } = msg.payload as { content: string };
          setMessages(prev => [...prev, { id: nextId(), role: 'system', content }]);
          break;
        }

        case 'clearTerminal': {
          setMessages([]);
          break;
        }

        case 'endpointStatus': {
          const { configured, name, model } = msg.payload as {
            configured: boolean; name?: string; model?: string;
          };
          setEndpointStatus({ configured, name, model });
          break;
        }

        case 'changeApplied': {
          const { changeId } = msg.payload as { changeId: string };
          setMessages(prev => prev.map(m =>
            m.change?.changeId === changeId
              ? { ...m, change: { ...m.change, status: 'applied' as const } }
              : m
          ));
          break;
        }

        case 'changeRejected': {
          const { changeId } = msg.payload as { changeId: string };
          setMessages(prev => prev.map(m =>
            m.change?.changeId === changeId
              ? { ...m, change: { ...m.change, status: 'rejected' as const } }
              : m
          ));
          break;
        }

        case 'commandDone': {
          setIsLoading(false);
          break;
        }

        case 'commandList': {
          const { names } = msg.payload as { names: string[] };
          setCommandNames(names);
          break;
        }
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const sendPrompt = useCallback((text: string) => {
    setMessages(prev => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsLoading(true);
    vscode.postMessage({ type: 'sendPrompt', payload: { text } });
  }, []);

  const acceptChange = useCallback((changeId: string) => {
    vscode.postMessage({ type: 'acceptChange', payload: { changeId } });
  }, []);

  const rejectChange = useCallback((changeId: string) => {
    vscode.postMessage({ type: 'rejectChange', payload: { changeId } });
  }, []);

  const allowAllChanges = useCallback((changeId: string) => {
    autoApproveRef.current = true;
    vscode.postMessage({ type: 'allowAllChanges' });
    vscode.postMessage({ type: 'acceptChange', payload: { changeId } });
  }, []);

  return {
    messages,
    endpointStatus,
    commandNames,
    isLoading,
    sendPrompt,
    acceptChange,
    rejectChange,
    allowAllChanges,
  };
}
