import React, { useState } from 'react';
import { ReportFormatStep } from './steps/ReportFormatStep';
import { SectionSelectStep } from './steps/SectionSelectStep';
import { LlmGuidanceStep } from './steps/LlmGuidanceStep';

type Step = 'report-format' | 'sections' | 'llm-guidance';

const STEPS: Step[] = ['report-format', 'sections', 'llm-guidance'];
const STEP_LABELS: Record<Step, string> = {
  'report-format': '1. Report & Format',
  'sections': '2. Sections',
  'llm-guidance': '3. AI & Guidance',
};

interface SelectedSections {
  [sectionName: string]: string[];
}

function getVsCodeApi() {
  return (window as any).acquireVsCodeApi?.() || { postMessage: () => {} };
}

const vscode = getVsCodeApi();

export const ExportWizard: React.FC = () => {
  const [step, setStep] = useState<Step>('report-format');
  const [reportType, setReportType] = useState('');
  const [format, setFormat] = useState('');
  const [selectedSections, setSelectedSections] = useState<SelectedSections>({});
  const [endpointId, setEndpointId] = useState('');
  const [modelId, setModelId] = useState('');
  const [guidance, setGuidance] = useState('');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [exportedFilename, setExportedFilename] = useState('');

  const stepIndex = STEPS.indexOf(step);

  const canGoNext = () => {
    if (step === 'report-format') return reportType !== '' && format !== '';
    if (step === 'sections') return Object.keys(selectedSections).length > 0;
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

  const handleReportFormatSelect = (rt: string, fmt: string) => {
    setReportType(rt);
    setFormat(fmt);
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
        selectedSections: sections,
        modelEndpointId: endpointId || undefined,
        modelId: modelId || undefined,
        guidance: guidance.trim() || undefined,
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
    setStep('report-format');
    setReportType('');
    setFormat('');
    setSelectedSections({});
    setEndpointId('');
    setModelId('');
    setGuidance('');
  };

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
            {step === 'report-format' && (
              <ReportFormatStep
                reportType={reportType}
                format={format}
                onSelect={handleReportFormatSelect}
                vscode={vscode}
              />
            )}
            {step === 'sections' && (
              <SectionSelectStep
                selectedSections={selectedSections}
                onChangeSelection={setSelectedSections}
                vscode={vscode}
              />
            )}
            {step === 'llm-guidance' && (
              <LlmGuidanceStep
                endpointId={endpointId}
                modelId={modelId}
                guidance={guidance}
                onEndpointChange={setEndpointId}
                onModelChange={setModelId}
                onGuidanceChange={setGuidance}
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
          {step !== 'llm-guidance' ? (
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
              disabled={exporting || (!endpointId && !modelId)}
            >
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
