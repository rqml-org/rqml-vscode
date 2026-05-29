// Scope a rqml-core DocumentOutline to the wizard's section/item selection
// before rendering it to markdown for the LLM prompt.
//
// rqml-core groups some RQML sections into several outline sections (catalogs →
// Glossary/Actors/…; goals → Goals/Quality goals/…). This maps each outline
// section title back to its RQML section name so the selection (keyed by RQML
// section name) can prune the outline.

import type { DocumentOutline, OutlineNode } from '../services/core';
import type { SelectedSection } from './generators/types';

const SECTION_OF_TITLE: Record<string, string> = {
  Meta: 'meta',
  Glossary: 'catalogs',
  Actors: 'catalogs',
  Stakeholders: 'catalogs',
  Constraints: 'catalogs',
  Policies: 'catalogs',
  Decisions: 'catalogs',
  Risks: 'catalogs',
  Domain: 'domain',
  Goals: 'goals',
  'Quality goals': 'goals',
  Obstacles: 'goals',
  'Goal links': 'goals',
  Scenarios: 'scenarios',
  'Misuse cases': 'scenarios',
  'Edge cases': 'scenarios',
  Requirements: 'requirements',
  Behavior: 'behavior',
  Interfaces: 'interfaces',
  Verification: 'verification',
  Trace: 'trace',
  Governance: 'governance',
};

/**
 * Prune an outline to the selected sections and items. Empty `selected` returns
 * the outline unchanged (nothing specified = everything). The Trace section is
 * always retained so the LLM keeps traceability context, mirroring the legacy
 * exporter which always included trace edges.
 */
export function scopeOutline(
  outline: DocumentOutline,
  selected: SelectedSection[],
): DocumentOutline {
  if (selected.length === 0) return outline;

  const selectedSectionNames = new Set<string>();
  const itemIdsBySection = new Map<string, Set<string>>();
  for (const sel of selected) {
    selectedSectionNames.add(sel.sectionName);
    itemIdsBySection.set(sel.sectionName, new Set(sel.selectedItemIds));
  }

  const sections: OutlineNode[] = [];
  for (const section of outline.sections) {
    const name = SECTION_OF_TITLE[section.title];
    const keepSection = name === 'trace' || (name !== undefined && selectedSectionNames.has(name));
    if (!keepSection) continue;

    const ids = name !== undefined ? itemIdsBySection.get(name) : undefined;
    if (!ids || ids.size === 0) {
      sections.push(section);
      continue;
    }

    const children = (section.children ?? []).filter(
      (c) => c.id !== undefined && ids.has(c.id),
    );
    const scoped: OutlineNode = { ...section };
    if (children.length > 0) scoped.children = children;
    else delete scoped.children;
    sections.push(scoped);
  }

  return { ...outline, sections };
}
