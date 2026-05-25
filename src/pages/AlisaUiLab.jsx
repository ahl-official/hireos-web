import React, { useState, useEffect } from 'react';
import AlisaFacePanel from '../components/interview/AlisaFacePanel';
import LongQuestionCard from '../components/interview/LongQuestionCard';
import InterviewActionBar from '../components/interview/InterviewActionBar';
import {
  Play,
  RefreshCw,
  Timer,
  CheckCircle2,
  Circle,
  Volume2,
  Save,
  FileText,
  ClipboardCheck,
} from 'lucide-react';

const AlisaUiLab = () => {
  const [activeTab, setActiveTab] = useState('speaking');
  const [isSpeaking, setIsSpeaking] = useState(true);

  const longQuestion =
    'In your AI Resume Architect project, you mentioned implementing ATS scoring. Can you walk us through your methodology for determining keyword significance in resumes, and how you ensured that the generated resumes would rank highly in Applicant Tracking Systems?';
  const sampleTranscript =
    'For keyword significance, I developed a custom TF-IDF variant that prioritized industry-specific terminology found in high-ranking job descriptions. I ensured ranking by cross-referencing candidate skills against these weighted vectors, providing real-time feedback for resume optimization.';

  const assets = { poster: '/alisa_poster.png' };

  useEffect(() => {
    setIsSpeaking(activeTab === 'speaking');
  }, [activeTab]);

  const getStatus = () => {
    if (activeTab === 'recording') return 'Listening';
    if (activeTab === 'processing') return 'Analyzing';
    if (activeTab === 'transcript') return 'Reviewing';
    return 'Ready';
  };

  const MockMicVisualizer = () => (
    <div className="flex items-end justify-center gap-1 h-8 lg:h-10 w-full max-w-[160px] mx-auto">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-200 ${activeTab === 'recording' ? 'bg-indigo-500 animate-pulse' : 'bg-slate-800'}`}
          style={{ height: activeTab === 'recording' ? `${30 + Math.random() * 70}%` : '20%' }}
        ></div>
      ))}
    </div>
  );

  return (
    <div className="h-[100dvh] bg-[#060810] text-slate-200 font-sans flex flex-col overflow-hidden">
      {/* 1. Ultra-Compact Header (44px) */}
      <header className="shrink-0 z-50 border-b border-white/5 bg-[#0B1020]/80 backdrop-blur-2xl px-4 lg:px-8 py-1.5 flex items-center justify-between h-[44px]">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center">
            <span className="text-white font-black text-[9px]">H</span>
          </div>
          <h1 className="text-[9px] font-bold tracking-widest text-white uppercase leading-none">
            HireOS
          </h1>
        </div>

        <nav className="flex bg-white/5 rounded p-0.5 border border-white/10">
          {['speaking', 'ready', 'recording', 'processing', 'transcript'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-0.5 rounded text-[9px] font-semibold transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
            >
              {tab === 'transcript' ? 'Review' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-indigo-400">12:45</span>
        </div>
      </header>

      {/* 2. Main Area (flex-1) */}
      <main className="flex-1 min-h-0 p-3 lg:p-5 overflow-hidden">
        <div className="h-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 min-h-0 items-start">
          {/* Left Column */}
          <div className="h-full flex flex-col min-h-0 overflow-hidden">
            {/* Mobile Alisa */}
            <div className="lg:hidden mb-3 shrink-0 mx-auto w-[140px]">
              <AlisaFacePanel
                isSpeaking={isSpeaking}
                status={getStatus()}
                posterSrc={assets.poster}
                compact={true}
              />
            </div>

            <div className="flex-1 flex flex-col min-h-0 justify-start pt-2 lg:pt-4">
              {/* Heading (shrink-0) */}
              <div className="mb-3 shrink-0">
                <span className="text-[7px] font-black uppercase tracking-[0.25em] text-indigo-500 block mb-1">
                  {activeTab === 'speaking' && 'AI PRESENTATION'}
                  {activeTab === 'ready' && 'SYSTEM READY'}
                  {activeTab === 'recording' && 'INPUT ACTIVE'}
                  {activeTab === 'processing' && 'EVALUATION'}
                  {activeTab === 'transcript' && 'FINAL REVIEW'}
                </span>
                <h2 className="text-lg lg:text-[20px] font-bold tracking-tight text-white leading-tight">
                  {activeTab === 'speaking' && 'Please listen to the prompt'}
                  {activeTab === 'ready' && 'Ready when you are'}
                  {activeTab === 'recording' && 'Recording your answer'}
                  {activeTab === 'processing' && 'Analyzing response'}
                  {activeTab === 'transcript' && 'Review your transcript'}
                </h2>
              </div>

              {/* Question (shrink-0) */}
              <div className="mb-3 shrink-0">
                <LongQuestionCard question={longQuestion} number={3} />
              </div>

              {/* State Content (flex-1 min-h-0) */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {/* Speaking/Ready */}
                {(activeTab === 'speaking' || activeTab === 'ready') && (
                  <div className="h-full max-h-[160px] flex flex-col justify-center items-center p-3 lg:p-4 rounded-xl bg-[#111827] border border-white/5 shadow-inner">
                    <div className="w-8 h-8 rounded-full bg-indigo-600/10 flex items-center justify-center text-indigo-400 mb-2 border border-indigo-500/20">
                      {activeTab === 'speaking' ? (
                        <Volume2 className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 text-center max-w-[220px] leading-snug">
                      {activeTab === 'speaking'
                        ? 'Interviewer is providing instructions. Please wait for completion.'
                        : 'Preparation mode. Actions are enabled below.'}
                    </p>
                  </div>
                )}

                {/* Recording */}
                {activeTab === 'recording' && (
                  <div className="h-full max-h-[160px] p-3 lg:p-4 rounded-xl bg-[#111827] border border-red-500/20 flex flex-col min-h-0 border-dashed justify-center">
                    <div className="flex items-center justify-between mb-3 shrink-0 px-2">
                      <span className="text-[10px] font-mono font-bold text-white tracking-widest bg-black/40 px-1.5 py-0.5 rounded">
                        00:42.15
                      </span>
                      <div className="flex items-center gap-1 text-red-500 animate-pulse text-[8px] font-bold uppercase">
                        <div className="w-1 h-1 rounded-full bg-current"></div>
                        LIVE
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center min-h-0">
                      <MockMicVisualizer />
                    </div>
                  </div>
                )}

                {/* Processing */}
                {activeTab === 'processing' && (
                  <div className="h-full max-h-[180px] p-4 rounded-xl bg-[#111827] border border-white/5 flex flex-col justify-center min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="space-y-2.5 max-w-[220px] mx-auto w-full">
                      {[
                        {
                          label: 'Saving Data',
                          status: 'complete',
                          icon: <Save className="w-3 h-3" />,
                        },
                        {
                          label: 'Transcribing',
                          status: 'active',
                          icon: <FileText className="w-3 h-3" />,
                        },
                        {
                          label: 'Analyzing',
                          status: 'pending',
                          icon: <ClipboardCheck className="w-3 h-3" />,
                        },
                      ].map((step, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center border ${step.status === 'complete' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : step.status === 'active' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-600'}`}
                          >
                            {step.status === 'complete' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              step.icon
                            )}
                          </div>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider ${step.status === 'pending' ? 'text-slate-600' : 'text-slate-300'}`}
                          >
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Review */}
                {activeTab === 'transcript' && (
                  <div className="h-full p-3 lg:p-4 rounded-xl bg-[#111827] border border-white/5 flex flex-col min-h-0">
                    <div className="flex items-center gap-2 mb-2 shrink-0 opacity-40">
                      <FileText className="w-3 h-3 text-indigo-400" />
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                        Transcript
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0">
                      <p className="text-[12px] lg:text-[13px] text-slate-400 leading-snug italic">
                        "{sampleTranscript}"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="hidden lg:flex flex-col h-full min-h-0 overflow-hidden py-1">
            <div className="flex-1 flex flex-col items-center justify-start min-h-0">
              <AlisaFacePanel
                isSpeaking={isSpeaking}
                status={getStatus()}
                posterSrc={assets.poster}
              />

              <div className="mt-4 w-full p-3 rounded-lg bg-white/[0.01] border border-white/5 opacity-40">
                <div className="flex items-center justify-between text-[8px] uppercase tracking-widest">
                  <span className="text-slate-600">Secure Link</span>
                  <span className="text-emerald-500 font-bold">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Footer */}
      <InterviewActionBar
        state={activeTab}
        onStart={() => setActiveTab('recording')}
        onStop={() => setActiveTab('processing')}
        onConfirm={() => alert('Submitted')}
        onReplay={() => alert('Replay')}
        onRestart={() => setActiveTab('recording')}
      />
    </div>
  );
};

export default AlisaUiLab;
