import React, { useEffect, useState } from 'react';
import { SectionTree } from '../components/SectionTree';

interface SectionTreeNode {
  name: string;
  label: string;
  present: boolean;
  items: { id: string; label: string }[];
}

interface SelectedSections {
  [sectionName: string]: string[];
}

interface SectionSelectStepProps {
  selectedSections: SelectedSections;
  onChangeSelection: (sel: SelectedSections) => void;
  vscode: { postMessage: (msg: unknown) => void };
}

export const SectionSelectStep: React.FC<SectionSelectStepProps> = ({
  selectedSections,
  onChangeSelection,
  vscode,
}) => {
  const [tree, setTree] = useState<SectionTreeNode[] | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'setSectionTree') {
        const nodes: SectionTreeNode[] = msg.payload.tree;
        setTree(nodes);
        // Auto-select all present sections with all items
        const initial: SelectedSections = {};
        for (const section of nodes) {
          if (section.present && section.items.length > 0) {
            initial[section.name] = section.items.map(i => i.id);
          }
        }
        onChangeSelection(initial);
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'requestSectionTree' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const toggleSection = (sectionName: string, items: { id: string }[]) => {
    const next = { ...selectedSections };
    if (next[sectionName]) {
      delete next[sectionName];
    } else {
      next[sectionName] = items.map(i => i.id);
    }
    onChangeSelection(next);
  };

  const toggleItem = (sectionName: string, itemId: string, allItems: { id: string }[]) => {
    const next = { ...selectedSections };
    const current = next[sectionName] || [];

    if (current.includes(itemId)) {
      const filtered = current.filter(id => id !== itemId);
      if (filtered.length === 0) {
        delete next[sectionName];
      } else {
        next[sectionName] = filtered;
      }
    } else {
      next[sectionName] = [...current, itemId];
      // If all items now selected, keep the full array
    }
    onChangeSelection(next);
  };

  const selectAll = () => {
    if (!tree) return;
    const all: SelectedSections = {};
    for (const section of tree) {
      if (section.present && section.items.length > 0) {
        all[section.name] = section.items.map(i => i.id);
      }
    }
    onChangeSelection(all);
  };

  const selectNone = () => {
    onChangeSelection({});
  };

  if (!tree) {
    return (
      <div className="export-step-content">
        <p className="export-step-description">Loading specification sections...</p>
      </div>
    );
  }

  const presentSections = tree.filter(s => s.present && s.items.length > 0);
  const totalItems = presentSections.reduce((sum, s) => sum + s.items.length, 0);
  const selectedCount = Object.values(selectedSections).reduce((sum, ids) => sum + ids.length, 0);

  return (
    <div className="export-step-content">
      <div className="export-section-header">
        <p className="export-step-description">
          Select sections and items to include ({selectedCount} of {totalItems} items selected).
        </p>
        <div className="export-section-actions">
          <button className="export-btn-link" onClick={selectAll}>Select all</button>
          <button className="export-btn-link" onClick={selectNone}>Select none</button>
        </div>
      </div>
      <SectionTree
        sections={presentSections}
        selectedSections={selectedSections}
        onToggleSection={toggleSection}
        onToggleItem={toggleItem}
      />
    </div>
  );
};
