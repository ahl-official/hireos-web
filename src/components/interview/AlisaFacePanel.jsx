import React from 'react';
import AlisaVideoPlayer from './AlisaVideoPlayer';
import { Mic, Volume2, ShieldCheck } from 'lucide-react';

/**
 * AlisaFacePanel Component
 * A premium HR/AI interviewer card featuring real human face video/avatar.
 *
 * @param {boolean} isSpeaking - Whether Alisa is currently speaking
 * @param {string} status - Current status text
 * @param {string} name - Alisa's name
 * @param {string} role - Alisa's role
 * @param {string} idleVideoSrc - URL for idle loop
 * @param {string} speakingVideoSrc - URL for speaking loop
 * @param {string} posterSrc - Poster image URL
 */
const AlisaFacePanel = ({
  isSpeaking = false,
  status = 'Ready',
  name = 'Alisa',
  role = 'AI Interviewer',
  idleVideoSrc,
  speakingVideoSrc,
  posterSrc,
  compact = false,
}) => {
  return (
    <div
      className={`w-full bg-[#111827] border rounded-lg overflow-hidden shadow-sm transition-all duration-500 group
      ${isSpeaking ? 'border-indigo-500/50' : 'border-white/10'}`}
    >
      {/* Real Face Video Area */}
      <div
        className={`relative bg-black overflow-hidden
        ${compact ? 'aspect-[4/3]' : 'h-[160px] lg:h-[200px] w-full'}`}
      >
        <AlisaVideoPlayer
          isSpeaking={isSpeaking}
          idleSrc={idleVideoSrc}
          speakingSrc={speakingVideoSrc}
          posterSrc={posterSrc}
        />

        {/* Status Badge Overlay */}
        <div className="absolute top-2 left-2 z-20">
          <div
            className={`flex items-center gap-1.5 rounded-full backdrop-blur-md border border-white/10 px-2 py-0.5 bg-black/40`}
          >
            <div
              className={`w-1 h-1 rounded-full ${isSpeaking ? 'bg-indigo-400 animate-pulse' : 'bg-slate-500'}`}
            ></div>
            <span className="font-semibold uppercase tracking-widest text-white text-[7px]">
              {isSpeaking ? 'Speaking' : status}
            </span>
          </div>
        </div>
      </div>

      {/* Profile & Identity Area */}
      <div className="p-2 lg:p-3 relative">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-white tracking-tight leading-none">{name}</h3>
            <ShieldCheck className="w-3 h-3 text-indigo-500" />
          </div>
          <p className="text-[9px] font-medium text-slate-500 uppercase tracking-widest leading-none mt-1">
            {role}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AlisaFacePanel;
