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

  // Word count for validation feedback
  const wordCount = answerText.trim().split(/\s+/).filter(w => w.length > 0).length;
  const isGoodLength = wordCount >= 1; // At least 1 word

  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-200 p-6 space-y-4 animate-fadeIn">
      {/* Answer Display with Countdown */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Your Answer</p>
            <p className="text-lg font-bold text-slate-900 leading-relaxed break-words">
              "{answerText}"
            </p>
            <p className="text-xs text-slate-400 mt-2">
              {wordCount} word{wordCount !== 1 ? 's' : ''} captured
            </p>
          </div>
          <div className="text-center">
            <p className={`text-3xl font-bold ${countdown <= 1 ? 'text-red-600' : countdown <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {countdown}s
            </p>
            <p className="text-xs text-slate-500 mt-1">auto-next</p>
          </div>
        </div>

        {/* Countdown Bar */}
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getCountdownColor()} transition-all duration-1000`}
            style={{ width: `${(countdown / autoAcceptSeconds) * 100}%` }}
          />
        </div>
      </div>

      {/* Word Length Validation Feedback */}
      {!isGoodLength && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800">
            ⚠️ Very short answer. Consider re-recording for a more complete response.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onReRecord}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-orange-100 text-orange-700 font-semibold rounded-lg hover:bg-orange-200 transition-colors border border-orange-300 text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Re-record
        </button>
        <button
          onClick={onLooksGood}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 transition-colors shadow-md text-sm"
        >
          <Check className="w-4 h-4" />
          Looks Good
        </button>
      </div>
    </div>
  );
}
