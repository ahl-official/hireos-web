import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, X } from 'lucide-react';

/**
 * LongQuestionCard Component
 * Handles long interview questions with internal scrolling and modal view.
 *
 * @param {string} question - The question text
 * @param {number|string} number - The question number or label
 */
const LongQuestionCard = ({ question, number }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const checkScroll = () => {
      if (scrollRef.current) {
        const { scrollHeight, clientHeight } = scrollRef.current;
        setShowScrollHint(scrollHeight > clientHeight + 4);
      }
    };

    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [question]);

  return (
    <>
      <div className="w-full max-w-2xl mx-auto bg-[#111827] border border-white/10 rounded-xl p-4 lg:p-5 relative overflow-hidden transition-all duration-300 shadow-sm min-h-0">
        {/* Question Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="px-1.5 py-0.5 rounded bg-indigo-600/20 border border-indigo-500/30 text-center min-w-[28px]">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                {number}
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
              Question
            </span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-slate-500 hover:text-slate-300"
            title="Expand question"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Question Text Area with Gradient Fade for Scroll */}
        <div className="relative min-h-0">
          <div
            ref={scrollRef}
            className="max-h-[120px] lg:max-h-[140px] overflow-y-auto custom-scrollbar pr-3 mb-1"
          >
            <p className="text-[16px] lg:text-[18px] font-medium text-slate-200 leading-snug tracking-tight">
              "{question}"
            </p>
          </div>

          {showScrollHint && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#111827] to-transparent pointer-events-none"></div>
          )}
        </div>

        {/* Scroll Hint Text */}
        {showScrollHint && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-white/5 opacity-60">
            <div className="flex gap-1">
              <div
                className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce"
                style={{ animationDelay: '0s' }}
              ></div>
              <div
                className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce"
                style={{ animationDelay: '0.2s' }}
              ></div>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
              Scroll to read more
            </span>
          </div>
        )}
      </div>

      {/* Full Question Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-2xl bg-[#111827] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                Full Interview Prompt
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <p className="text-xl md:text-2xl font-medium text-slate-200 leading-relaxed">
                "{question}"
              </p>
            </div>
            <div className="p-6 border-t border-white/5 bg-white/[0.02] flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-sm transition-all hover:bg-indigo-500 active:scale-95 shadow-lg shadow-indigo-900/20"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LongQuestionCard;
