import React from 'react';
import {
  Loader2,
  Shield,
  Play,
  CheckCircle2,
  MessageSquare,
  ClipboardCheck,
  ArrowRight,
  Bot,
  RotateCcw,
} from 'lucide-react';

export const WelcomeScreen = ({ candidateName, onStart, isStarting }) => {
  return (
    <div className="w-full flex flex-col items-center justify-center animate-fade-in-up my-auto">
      <div className="relative z-10 w-full max-w-[500px] px-container-padding">
        <div className="p-container-padding flex flex-col items-center text-center">
          {/* AI Avatar Replacement (Alisa Poster) */}
          <div className="relative w-28 h-28 mb-8 flex items-center justify-center group">
            <div className="absolute inset-0 rounded-full bg-indigo-500 opacity-20 blur-2xl group-hover:opacity-30 transition-all duration-700 animate-pulse"></div>
            <div className="w-24 h-24 rounded-full border border-white/10 bg-[#0d1117] overflow-hidden relative z-10 shadow-2xl shadow-indigo-500/20">
              <img
                src="/src/assets/alisa_poster.png"
                alt="Alisa - AI Interviewer"
                className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700 scale-[1.1]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#060810]/60 via-transparent to-transparent opacity-40" />
            </div>
            {/* Active Status Dot */}
            <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-[#060810] z-20 shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse"></div>
          </div>

          <h2 className="text-headline-lg font-headline-lg text-on-surface mb-stack-sm md:hidden">
            Hello {candidateName || 'Candidate'}
          </h2>
          <h2 className="text-headline-lg font-headline-lg text-on-surface mb-stack-sm hidden md:block">
            Hello {candidateName || 'Candidate'}
          </h2>
          <p className="text-body-lg font-body-lg text-on-surface-variant mb-stack-lg max-w-sm">
            I'm your AI interviewer. I'll guide you through a short voice interview.
          </p>

          <button
            onClick={onStart}
            disabled={isStarting}
            className="w-full bg-primary-container text-on-primary-container hover:bg-inverse-primary transition-colors duration-200 rounded-xl h-[56px] flex items-center justify-center gap-base mb-stack-md group disabled:opacity-50"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-button font-button">Preparing Interview...</span>
              </>
            ) : (
              <>
                <span className="text-button font-button">Begin Interview</span>
                <span
                  className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform duration-200"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  arrow_forward
                </span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-on-surface-variant opacity-80">
            <span className="material-symbols-outlined text-[16px]">lock</span>
            <span className="text-body-sm font-body-sm">
              Your answers will be securely submitted to HR.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TutorialGuide = ({ onContinue }) => {
  return (
    <div className="w-full flex flex-col items-center justify-center animate-fade-in-up my-auto">
      <div className="w-full max-w-[800px] flex flex-col h-full overflow-hidden relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="px-4 py-4 sm:px-10 flex-grow flex flex-col z-10">
          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface mb-2">How It Works</h1>
            <p className="text-sm text-on-surface-variant">
              A quick guide to your AI interview experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 flex-grow">
            <div className="bg-white/[0.02] rounded-xl border border-white/10 p-4 flex gap-3 items-start transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20">
              <div className="w-10 h-10 rounded-full bg-primary-container/20 border border-primary-container/30 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-primary text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  headphones
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface mb-1">1. Listen</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  We will ask you a question contextually based on the role.
                </p>
              </div>
            </div>

            <div className="bg-white/[0.02] rounded-xl border border-white/10 p-4 flex gap-3 items-start transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20">
              <div className="w-10 h-10 rounded-full bg-secondary-container/20 border border-secondary-container/30 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-secondary text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  mic
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface mb-1">2. Speak</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Answer naturally. Take your time to articulate your thoughts clearly.
                </p>
              </div>
            </div>

            <div className="bg-white/[0.02] rounded-xl border border-white/10 p-4 flex gap-3 items-start transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20">
              <div className="w-10 h-10 rounded-full bg-tertiary-container/20 border border-tertiary-container/30 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-tertiary text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  description
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface mb-1">3. Review</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  We instantly create a transcript of your verbal response.
                </p>
              </div>
            </div>

            <div className="bg-white/[0.02] rounded-xl border border-white/10 p-4 flex gap-3 items-start transition-all duration-300 hover:bg-white/[0.05] hover:border-white/20">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-primary text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface mb-1">4. Confirm</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Check your transcript for accuracy before continuing to the next step.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] rounded-lg p-3 border border-white/10 flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-tertiary shrink-0 text-sm">
              lightbulb
            </span>
            <p className="text-xs text-on-surface">
              <strong>Tip:</strong> Ensure you are in a quiet environment and speak clearly into
              your microphone for the best results.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 w-full max-w-sm mx-auto">
            <button
              onClick={onContinue}
              className="w-full h-[52px] bg-indigo-500 hover:bg-indigo-400 text-white font-black uppercase tracking-widest text-[11px] rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-indigo-400/50"
            >
              <span>Start Practice Round</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onContinue}
              className="text-[9px] font-bold text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-[0.2em] py-1"
            >
              Skip Tutorial
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const InterviewInstructions = ({ questionCount, onStart }) => {
  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in-up my-auto">
      <div className="flex flex-col relative py-2 sm:py-4">
        <div className="px-4 pt-2 pb-3 text-center space-y-1.5">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-primary/20">
            <CheckCircle2 className="w-5 h-5 text-primary" />
          </div>
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary uppercase tracking-wider mb-1">
            Practice Complete
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-on-surface tracking-tight">
            You're Ready
          </h2>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
            The real interview will now begin. Answer naturally and take one question at a time.
          </p>
        </div>

        <div className="px-4 pb-2 space-y-3 flex-1">
          <div className="grid grid-cols-1 gap-2">
            {[
              {
                icon: Play,
                title: 'Real Interview',
                desc: `${questionCount} questions designed to evaluate your strengths.`,
              },
              {
                icon: MessageSquare,
                title: 'Final Transcript Review',
                desc: 'Review your AI-generated transcripts at the end.',
              },
              {
                icon: ClipboardCheck,
                title: 'Secure Submission',
                desc: 'Your interview will be securely submitted for HR review.',
              },
            ].map((card, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/10 transition-all duration-300 hover:bg-white/[0.05]"
              >
                <div className="w-7 h-7 rounded-full bg-primary-container/20 flex items-center justify-center text-primary border border-primary-container/30 shrink-0">
                  <card.icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-bold text-[10px] text-on-surface uppercase tracking-wider mb-0.5">
                    {card.title}
                  </h4>
                  <p className="text-[11px] text-on-surface-variant">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-center">
            <button
              onClick={onStart}
              className="w-full sm:w-80 h-[46px] bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-black uppercase tracking-widest text-[11px] rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.4)] border border-cyan-300 transition-all"
            >
              <span>Start Interview</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PracticeReadyScreen = ({ setStatus, onStartCountdownManual, speakQuestion }) => {
  const practiceQuestion = 'Please introduce yourself in 20 seconds.';
  return (
    <div className="w-full flex flex-col justify-center items-center relative z-10 animate-fade-in-up my-auto">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex justify-center items-center opacity-20">
        <div className="w-[500px] h-[500px] rounded-full bg-primary-container blur-[100px] mix-blend-screen opacity-30 animate-pulse"></div>
      </div>

      <div className="w-full max-w-2xl relative z-10">
        <div className="px-6 py-8 flex flex-col items-center text-center transform transition-transform duration-500 hover:-translate-y-1">
          <div className="inline-flex items-center gap-2 bg-secondary-container/10 border border-secondary-container/20 rounded-full px-3 py-1 mb-6">
            <span
              className="material-symbols-outlined text-secondary-container text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              psychology
            </span>
            <span className="text-[10px] font-bold text-secondary-container uppercase tracking-wider">
              Practice Round
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface mb-6 leading-tight max-w-lg">
            "{practiceQuestion}"
          </h1>
          <div className="flex items-start md:items-center gap-2 bg-surface-container-low rounded-xl p-3 border border-outline-variant/50 w-full mb-8 text-left md:text-center justify-center">
            <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0 text-sm">
              info
            </span>
            <p className="text-xs text-on-surface-variant">
              This is only for practice and will not be scored. Use this time to adjust your camera
              and microphone.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 w-full max-w-sm mx-auto">
            <button
              onClick={() => {
                speakQuestion(practiceQuestion, onStartCountdownManual);
              }}
              className="w-full h-[52px] rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 transition-all active:scale-95 shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-indigo-400/50"
            >
              <Play className="w-4 h-4" /> Start Practice
            </button>
            <button
              onClick={() => speakQuestion(practiceQuestion)}
              className="text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-[0.2em] flex items-center gap-2 py-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Replay Question
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
