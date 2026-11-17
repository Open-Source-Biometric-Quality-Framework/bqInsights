interface IntroPaneProps {
  activeInstructions?: string;
  adhocText?: string;
  onAdhocTextChange?: (text: string) => void;
  onError?: (error: string) => void;
}

export const IntroPane = ({
  activeInstructions,
  adhocText,
  onAdhocTextChange,
  onError,
}: IntroPaneProps) => {
  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    onError?.("");
    onAdhocTextChange?.(e.target.value);
  };

  return (
    <div
     
    >
      <div className="pl-5 pr-5">
        <div className="mt-10" />
        <div>
          <div className="rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-8">
            <div className="text-sm text-gray-700 dark:text-gray-200">
              <p className="leading-relaxed">
                Use Menu <b>File/Open</b>, <b>Drag</b> a file or <b>Paste</b> an extract to start.
              </p>
              <div className="mt-4">
                {activeInstructions ? (
                  <>
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Active focus instructions
                    </div>
                    <div className="mt-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-4">
                      <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-800 dark:text-gray-100 font-mono">
                        {activeInstructions}
                      </pre>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      This will be applied to the next analysis run.<br /><br /><i>To set or change, open the </i>settings<i> on the top toolbar.</i>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                    <span className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                    No focus instructions set.
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="pt-8 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Adhoc focus instructions
              </div>
              <div className='pt-2'>
                <textarea
                  value={adhocText}
                  onBlur={handleBlur}
                  onChange={(e) => onAdhocTextChange?.(e.target.value)}
                  className="w-full min-h-[120px] px-3 py-2 text-sm rounded-lg
                    bg-white/70 dark:bg-white/5
                    border border-black/10 dark:border-white/10
                    focus:outline-none focus:ring-2 focus:ring-[#0a84ff]/40"
                  placeholder="Additional instructions provided here will be supplied to as part of AI context."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};