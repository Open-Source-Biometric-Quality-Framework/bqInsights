import React from "react";
import TurndownService from "turndown";

interface CategoryItemProps {
  itemId: string;
  itemText: string;
  isNullCategory: boolean;
  checked: boolean;
  onToggle: (id: string) => void;
}

export const CategoryItem = React.memo(
  ({ itemId, itemText, isNullCategory, checked, onToggle }: CategoryItemProps) => {
    const [copied, setCopied] = React.useState(false);
    const [saved, setSaved] = React.useState(false);

    const handleCopy = React.useCallback(() => {
      if (!navigator?.clipboard) return;

      const blob = new Blob([itemText], { type: "text/html" });
      const data = [new ClipboardItem({ "text/html": blob })];

      navigator.clipboard.write(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }, [itemText]);

    const handleSave = React.useCallback(async () => {
      try {
        const { filePath } = await window.electron.fs.showSaveDialog({
          defaultPath: "content.md",
          filters: [
            { name: "Markdown Files", extensions: ["md"] },
            { name: "Text Files", extensions: ["txt"] },
            { name: "All Files", extensions: ["*"] },
          ],
        });

        if (!filePath) return;

        const turndownService = new TurndownService({ headingStyle: "atx" });
        const mdText = turndownService.turndown(itemText);

        await window.electron.fs.writeFile(filePath, mdText);

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (error) {
        console.error("Failed to save file:", error);
      }
    }, [itemText]);

    const ButtonGroup = React.useMemo(
      () => (
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            type="button"
            onClick={handleSave}
            title={saved ? "Saved!" : "Save to disk"}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            {saved ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy to clipboard"}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <rect x="3" y="3" width="13" height="13" rx="2" />
              </svg>
            )}
          </button>
        </div>
      ),
      [copied, saved, handleCopy, handleSave]
    );

    if (isNullCategory) {
      return (
        <div className="relative p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
          {ButtonGroup}
          <div className="pr-8" dangerouslySetInnerHTML={{ __html: itemText }} />
        </div>
      );
    }

    return (
      <div className="relative flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        {ButtonGroup}

   <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onToggle(itemId);
        }}
        tabIndex={-1}
        className="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-red-500"
      />
        <div className="flex-1 min-w-0 pr-8">
          <div
            className="text-gray-700 dark:text-gray-300"
            dangerouslySetInnerHTML={{ __html: itemText }}
          />
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.checked === next.checked &&
    prev.itemText === next.itemText &&
    prev.isNullCategory === next.isNullCategory
);