import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, CheckCircle2, AlertTriangle, XCircle, Play } from 'lucide-react';

export default function MicLevelCheck() {
  const [status, setStatus] = useState('idle'); // idle, testing, detected, quiet, blocked
  const [volume, setVolume] = useState(0);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const volumeHistoryRef = useRef([]);

  const stopTest = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    return () => stopTest();
  }, [stopTest]);

  const startTest = async () => {
    stopTest();
    setStatus('testing');
    setVolume(0);
    volumeHistoryRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const currentVol = Math.min(100, (average / 128) * 100);

        setVolume(currentVol);
        volumeHistoryRef.current.push(currentVol);

        // Keep last 50 frames (approx 0.8s)
        if (volumeHistoryRef.current.length > 50) {
          volumeHistoryRef.current.shift();
        }

        // Auto-detect after some samples
        if (volumeHistoryRef.current.length >= 30) {
          const maxVol = Math.max(...volumeHistoryRef.current);
          if (maxVol > 15) {
            setStatus('detected');
            stopTest();
            return;
          }
        }

        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();

      // Timeout after 8 seconds
      setTimeout(() => {
        setStatus((prev) => {
          if (prev === 'testing') {
            const maxVol = Math.max(...volumeHistoryRef.current);
            stopTest();
            return maxVol > 10 ? 'detected' : 'quiet';
          }
          return prev;
        });
      }, 8000);
    } catch (err) {
      console.error('Mic Test Error:', err);
      setStatus('blocked');
    }
  };

  return (
    <div className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
          <Mic className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="font-bold text-white uppercase tracking-wider text-sm">
            Check Your Microphone
          </h3>
          <p className="text-xs text-slate-400">
            Say one sentence like: "My microphone is working."
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Volume Bar Visualizer */}
        <div className="h-12 bg-black/20 border border-white/5 rounded-xl flex items-center px-4 gap-1 overflow-hidden relative">
          {status === 'testing' ? (
            <div className="flex items-center gap-1 w-full h-full">
              {[...Array(24)].map((_, i) => {
                const pseudoRand = [0.4, 0.8, 0.2, 0.9, 0.5, 0.1, 0.7, 0.3][i % 8];
                return (
                  <div
                    key={i}
                    className="flex-1 bg-indigo-500/60 rounded-full transition-all duration-75"
                    style={{ height: `${10 + pseudoRand * (volume * 0.8)}%` }}
                  />
                );
              })}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest bg-[#0d1117]/80 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  Listening... Speak now
                </span>
              </div>
            </div>
          ) : status === 'detected' ? (
            <div className="flex items-center justify-center w-full gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" /> Mic detected & ready
            </div>
          ) : status === 'quiet' ? (
            <div className="flex items-center justify-center w-full gap-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" /> Mic is too quiet
            </div>
          ) : status === 'blocked' ? (
            <div className="flex items-center justify-center w-full gap-2 text-red-400 font-bold text-sm">
              <XCircle className="w-4 h-4" /> Microphone permission blocked
            </div>
          ) : (
            <div className="flex items-center justify-center w-full text-slate-500 text-xs italic">
              Click the button below to test
            </div>
          )}
        </div>

        <button
          onClick={startTest}
          disabled={status === 'testing'}
          className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border active:scale-95 ${
            status === 'testing'
              ? 'bg-white/5 text-slate-500 border-white/5 cursor-not-allowed'
              : status === 'detected'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20'
          }`}
        >
          {status === 'testing' ? (
            'Testing...'
          ) : status === 'detected' ? (
            <>
              Test Again <Play className="w-3 h-3 fill-current" />
            </>
          ) : (
            <>
              Test Microphone <Play className="w-3 h-3 fill-current" />
            </>
          )}
        </button>
      </div>

      {status === 'blocked' && (
        <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-xs text-red-200/80 leading-relaxed">
            Please click the camera/lock icon in your browser address bar and set Microphone to{' '}
            <b>"Allow"</b>.
          </p>
        </div>
      )}
    </div>
  );
}
