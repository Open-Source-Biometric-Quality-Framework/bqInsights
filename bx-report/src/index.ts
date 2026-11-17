// src/index.ts
import { BrowserWindow, app } from 'electron';
import { marked } from 'marked';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface PageOptions {
  landscape?: boolean;
  pageSize?: 'A3' | 'A4' | 'A5' | 'Legal' | 'Letter' | 'Tabloid' | { width: number; height: number };
  marginsType?: 0 | 1 | 2;
  margins?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  printBackground?: boolean;
  printSelectionOnly?: boolean;
  pageRanges?: string;
  scaleFactor?: number;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

export interface CoverOptions {
  htmlPath?: string;
  html?: string;
}

export interface HtmlToPDFOptions {
  html: string;
  outputPath: string;
  pageOptions?: PageOptions;
  css?: string;
}

export interface MarkdownToPDFOptions {
  markdownFiles: string | string[];
  outputPath: string;
  cover?: CoverOptions;
  pageOptions?: PageOptions;
  css?: string;
  cssPath?: string;
}

export class MarkdownToPDFConverter {
  private isAppReady: boolean = false;

  constructor() {
    if (app) {
      app.on('ready', () => {
        this.isAppReady = true;
      });
    }
  }

  private async ensureAppReady(): Promise<void> {
    if (this.isAppReady) return;
    
    if (app && !app.isReady()) {
      await app.whenReady();
    }
    this.isAppReady = true;
  }

  private async generatePDFFromHTML(html: string, options: PageOptions = {}): Promise<Buffer> {
    await this.ensureAppReady();

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const tmpFile = path.join(os.tmpdir(), `bx-report-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
    fs.writeFileSync(tmpFile, html, 'utf-8');
    await win.loadFile(tmpFile);

    // Wait for content to load and Mermaid to render
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore cleanup errors
    }

    const pdfOptions: any = {
      landscape: options.landscape ?? false,
      pageSize: options.pageSize ?? 'A4',
      printBackground: options.printBackground ?? true,
      printSelectionOnly: options.printSelectionOnly ?? false,
      scaleFactor: options.scaleFactor ?? 100,
      displayHeaderFooter: options.displayHeaderFooter ?? false,
      headerTemplate: options.headerTemplate ?? '',
      footerTemplate: options.footerTemplate ?? '',
    };

    // Only add margins if specified, otherwise use marginsType
    if (options.margins) {
      pdfOptions.margins = options.margins;
    } else {
      pdfOptions.marginsType = options.marginsType ?? 0;
    }

    if (options.pageRanges) {
      pdfOptions.pageRanges = options.pageRanges;
    }

    const data = await win.webContents.printToPDF(pdfOptions);
    win.close();

    return data;
  }

  private wrapHTMLWithStyles(content: string, css?: string): string {
    const defaultCSS = `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
      }
      h1, h2, h3, h4, h5, h6 {
        margin-top: 24px;
        margin-bottom: 16px;
        font-weight: 600;
        line-height: 1.25;
      }
      h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
      h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
      code {
        background-color: #f6f8fa;
        padding: 0.2em 0.4em;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
      }
      pre {
        background-color: #f6f8fa;
        padding: 16px;
        border-radius: 6px;
        overflow-x: auto;
      }
      pre code {
        background-color: transparent;
        padding: 0;
      }
      blockquote {
        border-left: 4px solid #dfe2e5;
        padding-left: 16px;
        color: #6a737d;
        margin-left: 0;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 16px 0;
      }
      table th, table td {
        border: 1px solid #dfe2e5;
        padding: 8px 12px;
      }
      table th {
        background-color: #f6f8fa;
        font-weight: 600;
      }
      img {
        max-width: 100%;
      }
      .page-break {
        page-break-after: always;
      }
      .cover-page {
        page-break-after: always;
      }
      .mermaid {
        display: flex;
        justify-content: center;
        margin: 20px 0;
      }
      @media print {
        body {
          max-width: 100%;
        }
      }
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${defaultCSS}
          ${css || ''}
        </style>
        <script type="module">
          import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.12.2/dist/mermaid.esm.min.mjs';
          mermaid.initialize({ 
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose'
          });
        </script>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;
  }

  async convert(options: MarkdownToPDFOptions): Promise<void> {
    await this.ensureAppReady();

    const markdownFiles = Array.isArray(options.markdownFiles) 
      ? options.markdownFiles 
      : [options.markdownFiles];

    // Load custom CSS if provided
    let customCSS = options.css || '';
    if (options.cssPath) {
      customCSS += fs.readFileSync(options.cssPath, 'utf-8');
    }

    // Build complete HTML document
    let fullHTML = '';

    // Add cover if provided
    if (options.cover) {
      if (options.cover.htmlPath) {
        const coverHTML = fs.readFileSync(options.cover.htmlPath, 'utf-8');
        // Extract body content from cover HTML if it's a full HTML document
        const bodyMatch = coverHTML.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch) {
          fullHTML += `<div class="cover-page">${bodyMatch[1]}</div>`;
        } else {
          fullHTML += `<div class="cover-page">${coverHTML}</div>`;
        }
      } else if (options.cover.html) {
        fullHTML += `<div class="cover-page">${options.cover.html}</div>`;
      }
    }

    // Convert and add all markdown files
    for (let i = 0; i < markdownFiles.length; i++) {
      const markdownFile = markdownFiles[i];
      const markdown = fs.readFileSync(markdownFile, 'utf-8');
      let htmlContent = marked.parse(markdown) as string;
      
      // Convert mermaid code blocks to mermaid divs
      htmlContent = htmlContent.replace(
        /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
        '<div class="mermaid">$1</div>'
      );
      
      // Add page break between files if multiple files (but not after the last one)
      if (i > 0) {
        fullHTML += '<div class="page-break"></div>';
      }
      fullHTML += htmlContent;
    }

    // Wrap everything with styles
    const wrappedHTML = this.wrapHTMLWithStyles(fullHTML, customCSS);

    // Generate single PDF
    const pdfBuffer = await this.generatePDFFromHTML(
      wrappedHTML,
      options.pageOptions
    );

    // Save PDF
    fs.writeFileSync(options.outputPath, pdfBuffer);
  }

  async convertHtmlString(options: HtmlToPDFOptions): Promise<void> {
    await this.ensureAppReady();

    const wrappedHTML = this.wrapHTMLWithStyles(options.html, options.css);

    const pdfBuffer = await this.generatePDFFromHTML(
      wrappedHTML,
      options.pageOptions
    );

    fs.writeFileSync(options.outputPath, pdfBuffer);
  }

  async quit(): Promise<void> {
    if (app) {
      app.quit();
    }
  }
}

// Export convenience function
export async function convertMarkdownToPDF(options: MarkdownToPDFOptions): Promise<void> {
  const converter = new MarkdownToPDFConverter();
  await converter.convert(options);
  await converter.quit();
}