import OpenAI from 'openai';
import { execFileSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { on } from 'events';

export type LLMProvider = 'openai' | 'ollama' | 'apple';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  baseURL?: string;
  temperature?: number;
  maxTokens?: number;
  contextSize?: number;
  shortcutName?: string;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class LLMClient {
  private config: LLMConfig;
  private openaiClient?: OpenAI;

  constructor(config: LLMConfig) {
    this.config = {
      temperature: 0.7,
      maxTokens: 1000,
      contextSize: 4096,
      ...config,
    };

    if (this.config.provider === 'openai') {
      if (!this.config.apiKey) {
        throw new Error('API key is required for OpenAI');
      }
      this.openaiClient = new OpenAI({
        apiKey: this.config.apiKey,
      });
      this.config.model = this.config.model || 'gpt-4-turbo-preview';
    } else if (this.config.provider === 'ollama') {
      this.config.baseURL = this.config.baseURL || 'http://localhost:11434';
      this.config.model = this.config.model || 'llama2';
    } else if (this.config.provider === 'apple') {
      this.config.shortcutName = this.config.shortcutName || 'Ask AI';
    }
  }

  async chat(
    prompt: string,
    conversationHistory?: Message[]
  ): Promise<LLMResponse> {
    switch (this.config.provider) {
      case 'openai':
        return this.chatOpenAI(prompt, conversationHistory);
      case 'ollama':
        return this.chatOllama(prompt, conversationHistory);
      case 'apple':
        return this.chatApple(prompt, conversationHistory);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private async chatOpenAI(
    prompt: string,
    conversationHistory?: Message[]
  ): Promise<LLMResponse> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const messages: Message[] = conversationHistory
      ? [...conversationHistory, { role: 'user', content: prompt }]
      : [{ role: 'user', content: prompt }];

    const response = await this.openaiClient.chat.completions.create({
      model: this.config.model!,
      messages: messages as any,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    });

    return {
      content: response.choices[0].message.content || '',
      provider: 'openai',
      model: this.config.model!,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }

  private async chatOllama(
    prompt: string,
    conversationHistory?: Message[]
  ): Promise<LLMResponse> {
    const messages: Message[] = conversationHistory
      ? [...conversationHistory, { role: 'user', content: prompt }]
      : [{ role: 'user', content: prompt }];

    const response = await fetch(`${this.config.baseURL}/api/chat`, {
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
          num_ctx: this.config.contextSize,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json() as any;

    return {
      content: data.message.content,
      provider: 'ollama',
      model: this.config.model!,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
    };
  }

private async chatApple_2(
  prompt: string,
  conversationHistory?: Message[]
): Promise<LLMResponse> {
  let fullPrompt = prompt;
  if (conversationHistory && conversationHistory.length > 0) {
    const context = conversationHistory
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');
    fullPrompt = `${context}\nuser: ${prompt}`;
  }

  // Slice fullPrompt into chunks of 1400 chars
  const chunks: string[] = fullPrompt.match(/.{1,1400}/g) || [];
  let finalResult = '';
  console.log(`Apple LLM: Sending ${chunks.length} chunk(s) to shortcut`);
  console.log(`First chunk preview: ${chunks[0].slice(0, 100)}...`);

  try {
    for (const chunk of chunks) {
      // Use temp file for each chunk
      const tempFile = join(tmpdir(), `llm-prompt-${Date.now()}.txt`);

      
      try {
        // Write the CHUNK to the file, not fullPrompt
        writeFileSync(tempFile, chunk, 'utf-8');

        const script = `
          set inputFile to POSIX file "${tempFile}"
          tell application "Shortcuts Events"
            run shortcut "${this.config.shortcutName}" with input inputFile
          end tell
        `;

        // Fixed: Proper execSync syntax with parentheses
        //const result = execSync(`osascript -e '${script}'`, {
         // encoding: 'utf-8',
          //timeout: 60000,
        //});


        const result = execFileSync(
          "osascript",
          ["-e", script],
          {
            encoding: "utf-8",
            timeout: 60000,
            // shell: false is default for execFileSync, but leaving it implicit is fine
          }
        );

        finalResult += result + '\n';
        break; // Exit loop on success

      } finally {
        // Clean up temp file
        try {
          unlinkSync(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }

    return {
      content: finalResult.trim(),
      provider: 'apple',
      model: 'apple-intelligence',
    };
  } catch (error: any) {
    // Fixed: Proper throw syntax with parentheses
    throw new Error(`Apple Shortcut error: ${error.message}`);
  }
}


private async chatApple(
    prompt: string,
    conversationHistory?: Message[]
  ): Promise<LLMResponse> {
    let fullPrompt = prompt;
    if (conversationHistory && conversationHistory.length > 0) {
      const context = conversationHistory
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n');
      fullPrompt = `${context}\nuser: ${prompt}`;
    }

    // Use temp file to avoid AppleScript length limits
    const tempFile = join(tmpdir(), `llm-prompt-${Date.now()}.txt`);
    
    try {
      writeFileSync(tempFile, fullPrompt, 'utf-8');

      const script = `
        set inputFile to POSIX file "${tempFile}"
        tell application "Shortcuts Events"
          run shortcut "${this.config.shortcutName}" with input inputFile
        end tell
      `;

      const result = execFileSync(
          "osascript",
          ["-e", script],
          {
            encoding: "utf-8",
            timeout: 60000,
            // shell: false is default for execFileSync, but leaving it implicit is fine
          }
        );



      return {
        content: result.trim(),
        provider: 'apple',
        model: 'apple-intelligence',
      };
    } catch (error: any) {
      throw new Error(`Apple Shortcut error: ${error.message}`);
    } finally {
      // Clean up temp file
      try {
        unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
}

}


export function createLLMClient(config: LLMConfig): LLMClient {
  return new LLMClient(config);
}
