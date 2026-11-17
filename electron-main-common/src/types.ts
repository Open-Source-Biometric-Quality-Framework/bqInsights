import type { MenuItemConstructorOptions } from "electron";

export interface AppWindowConfig {
  devUrl?: string;
  preloadPath: string;
  indexHtmlPath: string;
  splashHtmlPath?: string;
  iconPath?: string;
  appMenu?: MenuItemConstructorOptions[];
  showDevTools?: boolean;
}
