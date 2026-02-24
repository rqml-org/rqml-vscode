// Custom ReactFlow node for requirements/features/test cases
import { Handle, Position } from '@xyflow/react';
import type { VscodeTheme } from '../../shared/useVscodeTheme';

interface RequirementNodeData {
  label: string;
  id: string;
  type: string;
  status?: string;
  section: string;
  theme: VscodeTheme;
}

interface RequirementNodeProps {
  data: RequirementNodeData;
  selected: boolean;
}

export function RequirementNode({ data, selected }: RequirementNodeProps) {
  const { theme } = data;

  const getSectionColor = (section: string): string => {
    switch (section) {
      case 'Requirements':
        return '#8568ab'; // Lavender Purple
      case 'Features':
        return '#fc7a1e'; // Pumpkin Spice
      case 'TestCases':
        return '#60a561'; // Sage Green
      default:
        return theme.foreground;
    }
  };

  const getStatusColor = (status?: string): string => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'passed':
        return '#60a561';
      case 'draft':
      case 'pending':
        return '#cca700';
      case 'deprecated':
      case 'failed':
        return '#f48771';
      default:
        return theme.foreground;
    }
  };

  const sectionColor = getSectionColor(data.section);

  const styles = {
    node: {
      padding: '10px 14px',
      borderRadius: '6px',
      backgroundColor: theme.inputBackground,
      border: `2px solid ${selected ? sectionColor : theme.panelBorder}`,
      boxShadow: selected ? `0 0 0 2px ${sectionColor}40` : 'none',
      minWidth: '160px',
      maxWidth: '200px',
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      color: theme.foreground,
      cursor: 'pointer',
      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    } as React.CSSProperties,
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: '4px',
    } as React.CSSProperties,
    sectionIndicator: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: sectionColor,
    } as React.CSSProperties,
    id: {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: sectionColor,
      fontWeight: 500,
    } as React.CSSProperties,
    label: {
      fontSize: '12px',
      lineHeight: 1.3,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    } as React.CSSProperties,
    status: {
      display: 'inline-block',
      fontSize: '9px',
      padding: '1px 4px',
      borderRadius: '2px',
      marginTop: '4px',
      backgroundColor: getStatusColor(data.status) + '20',
      color: getStatusColor(data.status),
    } as React.CSSProperties,
    handle: {
      width: '8px',
      height: '8px',
      backgroundColor: theme.inputBackground,
      border: `2px solid ${sectionColor}`,
    } as React.CSSProperties,
  };

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={styles.handle}
      />
      <div style={styles.node}>
        <div style={styles.header}>
          <div style={styles.sectionIndicator} />
          <span style={styles.id}>{data.id}</span>
        </div>
        <div style={styles.label} title={data.label}>
          {data.label}
        </div>
        {data.status && (
          <span style={styles.status}>{data.status}</span>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={styles.handle}
      />
    </>
  );
}
