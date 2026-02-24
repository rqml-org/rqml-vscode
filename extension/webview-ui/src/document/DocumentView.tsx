// Document View - Renders RQML specification as formatted HTML
import { useEffect, useState } from 'react';
import { useVscodeTheme } from '../shared/useVscodeTheme';
import { navigateToItem } from '../shared/vscodeApi';

interface RqmlDocumentData {
  docId: string;
  title: string;
  version: string;
  status: string;
  sections: {
    name: string;
    items: {
      id: string;
      type: string;
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
    }[];
  }[];
}

export function DocumentView() {
  const theme = useVscodeTheme();
  const [document, setDocument] = useState<RqmlDocumentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for messages from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'setDocument':
          setDocument(message.payload);
          setError(null);
          break;
        case 'error':
          setError(message.payload);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleItemClick = (itemId: string) => {
    navigateToItem(itemId);
  };

  const styles = {
    container: {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      color: theme.foreground,
      backgroundColor: theme.editorBackground,
      padding: '20px',
      minHeight: '100vh',
    } as React.CSSProperties,
    header: {
      borderBottom: `2px solid ${theme.panelBorder}`,
      paddingBottom: '16px',
      marginBottom: '24px',
    } as React.CSSProperties,
    title: {
      fontSize: '24px',
      fontWeight: 600,
      marginBottom: '8px',
    } as React.CSSProperties,
    metadata: {
      display: 'flex',
      gap: '16px',
      fontSize: '12px',
      opacity: 0.8,
    } as React.CSSProperties,
    metaItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    } as React.CSSProperties,
    section: {
      marginBottom: '24px',
    } as React.CSSProperties,
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 600,
      marginBottom: '12px',
      color: theme.foreground,
      borderBottom: `1px solid ${theme.panelBorder}`,
      paddingBottom: '8px',
    } as React.CSSProperties,
    item: {
      padding: '12px',
      marginBottom: '8px',
      backgroundColor: theme.inputBackground,
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
    } as React.CSSProperties,
    itemId: {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: theme.buttonBackground,
      marginBottom: '4px',
    } as React.CSSProperties,
    itemTitle: {
      fontWeight: 500,
      marginBottom: '4px',
    } as React.CSSProperties,
    itemDescription: {
      fontSize: '12px',
      opacity: 0.9,
      lineHeight: 1.5,
    } as React.CSSProperties,
    statusBadge: {
      display: 'inline-block',
      fontSize: '10px',
      padding: '2px 6px',
      borderRadius: '3px',
      marginRight: '8px',
    } as React.CSSProperties,
    loading: {
      textAlign: 'center' as const,
      padding: '40px',
      opacity: 0.6,
    } as React.CSSProperties,
    errorBox: {
      padding: '16px',
      backgroundColor: 'rgba(244, 135, 113, 0.1)',
      border: `1px solid ${theme.errorForeground}`,
      borderRadius: '4px',
      color: theme.errorForeground,
    } as React.CSSProperties,
  };

  const getStatusColor = (status?: string): string => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return '#60a561';
      case 'draft':
        return '#cca700';
      case 'deprecated':
        return '#f48771';
      default:
        return theme.foreground;
    }
  };

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>{error}</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading RQML specification...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>{document.title || document.docId}</h1>
        <div style={styles.metadata}>
          <span style={styles.metaItem}>
            <strong>ID:</strong> {document.docId}
          </span>
          <span style={styles.metaItem}>
            <strong>Version:</strong> {document.version}
          </span>
          <span style={styles.metaItem}>
            <strong>Status:</strong>{' '}
            <span style={{ color: getStatusColor(document.status) }}>
              {document.status}
            </span>
          </span>
        </div>
      </header>

      {document.sections.map((section) => (
        <section key={section.name} style={styles.section}>
          <h2 style={styles.sectionTitle}>
            {section.name} ({section.items.length})
          </h2>
          {section.items.map((item) => (
            <div
              key={item.id}
              style={styles.item}
              onClick={() => handleItemClick(item.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.listHoverBackground;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.inputBackground;
              }}
            >
              <div style={styles.itemId}>{item.id}</div>
              {item.title && <div style={styles.itemTitle}>{item.title}</div>}
              <div>
                {item.status && (
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: getStatusColor(item.status) + '20',
                      color: getStatusColor(item.status),
                    }}
                  >
                    {item.status}
                  </span>
                )}
                {item.priority && (
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: theme.buttonBackground + '20',
                      color: theme.buttonBackground,
                    }}
                  >
                    P{item.priority}
                  </span>
                )}
              </div>
              {item.description && (
                <div style={styles.itemDescription}>{item.description}</div>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
