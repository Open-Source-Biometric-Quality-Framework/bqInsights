import React, { ReactNode, useEffect, useState } from 'react';
import { FileText, FingerprintPattern, HelpCircle, SettingsIcon, SplitSquareHorizontalIcon } from 'lucide-react';

interface TopBarProps extends AppInfo {
  Settings?: ReactNode;
  Help?: ReactNode;
  DetailPane?: ReactNode;
  settingsOpen?: boolean;
  helpOpen?: boolean;
  detailPaneOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  onHelpOpenChange?: (open: boolean) => void;
  onDetailPaneOpenChange?: (open: boolean) => void;
}



export const TopBar = ({
  icon,
  name,
  Settings,
  Help,
  DetailPane,
  settingsOpen = false,
  helpOpen = false,
  detailPaneOpen = false,
  onSettingsOpenChange,
  onHelpOpenChange,
  onDetailPaneOpenChange,
}: TopBarProps) => {

  const [logoSrc, setLogoSrc] = useState<string>("");
const [appInfo, setAppInfo] = useState<any>(null);

useEffect(() => {
  async function fetchAppInfo() {
    try {
      const info = await window.electron.getAppInfo();
      setAppInfo(info);
    } catch {
      setAppInfo({ name: "openbq desktop", version: "0.x" });
    }
  }

  fetchAppInfo();
}, []);

useEffect(() => {
  if (!appInfo?.logofile) return;

  let cancelled = false;

  const loadLogo = async () => {
    try {
      console.log("LOGO",appInfo.logofile)
      const { success, base64 } =
        await window.electron.fs.readImageBase64(
          appInfo.logofile,
          "",
          { maxWidth: 600 }
        );

      if (!cancelled && success && base64) {
        setLogoSrc(`data:image/png;base64,${base64}`);
      }
    } catch (err) {
      console.error("Failed to load logo:", err);
    }
  };

  loadLogo();

  return () => {
    cancelled = true;
  };
}, [appInfo?.logofile]);   // ← THIS must exist

  return (
    <div className="fixed top-0 inset-x-0 z-20 h-14
            bg-gradient-to-b light:from-gray-100/90 light:to-gray-200/70 dark:from-gray-800/90 dark:to-gray-900/70
            backdrop-blur
            border-b border-black/20">
      <div className="mx-auto h-full px-6 flex items-center">
        
         <img
              src={logoSrc}
              alt={name}
              className="h-13 tp-5 pt-1 w-auto ml-0"
              draggable={false}
            />
            - Desktop (Beta)
      

        <div className="ml-auto flex items-center gap-3">
          {/*}  <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm font-medium
                        bg-white/70 dark:bg-black/30 hover:bg-black/5 dark:hover:bg-white/5
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                        ${detailPaneOpen ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => onDetailPaneOpenChange?.(!detailPaneOpen)}
            >
            <SplitSquareHorizontalIcon className="w-5 h-5" />
            </button> */}
          <button
            type="button"
            aria-controls="settings-panel"
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                 onClick={() => onSettingsOpenChange?.(!settingsOpen)}
          >
            <SettingsIcon className="w-5 h-5" />
            {settingsOpen && Settings}
          </button>
          <button
            type="button"
            aria-controls="help-panel"
            className="inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm font-medium dark:text-white
                       bg-white/70 dark:bg-black/30 hover:bg-black/5 dark:hover:bg-white/5
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => onHelpOpenChange?.(!helpOpen)}
          >
            <HelpCircle className="w-5 h-5" />
            {helpOpen && Help}
          </button>
        </div>
      </div>
    </div>
  );
};