// In your main process (main.ts / electron main)
import { ipcMain } from 'electron';
import { BQATRunner, ensureReady, ProgressEvent } from '@biometix/openbq';


export function registerOBQHandlers() {
  // Register IPC handlers
  ipcMain.handle('openbq:analyze', async (event, mode, inputPath, outputPath, engine, generateReport) => {
    const runner = new BQATRunner();
    
    // Stream progress to renderer
    runner.on('progress', (progress: ProgressEvent) => {
      event.sender.send('openbq:progress', progress);
    });
    
    try {
      let result = await runner.run({
        mode,
        input: inputPath,
        output: outputPath,
        engine: engine != "nisqa" && engine != "NFIQ2" ? engine : undefined,
        report: generateReport
      });
      //console.log("csv result:", await result.loadCSVParsed());
      // TODO: resolve path issues
      return { success: true, summary: result.getSummary(), outputFiles: result.getAllPaths(), csvData: await result.loadCSVParsed() }; //
    } catch (error) {
      console.error("Analysis error:", error);
      return { success: false, error: error };
    }
  });

  ipcMain.handle('openbq:clearCache', async (event, mode, inputPath, outputPath, engine) => {
    const runner = new BQATRunner();
    const cacheDir = runner.getCacheDir(inputPath, {
      mode,
      input: inputPath,
      output: outputPath,
      engine: engine != "nisqa" && engine != "NFIQ2" ? engine : undefined,
    });
    if (cacheDir) {
      const fs = await import('fs');
      fs.rmSync(cacheDir, { recursive: true, force: true });
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle('openbq:benchmark', async (event) => {
    const runner = new BQATRunner();
    
    runner.on('progress', (progress: ProgressEvent) => {
      event.sender.send('openbq:progress', progress);
    });
    
    try {
      await runner.run({ benchmark: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: error };
    }
  });

  ipcMain.handle('openbq:ensureReady', async (event) => {
    try {
      await ensureReady(undefined, (message) => {
        event.sender.send('openbq:progress', {
          type: 'stdout',
          message,
          timestamp: new Date()
        });
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error };
    }
  });
}