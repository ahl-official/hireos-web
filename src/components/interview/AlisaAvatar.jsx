import React from 'react';

/**
 * AlisaAvatar Component
 * A professional AI human interviewer avatar with speaking animations.
 *
 * @param {boolean} isSpeaking - Whether Alisa is currently speaking
 * @param {string} size - Size of the avatar (sm, md, lg)
 * @param {string} imageSrc - Optional image URL for Alisa
 * @param {string} label - Name label (default: "Alisa")
 */
const AlisaAvatar = ({ isSpeaking = false, size = 'lg', imageSrc, label = 'Alisa' }) => {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32 md:w-40 md:h-40',
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.lg;

  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${currentSizeClass}`}>
        {/* Outer Pulse Rings - Only when speaking */}
        {isSpeaking && (
          <>
            <div
              className="absolute inset-0 rounded-full bg-primary/20 animate-ripple"
              style={{ animationDelay: '0s' }}
            ></div>
            <div
              className="absolute inset-0 rounded-full bg-primary/10 animate-ripple"
              style={{ animationDelay: '0.6s' }}
            ></div>
          </>
        )}

        {/* Avatar Container */}
        <div
          className={`relative z-10 w-full h-full rounded-full border-2 transition-all duration-500 overflow-hidden
          ${isSpeaking ? 'border-primary shadow-[0_0_30px_rgba(79,70,229,0.3)] scale-105' : 'border-white/20 scale-100'}
          bg-surface-container-high flex items-center justify-center`}
        >
          {imageSrc ? (
            <img src={imageSrc} alt={label} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-secondary/30 text-white text-4xl font-bold">
              {label.charAt(0)}
            </div>
          )}

          {/* Animated Waveform Overlay when speaking */}
          {isSpeaking && (
            <div className="absolute bottom-4 left-0 right-0 flex items-end justify-center gap-1 h-8 bg-black/20 backdrop-blur-sm pt-2">
              <div
                className="w-1 bg-primary rounded-full animate-bounce"
                style={{ height: '60%', animationDelay: '0.1s' }}
              ></div>
              <div
                className="w-1 bg-primary rounded-full animate-bounce"
                style={{ height: '100%', animationDelay: '0.2s' }}
              ></div>
              <div
                className="w-1 bg-primary rounded-full animate-bounce"
                style={{ height: '40%', animationDelay: '0.3s' }}
              ></div>
              <div
                className="w-1 bg-primary rounded-full animate-bounce"
                style={{ height: '80%', animationDelay: '0.4s' }}
              ></div>
              <div
                className="w-1 bg-primary rounded-full animate-bounce"
                style={{ height: '50%', animationDelay: '0.5s' }}
              ></div>
            </div>
          )}
        </div>

        {/* Speaking Badge */}
        {isSpeaking && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
            <div className="bg-primary px-3 py-1 rounded-full shadow-lg flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1 h-1 bg-white rounded-full animate-pulse"></span>
                <span
                  className="w-1 h-1 bg-white rounded-full animate-pulse"
                  style={{ animationDelay: '0.2s' }}
                ></span>
                <span
                  className="w-1 h-1 bg-white rounded-full animate-pulse"
                  style={{ animationDelay: '0.4s' }}
                ></span>
              </div>
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                {label} is speaking
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlisaAvatar;
