import React, { useState, useEffect } from 'react';
import {
  Bot,
  Mic,
  Timer,
  Square,
  RotateCcw,
  CheckCircle2,
  Circle,
  RefreshCw,
  Volume2,
  Play,
  Save,
  FileText,
  ClipboardCheck,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import AlisaFacePanel from './AlisaFacePanel';
import LongQuestionCard from './LongQuestionCard';

/**
 * Common State Header Component for Interview Flow
 */
const StateHeader = ({ activeTab, customTitle, customSubtitle }) => {
  const getTabLabel = () => {
    switch (activeTab) {
      case 'speaking':
        return 'AI Presentation';
      case 'ready':
        return 'System Ready';
      case 'recording':
        return 'Input Active';
      case 'processing':
        return 'Logic Evaluation';
      case 'transcript':
        return 'Final Review';
      default:
        return '';
    }
  };

  const getTitle = () => {
    if (customTitle) return customTitle;
    switch (activeTab) {
      case 'speaking':
        return 'Please listen to the prompt';
      case 'ready':
        return 'Ready when you are';
      case 'recording':
        return 'Recording your answer';
      case 'processing':
        return 'Analyzing your response';
      case 'transcript':
        return 'Review your transcript';
      default:
        return '';
    }
  };

  return (
    <div className="animate-fade-in shrink-0">
      <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 mb-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-400">
          {getTabLabel()}
        </span>
      </div>
      <h2 className="text-2xl lg:text-[28px] font-bold tracking-tight text-white leading-tight">
        {getTitle()}
      </h2>
    </div>
  );
};

export const InteractionSpeaking = ({ questions, currentQuestionIndex, onSkip }) => {
  const questionText =
    currentQuestionIndex === -1
      ? "Please say 'My microphone is working properly' to test your audio."
      : questions && questions[currentQuestionIndex]
        ? questions[currentQuestionIndex]
        : 'Loading question...';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex-1 flex flex-col justify-center min-h-0 gap-6"
    >
      <StateHeader activeTab="speaking" />

      <div className="shrink-0 min-h-0">
        <LongQuestionCard
          question={questionText}
          number={currentQuestionIndex === -1 ? 'P' : currentQuestionIndex + 1}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full flex flex-col justify-center items-center text-center p-6 lg:p-8 rounded-xl bg-[#111827] border border-white/5 animate-fade-in shadow-sm">
          <div className="w-10 h-10 rounded-full bg-indigo-600/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 mb-3 shadow-inner">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200 mb-1.5">Interviewer is speaking</p>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-[260px] mx-auto mb-4">
              Alisa is currently providing the context for this question. Please wait until she
              finishes.
            </p>
            {onSkip && (
              <button
                onClick={onSkip}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:bg-white/10 hover:text-white transition-all"
              >
                Skip & Answer Now
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const InteractionReady = ({
  audioError,
  questions,
  currentQuestionIndex,
  speakQuestion,
  onStartCountdownManual,
}) => {
  const questionText =
    currentQuestionIndex === -1
      ? "Please say 'My microphone is working properly' to test your audio."
      : questions && questions[currentQuestionIndex]
        ? questions[currentQuestionIndex]
        : 'Loading question...';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex-1 flex flex-col justify-center min-h-0 gap-6"
    >
      <StateHeader activeTab="ready" />

      {audioError && (
        <div className="shrink-0 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
          <p className="text-red-400 font-bold text-[10px] uppercase tracking-widest">
            {audioError}
          </p>
        </div>
      )}

      <div className="shrink-0 min-h-0">
        <LongQuestionCard
          question={questionText}
          number={currentQuestionIndex === -1 ? 'P' : currentQuestionIndex + 1}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full flex flex-col justify-center items-center text-center p-6 lg:p-8 rounded-xl bg-[#111827] border border-white/5 animate-fade-in shadow-sm">
          <div className="w-10 h-10 rounded-full bg-indigo-600/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 mb-3 shadow-inner">
            <Play className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-200 mb-1.5">Waiting for your input</p>
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-[260px] mx-auto">
              Take a moment to gather your thoughts. Use the actions below to begin your response.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const InteractionRecording = ({
  recordingTime,
  formatTime,
  questions,
  currentQuestionIndex,
  volumeLevel,
}) => {
  const questionText =
    currentQuestionIndex === -1
      ? "Please say 'My microphone is working properly' to test your audio."
      : questions && questions[currentQuestionIndex]
        ? questions[currentQuestionIndex]
        : 'Loading question...';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex-1 flex flex-col justify-center min-h-0 gap-6"
    >
      <StateHeader activeTab="recording" />

      <div className="shrink-0 min-h-0">
        <LongQuestionCard
          question={questionText}
          number={currentQuestionIndex === -1 ? 'P' : currentQuestionIndex + 1}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full p-6 lg:p-8 rounded-xl bg-[#111827] border border-red-500/20 animate-fade-in shadow-sm flex flex-col min-h-0 border-dashed justify-center">
          <div className="flex items-center justify-between mb-6 shrink-0 px-2">
            <span className="text-[11px] font-mono font-bold text-white tracking-widest bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
              {formatTime(recordingTime)}
            </span>
            <div className="flex items-center gap-1.5 text-red-500 animate-pulse text-[9px] font-bold uppercase">
              <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
              LIVE MIC
            </div>
          </div>
          <div className="flex-1 flex items-end justify-center gap-1 min-h-0 mb-4 px-4">
            {[...Array(16)].map((_, i) => {
              const pseudoRand = [
                0.8, 0.3, 0.9, 0.5, 0.2, 0.7, 0.4, 0.6, 1.0, 0.1, 0.85, 0.25, 0.95, 0.45, 0.65,
                0.15,
              ][i];
              const targetHeight = `${20 + (volumeLevel / 100) * (pseudoRand * 80 + 20)}%`;
              return (
                <motion.div
                  key={i}
                  className="w-1 rounded-full bg-indigo-500"
                  initial={{ height: '20%' }}
                  animate={{ height: targetHeight }}
                  transition={{ type: 'spring', bounce: 0.4, duration: 0.3 }}
                />
              );
            })}
          </div>
          <p className="text-slate-500 text-[9px] font-semibold uppercase tracking-widest text-center shrink-0">
            Capturing audio stream...
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export const InteractionProcessing = ({ transcriptError, onRetry }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex-1 flex flex-col justify-center min-h-0 gap-6"
    >
      <StateHeader activeTab="processing" />

      {transcriptError && (
        <div className="shrink-0 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center mb-2 animate-shake">
          <p className="text-red-400 font-bold text-xs uppercase tracking-widest mb-3">
            {transcriptError}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-500/30 transition-all"
            >
              <RotateCcw className="w-3 h-3" /> Try Again
            </button>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full p-6 lg:p-8 rounded-xl bg-[#111827] border border-white/5 animate-fade-in shadow-sm flex flex-col justify-center min-h-0 overflow-y-auto custom-scrollbar">
          {!transcriptError ? (
            <div className="space-y-4 max-w-[280px] mx-auto w-full">
              {[
                {
                  label: 'Saving Audio Data',
                  status: 'complete',
                  icon: <Save className="w-3.5 h-3.5" />,
                },
                {
                  label: 'Generating Transcription',
                  status: 'active',
                  icon: <FileText className="w-3.5 h-3.5" />,
                },
                {
                  label: 'Analyzing Contextual Fit',
                  status: 'pending',
                  icon: <ClipboardCheck className="w-3.5 h-3.5" />,
                },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 group">
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center border transition-all ${step.status === 'complete' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : step.status === 'active' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-lg shadow-indigo-900/20' : 'bg-white/5 border-white/10 text-slate-600'}`}
                  >
                    {step.status === 'complete' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      step.icon
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider ${step.status === 'pending' ? 'text-slate-600' : 'text-slate-300'}`}
                    >
                      {step.label}
                    </span>
                    {step.status === 'active' && (
                      <span className="text-[8px] text-indigo-500 font-bold uppercase mt-0.5 tracking-tighter">
                        Please wait...
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20 mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed max-w-[220px] mx-auto">
                We couldn't complete the processing phase. This might be due to a poor connection or
                audio issue.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export const TranscriptReview = ({
  transcript,
  onTranscriptChange,
  isSaving,
  questions,
  currentQuestionIndex,
}) => {
  const questionText =
    currentQuestionIndex === -1
      ? "Please say 'My microphone is working properly' to test your audio."
      : questions && questions[currentQuestionIndex]
        ? questions[currentQuestionIndex]
        : 'Loading question...';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex-1 flex flex-col justify-center min-h-0 gap-4 lg:gap-6"
    >
      <StateHeader activeTab="transcript" />

      <div className="shrink-0 min-h-0">
        <LongQuestionCard
          question={questionText}
          number={currentQuestionIndex === -1 ? 'P' : currentQuestionIndex + 1}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full p-4 pt-2 lg:p-6 lg:pt-3 rounded-xl bg-[#111827] border border-white/5 animate-fade-in shadow-sm flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-2 shrink-0 border-b border-white/5 pb-2">
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Candidate Transcript
            </span>
            {isSaving && <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin ml-auto" />}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-3">
            <textarea
              value={transcript}
              onChange={(e) => onTranscriptChange(e.target.value)}
              className="w-full h-full bg-transparent text-[14px] lg:text-[15px] text-slate-300 font-medium leading-relaxed italic resize-none focus:outline-none custom-scrollbar"
              placeholder="Your transcription will appear here..."
              spellCheck="false"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const RecordingCountdown = ({ seconds }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fadeIn w-full max-w-sm mx-auto space-y-10 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-2xl animate-pulse" />
        <div className="relative w-32 h-32 lg:w-36 lg:h-36 bg-[#0d1117] rounded-full flex items-center justify-center border-2 border-indigo-500/20 shadow-2xl">
          <span className="text-6xl lg:text-7xl font-black text-white animate-scaleIn">
            {seconds}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
          Initiating Mic
        </div>
        <h3 className="text-2xl lg:text-3xl font-bold text-white tracking-tight leading-none">
          Get ready to speak
        </h3>
        <p className="text-slate-500 text-xs max-w-xs mx-auto leading-relaxed">
          The recording will start automatically. Please speak clearly into your microphone.
        </p>
      </div>

      <div className="w-40 h-1 bg-white/5 rounded-full overflow-hidden border border-white/5 mx-auto">
        <div
          className="h-full bg-indigo-500 transition-all duration-1000 ease-linear"
          style={{ width: `${(seconds / 3) * 100}%` }}
        />
      </div>
    </div>
  );
};
