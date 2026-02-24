"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatrixView = MatrixView;
// Requirements Matrix - Renders requirements vs test cases matrix
const react_1 = require("react");
const useVscodeTheme_1 = require("../shared/useVscodeTheme");
const vscodeApi_1 = require("../shared/vscodeApi");
function MatrixView() {
    const theme = (0, useVscodeTheme_1.useVscodeTheme)();
    const [data, setData] = (0, react_1.useState)(null);
    const [error, setError] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        const handleMessage = (event) => {
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
    const handleCellClick = (reqId, testId) => {
        (0, vscodeApi_1.navigateToItem)(testId || reqId);
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
        },
        header: {
            marginBottom: '20px',
        },
        title: {
            fontSize: '20px',
            fontWeight: 600,
        },
        subtitle: {
            fontSize: '12px',
            opacity: 0.7,
            marginTop: '4px',
        },
        tableWrapper: {
            overflowX: 'auto',
            border: `1px solid ${theme.panelBorder}`,
            borderRadius: '6px',
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
        },
        th: {
            padding: '10px 12px',
            textAlign: 'left',
            backgroundColor: theme.inputBackground,
            borderBottom: `1px solid ${theme.panelBorder}`,
            fontWeight: 600,
            position: 'sticky',
            top: 0,
        },
        thRotated: {
            padding: '8px 4px',
            textAlign: 'center',
            backgroundColor: theme.inputBackground,
            borderBottom: `1px solid ${theme.panelBorder}`,
            fontWeight: 500,
            minWidth: '40px',
            maxWidth: '60px',
        },
        thText: {
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            maxHeight: '120px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
        },
        td: {
            padding: '8px 12px',
            borderBottom: `1px solid ${theme.panelBorder}`,
            verticalAlign: 'middle',
        },
        tdCell: {
            padding: '4px',
            borderBottom: `1px solid ${theme.panelBorder}`,
            textAlign: 'center',
            cursor: 'pointer',
        },
        groupRow: {
            backgroundColor: theme.listHoverBackground,
        },
        groupCell: {
            padding: '8px 12px',
            fontWeight: 600,
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#8568ab',
        },
        reqId: {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: theme.buttonBackground,
        },
        reqTitle: {
            marginTop: '2px',
        },
        statusDot: {
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            display: 'inline-block',
            transition: 'transform 0.15s ease',
        },
        loading: {
            textAlign: 'center',
            padding: '40px',
            opacity: 0.6,
        },
        errorBox: {
            padding: '16px',
            backgroundColor: 'rgba(244, 135, 113, 0.1)',
            border: `1px solid ${theme.errorForeground}`,
            borderRadius: '4px',
            color: theme.errorForeground,
        },
        legend: {
            display: 'flex',
            gap: '20px',
            marginTop: '16px',
            fontSize: '11px',
        },
        legendItem: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
        },
    };
    const getStatusColor = (status) => {
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
        return (<div style={styles.container}>
        <div style={styles.errorBox}>{error}</div>
      </div>);
    }
    if (!data) {
        return (<div style={styles.container}>
        <div style={styles.loading}>Loading requirements matrix...</div>
      </div>);
    }
    // Group requirements by their group
    const groupedRequirements = {};
    data.groups.forEach((group) => {
        groupedRequirements[group] = data.requirements.filter((r) => r.group === group);
    });
    // Requirements without a group
    const ungrouped = data.requirements.filter((r) => !r.group);
    if (ungrouped.length > 0) {
        groupedRequirements['Ungrouped'] = ungrouped;
    }
    return (<div style={styles.container}>
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
              {data.testCases.map((tc) => (<th key={tc.id} style={styles.thRotated} title={`${tc.id}: ${tc.title}`}>
                  <span style={styles.thText}>{tc.id}</span>
                </th>))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(groupedRequirements).map(([group, requirements]) => (<>
                {group !== 'Ungrouped' && (<tr key={`group-${group}`} style={styles.groupRow}>
                    <td style={styles.groupCell} colSpan={data.testCases.length + 1}>
                      {group}
                    </td>
                  </tr>)}
                {requirements.map((req) => (<tr key={req.id}>
                    <td style={{ ...styles.td, cursor: 'pointer' }} onClick={() => handleCellClick(req.id)}>
                      <div style={styles.reqId}>{req.id}</div>
                      <div style={styles.reqTitle}>{req.title}</div>
                    </td>
                    {data.testCases.map((tc) => {
                    const status = req.testCoverage[tc.id] || 'none';
                    return (<td key={tc.id} style={styles.tdCell} onClick={() => status !== 'none' && handleCellClick(req.id, tc.id)} title={status !== 'none'
                            ? `${req.id} ↔ ${tc.id}: ${status}`
                            : 'No trace'}>
                          <span style={{
                            ...styles.statusDot,
                            backgroundColor: getStatusColor(status),
                            opacity: status === 'none' ? 0.3 : 1,
                        }} onMouseEnter={(e) => {
                            if (status !== 'none') {
                                e.currentTarget.style.transform = 'scale(1.2)';
                            }
                        }} onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                        }}/>
                        </td>);
                })}
                  </tr>))}
              </>))}
          </tbody>
        </table>
      </div>

      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <span style={{ ...styles.statusDot, backgroundColor: getStatusColor('passed') }}/>
          Passed
        </div>
        <div style={styles.legendItem}>
          <span style={{ ...styles.statusDot, backgroundColor: getStatusColor('failed') }}/>
          Failed
        </div>
        <div style={styles.legendItem}>
          <span style={{ ...styles.statusDot, backgroundColor: getStatusColor('pending') }}/>
          Pending
        </div>
        <div style={styles.legendItem}>
          <span style={{
            ...styles.statusDot,
            backgroundColor: getStatusColor('none'),
            opacity: 0.3,
        }}/>
          No trace
        </div>
      </div>
    </div>);
}
//# sourceMappingURL=MatrixView.js.map