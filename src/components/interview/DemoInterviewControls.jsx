import { Mic, StopCircle, Check, RotateCcw, AlertTriangle } from 'lucide-react';

export default function DemoInterviewControls({ highlightTarget }) {
  const isTarget = (id) => highlightTarget === id;

  const highlightClass =
    'ring-4 ring-indigo-500 ring-offset-4 ring-offset-[#0d1117] animate-pulse shadow-[0_0_30px_rgba(99,102,241,0.5)]';

  return (
    <div className="space-y-6 opacity-90 pointer-events-none select-none">
      {/* Warning Banner */}
      <div
        className={`p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center gap-2 ${isTarget('warning-banner') ? highlightClass : ''}`}
      >
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
          Tab switch detected
        </span>
      </div>

      {/* Question Card */}
      <div
        className={`p-6 rounded-2xl bg-white/5 border border-white/10 ${isTarget('question-card') ? highlightClass : ''}`}
      >
        <p className="text-white text-lg font-medium">How do you handle tight deadlines?</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          className={`w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center ${isTarget('start-answer-button') ? highlightClass : ''}`}
        >
          <Mic className="w-6 h-6 text-white" />
        </button>
        <button
          className={`px-6 py-3 rounded-2xl bg-red-500 text-white font-bold flex items-center gap-2 ${isTarget('finish-answer-button') ? highlightClass : ''}`}
        >
          <StopCircle className="w-4 h-4" /> Finish Answer
        </button>
      </div>

      {/* Transcript Review */}
      <div
        className={`p-6 rounded-2xl bg-white/5 border border-white/10 text-center space-y-4 ${isTarget('transcript-box') ? highlightClass : ''}`}
      >
        <p className="text-slate-300">"I usually prioritize tasks and communicate..."</p>
        <div className="flex justify-center gap-3">
          <button
            className={`px-4 py-2 rounded-xl bg-white/10 text-slate-300 font-bold flex items-center gap-2 text-xs ${isTarget('confirm-answer-button') ? highlightClass : ''}`}
          >
            <RotateCcw className="w-3 h-3" /> Record Again
          </button>
          <button
            className={`px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-2 text-xs ${isTarget('confirm-answer-button') ? highlightClass : ''}`}
          >
            <Check className="w-3 h-3" /> Confirm Answer
          </button>
        </div>
      </div>
    </div>
  );
}
