import React, { useState } from 'react';
import { FormatStep } from './steps/FormatStep';
import { ReportTypeStep } from './steps/ReportTypeStep';
import { SectionSelectStep } from './steps/SectionSelectStep';

type ExportFormat = 'pptx' | 'docx' | 'xlsx' | 'pdf';
type Step = 'format' | 'report-type' | 'sections';

const STEPS: Step[] = ['format', 'report-type', 'sections'];
const STEP_LABELS: Record<Step, string> = {
  'format': '1. Format',
  'report-type': '2. Report Type',
  'sections': '3. Sections',
};

interface SelectedSections {
  [sectionName: string]: string[]; // empty array = all items
}

function getVsCodeApi() {
  return (window as any).acquireVsCodeApi?.() || { postMessage: () => {} };
}

const vscode = getVsCodeApi();

export const ExportWizard: React.FC = () => {
  const [step, setStep] = useState<Step>('format');
  const [format, setFormat] = useState<ExportFormat>('pptx');
  const [reportType, setReportType] = useState('full-spec');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedSections, setSelectedSections] = useState<SelectedSections>({});
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [exportedFilename, setExportedFilename] = useState('');

  const stepIndex = STEPS.indexOf(step);

  const canGoNext = () => {
    if (step === 'format') return true;
    if (step === 'report-type') return reportType !== 'other' || customPrompt.trim().length > 0;
    return true;
  };

  const goNext = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const handleExport = () => {
    setExporting(true);
    setError(null);

    const sections = Object.entries(selectedSections).map(([sectionName, itemIds]) => ({
      sectionName,
      selectedItemIds: itemIds,
    }));

    vscode.postMessage({
      type: 'startExport',
      payload: {
        format,
        reportType,
        customPrompt: reportType === 'other' ? customPrompt : undefined,
        selectedSections: sections,
      },
    });
  };

  const handleOpenFile = () => {
    vscode.postMessage({ type: 'openFile' });
    vscode.postMessage({ type: 'closePanel' });
  };

  const handleExportAnother = () => {
    setDone(false);
    setExportedFilename('');
    setError(null);
    setStep('format');
    setFormat('pptx');
    setReportType('full-spec');
    setCustomPrompt('');
    setSelectedSections({});
  };

  // Listen for messages from extension host
  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.type) {
        case 'exportProgress':
          setProgress(msg.payload);
          break;
        case 'exportComplete':
          setExporting(false);
          setProgress(null);
          setExportedFilename(msg.payload.filename);
          setDone(true);
          break;
        case 'exportError':
          setExporting(false);
          setProgress(null);
          setError(msg.payload.message);
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div className="export-wizard">
      {!done && (
        <div className="export-header">
          <h2>Export Specification</h2>
          <div className="export-steps">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`export-step-indicator${s === step ? ' active' : ''}${i < stepIndex ? ' done' : ''}`}
              >
                {STEP_LABELS[s]}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="export-body">
        {done ? (
          <div className="export-success">
            <div className="export-success-icon">&#10003;</div>
            <h3 className="export-success-title">Exported successfully</h3>
            <p className="export-success-filename">{exportedFilename}</p>
            <div className="export-success-actions">
              <button className="export-btn primary" onClick={handleOpenFile}>
                Open File
              </button>
              <button className="export-btn secondary" onClick={handleExportAnother}>
                Export Another
              </button>
            </div>
          </div>
        ) : (
          <>
            {step === 'format' && (
              <FormatStep format={format} onSelect={setFormat} />
            )}
            {step === 'report-type' && (
              <ReportTypeStep
                reportType={reportType}
                onSelect={setReportType}
                customPrompt={customPrompt}
                onCustomPromptChange={setCustomPrompt}
              />
            )}
            {step === 'sections' && (
              <SectionSelectStep
                selectedSections={selectedSections}
                onChangeSelection={setSelectedSections}
                vscode={vscode}
              />
            )}
          </>
        )}
      </div>

      {exporting && progress && (
        <div className="export-progress-overlay">
          <div className="export-progress-content">
            <div className="export-progress-bar-track">
              <div className="export-progress-bar-fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <span className="export-progress-label">{progress.stage}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="export-result error">
          {error}
          <button className="export-result-dismiss" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {!done && (
        <div className="export-footer">
          <button
            className="export-btn secondary"
            onClick={goBack}
            disabled={stepIndex === 0 || exporting}
          >
            Back
          </button>
          <div className="export-footer-spacer" />
          {step !== 'sections' ? (
            <button
              className="export-btn primary"
              onClick={goNext}
              disabled={!canGoNext() || exporting}
            >
              Next
            </button>
          ) : (
            <button
              className="export-btn primary"
              onClick={handleExport}
              disabled={exporting || Object.keys(selectedSections).length === 0}
            >
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
