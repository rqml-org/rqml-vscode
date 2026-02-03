"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceGraph = TraceGraph;
// Trace Graph - Renders RQML traceability as a ReactFlow graph
const react_1 = require("react");
const react_2 = require("@xyflow/react");
require("@xyflow/react/dist/style.css");
const useVscodeTheme_1 = require("../shared/useVscodeTheme");
const vscodeApi_1 = require("../shared/vscodeApi");
const RequirementNode_1 = require("./nodes/RequirementNode");
// Custom node types
const nodeTypes = {
    requirement: RequirementNode_1.RequirementNode,
};
function TraceGraph() {
    const theme = (0, useVscodeTheme_1.useVscodeTheme)();
    const [nodes, setNodes, onNodesChange] = (0, react_2.useNodesState)([]);
    const [edges, setEdges, onEdgesChange] = (0, react_2.useEdgesState)([]);
    const [error, setError] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        // Listen for messages from extension
        const handleMessage = (event) => {
            const message = event.data;
            switch (message.type) {
                case 'setGraphData':
                    transformAndSetData(message.payload);
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
    const transformAndSetData = (data) => {
        // Auto-layout: group by section, arrange in columns
        const sectionOrder = ['Requirements', 'Features', 'TestCases', 'Other'];
        const sectionNodes = {};
        data.nodes.forEach((node) => {
            const section = node.section || 'Other';
            if (!sectionNodes[section]) {
                sectionNodes[section] = [];
            }
            sectionNodes[section].push(node);
        });
        const transformedNodes = [];
        let xOffset = 0;
        const nodeWidth = 200;
        const nodeHeight = 80;
        const xGap = 100;
        const yGap = 30;
        sectionOrder.forEach((section) => {
            const sectionItems = sectionNodes[section] || [];
            if (sectionItems.length === 0)
                return;
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
        const transformedEdges = data.edges.map((edge, index) => ({
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
    const onNodeClick = (0, react_1.useCallback)((_, node) => {
        (0, vscodeApi_1.navigateToItem)(node.id);
    }, []);
    const styles = {
        container: {
            width: '100%',
            height: '100vh',
            backgroundColor: theme.editorBackground,
        },
        errorBox: {
            padding: '16px',
            margin: '20px',
            backgroundColor: 'rgba(244, 135, 113, 0.1)',
            border: `1px solid ${theme.errorForeground}`,
            borderRadius: '4px',
            color: theme.errorForeground,
            fontFamily: theme.fontFamily,
        },
        loading: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            color: theme.foreground,
            fontFamily: theme.fontFamily,
            opacity: 0.6,
        },
    };
    if (error) {
        return (<div style={styles.container}>
        <div style={styles.errorBox}>{error}</div>
      </div>);
    }
    if (nodes.length === 0) {
        return (<div style={styles.loading}>Loading trace graph...</div>);
    }
    return (<div style={styles.container}>
      <react_2.ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} nodeTypes={nodeTypes} fitView attributionPosition="bottom-left">
        <react_2.Background variant={react_2.BackgroundVariant.Dots} gap={20} size={1} color={theme.panelBorder}/>
        <react_2.Controls style={{
            backgroundColor: theme.inputBackground,
            borderColor: theme.panelBorder,
        }}/>
        <react_2.MiniMap style={{
            backgroundColor: theme.inputBackground,
        }} nodeColor={(node) => {
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
        }}/>
      </react_2.ReactFlow>
    </div>);
}
//# sourceMappingURL=TraceGraph.js.map