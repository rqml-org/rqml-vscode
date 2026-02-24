// Requirements Matrix - Renders requirements vs test cases matrix
import { useEffect, useState } from 'react';
import { useVscodeTheme } from '../shared/useVscodeTheme';
import { navigateToItem } from '../shared/vscodeApi';

interface RequirementRow {
  id: string;
  title: string;
  group?: string;
  testCoverage: Record<string, 'passed' | 'failed' | 'pending' | 'none'>;
}

interface MatrixData {
  requirements: RequirementRow[];
  testCases: {
    id: string;
    title: string;
  }[];
  groups: string[];
}

export function MatrixView() {
  const theme = useVscodeTheme();
  const [data, setData] = useState<MatrixData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'setMatrixData':
          setData(message.payload);
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

  const handleCellClick = (reqId: string, testId?: string) => {
    navigateToItem(testId || reqId);
  };

  const styles = {
    container: {
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      color: theme.foreground,
      backgroundColor: theme.editorBackground,
      padding: '20px',
      minHeight: '100vh',
      overflow: 'auto',
    } as React.CSSProperties,
    header: {
      marginBottom: '20px',
    } as React.CSSProperties,
    title: {
      fontSize: '20px',
      fontWeight: 600,
    } as React.CSSProperties,
    subtitle: {
      fontSize: '12px',
      opacity: 0.7,
      marginTop: '4px',
    } as React.CSSProperties,
    tableWrapper: {
      overflowX: 'auto' as const,
      border: `1px solid ${theme.panelBorder}`,
      borderRadius: '6px',
    } as React.CSSProperties,
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      fontSize: '12px',
    } as React.CSSProperties,
    th: {
      padding: '10px 12px',
      textAlign: 'left' as const,
      backgroundColor: theme.inputBackground,
      borderBottom: `1px solid ${theme.panelBorder}`,
      fontWeight: 600,
      position: 'sticky' as const,
      top: 0,
    } as React.CSSProperties,
    thRotated: {
      padding: '8px 4px',
      textAlign: 'center' as const,
      backgroundColor: theme.inputBackground,
      borderBottom: `1px solid ${theme.panelBorder}`,
      fontWeight: 500,
      minWidth: '40px',
      maxWidth: '60px',
    } as React.CSSProperties,
    thText: {
      writingMode: 'vertical-rl' as const,
      transform: 'rotate(180deg)',
      whiteSpace: 'nowrap' as const,
      fontSize: '10px',
      maxHeight: '120px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    } as React.CSSProperties,
    td: {
      padding: '8px 12px',
      borderBottom: `1px solid ${theme.panelBorder}`,
      verticalAlign: 'middle' as const,
    } as React.CSSProperties,
    tdCell: {
      padding: '4px',
      borderBottom: `1px solid ${theme.panelBorder}`,
      textAlign: 'center' as const,
      cursor: 'pointer',
    } as React.CSSProperties,
    groupRow: {
      backgroundColor: theme.listHoverBackground,
    } as React.CSSProperties,
    groupCell: {
      padding: '8px 12px',
      fontWeight: 600,
      fontSize: '11px',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      color: '#8568ab',
    } as React.CSSProperties,
    reqId: {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: theme.buttonBackground,
    } as React.CSSProperties,
    reqTitle: {
      marginTop: '2px',
    } as React.CSSProperties,
    statusDot: {
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      display: 'inline-block',
      transition: 'transform 0.15s ease',
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
    legend: {
      display: 'flex',
      gap: '20px',
      marginTop: '16px',
      fontSize: '11px',
    } as React.CSSProperties,
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    } as React.CSSProperties,
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'passed':
        return '#60a561';
      case 'failed':
        return '#f48771';
      case 'pending':
        return '#cca700';
      case 'none':
      default:
        return theme.panelBorder;
    }
  };

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading requirements matrix...</div>
      </div>
    );
  }

  // Group requirements by their group
  const groupedRequirements: Record<string, RequirementRow[]> = {};
  data.groups.forEach((group) => {
    groupedRequirements[group] = data.requirements.filter(
      (r) => r.group === group
    );
  });

  // Requirements without a group
  const ungrouped = data.requirements.filter((r) => !r.group);
  if (ungrouped.length > 0) {
    groupedRequirements['Ungrouped'] = ungrouped;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Requirements Matrix</h1>
        <p style={styles.subtitle}>
          {data.requirements.length} requirements × {data.testCases.length} test cases
        </p>
      </header>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Requirement</th>
              {data.testCases.map((tc) => (
                <th
                  key={tc.id}
                  style={styles.thRotated}
                  title={`${tc.id}: ${tc.title}`}
                >
                  <span style={styles.thText}>{tc.id}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedRequirements).map(([group, requirements]) => (
              <>
                {group !== 'Ungrouped' && (
                  <tr key={`group-${group}`} style={styles.groupRow}>
                    <td
                      style={styles.groupCell}
                      colSpan={data.testCases.length + 1}
                    >
                      {group}
                    </td>
                  </tr>
                )}
                {requirements.map((req) => (
                  <tr key={req.id}>
                    <td
                      style={{ ...styles.td, cursor: 'pointer' }}
                      onClick={() => handleCellClick(req.id)}
                    >
                      <div style={styles.reqId}>{req.id}</div>
                      <div style={styles.reqTitle}>{req.title}</div>
                    </td>
                    {data.testCases.map((tc) => {
                      const status = req.testCoverage[tc.id] || 'none';
                      return (
                        <td
                          key={tc.id}
                          style={styles.tdCell}
                          onClick={() =>
                            status !== 'none' && handleCellClick(req.id, tc.id)
                          }
                          title={
                            status !== 'none'
                              ? `${req.id} ↔ ${tc.id}: ${status}`
                              : 'No trace'
                          }
                        >
                          <span
                            style={{
                              ...styles.statusDot,
                              backgroundColor: getStatusColor(status),
                              opacity: status === 'none' ? 0.3 : 1,
                            }}
                            onMouseEnter={(e) => {
                              if (status !== 'none') {
                                e.currentTarget.style.transform = 'scale(1.2)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <span
            style={{ ...styles.statusDot, backgroundColor: getStatusColor('passed') }}
          />
          Passed
        </div>
        <div style={styles.legendItem}>
          <span
            style={{ ...styles.statusDot, backgroundColor: getStatusColor('failed') }}
          />
          Failed
        </div>
        <div style={styles.legendItem}>
          <span
            style={{ ...styles.statusDot, backgroundColor: getStatusColor('pending') }}
          />
          Pending
        </div>
        <div style={styles.legendItem}>
          <span
            style={{
              ...styles.statusDot,
              backgroundColor: getStatusColor('none'),
              opacity: 0.3,
            }}
          />
          No trace
        </div>
      </div>
    </div>
  );
}
