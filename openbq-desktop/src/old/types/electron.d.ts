export {};

declare global {
  interface Window {
    electron: {
      isElectron: boolean;
      llm: {
        create: (config: any) => Promise<{ chat: (prompt: string) => Promise<any> }>;
      };
      fs: {
        showSaveDialog: (options: any) => Promise<any>;
        writeFile: (filePath: string, content: string) => Promise<{ success: boolean }>;
        showOpenDialog: (options: any) => Promise<any>;
        readFile: (filePath: string) => Promise<{ success: boolean; content: string }>;
      };
    };
  }
}