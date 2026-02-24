"use strict";
// VS Code Webview API wrapper
// Provides type-safe access to the VS Code API from within webviews
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVsCodeApi = getVsCodeApi;
exports.postMessage = postMessage;
exports.navigateToItem = navigateToItem;
exports.requestRefresh = requestRefresh;
// Singleton instance
let vscodeApi;
function getVsCodeApi() {
    if (!vscodeApi) {
        vscodeApi = acquireVsCodeApi();
    }
    return vscodeApi;
}
function postMessage(message) {
    getVsCodeApi().postMessage(message);
}
// Navigate to a location in the RQML file
function navigateToItem(itemId) {
    postMessage({ type: 'navigateToItem', payload: { itemId } });
}
// Request refresh of data
function requestRefresh() {
    postMessage({ type: 'requestRefresh' });
}
//# sourceMappingURL=vscodeApi.js.map