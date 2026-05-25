import React from 'react';

export default function CandidateInterviewShell({
  header,
  warning,
  questionCard,
  contentHeader,
  children,
  contentFooter,
  bottomBar,
}) {
  return (
    <div className="h-[100dvh] w-full bg-[#080c18] flex flex-col font-sans text-slate-200 overflow-hidden selection:bg-indigo-500/30">
      {/* 1. Header Slot */}
      {header && (
        <div className="shrink-0 z-50 border-b border-white/5 bg-[#0a0e1a]/80 backdrop-blur-2xl">
          {header}
        </div>
      )}

      {/* 2. Warning Banner Slot */}
      {warning && <div className="shrink-0 z-40">{warning}</div>}

      {/* 3. Main Content Slot */}
      <main className="flex-1 overflow-hidden flex flex-col w-full relative">
        {/* Glow effect in background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-4xl mx-auto h-full flex flex-col p-2 sm:p-6 gap-3 sm:gap-6 overflow-hidden relative z-10">
          {questionCard && <div className="shrink-0 z-20">{questionCard}</div>}

          <div className="flex-1 flex flex-col relative w-full overflow-hidden min-h-0">
            {contentHeader && (
              <div className="shrink-0 px-4 sm:px-6 py-3 flex items-center justify-between z-10">
                {contentHeader}
              </div>
            )}

            {/* Fixed interior layout - vertically centered content via my-auto */}
            <div className="flex-1 flex flex-col items-center relative p-2 sm:p-4 overflow-hidden">
              <div className="my-auto w-full flex flex-col items-center max-w-full">{children}</div>
            </div>

            {contentFooter && (
              <div className="shrink-0 px-4 py-2 text-center z-10">{contentFooter}</div>
            )}
          </div>
        </div>
      </main>

      {/* Global Bottom Bar */}
      {bottomBar && <div className="shrink-0 z-20">{bottomBar}</div>}
    </div>
  );
}
