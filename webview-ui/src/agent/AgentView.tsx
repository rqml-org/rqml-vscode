// REQ-AGT-001: Agent panel tab UI
// REQ-AGT-002: Prompt input
// REQ-AGT-008: User-confirmed modifications (accept/reject/allow-all)

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';

/** Message types for the agent conversation */
interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** If this message contains a proposed change */
  change?: ProposedChange;
}

interface ProposedChange {
  changeId: string;
  description: string;
  diff?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface EndpointStatus {
  configured: boolean;
  name?: string;
  provider?: string;
}

export function AgentView() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [endpointStatus, setEndpointStatus] = useState<EndpointStatus>({ configured: false });
  const [autoApprove, setAutoApprove] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Listen for messages from the extension
  useEffect(() => {
    const vscode = getVsCodeApi();
    // Request initial endpoint status
    vscode.postMessage({ type: 'requestEndpoints' });

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case 'agentResponse': {
          const agentMsg: AgentMessage = {
            id: msg.payload.id || crypto.randomUUID(),
            role: 'assistant',
            content: msg.payload.content,
            timestamp: Date.now(),
            change: msg.payload.change,
          };
          setMessages(prev => [...prev, agentMsg]);
          setIsLoading(false);
          break;
        }
        case 'agentStreaming': {
          // Update the last assistant message with streaming content
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant' && last.id === msg.payload.id) {
              return [...prev.slice(0, -1), { ...last, content: msg.payload.content }];
            }
            // New streaming message
            return [...prev, {
              id: msg.payload.id,
              role: 'assistant',
              content: msg.payload.content,
              timestamp: Date.now(),
            }];
          });
          break;
        }
        case 'agentStreamEnd': {
          setIsLoading(false);
          // Final update with complete content and optional change
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.id === msg.payload.id) {
              return [...prev.slice(0, -1), {
                ...last,
                content: msg.payload.content,
                change: msg.payload.change
              }];
            }
            return prev;
          });
          break;
        }
        case 'endpointStatus': {
          setEndpointStatus(msg.payload);
          break;
        }
        case 'changeApplied': {
          setMessages(prev => prev.map(m => {
            if (m.change?.changeId === msg.payload.changeId) {
              return { ...m, change: { ...m.change, status: 'accepted' as const } };
            }
            return m;
          }));
          break;
        }
        case 'changeRejected': {
          setMessages(prev => prev.map(m => {
            if (m.change?.changeId === msg.payload.changeId) {
              return { ...m, change: { ...m.change, status: 'rejected' as const } };
            }
            return m;
          }));
          break;
        }
        case 'systemMessage': {
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'system',
            content: msg.payload.content,
            timestamp: Date.now(),
          }]);
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const vscode = getVsCodeApi();
    vscode.postMessage({ type: 'sendPrompt', payload: { text } });
  }, [input, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleAccept = (changeId: string) => {
    const vscode = getVsCodeApi();
    vscode.postMessage({ type: 'acceptChange', payload: { changeId } });
  };

  const handleReject = (changeId: string) => {
    const vscode = getVsCodeApi();
    vscode.postMessage({ type: 'rejectChange', payload: { changeId } });
  };

  const handleAllowAll = () => {
    setAutoApprove(true);
    const vscode = getVsCodeApi();
    vscode.postMessage({ type: 'allowAllChanges' });
  };

  return (
    <div style={styles.container}>
      {/* Endpoint status banner */}
      {!endpointStatus.configured && (
        <div style={styles.banner}>
          No LLM endpoint configured. Use <strong>RQML: Add LLM Endpoint</strong> from the command palette.
        </div>
      )}

      {/* Messages area */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.placeholder}>
            <div style={styles.placeholderIcon}>$(hubot)</div>
            <div>RQML Agent ready. Ask about your requirements, request quality assessments, or let the agent monitor your spec.</div>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} style={{
            ...styles.message,
            ...(msg.role === 'user' ? styles.userMessage : {}),
            ...(msg.role === 'system' ? styles.systemMessage : {}),
          }}>
            <div style={styles.messageRole}>
              {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Agent' : 'System'}
            </div>
            <div style={styles.messageContent}>
              {msg.content}
            </div>
            {/* REQ-AGT-008: Change proposal controls */}
            {msg.change && msg.change.status === 'pending' && !autoApprove && (
              <div style={styles.changeControls}>
                <div style={styles.changeDiff}>{msg.change.diff || msg.change.description}</div>
                <div style={styles.changeButtons}>
                  <button style={styles.acceptBtn} onClick={() => handleAccept(msg.change!.changeId)}>
                    Accept
                  </button>
                  <button style={styles.rejectBtn} onClick={() => handleReject(msg.change!.changeId)}>
                    Reject
                  </button>
                  <button style={styles.allowAllBtn} onClick={handleAllowAll}>
                    Allow All
                  </button>
                </div>
              </div>
            )}
            {msg.change && msg.change.status === 'accepted' && (
              <div style={styles.changeStatus}>Change applied</div>
            )}
            {msg.change && msg.change.status === 'rejected' && (
              <div style={styles.changeStatusRejected}>Change rejected</div>
            )}
          </div>
        ))}
        {isLoading && (
          <div style={styles.loading}>
            <span style={styles.loadingDot}>●</span> Agent is thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={styles.inputArea}>
        <textarea
          ref={inputRef}
          style={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={endpointStatus.configured
            ? 'Ask the agent about your requirements...'
            : 'Configure an LLM endpoint to start...'}
          disabled={!endpointStatus.configured}
          rows={2}
        />
        <button
          style={{
            ...styles.sendBtn,
            opacity: (!input.trim() || isLoading || !endpointStatus.configured) ? 0.5 : 1,
          }}
          onClick={sendMessage}
          disabled={!input.trim() || isLoading || !endpointStatus.configured}
        >
          Send
        </button>
      </div>

      {/* Auto-approve indicator */}
      {autoApprove && (
        <div style={styles.autoApproveBar}>
          Auto-approve enabled for this session
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'var(--vscode-font-family)',
    fontSize: 'var(--vscode-font-size)',
    color: 'var(--vscode-foreground)',
    background: 'var(--vscode-panel-background)',
  },
  banner: {
    padding: '8px 12px',
    background: 'var(--vscode-editorWarning-foreground)',
    color: 'var(--vscode-editor-background)',
    fontSize: '12px',
    textAlign: 'center',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    textAlign: 'center',
    opacity: 0.6,
    gap: '12px',
  },
  placeholderIcon: {
    fontSize: '32px',
  },
  message: {
    padding: '8px 12px',
    borderRadius: '4px',
    background: 'var(--vscode-editor-background)',
    border: '1px solid var(--vscode-widget-border)',
  },
  userMessage: {
    background: 'var(--vscode-textBlockQuote-background)',
    borderLeft: '3px solid var(--vscode-textLink-foreground)',
  },
  systemMessage: {
    background: 'transparent',
    border: 'none',
    opacity: 0.7,
    fontStyle: 'italic',
    fontSize: '12px',
  },
  messageRole: {
    fontSize: '11px',
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
    opacity: 0.7,
    marginBottom: '4px',
  },
  messageContent: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    lineHeight: '1.5',
  },
  changeControls: {
    marginTop: '8px',
    padding: '8px',
    border: '1px solid var(--vscode-inputValidation-infoBorder)',
    borderRadius: '4px',
    background: 'var(--vscode-inputValidation-infoBackground)',
  },
  changeDiff: {
    fontFamily: 'var(--vscode-editor-font-family)',
    fontSize: '12px',
    whiteSpace: 'pre-wrap',
    marginBottom: '8px',
    padding: '4px',
    background: 'var(--vscode-editor-background)',
    borderRadius: '2px',
  },
  changeButtons: {
    display: 'flex',
    gap: '8px',
  },
  acceptBtn: {
    padding: '4px 12px',
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  rejectBtn: {
    padding: '4px 12px',
    background: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  allowAllBtn: {
    padding: '4px 12px',
    background: 'transparent',
    color: 'var(--vscode-textLink-foreground)',
    border: '1px solid var(--vscode-textLink-foreground)',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '12px',
    marginLeft: 'auto',
  },
  changeStatus: {
    marginTop: '4px',
    fontSize: '11px',
    color: 'var(--vscode-testing-iconPassed)',
    fontStyle: 'italic',
  },
  changeStatusRejected: {
    marginTop: '4px',
    fontSize: '11px',
    color: 'var(--vscode-testing-iconFailed)',
    fontStyle: 'italic',
  },
  loading: {
    padding: '8px 12px',
    opacity: 0.7,
    fontSize: '12px',
  },
  loadingDot: {
    animation: 'pulse 1s infinite',
    color: 'var(--vscode-textLink-foreground)',
  },
  inputArea: {
    display: 'flex',
    gap: '4px',
    padding: '8px',
    borderTop: '1px solid var(--vscode-widget-border)',
    background: 'var(--vscode-editor-background)',
  },
  input: {
    flex: 1,
    padding: '6px 8px',
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: '2px',
    fontFamily: 'var(--vscode-font-family)',
    fontSize: 'var(--vscode-font-size)',
    resize: 'none',
    outline: 'none',
  },
  sendBtn: {
    padding: '6px 16px',
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '12px',
    alignSelf: 'flex-end',
  },
  autoApproveBar: {
    padding: '4px 12px',
    background: 'var(--vscode-inputValidation-warningBackground)',
    color: 'var(--vscode-inputValidation-warningForeground)',
    fontSize: '11px',
    textAlign: 'center',
  },
};
