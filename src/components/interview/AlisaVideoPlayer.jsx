import React, { useRef, useEffect } from 'react';

/**
 * AlisaVideoPlayer Component
 * Handles seamless switching between idle and speaking video loops.
 *
 * @param {boolean} isSpeaking - Whether Alisa is currently speaking
 * @param {string} idleSrc - URL for idle loop video
 * @param {string} speakingSrc - URL for speaking loop video
 * @param {string} posterSrc - URL for poster image
 */
const AlisaVideoPlayer = ({ isSpeaking = false, idleSrc, speakingSrc, posterSrc }) => {
  const idleVideoRef = useRef(null);
  const speakingVideoRef = useRef(null);

  useEffect(() => {
    if (isSpeaking) {
      if (speakingVideoRef.current) {
        speakingVideoRef.current.play().catch((e) => console.log('Auto-play prevented', e));
      }
      if (idleVideoRef.current) {
        idleVideoRef.current.pause();
      }
    } else {
      if (idleVideoRef.current) {
        idleVideoRef.current.play().catch((e) => console.log('Auto-play prevented', e));
      }
      if (speakingVideoRef.current) {
        speakingVideoRef.current.pause();
      }
    }
  }, [isSpeaking]);

  return (
    <div className="relative w-full h-full bg-surface-container-highest overflow-hidden">
      {/* Idle Video Layer */}
      <video
        ref={idleVideoRef}
        src={idleSrc}
        poster={posterSrc}
        muted
        loop
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${isSpeaking ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Speaking Video Layer */}
      <video
        ref={speakingVideoRef}
        src={speakingSrc}
        muted
        loop
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${isSpeaking ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Fallback/Poster if no video sources */}
      {!idleSrc && !speakingSrc && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-surface-container-highest">
          {posterSrc ? (
            <img src={posterSrc} alt="Alisa Poster" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface-container-highest to-surface-container-low">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <span className="text-4xl font-bold text-primary/40">A</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlisaVideoPlayer;
