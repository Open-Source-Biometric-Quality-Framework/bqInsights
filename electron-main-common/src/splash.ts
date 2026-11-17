import { BrowserWindow } from "electron";

interface SplashConfig {
  preloadPath: string;
  splashHtmlPath: string;
}

let splashWindow: BrowserWindow | null = null;

export function createSplashWindow({
  preloadPath,
  splashHtmlPath
}: SplashConfig) {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 320,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    show: true,
    webPreferences: {
      contextIsolation: true,
      preload: preloadPath,
      nodeIntegration: false
    }
  });

  splashWindow.loadFile(splashHtmlPath);

  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

export function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}
