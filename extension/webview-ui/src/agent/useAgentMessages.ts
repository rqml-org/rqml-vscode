// Core state hook for agent messages and streaming
import { useState, useEffect, useCallback, useRef } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';

export interface ChangeInfo {
  changeId: string;
  description: string;
  diff?: string;
  status: 'pending' | 'applied' | 'rejected';
}

export interface ToolApprovalInfo {
  approvalId: string;
  toolName: string;
  filePath?: string;
  preview?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface UserChoiceInfo {
  choiceId: string;
  question: string;
  options: string[];
  selected?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'command';
  content: string;
  streaming?: boolean;
  change?: ChangeInfo;
  toolApproval?: ToolApprovalInfo;
  userChoice?: UserChoiceInfo;
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
  const autoApproveToolsRef = useRef(false);
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

        case 'toolApprovalRequest': {
          const { approvalId, toolName, filePath, preview } = msg.payload as {
            approvalId: string; toolName: string; filePath?: string; preview?: string;
          };
          // Auto-approve if enabled
          if (autoApproveToolsRef.current) {
            vscode.postMessage({ type: 'approveToolCall', payload: { approvalId } });
            setMessages(prev => [...prev, {
              id: `tool-${approvalId}`,
              role: 'system',
              content: `Auto-approved: ${toolName}${filePath ? ` (${filePath})` : ''}`,
              toolApproval: { approvalId, toolName, filePath, preview, status: 'approved' },
            }]);
          } else {
            setMessages(prev => [...prev, {
              id: `tool-${approvalId}`,
              role: 'system',
              content: `${toolName}${filePath ? `: ${filePath}` : ''}`,
              toolApproval: { approvalId, toolName, filePath, preview, status: 'pending' },
            }]);
          }
          break;
        }

        case 'toolApprovalResolved': {
          const { approvalId, approved } = msg.payload as { approvalId: string; approved: boolean };
          setMessages(prev => prev.map(m =>
            m.toolApproval?.approvalId === approvalId
              ? { ...m, toolApproval: { ...m.toolApproval, status: approved ? 'approved' as const : 'rejected' as const } }
              : m
          ));
          break;
        }

        case 'userChoiceRequest': {
          const { choiceId, question, options } = msg.payload as {
            choiceId: string; question: string; options: string[];
          };
          setMessages(prev => [...prev, {
            id: `choice-${choiceId}`,
            role: 'system',
            content: question,
            userChoice: { choiceId, question, options },
          }]);
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

  const approveToolCall = useCallback((approvalId: string) => {
    vscode.postMessage({ type: 'approveToolCall', payload: { approvalId } });
  }, []);

  const rejectToolCall = useCallback((approvalId: string) => {
    vscode.postMessage({ type: 'rejectToolCall', payload: { approvalId } });
  }, []);

  const allowAllToolCalls = useCallback((approvalId: string) => {
    autoApproveToolsRef.current = true;
    vscode.postMessage({ type: 'allowAllToolCalls', payload: { approvalId } });
  }, []);

  const respondToChoice = useCallback((choiceId: string, selected: string) => {
    vscode.postMessage({ type: 'respondToChoice', payload: { choiceId, selected } });
    setMessages(prev => prev.map(m =>
      m.userChoice?.choiceId === choiceId
        ? { ...m, userChoice: { ...m.userChoice, selected } }
        : m
    ));
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
    approveToolCall,
    rejectToolCall,
    allowAllToolCalls,
    respondToChoice,
  };
}
