import React from 'react';

interface ReportType {
  id: string;
  label: string;
  description: string;
}

const REPORT_TYPES: ReportType[] = [
  { id: 'full-spec', label: 'Full Specification', description: 'Complete specification document with all sections and items' },
  { id: 'executive-summary', label: 'Executive Summary', description: 'High-level overview with key metrics, goals, and status' },
  { id: 'traceability-matrix', label: 'Traceability Matrix', description: 'Requirements-to-tests coverage matrix' },
  { id: 'quality-assessment', label: 'Quality Assessment', description: 'Completeness, coverage gaps, and quality scores' },
  { id: 'implementation-status', label: 'Implementation Status', description: 'Per-requirement status breakdown with progress metrics' },
  { id: 'stakeholder-overview', label: 'Stakeholder Overview', description: 'Goals, scenarios, and key decisions for stakeholder review' },
  { id: 'other', label: 'Other...', description: 'Describe your report and let AI generate the structure' },
];

interface ReportTypeStepProps {
  reportType: string;
  onSelect: (id: string) => void;
  customPrompt: string;
  onCustomPromptChange: (value: string) => void;
}

export const ReportTypeStep: React.FC<ReportTypeStepProps> = ({
  reportType,
  onSelect,
  customPrompt,
  onCustomPromptChange,
}) => {
  return (
    <div className="export-step-content">
      <p className="export-step-description">What kind of report would you like to generate?</p>
      <div className="export-report-list">
        {REPORT_TYPES.map(rt => (
          <label key={rt.id} className={`export-report-option${rt.id === reportType ? ' selected' : ''}`}>
            <input
              type="radio"
              name="reportType"
              value={rt.id}
              checked={rt.id === reportType}
              onChange={() => onSelect(rt.id)}
            />
            <div className="export-report-option-text">
              <span className="export-report-option-label">{rt.label}</span>
              <span className="export-report-option-desc">{rt.description}</span>
            </div>
          </label>
        ))}
      </div>
      {reportType === 'other' && (
        <div className="export-custom-prompt">
          <label className="export-custom-prompt-label">Describe the report you want:</label>
          <textarea
            className="export-custom-prompt-input"
            value={customPrompt}
            onChange={e => onCustomPromptChange(e.target.value)}
            placeholder="e.g., Security audit focusing on authentication requirements..."
            rows={3}
          />
        </div>
      )}
    </div>
  );
};
