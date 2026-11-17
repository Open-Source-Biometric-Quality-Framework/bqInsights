import { app, Menu, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "node:url";

if (app.isPackaged) {
  if (process.platform === 'darwin') {
    process.env.PATH = [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      process.env.PATH
    ].filter(Boolean).join(':');
  }

  if (process.platform === 'linux') {
    process.env.PATH = [
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      process.env.PATH
    ].filter(Boolean).join(':');
  }
}



// Catch all unhandled errors
process.on('uncaughtException', (error) => {
  console.log(`Uncaught Exception: ${error.message}\n${error.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log(`Unhandled Rejection at: ${promise}\nReason: ${reason}`);
});

console.log('App starting...');
console.log(`Platform: ${process.platform}`);
console.log(`Arch: ${process.arch}`);
console.log(`Electron: ${process.versions.electron}`);
console.log(`Node: ${process.versions.node}`);

import {
  runElectronApp,
  createSplashWindow,
  createMainWindow,
  createDefaultMenu
} from "@biometix/electron-main-common";

import { registerHandlers } from "./handlers.js";
import { registerReportBridge } from "./report-bridge.js";
import { registerOBQHandlers } from "./openbq-ipc.js";
import { registerUmapCacheHandlers } from "./umap-cache-handler.js";
import { registerClusteringHandlers } from "./clustering-ipc.js";
import { registerDockerUmapHandlers } from "./docker-umap-cluster.js";
import { registerDeepfaceHandlers } from "./deepface-ipc.js";

const __dirname = process.cwd();

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function appPath(...segments: string[]) {
  return path.join(app.getAppPath(), ...segments);
}

function devPath(...segments: string[]) {
  return path.join(__dirname, ".", ...segments);
}

const args = process.argv.slice(2); // Skip electron executable and script path

const debugMode = args.includes('--debug') || args.includes('-d');
const testMode = args.includes('--test') || args.includes('-t');


runElectronApp(
  () => {
    // IPC registration (app-specific)
    registerHandlers();
    registerReportBridge();
    registerOBQHandlers();
    registerUmapCacheHandlers();
    registerClusteringHandlers();
    registerDockerUmapHandlers();
    registerDeepfaceHandlers();
  },
  async () => {

    console.log("__dirname", __dirname);
    
    // App-specific paths
    const preloadPath = app.isPackaged
      ? appPath("electron-dist/preload.cjs")
      : devPath("electron/preload.cjs");

    const splashHtmlPath = app.isPackaged
      ? appPath("public/splash.html")
      : devPath("public/splash.html");

    const indexHtmlPath = app.isPackaged
      ? appPath("dist/index.html")
      : devPath("dist/index.html");

    const iconPath = app.isPackaged
      ? appPath("public/icon.png")
      : devPath("public/icon.png");



    // Splash first
    createSplashWindow({
      preloadPath,
      splashHtmlPath
    });


    
    app.commandLine.appendSwitch("ignore-gpu-blocklist")
    app.commandLine.appendSwitch("enable-gpu-rasterization")

    app.commandLine.appendSwitch('enable-logging');
    app.commandLine.appendSwitch('log-level', '0');
    app.commandLine.appendSwitch('vmodule', 'gpu*=2,angle*=2,gl*=2,viz*=2');

    app.commandLine.appendSwitch('use-gl', 'swiftshader');
    
  
    let waitime =  app.isPackaged ? 4000 : 2000
    await delay(waitime); // delay to allow splash screen to show


    const sendToRenderer = (channel: string) => {
      const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
      if (win) {
        win.webContents.send(channel);
      }
    };

    const menuTemplate = createDefaultMenu(sendToRenderer);
    const fileMenu = menuTemplate.find((item) => item.label === "File");
    if (fileMenu && Array.isArray(fileMenu.submenu)) {
      const quitIndex = fileMenu.submenu.findIndex((item: any) => item?.role === "quit");
      const insertIndex = quitIndex >= 0 ? quitIndex : fileMenu.submenu.length;
      fileMenu.submenu.splice(
        insertIndex,
        0,
        {
          label: "Export Analysis Bundle…",
          accelerator: "CmdOrCtrl+Shift+E",
          click: () => sendToRenderer("menu:exportBundle")
        },
        {
          label: "Import Analysis Bundle…",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => sendToRenderer("menu:importBundle")
        }
      );
    }
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

   

    // Main window
    const win = await createMainWindow({
      preloadPath,
      devUrl: "http://localhost:5173",
      indexHtmlPath,
      iconPath,
      showDevTools: !app.isPackaged || testMode,
   
    });

    // Then hide the visual bar on the window
    // win.setMenuBarVisibility(false);
    // win.setAutoHideMenuBar(true);

    process.on('unhandledRejection', (error) => {
        console.error('Unhandled rejection:', error);
    });

    win.webContents.on('did-finish-load', () => {
      win.webContents.executeJavaScript(`
        window.TEST_MODE = ${testMode};
       console.log('Test mode enabled');
      `);
  });
  }
);
