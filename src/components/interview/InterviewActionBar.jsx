import React from 'react';
import { Bot, Mic, Square, RotateCcw, Loader2 } from 'lucide-react';

/**
 * InterviewActionBar Component
 * A sticky/fixed bottom action bar for interview controls.
 *
 * @param {string} state - The current interview state ('ready', 'recording', 'processing')
 * @param {function} onStart - Action when starting answer
 * @param {function} onStop - Action when stopping/finishing answer
 * @param {function} onReplay - Action when replaying question
 * @param {function} onRestart - Action when recording again
 */
const InterviewActionBar = ({
  state = 'ready',
  onStart,
  onStop,
  onReplay,
  onRestart,
  onConfirm,
}) => {
  return (
    <div className="w-full py-2 px-6 border-t border-white/10 bg-[#050711]/95 backdrop-blur-xl shrink-0 flex items-center">
      <div className="max-w-5xl mx-auto w-full flex items-center justify-center gap-3">
        {(state === 'ready' || state === 'speaking') && (
          <>
            <button
              onClick={onStart}
              disabled={state === 'speaking'}
              className="w-full sm:w-[220px] h-10 lg:h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-white/10"
            >
              <Mic className="w-4 h-4" /> Start Answer Now
            </button>
            <button
              onClick={onReplay}
              className="w-full sm:w-[190px] h-10 lg:h-11 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-[13px] flex items-center justify-center gap-2 transition-all border border-white/10"
            >
              <Bot className="w-4 h-4" /> Replay Question
            </button>
          </>
        )}

        {state === 'recording' && (
          <>
            <button
              onClick={onStop}
              className="w-full sm:w-[220px] h-10 lg:h-11 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-white/10"
            >
              <Square className="w-4 h-4 fill-current" /> Finish Answer
            </button>
            <button
              onClick={onRestart}
              className="w-full sm:w-[190px] h-10 lg:h-11 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-[13px] flex items-center justify-center gap-2 transition-all border border-white/10"
            >
              <RotateCcw className="w-4 h-4" /> Record Again
            </button>
          </>
        )}

        {state === 'transcript' && (
          <>
            <button
              onClick={onConfirm}
              className="w-full sm:w-[220px] h-10 lg:h-11 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-white/10"
            >
              Confirm & Continue
            </button>
            <button
              onClick={onRestart}
              className="w-full sm:w-[190px] h-10 lg:h-11 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold text-[13px] flex items-center justify-center gap-2 transition-all border border-white/10"
            >
              <RotateCcw className="w-4 h-4" /> Record Again
            </button>
          </>
        )}

        {state === 'processing' && (
          <div className="w-full sm:w-auto px-8 h-10 lg:h-11 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span className="font-semibold text-[12px]">Processing response...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewActionBar;
