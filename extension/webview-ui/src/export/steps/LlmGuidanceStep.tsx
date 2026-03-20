import React, { useEffect, useState } from 'react';

interface ModelOption {
  endpointId: string;
  endpointName: string;
  modelId: string;
  displayName: string;
}

interface Props {
  endpointId: string;
  modelId: string;
  guidance: string;
  onEndpointChange: (endpointId: string) => void;
  onModelChange: (modelId: string) => void;
  onGuidanceChange: (guidance: string) => void;
  vscode: { postMessage: (msg: any) => void };
}

export const LlmGuidanceStep: React.FC<Props> = ({
  endpointId,
  modelId,
  guidance,
  onEndpointChange,
  onModelChange,
  onGuidanceChange,
  vscode,
}) => {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [ready, setReady] = useState(true);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data.type === 'setModelList') {
        const list: ModelOption[] = event.data.payload.models;
        setModels(list);
        setReady(list.length > 0);

        // Auto-select first model if none selected
        if (list.length > 0 && !endpointId) {
          onEndpointChange(list[0].endpointId);
          onModelChange(list[0].modelId);
        }
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'requestModelList' });
    return () => window.removeEventListener('message', handler);
  }, []);

  // Group models by endpoint
  const endpoints = new Map<string, { name: string; models: ModelOption[] }>();
  for (const m of models) {
    if (!endpoints.has(m.endpointId)) {
      endpoints.set(m.endpointId, { name: m.endpointName, models: [] });
    }
    endpoints.get(m.endpointId)!.models.push(m);
  }

  const handleModelSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const [eid, mid] = value.split('::');
    onEndpointChange(eid);
    onModelChange(mid);
  };

  const currentValue = endpointId && modelId ? `${endpointId}::${modelId}` : '';

  if (!ready) {
    return (
      <div className="llm-guidance-step">
        <div className="llm-no-config">
          <p>No LLM endpoints configured.</p>
          <p>Use the <strong>/provider add</strong> command in the RQML agent to configure an AI provider before exporting.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="llm-guidance-step">
      <div className="llm-model-section">
        <label className="llm-label" htmlFor="model-select">AI Model</label>
        <select
          id="model-select"
          className="llm-select"
          value={currentValue}
          onChange={handleModelSelect}
        >
          {Array.from(endpoints.entries()).map(([eid, group]) => (
            <optgroup key={eid} label={group.name}>
              {group.models.map(m => (
                <option key={`${m.endpointId}::${m.modelId}`} value={`${m.endpointId}::${m.modelId}`}>
                  {m.displayName}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="llm-guidance-section">
        <label className="llm-label" htmlFor="guidance-input">Additional guidance (optional)</label>
        <textarea
          id="guidance-input"
          className="llm-textarea"
          value={guidance}
          onChange={e => onGuidanceChange(e.target.value)}
          placeholder="e.g., Focus on security requirements, use formal tone, include risk assessment..."
          rows={5}
        />
      </div>
    </div>
  );
};
