import { app } from "electron";

export async function runElectronApp(
  initIpc: () => void,
  createWindows: () => Promise<void> | void
) {
  initIpc();

  await app.whenReady();

  await createWindows();
}
