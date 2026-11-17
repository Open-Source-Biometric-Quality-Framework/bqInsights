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
var index_js_1 = require("../src/index.js");
var TEST_CONFIG = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY || 'your-openai-key',
        model: 'gpt-3.5-turbo',
    },
    ollama: {
        baseURL: 'http://localhost:11434',
        model: 'llama2',
    },
    apple: {
        shortcutName: 'Ask AI',
    },
};
function log(message) {
    console.log("\n".concat('='.repeat(50)));
    console.log(message);
    console.log('='.repeat(50));
}
function runTests() {
    return __awaiter(this, void 0, void 0, function () {
        var openaiClient, response, error_1, openaiClient, history_1, response, error_2, ollamaClient, response, error_3, appleClient, response, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🚀 Starting LLM Client Tests\n');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    log('TEST 1: OpenAI Basic Chat');
                    openaiClient = (0, index_js_1.createLLMClient)({
                        provider: 'openai',
                        apiKey: TEST_CONFIG.openai.apiKey,
                        model: TEST_CONFIG.openai.model,
                        temperature: 0.7,
                        maxTokens: 100,
                    });
                    return [4 /*yield*/, openaiClient.chat('What is 2+2? Answer briefly.')];
                case 2:
                    response = _a.sent();
                    console.log('✅ OpenAI Response:', response.content);
                    console.log('Model:', response.model);
                    console.log('Usage:', response.usage);
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error('❌ OpenAI test failed:', error_1.message);
                    return [3 /*break*/, 4];
                case 4:
                    _a.trys.push([4, 6, , 7]);
                    log('TEST 2: OpenAI with Conversation History');
                    openaiClient = (0, index_js_1.createLLMClient)({
                        provider: 'openai',
                        apiKey: TEST_CONFIG.openai.apiKey,
                        model: TEST_CONFIG.openai.model,
                    });
                    history_1 = [
                        { role: 'user', content: 'My name is Alice.' },
                        { role: 'assistant', content: 'Hello Alice! Nice to meet you.' },
                    ];
                    return [4 /*yield*/, openaiClient.chat('What is my name?', history_1)];
                case 5:
                    response = _a.sent();
                    console.log('✅ OpenAI with History Response:', response.content);
                    return [3 /*break*/, 7];
                case 6:
                    error_2 = _a.sent();
                    console.error('❌ OpenAI history test failed:', error_2.message);
                    return [3 /*break*/, 7];
                case 7:
                    _a.trys.push([7, 9, , 10]);
                    log('TEST 3: Ollama Basic Chat');
                    ollamaClient = (0, index_js_1.createLLMClient)({
                        provider: 'ollama',
                        baseURL: TEST_CONFIG.ollama.baseURL,
                        model: TEST_CONFIG.ollama.model,
                        temperature: 0.7,
                        maxTokens: 100,
                    });
                    return [4 /*yield*/, ollamaClient.chat('What is the capital of France? Answer briefly.')];
                case 8:
                    response = _a.sent();
                    console.log('✅ Ollama Response:', response.content);
                    console.log('Model:', response.model);
                    console.log('Usage:', response.usage);
                    return [3 /*break*/, 10];
                case 9:
                    error_3 = _a.sent();
                    console.error('❌ Ollama test failed:', error_3.message);
                    console.error('Make sure Ollama is running and the model is pulled');
                    return [3 /*break*/, 10];
                case 10:
                    _a.trys.push([10, 12, , 13]);
                    log('TEST 4: Apple Intelligence via Shortcut');
                    appleClient = (0, index_js_1.createLLMClient)({
                        provider: 'apple',
                        shortcutName: TEST_CONFIG.apple.shortcutName,
                    });
                    return [4 /*yield*/, appleClient.chat('Tell me a fun fact in one sentence.')];
                case 11:
                    response = _a.sent();
                    console.log('✅ Apple Intelligence Response:', response.content);
                    console.log('Model:', response.model);
                    return [3 /*break*/, 13];
                case 12:
                    error_4 = _a.sent();
                    console.error('❌ Apple test failed:', error_4.message);
                    console.error('Make sure you have a Shortcut named "Ask AI"');
                    return [3 /*break*/, 13];
                case 13:
                    console.log('\n✨ Tests completed!\n');
                    return [2 /*return*/];
            }
        });
    });
}
runTests().catch(console.error);
