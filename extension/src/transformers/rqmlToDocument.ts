// Transform RQML document to Document View data structure
import { RqmlDocument, RqmlItem, RqmlSectionName, RQML_SECTIONS } from '../services/rqmlParser';

/**
 * Data structure for the Document View webview
 */
export interface DocumentViewData {
  docId: string;
  title: string;
  version: string;
  status: string;
  sections: {
    name: string;
    items: DocumentViewItem[];
  }[];
}

export interface DocumentViewItem {
  id: string;
  type: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
}

/**
 * Section display names for better readability
 */
const SECTION_DISPLAY_NAMES: Record<RqmlSectionName, string> = {
  meta: 'Metadata',
  catalogs: 'Catalogs',
  domain: 'Domain Model',
  goals: 'Goals',
  scenarios: 'Scenarios',
  requirements: 'Requirements',
  behavior: 'Behavior',
  interfaces: 'Interfaces',
  verification: 'Verification',
  trace: 'Traceability',
  governance: 'Governance'
};

/**
 * Transform an RQML document into Document View data
 */
export function transformToDocumentView(doc: RqmlDocument): DocumentViewData {
  const sections: DocumentViewData['sections'] = [];

  for (const sectionName of RQML_SECTIONS) {
    const section = doc.sections.get(sectionName);
    if (!section || !section.present || section.items.length === 0) {
      continue;
    }

    const items = flattenItems(section.items);
    if (items.length > 0) {
      sections.push({
        name: SECTION_DISPLAY_NAMES[sectionName],
        items
      });
    }
  }

  // Get title from meta section
  const metaSection = doc.sections.get('meta');
  let title = doc.docId;
  if (metaSection && metaSection.items.length > 0) {
    const metaItem = metaSection.items[0];
    if (metaItem.raw && typeof metaItem.raw === 'object') {
      const rawMeta = metaItem.raw as Record<string, unknown>;
      if (rawMeta.title) {
        title = String(rawMeta.title);
      }
    }
  }

  return {
    docId: doc.docId,
    title,
    version: doc.version,
    status: doc.status,
    sections
  };
}

/**
 * Flatten nested items (e.g., requirements in packages) into a flat list
 */
function flattenItems(items: RqmlItem[]): DocumentViewItem[] {
  const result: DocumentViewItem[] = [];

  for (const item of items) {
    // Add the item itself
    result.push(transformItem(item));

    // Add children if present
    if (item.children && item.children.length > 0) {
      for (const child of item.children) {
        result.push(transformItem(child));
      }
    }
  }

  return result;
}

/**
 * Transform a single RQML item to Document View item
 */
function transformItem(item: RqmlItem): DocumentViewItem {
  // Extract description from raw data if available
  let description: string | undefined;
  if (item.raw && typeof item.raw === 'object') {
    const raw = item.raw as Record<string, unknown>;
    if (raw.description) {
      description = String(raw.description);
    } else if (raw.statement) {
      description = String(raw.statement);
    } else if (raw.definition) {
      description = String(raw.definition);
    }
  }

  return {
    id: item.id,
    type: item.type,
    title: item.title || item.name,
    description,
    status: item.status,
    priority: item.priority
  };
}
