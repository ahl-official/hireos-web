import { useState, useRef, useCallback, useEffect } from 'react';

export function useAlisaVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  const utteranceRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }

    const loadVoices = () => {
      // Warm up voices
      window.speechSynthesis.getVoices();
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // Call this synchronously inside onClick handlers before async await to bypass Chrome's autoplay policy drops.
  const unlockAudio = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const silentUtterance = new SpeechSynthesisUtterance('');
      silentUtterance.volume = 0;
      window.speechSynthesis.speak(silentUtterance);
    }
  }, []);

  const speak = useCallback((text, onEndCallback) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEndCallback?.();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    const femaleNames = [
      'samantha', 'victoria', 'karen', 'tessa', // macOS
      'zira', 'hazel', 'catherine', 'susan', 'aria', 'jenny', // Windows/Edge
      'google us english', 'google uk english female', // Chrome
      'female' // Generic fallback
    ];

    let preferred = voices.find(
      (v) => v.lang.startsWith('en') && femaleNames.some((name) => v.name.toLowerCase().includes(name))
    );

    if (!preferred) {
      preferred = voices.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('google'));
    }
    
    if (!preferred) {
      preferred = voices.find((v) => v.lang.startsWith('en'));
    }

    if (preferred) {
      utterance.voice = preferred;
    }

    // Calm, professional settings
    utterance.rate = 0.9; // Slightly slower for extreme clarity
    utterance.pitch = 1.02; // Very slight adjustment for a "friendly" tone
    utterance.volume = 1.0;

    let ended = false;

    utterance.onend = () => {
      if (ended) return;
      ended = true;
      setIsSpeaking(false);
      onEndCallback?.();
    };

    utterance.onerror = (event) => {
      console.error('SpeechSynthesis error:', event);
      if (ended) return;
      ended = true;
      setIsSpeaking(false);
      onEndCallback?.();
    };

    utteranceRef.current = utterance;

    // Direct call without setTimeout to prevent Chrome autoplay policy blocking
    window.speechSynthesis.speak(utterance);

    // Fallback timer: roughly 1 second per 15 characters, plus 2 seconds buffer.
    // If the browser blocks TTS (e.g., due to async network delays), we must not freeze the app.
    const estimatedDurationMs = (text.length / 15) * 1000 + 2000;
    setTimeout(() => {
      if (!ended) {
        console.warn('SpeechSynthesis fallback triggered (browser likely blocked TTS).');
        ended = true;
        setIsSpeaking(false);
        onEndCallback?.();
      }
    }, estimatedDurationMs);
  }, []);

  return {
    isSpeaking,
    isSupported,
    speak,
    stopSpeaking,
    unlockAudio,
  };
}
