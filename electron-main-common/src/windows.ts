import { BrowserWindow, Menu, app } from "electron";
import type { AppWindowConfig } from "./types.js";
import { closeSplashWindow } from "./splash.js";

export async function createMainWindow(config: AppWindowConfig) {
  const win = new BrowserWindow({
    width: 1100,
    height: 850,
    show: false,
    icon: config.iconPath,
    autoHideMenuBar: false,
    vibrancy: "under-window",
    webPreferences: {
      preload: config.preloadPath,
      contextIsolation: true
    }
  });

win.webContents.on("did-start-loading", () => {
  //  console.log("[main] did-start-loading");
  });

  win.webContents.on("did-finish-load", () => {
    //console.log("[main] did-finish-load");
    closeSplashWindow();
    win.show();
  });

  win.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error("[main] did-fail-load", code, desc);
  });


  if (!app.isPackaged && config.devUrl) {
    await win.loadURL(config.devUrl);
    if (config.showDevTools) {
      win.webContents.openDevTools();
    }
  } else {
    await win.loadFile(config.indexHtmlPath);
  }

  win.webContents.on("did-finish-load", () => {
    closeSplashWindow();
    win.show();
  });

  if (config.appMenu) {
    Menu.setApplicationMenu(Menu.buildFromTemplate(config.appMenu));
  }

  return win;
}
