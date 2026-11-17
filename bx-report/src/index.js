"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkdownToPDFConverter = void 0;
exports.convertMarkdownToPDF = convertMarkdownToPDF;
// src/index.ts
var electron_1 = require("electron");
var marked_1 = require("marked");
var fs = require("fs");
var MarkdownToPDFConverter = /** @class */ (function () {
    function MarkdownToPDFConverter() {
        var _this = this;
        this.isAppReady = false;
        if (electron_1.app) {
            electron_1.app.on('ready', function () {
                _this.isAppReady = true;
            });
        }
    }
    MarkdownToPDFConverter.prototype.ensureAppReady = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isAppReady)
                            return [2 /*return*/];
                        if (!(electron_1.app && !electron_1.app.isReady())) return [3 /*break*/, 2];
                        return [4 /*yield*/, electron_1.app.whenReady()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        this.isAppReady = true;
                        return [2 /*return*/];
                }
            });
        });
    };
    MarkdownToPDFConverter.prototype.generatePDFFromHTML = function (html_1) {
        return __awaiter(this, arguments, void 0, function (html, options) {
            var win, pdfOptions, data;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0: return [4 /*yield*/, this.ensureAppReady()];
                    case 1:
                        _k.sent();
                        win = new electron_1.BrowserWindow({
                            show: false,
                            webPreferences: {
                                nodeIntegration: false,
                                contextIsolation: true,
                            },
                        });
                        return [4 /*yield*/, win.loadURL("data:text/html;charset=utf-8,".concat(encodeURIComponent(html)))];
                    case 2:
                        _k.sent();
                        // Wait for content to load and Mermaid to render
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 2000); })];
                    case 3:
                        // Wait for content to load and Mermaid to render
                        _k.sent();
                        pdfOptions = {
                            landscape: (_a = options.landscape) !== null && _a !== void 0 ? _a : false,
                            pageSize: (_b = options.pageSize) !== null && _b !== void 0 ? _b : 'A4',
                            printBackground: (_c = options.printBackground) !== null && _c !== void 0 ? _c : true,
                            printSelectionOnly: (_d = options.printSelectionOnly) !== null && _d !== void 0 ? _d : false,
                            scaleFactor: (_e = options.scaleFactor) !== null && _e !== void 0 ? _e : 100,
                            displayHeaderFooter: (_f = options.displayHeaderFooter) !== null && _f !== void 0 ? _f : false,
                            headerTemplate: (_g = options.headerTemplate) !== null && _g !== void 0 ? _g : '',
                            footerTemplate: (_h = options.footerTemplate) !== null && _h !== void 0 ? _h : '',
                        };
                        // Only add margins if specified, otherwise use marginsType
                        if (options.margins) {
                            pdfOptions.margins = options.margins;
                        }
                        else {
                            pdfOptions.marginsType = (_j = options.marginsType) !== null && _j !== void 0 ? _j : 0;
                        }
                        if (options.pageRanges) {
                            pdfOptions.pageRanges = options.pageRanges;
                        }
                        return [4 /*yield*/, win.webContents.printToPDF(pdfOptions)];
                    case 4:
                        data = _k.sent();
                        win.close();
                        return [2 /*return*/, data];
                }
            });
        });
    };
    MarkdownToPDFConverter.prototype.wrapHTMLWithStyles = function (content, css) {
        var defaultCSS = "\n      body {\n        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;\n        line-height: 1.6;\n        color: #333;\n        max-width: 800px;\n        margin: 0 auto;\n        padding: 20px;\n      }\n      h1, h2, h3, h4, h5, h6 {\n        margin-top: 24px;\n        margin-bottom: 16px;\n        font-weight: 600;\n        line-height: 1.25;\n      }\n      h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }\n      h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }\n      code {\n        background-color: #f6f8fa;\n        padding: 0.2em 0.4em;\n        border-radius: 3px;\n        font-family: 'Courier New', monospace;\n      }\n      pre {\n        background-color: #f6f8fa;\n        padding: 16px;\n        border-radius: 6px;\n        overflow-x: auto;\n      }\n      pre code {\n        background-color: transparent;\n        padding: 0;\n      }\n      blockquote {\n        border-left: 4px solid #dfe2e5;\n        padding-left: 16px;\n        color: #6a737d;\n        margin-left: 0;\n      }\n      table {\n        border-collapse: collapse;\n        width: 100%;\n        margin: 16px 0;\n      }\n      table th, table td {\n        border: 1px solid #dfe2e5;\n        padding: 8px 12px;\n      }\n      table th {\n        background-color: #f6f8fa;\n        font-weight: 600;\n      }\n      img {\n        max-width: 100%;\n      }\n      .page-break {\n        page-break-after: always;\n      }\n      .cover-page {\n        page-break-after: always;\n      }\n      .mermaid {\n        display: flex;\n        justify-content: center;\n        margin: 20px 0;\n      }\n      @media print {\n        body {\n          max-width: 100%;\n        }\n      }\n    ";
        return "\n      <!DOCTYPE html>\n      <html>\n      <head>\n        <meta charset=\"UTF-8\">\n        <style>\n          ".concat(defaultCSS, "\n          ").concat(css || '', "\n        </style>\n        <script type=\"module\">\n          import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.12.2/dist/mermaid.esm.min.mjs';\n          mermaid.initialize({ \n            startOnLoad: true,\n            theme: 'default',\n            securityLevel: 'loose'\n          });\n        </script>\n      </head>\n      <body>\n        ").concat(content, "\n      </body>\n      </html>\n    ");
    };
    MarkdownToPDFConverter.prototype.convert = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var markdownFiles, customCSS, fullHTML, coverHTML, bodyMatch, i, markdownFile, markdown, htmlContent, wrappedHTML, pdfBuffer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.ensureAppReady()];
                    case 1:
                        _a.sent();
                        markdownFiles = Array.isArray(options.markdownFiles)
                            ? options.markdownFiles
                            : [options.markdownFiles];
                        customCSS = options.css || '';
                        if (options.cssPath) {
                            customCSS += fs.readFileSync(options.cssPath, 'utf-8');
                        }
                        fullHTML = '';
                        // Add cover if provided
                        if (options.cover) {
                            if (options.cover.htmlPath) {
                                coverHTML = fs.readFileSync(options.cover.htmlPath, 'utf-8');
                                bodyMatch = coverHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                                if (bodyMatch) {
                                    fullHTML += "<div class=\"cover-page\">".concat(bodyMatch[1], "</div>");
                                }
                                else {
                                    fullHTML += "<div class=\"cover-page\">".concat(coverHTML, "</div>");
                                }
                            }
                            else if (options.cover.html) {
                                fullHTML += "<div class=\"cover-page\">".concat(options.cover.html, "</div>");
                            }
                        }
                        // Convert and add all markdown files
                        for (i = 0; i < markdownFiles.length; i++) {
                            markdownFile = markdownFiles[i];
                            markdown = fs.readFileSync(markdownFile, 'utf-8');
                            htmlContent = marked_1.marked.parse(markdown);
                            // Convert mermaid code blocks to mermaid divs
                            htmlContent = htmlContent.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, '<div class="mermaid">$1</div>');
                            // Add page break between files if multiple files (but not after the last one)
                            if (i > 0) {
                                fullHTML += '<div class="page-break"></div>';
                            }
                            fullHTML += htmlContent;
                        }
                        wrappedHTML = this.wrapHTMLWithStyles(fullHTML, customCSS);
                        return [4 /*yield*/, this.generatePDFFromHTML(wrappedHTML, options.pageOptions)];
                    case 2:
                        pdfBuffer = _a.sent();
                        // Save PDF
                        fs.writeFileSync(options.outputPath, pdfBuffer);
                        return [2 /*return*/];
                }
            });
        });
    };
    MarkdownToPDFConverter.prototype.quit = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (electron_1.app) {
                    electron_1.app.quit();
                }
                return [2 /*return*/];
            });
        });
    };
    return MarkdownToPDFConverter;
}());
exports.MarkdownToPDFConverter = MarkdownToPDFConverter;
// Export convenience function
function convertMarkdownToPDF(options) {
    return __awaiter(this, void 0, void 0, function () {
        var converter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    converter = new MarkdownToPDFConverter();
                    return [4 /*yield*/, converter.convert(options)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, converter.quit()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
