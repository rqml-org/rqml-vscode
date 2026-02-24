"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Requirements Matrix webview entry point
const client_1 = require("react-dom/client");
const MatrixView_1 = require("./MatrixView");
const container = document.getElementById('root');
if (container) {
    const root = (0, client_1.createRoot)(container);
    root.render(<MatrixView_1.MatrixView />);
}
//# sourceMappingURL=index.js.map