import { useState, useRef, useCallback } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [maxVolumeReached, setMaxVolumeReached] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const stopResolverRef = useRef(null);
  const onDataAvailableRef = useRef(null);

  // Volume analysis
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const volumeRequestRef = useRef(null);

  const startVolumeAnalysis = useCallback((stream) => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    source.connect(analyser);
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    audioContextRef.current = audioContext;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
      if (!analyserRef.current) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const currentVol = Math.min(100, (average / 128) * 100);
      setVolumeLevel(currentVol);
      setMaxVolumeReached((prev) => Math.max(prev, currentVol));
      volumeRequestRef.current = requestAnimationFrame(updateVolume);
    };
    updateVolume();
  }, []);

  const startRecording = useCallback(
    async (onDataAvailable) => {
      setAudioBlob(null);
      setDurationSeconds(0);
      setVolumeLevel(0);
      onDataAvailableRef.current = onDataAvailable;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        startVolumeAnalysis(stream);

        const supportedMimeTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/ogg',
          'audio/mp4',
        ];
        const selectedMimeType =
          supportedMimeTypes.find(
            (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)
          ) || '';
        const mediaRecorder = selectedMimeType
          ? new MediaRecorder(stream, { mimeType: selectedMimeType })
          : new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        console.log(
          '[useAudioRecorder] Starting recording with MIME type:',
          selectedMimeType || 'default'
        );
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
            if (onDataAvailableRef.current) {
              onDataAvailableRef.current(e.data);
            }
          }
        };

        mediaRecorder.onstop = () => {
          const blobType = mediaRecorder.mimeType || selectedMimeType || 'audio/webm';
          console.log(
            '[useAudioRecorder] Recording stopped. Total chunks:',
            audioChunksRef.current.length
          );
          const blob = new Blob(audioChunksRef.current, { type: blobType });
          console.log('[useAudioRecorder] Final Blob created:', {
            size: blob.size,
            type: blob.type,
          });

          // Cleanup resources only AFTER blob is created
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          if (volumeRequestRef.current) cancelAnimationFrame(volumeRequestRef.current);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(() => {});
          }

          setAudioBlob(blob);
          if (stopResolverRef.current) {
            stopResolverRef.current(blob);
            stopResolverRef.current = null;
          }
        };

        // Start without timeslice for batch (default) - more stable container
        mediaRecorder.start();
        setIsRecording(true);

        timerIntervalRef.current = setInterval(() => {
          setDurationSeconds((p) => p + 1);
        }, 1000);
      } catch (err) {
        console.error('Mic access denied:', err);
        throw new Error(
          'Microphone access is required for the interview. Please allow microphone permission and try again.'
        );
      }
    },
    [startVolumeAnalysis]
  );

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      stopResolverRef.current = resolve;

      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        onDataAvailableRef.current = null;
        stopResolverRef.current = null;
        resolve(audioBlob);
        return;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);

      // onstop handler will handle cleanup and resolver resolution

      analyserRef.current = null;
      // We'll clear onDataAvailableRef.current in onstop or after a timeout to be safe
      setTimeout(() => {
        onDataAvailableRef.current = null;
      }, 100);
    });
  }, [audioBlob]);

  const resetRecording = useCallback(() => {
    setAudioBlob(null);
    setDurationSeconds(0);
    setVolumeLevel(0);
  }, []);

  const blobToBase64 = useCallback(async (blob) => {
    if (!blob) return null;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }, []);

  return {
    isRecording,
    audioBlob,
    durationSeconds,
    volumeLevel,
    maxVolumeReached,
    startRecording,
    stopRecording,
    resetRecording,
    blobToBase64,
  };
}
