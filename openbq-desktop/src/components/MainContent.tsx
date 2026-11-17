import React from 'react';
import { InfoPanel } from './InfoPanel';
import { OpenBQAnalyzer } from './OpenBQAnalyzer';
import type { AppInfo, AnalysisParams } from '../types';

interface MainContentProps {
  appInfo: AppInfo | null;
  startProcessing: boolean;
  processingComplete: boolean;
  openError?: string | null;
  selectedPath: string;
  analysisParams: AnalysisParams;
  rowsInput: any[]; // a new prop to receive the rows data if not using the OpenBQAnalyzer's internal file reading
  analysisKey: number; // a key to force remounting the OpenBQAnalyzer when rowsInput changes
  opening: boolean;
  isCancelling: boolean;
  onCancel: () => void;
  onSelection: (selection: any, folder: string) => void;
  onProcessingComplete: (data?: any) => void;
  onLogUpdate: (logs: string[]) => void;
}

/**
 * Main content area component
 */
export const MainContent: React.FC<MainContentProps> = ({
  appInfo,
  startProcessing,
  processingComplete,
  openError,
  selectedPath,
  analysisParams,
  rowsInput,
  analysisKey,
  opening,
  isCancelling,
  onCancel,
  onSelection,
  onProcessingComplete,
  onLogUpdate,
}) => {
  const showInfoPanel = (!startProcessing && !processingComplete) || opening;

  
  return (
    <div className="
      lg:col-start-3 min-w-0 overflow-y-auto
      h-[calc(100vh-3rem)]
      bg-gradient-to-b
      from-gray-50/40 to-gray-300/40
      dark:from-gray-900/60 dark:to-gray-800/40
    ">
      <div>
        {/* Docker Status Warnings */}
        {!appInfo?.docker?.installed && (
          <div className="text-center pt-25">
            Docker is not installed. Docker must be running to continue.
          </div>
        )}
        {!appInfo?.docker?.running && (
          <div className="text-center pt-25">
            Docker is not running, please check it is working and restart.
          </div>
        )}

        {/* Info Panel */}
        {showInfoPanel && (
          <InfoPanel
            processing={startProcessing || opening}
            error_msg={openError ?? undefined}
            onCancel={startProcessing || isCancelling ? onCancel : undefined}
            cancelLabel={isCancelling ? 'Canceling, please wait ...' : 'Cancel'}
            cancelDisabled={isCancelling}
          />
        )}

        {/* Analysis Component */}
        {startProcessing && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <OpenBQAnalyzer
              directory={selectedPath}
              onSelection={onSelection}
              onProcessingComplete={onProcessingComplete}
              analysisParams={analysisParams}
              key={analysisKey}  
              opening={opening}
              isCancelling={isCancelling}
              onCancel={onCancel}
              onLogUpdate={onLogUpdate}
              customLogPanel={false}
              rowsInput={rowsInput} // pass the rows data to the OpenBQAnalyzer
            />
          </div>
        )}
      </div>
    </div>
  );
};
