// Bottom input area: auto-growing textarea, spec health, status, attachment, help
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { SpecHealthIndicator } from './SpecHealthIndicator';
import type { EndpointStatus } from './useAgentMessages';

interface InputBoxProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
  endpointStatus: EndpointStatus;
  commandNames: string[];
  specHealth: number;
  statusMessage: string;
}

export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  isLoading,
  endpointStatus,
  commandNames,
  specHealth,
  statusMessage,
}) => {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Slash autocomplete
  useEffect(() => {
    if (value.startsWith('/') && !value.includes(' ')) {
      const query = value.slice(1).toLowerCase();
      const matches = commandNames.filter(n => n.toLowerCase().startsWith(query));
      setAutocompleteItems(matches);
      setAutocompleteIndex(0);
    } else {
      setAutocompleteItems([]);
    }
  }, [value, commandNames]);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || isLoading) return;
    onSubmit(text);
    setHistory(prev => [...prev, text]);
    setHistoryIndex(-1);
    setValue('');
  }, [value, isLoading, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Autocomplete navigation
    if (autocompleteItems.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex(i => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex(i => Math.min(autocompleteItems.length - 1, i + 1));
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        setValue('/' + autocompleteItems[autocompleteIndex]);
        setAutocompleteItems([]);
        if (e.key === 'Enter') {
          // Submit the selected command
          const text = '/' + autocompleteItems[autocompleteIndex];
          onSubmit(text.trim());
          setHistory(prev => [...prev, text.trim()]);
          setHistoryIndex(-1);
          setValue('');
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocompleteItems([]);
        return;
      }
    }

    // Enter to submit (Shift+Enter for newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
      return;
    }

    // History navigation (only when no autocomplete and at start/end of input)
    if (e.key === 'ArrowUp' && !e.shiftKey && textareaRef.current?.selectionStart === 0) {
      e.preventDefault();
      if (history.length === 0) return;
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setValue(history[newIndex]);
      return;
    }

    if (e.key === 'ArrowDown' && !e.shiftKey) {
      const ta = textareaRef.current;
      if (ta && ta.selectionStart === ta.value.length && historyIndex >= 0) {
        e.preventDefault();
        if (historyIndex >= history.length - 1) {
          setHistoryIndex(-1);
          setValue('');
        } else {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setValue(history[newIndex]);
        }
      }
    }
  }, [autocompleteItems, autocompleteIndex, submit, history, historyIndex, onSubmit]);

  const handleHelpClick = useCallback(() => {
    onSubmit('/help');
  }, [onSubmit]);

  const handleAttachClick = useCallback(() => {
    // Placeholder — attachment not yet implemented
  }, []);

  const placeholder = !endpointStatus.configured
    ? 'No LLM endpoint configured...'
    : 'Describe what to build next';

  return (
    <div className="input-box">
      <div className="input-textarea-wrapper">
        {autocompleteItems.length > 0 && (
          <div className="autocomplete-dropdown">
            {autocompleteItems.map((item, i) => (
              <div
                key={item}
                className={`autocomplete-item${i === autocompleteIndex ? ' selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setValue('/' + item);
                  setAutocompleteItems([]);
                  textareaRef.current?.focus();
                }}
              >
                /{item}
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          className="input-textarea"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
        />
        <div className="input-bottom-bar">
          <SpecHealthIndicator progress={specHealth} />
          <div className="input-status">{statusMessage}</div>
          <button
            className="input-icon-btn"
            onClick={handleAttachClick}
            title="Add attachment"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10.97 1.47a3.75 3.75 0 0 0-5.3 0L2.22 4.92a5.25 5.25 0 0 0 7.42 7.42l4.72-4.72a.75.75 0 1 0-1.06-1.06l-4.72 4.72a3.75 3.75 0 0 1-5.3-5.3l3.45-3.45a2.25 2.25 0 0 1 3.18 3.18L6.46 9.16a.75.75 0 0 1-1.06-1.06l2.83-2.83a.75.75 0 0 0-1.06-1.06L4.34 7.04a2.25 2.25 0 0 0 3.18 3.18l3.45-3.45a3.75 3.75 0 0 0 0-5.3Z" />
            </svg>
          </button>
          <button
            className="input-icon-btn"
            onClick={handleHelpClick}
            title="Help (/help)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM6.5 5.5a1.5 1.5 0 1 1 2.13 1.36.75.75 0 0 0-.38.66V8.5a.75.75 0 0 0 1.5 0v-.56A3 3 0 1 0 5 5.5a.75.75 0 0 0 1.5 0ZM8 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
