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
  recommended?: number;
  selected?: string;
}

export interface ImageAttachment {
  id: string;
  dataUrl: string;
  mediaType: string;
}

export interface FileAttachment {
  path: string;
  isDirectory: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'command';
  content: string;
  streaming?: boolean;
  change?: ChangeInfo;
  toolApproval?: ToolApprovalInfo;
  userChoice?: UserChoiceInfo;
  images?: ImageAttachment[];
  files?: FileAttachment[];
}

export interface EndpointStatus {
  configured: boolean;
  name?: string;
  model?: string;
}

export interface AvailableModel {
  modelId: string;
  displayName: string;
  provider: string;
}

export interface StartupStatus {
  summary: string;
  nextStep: string;
}

export interface AgentState {
  messages: Message[];
  endpointStatus: EndpointStatus;
  commandNames: string[];
  isLoading: boolean;
  startupStatus: StartupStatus | null;
  availableModels: AvailableModel[];
  selectedModelId: string;
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
  const [startupStatus, setStartupStatus] = useState<StartupStatus | null>(null);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const autoApproveRef = useRef(false);
  const autoApproveToolsRef = useRef(false);
  const vscode = getVsCodeApi();

  useEffect(() => {
    // Request initial state
    vscode.postMessage({ type: 'requestEndpoints' });
    vscode.postMessage({ type: 'requestCommandList' });
    vscode.postMessage({ type: 'requestStartupStatus' });
    vscode.postMessage({ type: 'requestModelList' });

    function handleMessage(event: MessageEvent) {
      const msg = event.data;
      switch (msg.type) {
        case 'agentStreaming': {
          const { id, content } = msg.payload as { id: string; content: string };
          const streamId = `stream-${id}`;
          setMessages(prev => {
            // Find the streaming message anywhere in the list (tool call system messages
            // may have been inserted after it, so it may not be the last message)
            const idx = prev.findIndex(m => m.id === streamId && m.streaming);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = { ...prev[idx], content };
              return updated;
            }
            // New stream — create message
            setIsLoading(false);
            return [...prev, { id: streamId, role: 'assistant', content, streaming: true }];
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
          const endStreamId = `stream-${id}`;
          setMessages(prev => {
            const changeInfo: ChangeInfo | undefined = change
              ? { changeId: change.changeId, description: change.description, diff: change.diff, status: 'pending' }
              : undefined;

            // Auto-approve if enabled
            if (changeInfo && autoApproveRef.current) {
              vscode.postMessage({ type: 'acceptChange', payload: { changeId: change!.changeId } });
              changeInfo.status = 'applied';
            }

            // Find the streaming message anywhere in the list
            const idx = prev.findIndex(m => m.id === endStreamId);
            if (idx !== -1) {
              // If content is empty (stream ended with tool calls, no text),
              // remove the empty streaming placeholder instead of keeping it
              if (!content && !changeInfo) {
                const updated = [...prev];
                updated.splice(idx, 1);
                return updated;
              }
              const updated = [...prev];
              updated[idx] = { ...prev[idx], content, streaming: false, change: changeInfo };
              return updated;
            }
            // Don't create a new empty message
            if (!content && !changeInfo) {
              return prev;
            }
            return [...prev, { id: endStreamId, role: 'assistant', content, streaming: false, change: changeInfo }];
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
          const isToolCall = content.startsWith('Calling tool:');
          if (isToolCall) {
            setIsLoading(true);
          }
          setMessages(prev => {
            // Merge consecutive tool-call messages into one line
            if (isToolCall && prev.length > 0) {
              const last = prev[prev.length - 1];
              if (last.role === 'system' && last.content.startsWith('Calling tool:')) {
                const updated = [...prev];
                updated[updated.length - 1] = { ...last, content: last.content + ' · ' + content };
                return updated;
              }
            }
            return [...prev, { id: nextId(), role: 'system', content }];
          });
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
          if (model) setSelectedModelId(model);
          break;
        }

        case 'modelList': {
          const { models, selectedModel } = msg.payload as {
            models: AvailableModel[];
            selectedModel?: string;
          };
          setAvailableModels(models);
          if (selectedModel) setSelectedModelId(selectedModel);
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

        case 'startupStatus': {
          const { summary, nextStep } = msg.payload as { summary: string; nextStep: string };
          setStartupStatus({ summary, nextStep });
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
          const { choiceId, question, options, recommended } = msg.payload as {
            choiceId: string; question: string; options: string[]; recommended?: number;
          };
          setMessages(prev => [...prev, {
            id: `choice-${choiceId}`,
            role: 'system',
            content: question,
            userChoice: { choiceId, question, options, recommended },
          }]);
          break;
        }
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const sendPrompt = useCallback((text: string, images?: ImageAttachment[], files?: FileAttachment[]) => {
    setMessages(prev => [...prev, {
      id: nextId(),
      role: 'user',
      content: text,
      images: images?.length ? images : undefined,
      files: files?.length ? files : undefined,
    }]);
    setIsLoading(true);
    vscode.postMessage({
      type: 'sendPrompt',
      payload: {
        text,
        images: images?.map(img => ({ dataUrl: img.dataUrl, mediaType: img.mediaType })),
        files: files?.map(f => ({ path: f.path, isDirectory: f.isDirectory })),
      },
    });
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

  const selectModel = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    vscode.postMessage({ type: 'selectModel', payload: { modelId } });
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
    startupStatus,
    availableModels,
    selectedModelId,
    sendPrompt,
    acceptChange,
    rejectChange,
    allowAllChanges,
    approveToolCall,
    rejectToolCall,
    allowAllToolCalls,
    selectModel,
    respondToChoice,
  };
}
