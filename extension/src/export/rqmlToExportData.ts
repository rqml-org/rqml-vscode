// Transforms RqmlDocument + section selection into ExportData

import type { RqmlDocument } from '../services/rqmlParser';
import type { ExportData, ExportDataSection, ExportDataItem, SelectedSection } from './generators/types';

export function transformToExportData(
  doc: RqmlDocument,
  selectedSections: SelectedSection[]
): ExportData {
  const sections: ExportDataSection[] = [];

  for (const sel of selectedSections) {
    const section = doc.sections.get(sel.sectionName as any);
    if (!section || !section.present) continue;

    const allSelected = sel.selectedItemIds.length === 0;
    const selectedSet = new Set(sel.selectedItemIds);

    const items: ExportDataItem[] = section.items
      .filter(item => allSelected || selectedSet.has(item.id))
      .map(item => mapItem(item));

    if (items.length > 0) {
      sections.push({ name: sel.sectionName, items });
    }
  }

  const traceEdges = doc.traceEdges.map(e => ({
    id: e.id,
    from: e.from,
    to: e.to,
    type: e.type,
    notes: e.notes,
  }));

  return {
    title: getMetaTitle(doc),
    docId: doc.docId,
    version: doc.version,
    status: doc.status,
    sections,
    traceEdges,
  };
}

function getMetaTitle(doc: RqmlDocument): string {
  const meta = doc.sections.get('meta');
  if (meta?.present && meta.items.length > 0) {
    return meta.items[0].title || meta.items[0].name || doc.docId;
  }
  return doc.docId;
}

function mapItem(item: any): ExportDataItem {
  const mapped: ExportDataItem = {
    id: item.id,
    type: item.type,
    title: item.title || item.name || item.id,
    status: item.status,
    priority: item.priority,
    section: item.section,
  };
  if (item.children?.length) {
    mapped.children = item.children.map(mapItem);
  }
  return mapped;
}
