"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
// Expose safe APIs here later if needed
electron_1.contextBridge.exposeInMainWorld("api", {
    ping: function () { return "pong"; },
});
