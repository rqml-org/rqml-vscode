"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Trace Graph webview entry point
const client_1 = require("react-dom/client");
const TraceGraph_1 = require("./TraceGraph");
const container = document.getElementById('root');
if (container) {
    const root = (0, client_1.createRoot)(container);
    root.render(<TraceGraph_1.TraceGraph />);
}
//# sourceMappingURL=index.js.map