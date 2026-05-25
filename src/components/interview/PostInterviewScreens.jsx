import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Send,
  Edit3,
  Clock,
  ShieldCheck,
  ExternalLink,
  XCircle,
  Loader2,
  Sparkles,
  Trophy,
} from 'lucide-react';

export const FinalReview = ({ questions, answers, tabSwitches, onJumpToQuestion, onSubmit }) => {
  const answerCount = Object.keys(answers).length;
  const totalCount = questions.length;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row gap-8 py-4 animate-fade-in items-start">
      {/* Left Column: Summary & Actions */}
      <div className="w-full lg:w-[320px] shrink-0 space-y-4 sticky top-0">
        <div className="p-6 rounded-2xl bg-[#0D1117] border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-all duration-700" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 mb-4">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">
                Final Verification
              </span>
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight mb-2">Review Summary</h2>
            <p className="text-slate-500 text-xs leading-relaxed mb-6">
              Confirm your responses before finalizing your submission to HR.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-center">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Completion
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-white">{answerCount}</span>
                  <span className="text-[10px] font-bold text-slate-600">/ {totalCount}</span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-center">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Integrity
                </span>
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-xl font-black ${tabSwitches > 2 ? 'text-amber-400' : 'text-emerald-400'}`}
                  >
                    {tabSwitches}
                  </span>
                  <span className="text-[10px] font-bold text-slate-600">Alerts</span>
                </div>
              </div>
            </div>

            <button
              onClick={onSubmit}
              className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.15em] text-[10px] flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-indigo-900/40 border-b-2 border-indigo-800"
            >
              <Send className="w-3.5 h-3.5" /> Submit Interview
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Responses List */}
      <div className="flex-1 w-full space-y-4">
        <div className="flex items-center justify-between px-2 mb-2">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
            Response Inventory
          </h3>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
            <Clock className="w-3 h-3" /> Auto-saved
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto custom-scrollbar lg:max-h-[calc(100vh-180px)] pr-2 pb-8">
          {questions.map((q, i) => (
            <div
              key={i}
              className={`p-5 rounded-2xl border transition-all duration-300 group cursor-pointer ${
                answers[i]
                  ? 'bg-white/[0.02] border-white/5 hover:border-white/10'
                  : 'bg-red-500/5 border-red-500/10 hover:border-red-500/20'
              }`}
              onClick={() => onJumpToQuestion(i)}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex gap-4">
                  <div
                    className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-xs font-black border transition-colors ${
                      answers[i]
                        ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors leading-snug">
                    {q}
                  </h4>
                </div>
                <div className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-slate-500 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-all">
                  <Edit3 className="w-3.5 h-3.5" />
                </div>
              </div>

              {answers[i] ? (
                <div className="p-4 rounded-xl bg-[#060810]/60 border border-white/5 italic text-slate-400 text-[13px] leading-relaxed relative">
                  <span className="absolute top-2 left-2 text-indigo-500/20 text-2xl font-serif">
                    "
                  </span>
                  <p className="line-clamp-3 pl-4 pr-2">{answers[i]}</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-500/70 text-[10px] font-bold uppercase tracking-widest pl-12">
                  <AlertTriangle className="w-3 h-3" />
                  No response recorded
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const SubmittingScreen = ({ submitError, onRetry, speak }) => {
  React.useEffect(() => {
    if (submitError && speak) {
      speak(
        "I'm sorry, we encountered a technical issue while submitting your interview. Please click the retry button below."
      );
    }
  }, [submitError, speak]);

  return (
    <div className="w-full flex flex-col items-center justify-center animate-fade-in relative overflow-hidden my-auto p-6">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="w-[600px] h-[600px] bg-indigo-600/10 blur-[120px] rounded-full mix-blend-screen animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.03)_0%,transparent_70%)]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        {submitError ? (
          <div className="animate-shake">
            <div className="bg-[#0D1117] border border-red-500/20 rounded-2xl p-8 lg:p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/40 to-transparent"></div>

              <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>

              <h2 className="text-2xl font-black text-white tracking-tight mb-2">
                Submission Error
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                {typeof submitError === 'string'
                  ? submitError
                  : 'We encountered a critical error while transmitting your data. Please check your connection and try again.'}
              </p>

              <button
                onClick={onRetry}
                className="w-full h-12 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-black uppercase tracking-[0.15em] text-[10px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] border border-red-500/30"
              >
                <Sparkles className="w-3.5 h-3.5" /> Retry Submission
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* Elegant Loader */}
            <div className="relative flex items-center justify-center w-40 h-40 mb-10">
              {/* Animated Rings */}
              <div className="absolute inset-0 rounded-full border border-white/5 shadow-inner"></div>
              <div
                className="absolute inset-2 rounded-full border-2 border-transparent border-t-indigo-500/40 border-l-indigo-500/10 animate-spin"
                style={{ animationDuration: '3s' }}
              ></div>
              <div
                className="absolute inset-4 rounded-full border border-transparent border-b-indigo-400/30 border-r-indigo-400/10 animate-spin"
                style={{ animationDuration: '2s', animationDirection: 'reverse' }}
              ></div>

              {/* Core Status */}
              <div className="w-16 h-16 rounded-2xl bg-[#0D1117] border border-white/10 flex items-center justify-center shadow-2xl relative z-10">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              </div>

              {/* Particles/Glow */}
              <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full opacity-30 animate-pulse"></div>
            </div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative rounded-full h-2 w-2 bg-indigo-400"></span>
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">
                  Transmitting Data
                </span>
              </div>

              <h1 className="text-3xl font-black text-white tracking-tight leading-none">
                Finalizing Session
              </h1>
              <p className="text-slate-500 text-sm max-w-[280px] mx-auto leading-relaxed font-medium">
                Encrypting and uploading your responses to the secure recruitment cloud.
              </p>

              <div className="pt-6">
                <div className="flex items-center gap-3 text-slate-600 text-[10px] font-bold uppercase tracking-widest justify-center px-6 py-2 rounded-xl bg-white/[0.02] border border-white/5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/40" />
                  Do not close this window
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const CompletionScreen = ({ candidateName, speak }) => {
  const [verificationId] = React.useState(() =>
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );

  React.useEffect(() => {
    if (speak) {
      const messages = [
        `Thank you for your time, ${candidateName || 'Candidate'}. Your interview has been successfully submitted. We'll be in touch soon.`,
        `That's all for today. I've sent your responses to the recruitment team. Have a great day!`,
        `Interview complete. Your data is secure and has been transmitted. Thank you for using HireOS.`,
      ];
      speak(messages[Math.floor(Math.random() * messages.length)]);
    }
  }, [speak, candidateName]);

  return (
    <div className="w-full flex justify-center animate-fade-in my-auto p-6">
      <div className="relative z-10 w-full max-w-md">
        {/* Success Card */}
        <div className="bg-[#0D1117] border border-white/10 rounded-3xl p-10 lg:p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden text-center">
          {/* Success Decorations */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 blur-[80px] rounded-full -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-500/10 blur-[80px] rounded-full -ml-20 -mb-20"></div>

          <div className="relative z-10">
            <div className="w-24 h-24 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-8 shadow-inner group">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">
                Interview Complete
              </span>
            </div>

            <h1 className="text-3xl font-black text-white tracking-tight leading-tight mb-4">
              Thank You for Your Time
            </h1>

            <p className="text-slate-400 text-sm leading-relaxed mb-10 max-w-[300px] mx-auto">
              Your interview has been securely transmitted. Our HR team will review your application
              and get back to you shortly.
            </p>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8"></div>

            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-slate-500 text-[11px] font-bold uppercase tracking-widest">
                <ShieldCheck className="w-4 h-4 text-emerald-500/50" />
                <span>Verification ID: {verificationId}</span>
              </div>

              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => window.close()}
                  className="px-8 h-12 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-black uppercase tracking-[0.15em] text-[10px] border border-white/10 transition-all active:scale-[0.98] flex items-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Close Session
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Credit */}
        <p className="mt-8 text-center text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">
          Powered by HireOS Intelligence
        </p>
      </div>
    </div>
  );
};
