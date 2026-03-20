import React, { useEffect, useState } from 'react';

interface ReportTypeDefinition {
  id: string;
  label: string;
  description: string;
  formats: string[];
}

interface Props {
  reportType: string;
  format: string;
  onSelect: (reportType: string, format: string) => void;
  vscode: { postMessage: (msg: any) => void };
}

const FORMAT_LABELS: Record<string, string> = {
  pptx: 'PPT',
  docx: 'Word',
  pdf: 'PDF',
  xlsx: 'Excel',
};

export const ReportFormatStep: React.FC<Props> = ({ reportType, format, onSelect, vscode }) => {
  const [registry, setRegistry] = useState<ReportTypeDefinition[]>([]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data.type === 'setReportTypes') {
        setRegistry(event.data.payload.registry);
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'requestReportTypes' });
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div className="report-format-step">
      <p className="step-description">Select a report type and output format.</p>
      <div className="report-list">
        {registry.map(rt => (
          <div
            key={rt.id}
            className={`report-row${reportType === rt.id ? ' selected' : ''}`}
            title={rt.description}
          >
            <div className="report-label">{rt.label}</div>
            <div className="report-formats">
              {rt.formats.map(f => (
                <button
                  key={f}
                  className={`format-btn${reportType === rt.id && format === f ? ' active' : ''}`}
                  onClick={() => onSelect(rt.id, f)}
                >
                  {FORMAT_LABELS[f] || f}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
