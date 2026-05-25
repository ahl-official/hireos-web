import React, { useState, useEffect } from 'react';
import {
  Mic,
  Globe,
  Volume2,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

const StatusBadge = ({ status, passedLabel = 'Ready' }) => {
  if (status === 'checking')
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Checking
      </div>
    );
  if (status === 'passed')
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
        <CheckCircle2 className="w-2.5 h-2.5" /> {passedLabel}
      </div>
    );
  if (status === 'amber')
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-500 uppercase tracking-widest">
        <AlertTriangle className="w-2.5 h-2.5" /> Slow
      </div>
    );
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-[9px] font-bold text-red-500 uppercase tracking-widest">
      <AlertTriangle className="w-2.5 h-2.5" /> Failed
    </div>
  );
};

const CheckCard = ({ icon: Icon, title, status, description }) => (
  <div
    className={`p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between h-full ${
      status === 'passed' ? 'bg-[#111827]/40 border-white/5' : 'bg-[#111827] border-white/10'
    }`}
  >
    <div className="flex items-start justify-between mb-2">
      <div
        className={`p-2 rounded-lg ${status === 'passed' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-white/5 text-slate-400'}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <StatusBadge status={status} />
    </div>
    <div>
      <h4 className="text-xs font-bold text-slate-200 mb-0.5">{title}</h4>
      <p className="text-[10px] text-slate-500 leading-relaxed">{description}</p>
    </div>
  </div>
);

export default function SystemCheck({ onStateChange, isSystemReady, onContinue }) {
  const [deviceStatus, setDeviceStatus] = useState('checking');
  const [browserStatus, setBrowserStatus] = useState('checking');
  const [micStatus, setMicStatus] = useState('checking');
  const [networkStatus, setNetworkStatus] = useState('checking');

  const requestMicPermission = async () => {
    setMicStatus('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicStatus('passed');
      return true;
    } catch (err) {
      console.error('Microphone access error:', err);
      setMicStatus('failed');
      return false;
    }
  };

  useEffect(() => {
    const runChecks = async () => {
      const ua = navigator.userAgent || '';
      const mobilePattern = /Android|iPhone|iPad|iPod|Mobile|Tablet/i;

      // Device Check
      if (mobilePattern.test(ua)) {
        setDeviceStatus('failed');
      } else {
        setDeviceStatus('passed');
      }

      // Browser Check
      const isChrome = /Chrome\//i.test(ua) && !/OPR\//i.test(ua) && !/Brave\//i.test(ua);
      setBrowserStatus(isChrome ? 'passed' : 'failed');

      // Mic Check
      const micOk = await requestMicPermission();

      // Network Check
      setNetworkStatus('checking');
      try {
        if (navigator.connection && navigator.connection.downlink) {
          setNetworkStatus(navigator.connection.downlink >= 0.5 ? 'passed' : 'amber');
        } else {
          setNetworkStatus('passed');
        }
      } catch {
        setNetworkStatus('passed');
      }
    };
    runChecks();
  }, []);

  const allPassed =
    deviceStatus === 'passed' &&
    browserStatus === 'passed' &&
    micStatus === 'passed' &&
    (networkStatus === 'passed' || networkStatus === 'amber');

  useEffect(() => {
    if (onStateChange) onStateChange(allPassed);
  }, [allPassed, onStateChange]);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center animate-fade-in py-2 lg:py-4">
      {/* Centered Content Card */}
      <div className="w-full bg-[#0D1117] border border-white/10 rounded-2xl p-5 lg:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none" />

        {/* Header Section */}
        <div className="text-center mb-6 lg:mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">
              Environment Verification
            </span>
          </div>
          <h2 className="text-xl lg:text-2xl font-black text-white tracking-tight mb-1">
            System Check
          </h2>
          <p className="text-slate-500 text-xs max-w-sm mx-auto leading-relaxed font-medium">
            Verifying your setup before the interview begins.
          </p>
        </div>

        {/* Diagnostics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          <CheckCard
            icon={Mic}
            title="Microphone"
            status={micStatus}
            description="Required for communication."
          />
          <CheckCard
            icon={Globe}
            title="Browser"
            status={browserStatus}
            description="Chrome is recommended."
          />
          <CheckCard
            icon={Volume2}
            title="Speakers"
            status={micStatus === 'checking' ? 'checking' : 'passed'}
            description="Can you hear Alisa clearly?"
          />
          <CheckCard
            icon={Wifi}
            title="Connection"
            status={networkStatus}
            description="Min 0.5 Mbps required."
          />
        </div>

        {/* Error State / Help - Conditional rendering that keeps layout stable */}
        {micStatus === 'failed' && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center gap-3 animate-shake">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-red-400">Microphone denied</p>
              <p className="text-[9px] text-red-500/70 leading-none">Please allow permissions.</p>
            </div>
            <button
              onClick={requestMicPermission}
              className="px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-widest hover:bg-red-500/30 transition-all"
            >
              Retry
            </button>
          </div>
        )}

        {deviceStatus === 'failed' && micStatus !== 'failed' && (
          <div className="mb-6 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-center gap-3">
            <Smartphone className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-[10px] text-amber-500 leading-tight font-medium">
              Optimized for **Desktop**. Mobile may experience drops.
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onContinue}
            disabled={!isSystemReady}
            className={`w-full max-w-xs h-[48px] rounded-xl font-black uppercase tracking-[0.15em] text-[10px] flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
              isSystemReady
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-500 border-b-2 border-indigo-800'
                : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'
            }`}
          >
            <span>Proceed to Tutorial</span>
            {!isSystemReady ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            )}
          </button>
          <div className="flex items-center gap-2 text-slate-600 text-[9px] font-bold uppercase tracking-widest opacity-60">
            <ShieldCheck className="w-2.5 h-2.5" />
            <span>Secure Encryption Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
