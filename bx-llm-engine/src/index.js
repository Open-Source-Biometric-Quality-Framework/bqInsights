"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMClient = void 0;
exports.createLLMClient = createLLMClient;
var openai_1 = require("openai");
var child_process_1 = require("child_process");
var LLMClient = /** @class */ (function () {
    function LLMClient(config) {
        this.config = __assign({ temperature: 0.7, maxTokens: 1000 }, config);
        if (this.config.provider === 'openai') {
            if (!this.config.apiKey) {
                throw new Error('API key is required for OpenAI');
            }
            this.openaiClient = new openai_1.default({
                apiKey: this.config.apiKey,
            });
            this.config.model = this.config.model || 'gpt-4-turbo-preview';
        }
        else if (this.config.provider === 'ollama') {
            this.config.baseURL = this.config.baseURL || 'http://localhost:11434';
            this.config.model = this.config.model || 'llama2';
        }
        else if (this.config.provider === 'apple') {
            this.config.shortcutName = this.config.shortcutName || 'Ask AI';
        }
    }
    LLMClient.prototype.chat = function (prompt, conversationHistory) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (this.config.provider) {
                    case 'openai':
                        return [2 /*return*/, this.chatOpenAI(prompt, conversationHistory)];
                    case 'ollama':
                        return [2 /*return*/, this.chatOllama(prompt, conversationHistory)];
                    case 'apple':
                        return [2 /*return*/, this.chatApple(prompt, conversationHistory)];
                    default:
                        throw new Error("Unsupported provider: ".concat(this.config.provider));
                }
                return [2 /*return*/];
            });
        });
    };
    LLMClient.prototype.chatOpenAI = function (prompt, conversationHistory) {
        return __awaiter(this, void 0, void 0, function () {
            var messages, response;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!this.openaiClient) {
                            throw new Error('OpenAI client not initialized');
                        }
                        messages = conversationHistory
                            ? __spreadArray(__spreadArray([], conversationHistory, true), [{ role: 'user', content: prompt }], false) : [{ role: 'user', content: prompt }];
                        return [4 /*yield*/, this.openaiClient.chat.completions.create({
                                model: this.config.model,
                                messages: messages,
                                temperature: this.config.temperature,
                                max_tokens: this.config.maxTokens,
                            })];
                    case 1:
                        response = _d.sent();
                        return [2 /*return*/, {
                                content: response.choices[0].message.content || '',
                                provider: 'openai',
                                model: this.config.model,
                                usage: {
                                    promptTokens: ((_a = response.usage) === null || _a === void 0 ? void 0 : _a.prompt_tokens) || 0,
                                    completionTokens: ((_b = response.usage) === null || _b === void 0 ? void 0 : _b.completion_tokens) || 0,
                                    totalTokens: ((_c = response.usage) === null || _c === void 0 ? void 0 : _c.total_tokens) || 0,
                                },
                            }];
                }
            });
        });
    };
    LLMClient.prototype.chatOllama = function (prompt, conversationHistory) {
        return __awaiter(this, void 0, void 0, function () {
            var messages, response, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        messages = conversationHistory
                            ? __spreadArray(__spreadArray([], conversationHistory, true), [{ role: 'user', content: prompt }], false) : [{ role: 'user', content: prompt }];
                        return [4 /*yield*/, fetch("".concat(this.config.baseURL, "/api/chat"), {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    model: this.config.model,
                                    messages: messages,
                                    stream: false,
                                    options: {
                                        temperature: this.config.temperature,
                                        num_predict: this.config.maxTokens,
                                    },
                                }),
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Ollama API error: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        return [2 /*return*/, {
                                content: data.message.content,
                                provider: 'ollama',
                                model: this.config.model,
                                usage: {
                                    promptTokens: data.prompt_eval_count || 0,
                                    completionTokens: data.eval_count || 0,
                                    totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
                                },
                            }];
                }
            });
        });
    };
    LLMClient.prototype.chatApple = function (prompt, conversationHistory) {
        return __awaiter(this, void 0, void 0, function () {
            var fullPrompt, context, escapedPrompt, script, result;
            return __generator(this, function (_a) {
                fullPrompt = prompt;
                if (conversationHistory && conversationHistory.length > 0) {
                    context = conversationHistory
                        .map(function (msg) { return "".concat(msg.role, ": ").concat(msg.content); })
                        .join('\n');
                    fullPrompt = "".concat(context, "\nuser: ").concat(prompt);
                }
                escapedPrompt = fullPrompt
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"');
                script = "\n      tell application \"Shortcuts Events\"\n        run shortcut \"".concat(this.config.shortcutName, "\" with input \"").concat(escapedPrompt, "\"\n      end tell\n    ");
                try {
                    result = (0, child_process_1.execSync)("osascript -e '".concat(script, "'"), {
                        encoding: 'utf-8',
                        timeout: 60000, // 60 second timeout
                    });
                    return [2 /*return*/, {
                            content: result.trim(),
                            provider: 'apple',
                            model: 'apple-intelligence',
                        }];
                }
                catch (error) {
                    throw new Error("Apple Shortcut error: ".concat(error.message));
                }
                return [2 /*return*/];
            });
        });
    };
    return LLMClient;
}());
exports.LLMClient = LLMClient;
// Convenience factory function
function createLLMClient(config) {
    return new LLMClient(config);
}
