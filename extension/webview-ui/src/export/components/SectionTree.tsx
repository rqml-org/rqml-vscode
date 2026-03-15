import React, { useState } from 'react';

interface SectionTreeNode {
  name: string;
  label: string;
  present: boolean;
  items: { id: string; label: string }[];
}

interface SelectedSections {
  [sectionName: string]: string[];
}

interface SectionTreeProps {
  sections: SectionTreeNode[];
  selectedSections: SelectedSections;
  onToggleSection: (name: string, items: { id: string }[]) => void;
  onToggleItem: (sectionName: string, itemId: string, allItems: { id: string }[]) => void;
}

export const SectionTree: React.FC<SectionTreeProps> = ({
  sections,
  selectedSections,
  onToggleSection,
  onToggleItem,
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="export-section-tree">
      {sections.map(section => {
        const selectedIds = selectedSections[section.name] || [];
        const allSelected = selectedIds.length === section.items.length;
        const someSelected = selectedIds.length > 0 && !allSelected;
        const isExpanded = expanded[section.name] ?? false;

        return (
          <div key={section.name} className="export-section-node">
            <div className="export-section-row">
              <button
                className="export-section-expand"
                onClick={() => toggleExpand(section.name)}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? '▾' : '▸'}
              </button>
              <label className="export-section-checkbox">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={() => onToggleSection(section.name, section.items)}
                />
                <span className="export-section-label">
                  {section.label}
                  <span className="export-section-count">({section.items.length})</span>
                </span>
              </label>
            </div>
            {isExpanded && (
              <div className="export-item-list">
                {section.items.map(item => (
                  <label key={item.id} className="export-item-row">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => onToggleItem(section.name, item.id, section.items)}
                    />
                    <span className="export-item-id">{item.id}</span>
                    <span className="export-item-label">{item.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
