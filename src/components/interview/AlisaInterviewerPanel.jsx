import React from 'react';
import { Bot, Mic, Loader2, Volume2 } from 'lucide-react';

/**
 * AlisaInterviewerPanel Component
 * A professional HR/AI interviewer card with video support and status indicators.
 *
 * @param {boolean} isSpeaking - Whether Alisa is currently speaking
 * @param {string} mode - "idle" | "speaking" | "listening" | "processing"
 * @param {string} avatarImage - Placeholder image URL
 * @param {string} idleVideo - URL for idle loop video
 * @param {string} speakingVideo - URL for speaking loop video
 * @param {string} label - Name label (default: "Alisa")
 */
const AlisaInterviewerPanel = ({
  isSpeaking = false,
  mode = 'idle',
  avatarImage,
  idleVideo,
  speakingVideo,
  label = 'Alisa',
}) => {
  // Status configuration
  const statusConfig = {
    idle: {
      label: 'Waiting',
      color: 'bg-on-surface-variant/20',
      textColor: 'text-on-surface-variant',
      icon: <Bot className="w-3 h-3" />,
    },
    speaking: {
      label: 'Speaking',
      color: 'bg-primary/20',
      textColor: 'text-primary',
      icon: <Volume2 className="w-3 h-3" />,
    },
    listening: {
      label: 'Listening',
      color: 'bg-error/20',
      textColor: 'text-error',
      icon: <Mic className="w-3 h-3" />,
    },
    processing: {
      label: 'Processing',
      color: 'bg-secondary/20',
      textColor: 'text-secondary',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
  };

  const currentStatus = statusConfig[mode] || statusConfig.idle;

  return (
    <div className="w-full bg-surface-container-low border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 hover:border-white/20">
      {/* Video/Avatar Area */}
      <div className="relative aspect-[4/3] bg-surface-container-highest overflow-hidden">
        {isSpeaking && speakingVideo ? (
          <video
            src={speakingVideo}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : idleVideo ? (
          <video
            src={idleVideo}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : avatarImage ? (
          <img src={avatarImage} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface-container-highest to-surface-container-low">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/30 mb-4">
              <span className="text-3xl font-bold text-primary">{label.charAt(0)}</span>
            </div>
            <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">
              AI Interviewer
            </p>
          </div>
        )}

        {/* Live Indicator Overlay */}
        <div className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 rounded-md bg-black/40 backdrop-blur-md border border-white/10">
          <div
            className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-primary animate-pulse' : 'bg-on-surface-variant'}`}
          ></div>
          <span className="text-[9px] font-bold text-white uppercase tracking-wider">Live AI</span>
        </div>

        {/* Speaking Audio Waveform */}
        {isSpeaking && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center gap-1 pb-3 px-4">
            {[...Array(8)].map((_, i) => {
              const r1 = [0.2, 0.8, 0.4, 0.9, 0.1, 0.7, 0.5, 0.3][i];
              const r2 = [0.7, 0.1, 0.9, 0.3, 0.8, 0.2, 0.6, 0.4][i];
              return (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full animate-bounce"
                  style={{
                    height: `${30 + r1 * 70}%`,
                    animationDuration: `${0.6 + r2 * 0.4}s`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                ></div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info & Status Area */}
      <div className="p-4 bg-surface-container-low">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-on-surface">{label}</h3>
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${currentStatus.color} ${currentStatus.textColor}`}
          >
            {currentStatus.icon}
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {currentStatus.label}
            </span>
          </div>
        </div>
        <p className="text-xs text-on-surface-variant">Senior AI Human Resources Partner</p>
      </div>
    </div>
  );
};

export default AlisaInterviewerPanel;
