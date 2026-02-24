"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Document View webview entry point
const client_1 = require("react-dom/client");
const DocumentView_1 = require("./DocumentView");
const container = document.getElementById('root');
if (container) {
    const root = (0, client_1.createRoot)(container);
    root.render(<DocumentView_1.DocumentView />);
}
//# sourceMappingURL=index.js.map