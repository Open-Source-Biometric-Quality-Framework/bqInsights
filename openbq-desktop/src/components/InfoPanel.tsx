import React from 'react';

interface InfoPanelProps {
    processing?: boolean;
    error_msg?: string | null;
    onCancel?: () => void;
    cancelLabel?: string;
    cancelDisabled?: boolean;
}

/**
 * Animated loading indicator component
 */
export const InfoPanel = React.memo<InfoPanelProps>(({
    processing = false,
    error_msg = null,
    onCancel,
    cancelLabel,
    cancelDisabled
}) => {
    return (
        <div className="logomain relative">
            <div className="logo-container flex flex-col items-center">
                {error_msg && (
                    <div className="error-overlay">
                        <div className="error-box">
                            <div className="error-title">Processing Error</div>
                            <div className="error-text">{error_msg}</div>
                        </div>
                    </div>
                )}
                <div className={`segments-container ${processing ? 'animated' : ''}`}>
                    <div className="segment"></div>
                    <div className="segment"></div>
                    <div className="segment"></div>
                    <div className="segment"></div>
                    <div className="segment"></div>
                    <div className="segment"></div>
                    <div className="segment"></div>
                    <div className="segment"></div>
                    <div className="segment"></div>
                    <div className="segment"></div>
                </div>
                <div className="inner-circle">
                    <div className="inner-circle-white">
                        <div className={`user-icon ${processing ? 'animated' : ''}`}>
                            <div className="user-head"></div>
                            <div className="user-body"></div>
                        </div>
                    </div>
                </div>
            </div>
            {onCancel && (
                <button
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-gray-900/80 px-4 py-2 text-xs font-medium text-white hover:bg-gray-900 disabled:cursor-wait disabled:opacity-70"
                    onClick={onCancel}
                    type="button"
                    disabled={cancelDisabled}
                >
                    {cancelLabel ?? 'Cancel'}
                </button>
            )}
        </div>
    );
});

InfoPanel.displayName = 'InfoPanel';
