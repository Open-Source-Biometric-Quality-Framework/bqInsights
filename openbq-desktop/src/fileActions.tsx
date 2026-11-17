// src/renderer/fileActions.ts


type OpenedFile =
  | { filePath: string; content: string | any[]; messages?: any }
  | undefined;

function makeUniqueHeaders(rawHeaders: any[]): string[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((value, i) => {
    const base = String(value ?? "").trim() || `Column${i + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

function sheetRowsToObjects(rows: any[]): any[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  if (rows.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
    return rows;
  }

  const headerRow = Array.isArray(rows[0]) ? rows[0] : [];
  const dataRows = rows.slice(1);

  const rawHeaders = headerRow.slice(1);
  let headers = makeUniqueHeaders(rawHeaders);

  const maxColumns = dataRows.reduce((max, row) => {
    if (!Array.isArray(row)) return max;
    return Math.max(max, row.length - 1);
  }, headers.length);

  if (maxColumns > headers.length) {
    const extra = Array.from({ length: maxColumns - headers.length }, (_, i) => `Column${headers.length + i + 1}`);
    headers = headers.concat(extra);
  }

  return dataRows
    .map((row) => {
      const values = Array.isArray(row) ? row.slice(1) : [];
      const obj: Record<string, any> = {};
      headers.forEach((header, idx) => {
        obj[header] = values[idx] ?? null;
      });
      return obj;
    })
    .filter((row) => {
      const values = Object.values(row);
      return values.some((v) => v !== null && v !== undefined && v !== "");
    });
}

// open directory
export async function openDirectory(): Promise<string> {
  const result = await window.electron.fs.showOpenDialog({
    title: "Open directory",
    properties: ["openDirectory"],
  });
   if (result.canceled || !result.filePaths?.length) return "";
   return result.filePaths[0];
}

export async function openDocxAsHtml(filePath?: string): Promise<OpenedFile> {
  // If no path provided, prompt
  if (!filePath) {
    const result = await window.electron.fs.showOpenDialog({
      title: "Open document",
      properties: ["openFile"],
      filters: [
        { name: "Word Document", extensions: ["docx", "xlsx","csv"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || !result.filePaths?.length) return;
    filePath = result.filePaths[0];
  }

  // Normalise case
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".docx")) {
    const { html, messages } = await window.electron.docx.toHtml(filePath);
    return { filePath, content: html, messages };
  }

  if (lower.endsWith(".xlsx")) {
    const { sheets } = await window.electron.xlsx.toJson(filePath);
    const firstSheet = Array.isArray(sheets) ? sheets[0] : undefined;
    const rows = sheetRowsToObjects(firstSheet?.rows ?? []);
    return { filePath, content: rows };
  }

  if (lower.endsWith(".csv")) {
    const { content } = await window.electron.csv.toJson(filePath);
    return { filePath, content };
  }

  // Optional: handle unsupported types gracefully
  throw new Error(`Unsupported file type: ${filePath}`);
}

export async function openTextFile() {
  const result = await window.electron.fs.showOpenDialog({
    title: "Open file",
    properties: ["openFile"],
    filters: [
      { name: "Text", extensions: ["docx", "csv"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePaths?.length) return;

  const filePath = result.filePaths[0];
  const { content } = await window.electron.fs.readFile(filePath);

  return {
    filePath,
    html,
  };
}

export async function exportPdfFromMarkdownFile(markdownPath: string) {
  const save = await window.electron.report.savePdfDialog({
    defaultPath: "report.pdf",
  });

  if (save.canceled || !save.filePath) return;

  await window.electron.report.convertMarkdownToPdf({
    markdownFiles: markdownPath,
    outputPath: save.filePath,
    pageOptions: {
      displayHeaderFooter: true,
      footerTemplate:
        '<div style="font-size:10px; text-align:center; width:100%; padding-top:5px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      marginsType: 0,
      printBackground: true,
    },
  });

  console.log("PDF written to:", save.filePath);
}
