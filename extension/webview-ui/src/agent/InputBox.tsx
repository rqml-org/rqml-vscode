// Bottom input area: auto-growing textarea, RQML icon, model selector, attachment, help
// Supports image pasting from clipboard with thumbnail preview
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FileBrowser } from './FileBrowser';
import type { EndpointStatus, ImageAttachment, FileAttachment, AvailableModel, SpecHealthColor } from './useAgentMessages';

const SPEC_HEALTH_TOOLTIPS: Record<string, string> = {
  gray: 'No RQML spec file found.',
  yellow: 'Spec exists but is not implementation-ready.',
  green: 'Spec is implementation-ready. Code is behind spec.',
  red: 'Spec exists but is behind the code.',
  blue: 'Spec is implementation-ready and code is in sync.',
};

const MAX_DIMENSION = 1024;
const MAX_ENCODED_SIZE = 1024 * 1024 * 1.37; // ~1MB raw ≈ 1.37MB base64

function compressImage(dataUrl: string): Promise<{ dataUrl: string; mediaType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      let result = canvas.toDataURL('image/jpeg', quality);
      while (result.length > MAX_ENCODED_SIZE && quality > 0.3) {
        quality -= 0.1;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      resolve({ dataUrl: result, mediaType: 'image/jpeg' });
    };
    img.src = dataUrl;
  });
}

interface InputBoxProps {
  onSubmit: (text: string, images?: ImageAttachment[], files?: FileAttachment[]) => void;
  onStop: () => void;
  isLoading: boolean;
  endpointStatus: EndpointStatus;
  commandNames: string[];
  availableModels: AvailableModel[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  attachedFiles: FileAttachment[];
  onAttachFile: (path: string, isDirectory: boolean) => void;
  onRemoveFile: (path: string) => void;
  specHealth: SpecHealthColor;
  planExists: boolean;
  onOpenPlan: () => void;
}

export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  onStop,
  isLoading,
  endpointStatus,
  commandNames,
  availableModels,
  selectedModelId,
  onSelectModel,
  attachedFiles,
  onAttachFile,
  onRemoveFile,
  specHealth,
  planExists,
  onOpenPlan,
}) => {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autocompleteItems, setAutocompleteItems] = useState<string[]>([]);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
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

  // Refocus textarea when loading ends (after agent response or slash command)
  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus();
    }
  }, [isLoading]);

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
    if (!text && images.length === 0 && attachedFiles.length === 0) return;
    if (isLoading) return;
    onSubmit(
      text,
      images.length > 0 ? images : undefined,
      attachedFiles.length > 0 ? attachedFiles : undefined,
    );
    setHistory(prev => text ? [...prev, text] : prev);
    setHistoryIndex(-1);
    setValue('');
    setImages([]);
  }, [value, images, attachedFiles, isLoading, onSubmit]);

  // Document-level paste listener — captures image paste in VS Code webviews
  useEffect(() => {
    const handler = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = async () => {
            const raw = reader.result as string;
            const compressed = await compressImage(raw);
            setImages(prev => [...prev, {
              id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              dataUrl: compressed.dataUrl,
              mediaType: compressed.mediaType,
            }]);
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, []);

  const removeImage = useCallback((id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  }, []);

  const handleFileSelect = useCallback((path: string, isDirectory: boolean) => {
    onAttachFile(path, isDirectory);
    setFileBrowserOpen(false);
    textareaRef.current?.focus();
  }, [onAttachFile]);

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

  const handleDesignOverviewClick = useCallback(() => {
    onSubmit('/design overview');
  }, [onSubmit]);

  const handleAttachClick = useCallback(() => {
    setFileBrowserOpen(prev => !prev);
  }, []);

  const SPEC_HEALTH_PLACEHOLDERS: Record<SpecHealthColor, string> = {
    gray: 'Click "Create RQML Spec" to initialize a spec file',
    yellow: 'Tell me your requirements and I will help you build a spec, or run /elicit',
    green: 'Describe what to build next',
    red: 'Run /sync to check spec-code consistency',
    blue: 'Describe what to build next',
  };

  const placeholder = !endpointStatus.configured
    ? 'No LLM endpoint configured...'
    : SPEC_HEALTH_PLACEHOLDERS[specHealth];

  /** Display name for an attachment tag */
  const tagName = (f: FileAttachment) => {
    const name = f.path.includes('/') ? f.path.substring(f.path.lastIndexOf('/') + 1) : f.path;
    return f.isDirectory ? `${name}/` : name;
  };

  return (
    <div className="input-box">
      {fileBrowserOpen && (
        <FileBrowser
          onSelect={handleFileSelect}
          onClose={() => setFileBrowserOpen(false)}
        />
      )}
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
        {(images.length > 0 || attachedFiles.length > 0) && (
          <div className="input-attachments-bar">
            {images.map(img => (
              <div key={img.id} className="image-preview-item">
                <img src={img.dataUrl} alt="Attached" className="image-preview-thumb" />
                <button
                  className="image-preview-remove"
                  onClick={() => removeImage(img.id)}
                  title="Remove image"
                >
                  &times;
                </button>
              </div>
            ))}
            {attachedFiles.map(f => (
              <span key={f.path} className="attached-file-tag" title={f.path}>
                <span className="attached-file-icon">{f.isDirectory ? '📁' : '📄'}</span>
                <span className="attached-file-name">{tagName(f)}</span>
                <button
                  className="attached-file-remove"
                  onClick={() => onRemoveFile(f.path)}
                  title="Remove"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="input-textarea-row">
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
          {value.trim() && (
            <span className="input-newline-hint">Shift-Enter for newline</span>
          )}
        </div>
        <div className="input-bottom-bar">
          {(() => {
            const iconsRaw = (window as any).__WEBVIEW_DATA__?.rqmlIcons;
            const icons = iconsRaw ? (typeof iconsRaw === 'string' ? JSON.parse(iconsRaw) : iconsRaw) : null;
            const src = icons?.[specHealth];
            return src ? (
              <img
                className="input-rqml-icon"
                src={src}
                alt="RQML"
                title={SPEC_HEALTH_TOOLTIPS[specHealth]}
              />
            ) : null;
          })()}
          <button
            className="input-icon-btn"
            onClick={onOpenPlan}
            title="Open implementation plan"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3.5L3.5 5 6 2.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 3.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M2 8L3.5 9.5 6 7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 8h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M2 12.5L3.5 14 6 11.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 12.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="input-icon-btn"
            onClick={handleDesignOverviewClick}
            title="Summarize architectural decisions"
            style={{marginLeft: '-3px'}}
          >
            <svg width="16" height="16" viewBox="-1 -1 16 16" fill="none" style={{pointerEvents: 'none'}}>
              <circle cx="3.5" cy="3" r="1.8" fill="currentColor" />
              <path d="M6 3h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <polygon points="10.5,1.2 12.3,3 10.5,4.8 8.7,3" fill="currentColor" />
              <path d="M10.5 5.5v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <rect x="9" y="9" width="3" height="3" rx="0.4" fill="currentColor" />
              <path d="M8.5 10.5H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="3.5" cy="10.5" r="1.8" stroke="currentColor" strokeWidth="1.2" />
              <path d="M3.5 8.2V5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="input-bottom-spacer" />
          <select
            className="model-selector"
            value={selectedModelId}
            onChange={e => onSelectModel(e.target.value)}
            title="Select LLM model"
            disabled={availableModels.length === 0}
          >
            {availableModels.length === 0 && (
              <option value="">No models available</option>
            )}
            {availableModels.map(m => (
              <option key={`${m.provider}/${m.modelId}`} value={m.modelId}>
                {m.displayName}
              </option>
            ))}
          </select>
          <button
            className={`input-icon-btn${fileBrowserOpen ? ' active' : ''}`}
            onClick={handleAttachClick}
            title="Attach file or folder"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2.5a.75.75 0 0 1 .75.75v4h4a.75.75 0 0 1 0 1.5h-4v4a.75.75 0 0 1-1.5 0v-4h-4a.75.75 0 0 1 0-1.5h4v-4A.75.75 0 0 1 8 2.5Z" />
            </svg>
          </button>
          <button
            className="input-icon-btn"
            onClick={handleHelpClick}
            title="Slash commands (/help)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10.7 2.4a.85.85 0 0 1 .2 1.2l-5 7.5a.85.85 0 0 1-1.4-1l5-7.5a.85.85 0 0 1 1.2-.2Z" />
            </svg>
          </button>
          {isLoading ? (
            <button
              className="input-send-btn stop"
              onClick={onStop}
              title="Stop generation"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="3" width="10" height="10" rx="1" />
              </svg>
            </button>
          ) : (
            <button
              className="input-send-btn"
              onMouseDown={e => { e.preventDefault(); submit(); }}
              disabled={!value.trim()}
              title="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.724 1.053a.5.5 0 0 1 .541-.054l12 6a.5.5 0 0 1 0 .894l-12 6A.5.5 0 0 1 1.5 13.5v-4.379l6.776-1.121L1.5 6.879V2.5a.5.5 0 0 1 .224-.447Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
