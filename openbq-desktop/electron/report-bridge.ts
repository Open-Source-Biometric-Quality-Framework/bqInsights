// electron/report-bridge.ts (main process)
import { ipcMain, BrowserWindow, dialog } from "electron";
import path from "path";
import { MarkdownToPDFConverter } from "@biometix/bx-report";

type ConvertArgs = {
  markdownFiles?: string | string[];
  html?: string;
  outputPath: string;
  css?: string;
  cover?: {
    htmlPath?: string;
    html?: string;
    pageOptions?: Record<string, any>;
  };
  pageOptions?: Record<string, any>;
};

let converter: MarkdownToPDFConverter | null = null;

function getConverter() {
  if (!converter) converter = new MarkdownToPDFConverter();
  return converter;
}

export function registerReportBridge() {
  ipcMain.handle("report:savePdfDialog", async (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error("No window found");
    
    const result = await dialog.showSaveDialog(win, {
      title: "Save PDF",
      defaultPath: path.join(process.cwd(), "report.pdf"),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      ...options,
    });
    
    // Return the filePath if user didn't cancel
    if (result.canceled) {
      return { canceled: true, filePath: null };
    }
    
    return { canceled: false, filePath: result.filePath };
  });

  ipcMain.handle("report:convertMarkdownToPdf", async (_event, args: ConvertArgs) => {
    if (!args?.outputPath) throw new Error("outputPath is required");

    const conv = getConverter();

    // Support inline HTML strings (for PDF export feature)
    if (args.html) {
      await conv.convertHtmlString({
        html: args.html!,
        outputPath: args.outputPath,
        pageOptions: args.pageOptions,
        css: args.css,
      });
      return { success: true, outputPath: args.outputPath };
    }

    // Original file-based path (backward compatible)
    if (!args?.markdownFiles) throw new Error("Either markdownFiles or html is required");

    const markdownFiles = args.markdownFiles;

    await conv.convert({
      markdownFiles,
      outputPath: args.outputPath,
      css: args.css,
      cover: args.cover,
      pageOptions: args.pageOptions,
    });

    return { success: true, outputPath: args.outputPath };
  });
}