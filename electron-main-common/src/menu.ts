import { app } from "electron";
import type { MenuItemConstructorOptions } from "electron";

export function createDefaultMenu(
  sendToRenderer: (channel: string) => void
): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [{
          label: app.name,
          submenu: [
            { role: "about" as const },
            { type: "separator" as const },
            { role: "quit" as const }
          ]
        }]
      : []),

    {
      label: "File",
      submenu: [
        {
          label: "Open…",
          accelerator: "CmdOrCtrl+O",
          click: () => sendToRenderer("menu:open")
        },
        {
          label: "Close",
          accelerator: "CmdOrCtrl+W",
          click: () => sendToRenderer("menu:close")
        },
        {
          label: "Print..",
          accelerator: "CmdOrCtrl+P",
          click: () => sendToRenderer("menu:print")
        },
        { type: "separator" as const },
        { role: "quit" as const }
      ]
    },

    { role: "editMenu" as const },
    { role: "viewMenu" as const },
    { role: "windowMenu" as const },

    {
      label: "Help",
      submenu: [
        {
          label: "Docs and FAQ",
          click: () => sendToRenderer("menu:help")
        }
      ]
    }
  ];

  return template;
}
