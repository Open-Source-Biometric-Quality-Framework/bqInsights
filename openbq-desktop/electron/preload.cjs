// electron/preload.cjs
const { contextBridge, ipcRenderer, webUtils} = require("electron");

contextBridge.exposeInMainWorld("electron", {
  isElectron: true,
  llm: {
    create: async (config) => {
      const { key } = await ipcRenderer.invoke("llm:create", config);
      return {
        chat: (prompt) => ipcRenderer.invoke("llm:chat", key, prompt),
      };
    },
  },
  'shell': {
    openExternal: (url) =>
      ipcRenderer.invoke('open-external', url),
  },
  'openbq': {
    analyze: (mode, inputPath, outputPath, engine,report) => 
      ipcRenderer.invoke('openbq:analyze', mode, inputPath, outputPath, engine, report),
    
    clearCache: (mode, inputPath, outputPath, engine) =>
      ipcRenderer.invoke('openbq:clearCache', mode, inputPath, outputPath, engine),
    
    benchmark: () => 
      ipcRenderer.invoke('openbq:benchmark'),
    
    ensureReady: () => 
      ipcRenderer.invoke('openbq:ensureReady'),
    
    onProgress: (callback) => {
      ipcRenderer.on('openbq:progress', (_, progress) => callback(progress));
      return () => ipcRenderer.removeAllListeners('openbq:progress');
    },
  },
  fs: {
    showSaveDialog: (options) => ipcRenderer.invoke("show-save-dialog", options),
    writeFile: (filePath, content) =>
      ipcRenderer.invoke("write-file", filePath, content),
    writeFileAbsolute: (filePath, content) =>
      ipcRenderer.invoke("write-file-absolute", filePath, content),
    deleteFileAbsolute: (filePath) =>
      ipcRenderer.invoke("delete-file-absolute", filePath),

    showOpenDialog: (options) => ipcRenderer.invoke("show-open-dialog", options),
    readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
    readFileBase64: (filePath) => ipcRenderer.invoke("read-file-base64", filePath),
    readImageBase64: (filePath, folderPath, options) => ipcRenderer.invoke("read-image-base64", filePath, folderPath, options),
    listFiles: (rootPath, limit) => ipcRenderer.invoke("list-files-recursive", rootPath, limit),
    readDir: (dirPath) => ipcRenderer.invoke("read-dir", dirPath),
    ensureDir: (dirPath) => ipcRenderer.invoke("ensure-dir", dirPath)
  },
  menu: {
    onOpen: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("menu:open", handler);
      return () => ipcRenderer.removeListener("menu:open", handler);
      // or: return () => ipcRenderer.off("menu:open", handler);
    },
    onClose: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("menu:close", handler);
      return () => ipcRenderer.removeListener("menu:close", handler);
    },
    onHelp: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("menu:help", handler);
      return () => ipcRenderer.removeListener("menu:help", handler);
    },
    onPrint: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("menu:print", handler);
      return () => ipcRenderer.removeListener("menu:print", handler);
    },
    onExportBundle: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("menu:exportBundle", handler);
      return () => ipcRenderer.removeListener("menu:exportBundle", handler);
    },
    onImportBundle: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("menu:importBundle", handler);
      return () => ipcRenderer.removeListener("menu:importBundle", handler);
    },
    onTestFeature: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("menu:testfeature", handler);
      return () => ipcRenderer.removeListener("menu:testfeature", handler);
    }
  },
  docx: {
    toHtml: (filePath) => ipcRenderer.invoke("docx:toHtml", filePath),
  },
  xlsx: {
    toJson:  (filePath) => ipcRenderer.invoke("xlsx:toJson", filePath),
  },
  csv: {
    toJson:  (filePath) => ipcRenderer.invoke("csv:toJson", filePath),
  },
  report: {
    savePdfDialog: (options) => ipcRenderer.invoke("report:savePdfDialog", options),
    convertMarkdownToPdf: (args) => ipcRenderer.invoke("report:convertMarkdownToPdf", args),
  },
  ollama: {
    startService: () => ipcRenderer.invoke("ollama:startService"),
    status: () => ipcRenderer.invoke("ollama:status"),
    pullModel: (model) => ipcRenderer.invoke("ollama:pullModel", model),
  },
  bundle: {
    exportAnalysisBundle: (payload) => ipcRenderer.invoke("analysis-bundle:export", payload),
    importAnalysisBundle: () => ipcRenderer.invoke("analysis-bundle:import"),
  },
  umap: {
    cacheResult: (key, data) => ipcRenderer.invoke("umap-cache:set", key, data),
    getCachedResult: (data, params) => ipcRenderer.invoke("umap-cache:get", data, params),
    clearCache: () => ipcRenderer.invoke("umap-cache:clear"),
  },
  cluster: {
    run: (payload) => ipcRenderer.invoke("cluster:run", payload),
    onProgress: (callback) => {
      const handler = (_event, message) => callback(message);
      ipcRenderer.on("cluster:progress", handler);
      return () => ipcRenderer.removeListener("cluster:progress", handler);
    },
  },
  dockerUmap: {
    run: (payload) => ipcRenderer.invoke("docker-umap:run", payload),
  },
  deepface: {
    analyzeImage: (payload) => ipcRenderer.invoke("deepface:analyzeImage", payload),
  },
  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
  getPath: (name) => ipcRenderer.invoke("app:getPath", name),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  handleDroppedPaths: (paths) => ipcRenderer.send("dropped-paths", paths),
  showNotification: (title, body) => ipcRenderer.invoke("show-notification", title, body),
});
