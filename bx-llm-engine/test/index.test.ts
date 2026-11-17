import { createLLMClient, Message } from '../src/index.js';

const TEST_CONFIG = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'your-openai-key',
    model: 'gpt-3.5-turbo',
  },
  ollama: {
    baseURL: 'http://localhost:11434',
    model: 'gpt-oss:20b',
  },
  apple: {
    shortcutName: 'Ask AI',
  },
};

function log(message: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(message);
  console.log('='.repeat(50));
}

async function runTests() {
  console.log('🚀 Starting LLM Client Tests\n');
/*
  try {
    log('TEST 1: OpenAI Basic Chat');
    const openaiClient = createLLMClient({
      provider: 'openai',
      apiKey: TEST_CONFIG.openai.apiKey,
      model: TEST_CONFIG.openai.model,
      temperature: 0.7,
      maxTokens: 100,
    });

    const response = await openaiClient.chat('What is 2+2? Answer briefly.');
    console.log('✅ OpenAI Response:', response.content);
    console.log('Model:', response.model);
    console.log('Usage:', response.usage);
  } catch (error: any) {
    console.error('❌ OpenAI test failed:', error.message);
  }

  try {
    log('TEST 2: OpenAI with Conversation History');
    const openaiClient = createLLMClient({
      provider: 'openai',
      apiKey: TEST_CONFIG.openai.apiKey,
      model: TEST_CONFIG.openai.model,
    });

    const history: Message[] = [
      { role: 'user', content: 'My name is Alice.' },
      { role: 'assistant', content: 'Hello Alice! Nice to meet you.' },
    ];

    const response = await openaiClient.chat('What is my name?', history);
    console.log('✅ OpenAI with History Response:', response.content);
  } catch (error: any) {
    console.error('❌ OpenAI history test failed:', error.message);
  }
*/
  try {
    log('TEST 3: Ollama Basic Chat');
    const ollamaClient = createLLMClient({
      provider: 'ollama',
      baseURL: TEST_CONFIG.ollama.baseURL,
      model: TEST_CONFIG.ollama.model,
      temperature: 0.7,
      maxTokens: 100,
    });

    const response = await ollamaClient.chat('Tell me two fun facts.');
    console.log('✅ Ollama Response:', response.content);
    console.log('Model:', response.model);
    console.log('Usage:', response.usage);
  } catch (error: any) {
    console.error('❌ Ollama test failed:', error.message);
    console.error('Make sure Ollama is running and the model is pulled');
  }

  try {
    log('TEST 4: Apple Intelligence via Shortcut');
    const appleClient = createLLMClient({
      provider: 'apple',
      shortcutName: TEST_CONFIG.apple.shortcutName,
    });

    const response = await appleClient.chat('Tell me two fun facts.');
    console.log('✅ Apple Intelligence Response:', response.content);
    console.log('Model:', response.model);
  } catch (error: any) {
    console.error('❌ Apple test failed:', error.message);
    console.error('Make sure you have a Shortcut named "Ask AI"');
  }

  console.log('\n✨ Tests completed!\n');
}

runTests().catch(console.error);
