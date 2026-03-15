import React from 'react';

type ExportFormat = 'pptx' | 'docx' | 'xlsx' | 'pdf';

interface FormatOption {
  id: ExportFormat;
  label: string;
  icon: string;
  available: boolean;
}

const FORMATS: FormatOption[] = [
  { id: 'pptx', label: 'PowerPoint', icon: '📊', available: true },
  { id: 'docx', label: 'Word', icon: '📄', available: false },
  { id: 'xlsx', label: 'Excel', icon: '📋', available: false },
  { id: 'pdf', label: 'PDF', icon: '📑', available: false },
];

interface FormatStepProps {
  format: ExportFormat;
  onSelect: (format: ExportFormat) => void;
}

export const FormatStep: React.FC<FormatStepProps> = ({ format, onSelect }) => {
  return (
    <div className="export-step-content">
      <p className="export-step-description">Choose the output format for your export.</p>
      <div className="export-format-grid">
        {FORMATS.map(f => (
          <button
            key={f.id}
            className={`export-format-card${f.id === format ? ' selected' : ''}${!f.available ? ' disabled' : ''}`}
            onClick={() => f.available && onSelect(f.id)}
            disabled={!f.available}
          >
            <span className="export-format-icon">{f.icon}</span>
            <span className="export-format-label">{f.label}</span>
            {!f.available && <span className="export-format-badge">Coming soon</span>}
          </button>
        ))}
      </div>
    </div>
  );
};
