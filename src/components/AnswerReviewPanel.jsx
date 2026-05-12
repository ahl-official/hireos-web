import React, { useEffect, useState } from 'react';
import { RotateCcw, Check } from 'lucide-react';

export function AnswerReviewPanel({
  question,
  answerText,
  questionIndex,
  totalQuestions,
  onLooksGood,
  onReRecord,
  autoAcceptSeconds = 5
}) {
  const [countdown, setCountdown] = useState(autoAcceptSeconds);
  const [countdownStarted, setCountdownStarted] = useState(false);

  useEffect(() => {
    setCountdown(autoAcceptSeconds);
    setCountdownStarted(true);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onLooksGood();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [answerText, autoAcceptSeconds, onLooksGood]);

  // Determine countdown color based on time remaining
  const getCountdownColor = () => {
    if (countdown <= 1) return 'bg-red-500';
    if (countdown <= 2) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  // Calculate progress bar width
  const progressPercent = ((questionIndex + 1) / totalQuestions) * 100;

  // Word/char count for validation feedback
  const wordCount = answerText.trim().split(/\s+/).filter(w => w.length > 0).length;
  const isGoodLength = wordCount >= 1; // At least 1 word

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full space-y-6">
        {/* Progress Indicator */}
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">
            Question {questionIndex + 1} of {totalQuestions}
          </span>
          <span className="text-slate-500">{Math.round(progressPercent)}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Question Context (Small, Muted) */}
        <div className="pt-2">
          <p className="text-sm text-slate-500 font-medium mb-2">Current Question:</p>
          <p className="text-base text-slate-700 leading-relaxed">{question}</p>
        </div>

        {/* Answer Display (HERO - Large, Prominent) */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-8 border-2 border-indigo-200">
          <p className="text-xs text-slate-500 font-semibold mb-4 uppercase tracking-wide">Your Answer</p>
          <p className="text-3xl font-bold text-slate-900 leading-relaxed break-words">
            "{answerText}"
          </p>
          <p className="text-xs text-slate-400 mt-4">
            {wordCount} word{wordCount !== 1 ? 's' : ''} captured
          </p>
        </div>

        {/* Word Length Validation Feedback */}
        {!isGoodLength && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              ⚠️ Very short answer. Consider re-recording for a more complete response.
            </p>
          </div>
        )}

        {/* Countdown Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 font-medium">Auto-proceeding in</span>
            <span className={`text-2xl font-bold ${countdown <= 1 ? 'text-red-600' : countdown <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {countdown}s
            </span>
          </div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getCountdownColor()} transition-all duration-1000`}
              style={{ width: `${(countdown / autoAcceptSeconds) * 100}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4">
          <button
            onClick={onReRecord}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-orange-100 text-orange-700 font-semibold rounded-xl hover:bg-orange-200 transition-colors border border-orange-300"
          >
            <RotateCcw className="w-5 h-5" />
            Re-record
          </button>
          <button
            onClick={onLooksGood}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors shadow-lg hover:shadow-xl"
          >
            <Check className="w-5 h-5" />
            Looks Good
          </button>
        </div>

        {/* Accessibility: Explain auto-proceed */}
        <p className="text-xs text-slate-500 text-center">
          Will automatically proceed to next question if no action is taken
        </p>
      </div>
    </div>
  );
}
