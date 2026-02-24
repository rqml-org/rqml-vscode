// Trace Graph - Renders RQML traceability as a ReactFlow graph
import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useVscodeTheme } from '../shared/useVscodeTheme';
import { navigateToItem } from '../shared/vscodeApi';
import { RequirementNode } from './nodes/RequirementNode';

// Custom node types
const nodeTypes = {
  requirement: RequirementNode,
};

interface TraceGraphData {
  nodes: {
    id: string;
    type: string;
    label: string;
    status?: string;
    section: string;
  }[];
  edges: {
    source: string;
    target: string;
    label?: string;
  }[];
}

export function TraceGraph() {
  const theme = useVscodeTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for messages from extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'setGraphData':
          transformAndSetData(message.payload as TraceGraphData);
          setError(null);
          break;
        case 'error':
          setError(message.payload);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [theme]);

  const transformAndSetData = (data: TraceGraphData) => {
    // Auto-layout: group by section, arrange in columns
    const sectionOrder = ['Requirements', 'Features', 'TestCases', 'Other'];
    const sectionNodes: Record<string, typeof data.nodes> = {};

    data.nodes.forEach((node) => {
      const section = node.section || 'Other';
      if (!sectionNodes[section]) {
        sectionNodes[section] = [];
      }
      sectionNodes[section].push(node);
    });

    const transformedNodes: Node[] = [];
    let xOffset = 0;
    const nodeWidth = 200;
    const nodeHeight = 80;
    const xGap = 100;
    const yGap = 30;

    sectionOrder.forEach((section) => {
      const sectionItems = sectionNodes[section] || [];
      if (sectionItems.length === 0) return;

      sectionItems.forEach((node, index) => {
        transformedNodes.push({
          id: node.id,
          type: 'requirement',
          position: {
            x: xOffset,
            y: index * (nodeHeight + yGap),
          },
          data: {
            label: node.label,
            id: node.id,
            type: node.type,
            status: node.status,
            section: section,
            theme,
          },
        });
      });

      xOffset += nodeWidth + xGap;
    });

    const transformedEdges: Edge[] = data.edges.map((edge, index) => ({
      id: `e-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: true,
      style: {
        stroke: theme.foreground,
        strokeWidth: 1.5,
      },
      labelStyle: {
        fill: theme.foreground,
        fontSize: 10,
      },
    }));

    setNodes(transformedNodes);
    setEdges(transformedEdges);
  };

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    navigateToItem(node.id);
  }, []);

  const styles = {
    container: {
      width: '100%',
      height: '100vh',
      backgroundColor: theme.editorBackground,
    } as React.CSSProperties,
    errorBox: {
      padding: '16px',
      margin: '20px',
      backgroundColor: 'rgba(244, 135, 113, 0.1)',
      border: `1px solid ${theme.errorForeground}`,
      borderRadius: '4px',
      color: theme.errorForeground,
      fontFamily: theme.fontFamily,
    } as React.CSSProperties,
    loading: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: theme.foreground,
      fontFamily: theme.fontFamily,
      opacity: 0.6,
    } as React.CSSProperties,
  };

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>{error}</div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div style={styles.loading}>Loading trace graph...</div>
    );
  }

  return (
    <div style={styles.container}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={theme.panelBorder}
        />
        <Controls
          style={{
            backgroundColor: theme.inputBackground,
            borderColor: theme.panelBorder,
          }}
        />
        <MiniMap
          style={{
            backgroundColor: theme.inputBackground,
          }}
          nodeColor={(node) => {
            switch (node.data?.section) {
              case 'Requirements':
                return '#8568ab';
              case 'Features':
                return '#fc7a1e';
              case 'TestCases':
                return '#60a561';
              default:
                return theme.foreground;
            }
          }}
        />
      </ReactFlow>
    </div>
  );
}
