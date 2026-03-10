// File/folder browser popup for attaching workspace files to the agent context
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface FileBrowserProps {
  onSelect: (path: string, isDirectory: boolean) => void;
  onClose: () => void;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ onSelect, onClose }) => {
  const vscode = getVsCodeApi();
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  // Request directory listing
  const browse = useCallback((relativePath: string) => {
    setLoading(true);
    setCurrentPath(relativePath);
    vscode.postMessage({ type: 'listWorkspaceFiles', payload: { relativePath } });
  }, []);

  // Initial load
  useEffect(() => {
    browse('');
  }, [browse]);

  // Listen for file listing responses
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const msg = event.data;
      if (msg.type === 'workspaceFiles') {
        const { entries: newEntries } = msg.payload as {
          entries: FileEntry[];
          relativePath: string;
        };
        setEntries(newEntries);
        setLoading(false);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Close on click outside (but not on the attach button itself, which toggles)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // Don't close if the click is on the attach button (it handles its own toggle)
      if (target.closest?.('.input-icon-btn.active')) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    }
    // Use mouseup to avoid racing with the click that opened the browser
    document.addEventListener('mouseup', handleClickOutside);
    return () => {
      document.removeEventListener('mouseup', handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleEntryClick = useCallback((entry: FileEntry) => {
    if (entry.isDirectory) {
      browse(entry.path);
    } else {
      onSelect(entry.path, false);
    }
  }, [browse, onSelect]);

  const handleAttachFolder = useCallback(() => {
    onSelect(currentPath, true);
  }, [currentPath, onSelect]);

  const navigateUp = useCallback(() => {
    const parent = currentPath.includes('/')
      ? currentPath.substring(0, currentPath.lastIndexOf('/'))
      : '';
    browse(parent);
  }, [currentPath, browse]);

  const breadcrumbs = currentPath ? currentPath.split('/') : [];

  return (
    <div className="file-browser" ref={panelRef}>
      <div className="file-browser-header">
        <div className="file-browser-breadcrumbs">
          <button
            className="file-browser-crumb"
            onClick={() => browse('')}
            title="Workspace root"
          >
            /
          </button>
          {breadcrumbs.map((segment, i) => {
            const path = breadcrumbs.slice(0, i + 1).join('/');
            return (
              <React.Fragment key={path}>
                <span className="file-browser-sep">/</span>
                <button
                  className="file-browser-crumb"
                  onClick={() => browse(path)}
                >
                  {segment}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        {currentPath && (
          <button
            className="file-browser-attach-folder"
            onClick={handleAttachFolder}
            title={`Attach folder: ${currentPath}`}
          >
            + folder
          </button>
        )}
      </div>
      <div className="file-browser-list">
        {loading && <div className="file-browser-loading">Loading...</div>}
        {!loading && currentPath && (
          <div className="file-browser-entry" onClick={navigateUp}>
            <span className="file-browser-icon">↩</span>
            <span className="file-browser-name">..</span>
          </div>
        )}
        {!loading && entries.map(entry => (
          <div
            key={entry.path}
            className="file-browser-entry"
            onClick={() => handleEntryClick(entry)}
          >
            <span className="file-browser-icon">
              {entry.isDirectory ? '📁' : '📄'}
            </span>
            <span className="file-browser-name">{entry.name}</span>
            {entry.isDirectory && (
              <button
                className="file-browser-attach-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(entry.path, true);
                }}
                title={`Attach folder: ${entry.name}`}
              >
                +
              </button>
            )}
          </div>
        ))}
        {!loading && entries.length === 0 && (
          <div className="file-browser-empty">Empty folder</div>
        )}
      </div>
    </div>
  );
};
