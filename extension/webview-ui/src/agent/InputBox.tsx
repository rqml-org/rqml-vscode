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
}

export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
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

  const handleAttachClick = useCallback(() => {
    setFileBrowserOpen(prev => !prev);
  }, []);

  const placeholder = !endpointStatus.configured
    ? 'No LLM endpoint configured...'
    : 'Describe what to build next';

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
        {images.length > 0 && (
          <div className="image-previews">
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
          </div>
        )}
        {attachedFiles.length > 0 && (
          <div className="attached-files">
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
              <path fillRule="evenodd" clipRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm0-1.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z" />
              <path d="M7.25 10.5a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM8 4.5A2.25 2.25 0 0 0 5.75 6.75h1.5a.75.75 0 0 1 1.5 0c0 .414-.336.75-.75.75a.75.75 0 0 0-.75.75V9h1.5v-.34A2.25 2.25 0 0 0 8 4.5Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
