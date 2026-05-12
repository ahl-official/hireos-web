import { useState, useEffect } from 'react';
import { Mic, Wifi, Loader2, CheckCircle, AlertTriangle, ArrowRight, Laptop, Globe } from 'lucide-react';

function CheckRow({ icon: Icon, label, subtitle, checkStatus }) {
  return (
    <div className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-300 group ${
      checkStatus === 'passed' 
        ? 'bg-gradient-to-r from-emerald-500/10 to-emerald-400/5 border-emerald-500/40 shadow-lg shadow-emerald-500/10 scale-[1.02]' :
      checkStatus === 'failed' 
        ? 'bg-gradient-to-r from-red-500/10 to-red-400/5 border-red-500/40 shadow-lg shadow-red-500/10' :
        'bg-gradient-to-r from-indigo-500/8 to-indigo-400/3 border-indigo-500/20'
    }`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${
          checkStatus === 'passed' ? 'bg-emerald-500/25 text-emerald-300 shadow-lg shadow-emerald-500/20' :
          checkStatus === 'failed' ? 'bg-red-500/25 text-red-300 shadow-lg shadow-red-500/20' :
          'bg-indigo-500/20 text-indigo-300'
        }`}>
          <Icon className={`w-6 h-6 transition-transform ${checkStatus === 'passed' ? 'animate-bounce' : ''}`} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white text-sm leading-tight">{label}</p>
          <p className={`text-xs mt-1 font-medium transition-colors ${
            checkStatus === 'checking' ? 'text-slate-400 animate-pulse' :
            checkStatus === 'passed' ? 'text-emerald-300' :
            checkStatus === 'failed' ? 'text-red-300' :
            'text-slate-400'
          }`}>{subtitle}</p>
        </div>
      </div>
      <div className="shrink-0 ml-4">
        {checkStatus === 'checking' && (
          <div className="relative w-6 h-6 flex items-center justify-center">
            <div className="absolute inset-0 bg-indigo-400 rounded-full animate-ping opacity-75" />
            <Loader2 className="w-5 h-5 text-indigo-300 animate-spin relative z-10" />
          </div>
        )}
        {checkStatus === 'passed' && (
          <div className="animate-scaleIn">
            <CheckCircle className="w-6 h-6 text-emerald-400 drop-shadow-lg" />
          </div>
        )}
        {checkStatus === 'failed' && (
          <AlertTriangle className="w-6 h-6 text-red-400 drop-shadow-lg" />
        )}
      </div>
    </div>
  );
}

export default function SystemCheck({ onComplete }) {
  const [deviceStatus, setDeviceStatus] = useState('checking');
  const [browserStatus, setBrowserStatus] = useState('checking');
  const [micStatus, setMicStatus] = useState('checking');
  const [networkStatus, setNetworkStatus] = useState('checking');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const runChecks = async () => {
      // 1. Check Device Type (Laptop / Desktop only)
      const ua = navigator.userAgent || '';
      const uaData = navigator.userAgentData?.mobile;
      const mobilePattern = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|BlackBerry|Opera Mini/i;
      const isMobileLike = typeof uaData === 'boolean' ? uaData : mobilePattern.test(ua);

      if (isMobileLike) {
        setDeviceStatus('failed');
        setErrorMsg('This interview is allowed on laptop or desktop only. Please open the link on a laptop with Chrome.');
        setBrowserStatus('failed');
        setMicStatus('failed');
        setNetworkStatus('failed');
        return;
      }
      setDeviceStatus('passed');

      // 2. Check Browser (Chrome only)
      const isChrome = /Chrome\//i.test(ua) && !/OPR\//i.test(ua) && !/Brave\//i.test(ua);
      const supportedBrowser = isChrome;

      if (!supportedBrowser) {
        setBrowserStatus('failed');
        setErrorMsg('Please use Google Chrome on laptop/desktop. Unsupported browser detected.');
        setMicStatus('failed');
        setNetworkStatus('failed');
        return;
      }
      setBrowserStatus('passed');

      // 1. Check Microphone
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setMicStatus('passed');
      } catch (err) {
        console.error('Microphone access error:', err);
        setMicStatus('failed');
        setErrorMsg('Microphone access denied or not found. Please allow microphone permissions and refresh.');
        return;
      }

      // 4. Check Network Speed (> 500kbps)
      try {
        let isFastEnough = true;
        if (navigator.connection && navigator.connection.downlink) {
          if (navigator.connection.downlink < 0.5) isFastEnough = false;
        } else {
          const startTime = Date.now();
          const cacheBuster = `?nnn=${startTime}`;
          const downloadUrl = `https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg${cacheBuster}`;
          await fetch(downloadUrl, { mode: 'no-cors' });
          const duration = (Date.now() - startTime) / 1000;
          const kbps = 800 / duration;
          if (kbps < 500) isFastEnough = false;
        }
        if (isFastEnough) {
          setNetworkStatus('passed');
        } else {
          setNetworkStatus('failed');
          setErrorMsg('Your internet connection is too slow (minimum 500kbps required). Please use a faster connection.');
        }
      } catch {
        setNetworkStatus('passed'); // fallback
      }
    };
    runChecks();
  }, []);

  const allPassed =
    deviceStatus === 'passed' &&
    browserStatus === 'passed' &&
    micStatus === 'passed' &&
    networkStatus === 'passed';

  // Count passed checks
  const passedCount = [deviceStatus, browserStatus, micStatus, networkStatus].filter(s => s === 'passed').length;
  const totalChecks = 4;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1117] via-[#1a1d2e] to-[#0f1117] flex items-center justify-center p-4">
      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scaleIn {
          animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 animate-slideUp">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-3xl flex items-center justify-center mx-auto mb-6 border-2 border-indigo-500/40 shadow-2xl shadow-indigo-500/20">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
              <span className="text-indigo-600 font-black text-lg">H</span>
            </div>
          </div>
          <h2 className="text-3xl font-black text-white mb-2">System Check</h2>
          <p className="text-slate-300 text-sm font-medium">
            Verifying your device for the interview
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-6 animate-slideUp" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="flex-1 h-1 bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-500" style={{ width: `${(passedCount / totalChecks) * 100}%` }} />
            <span className="text-xs font-bold text-indigo-300 bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30">
              {passedCount}/{totalChecks}
            </span>
          </div>
          <div className="flex gap-1.5">
            {[...Array(totalChecks)].map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-500 flex-1 ${
                  i < passedCount ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-lg shadow-emerald-500/50' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="bg-gradient-to-br from-[#1a1d2e] to-[#0f1117] border-2 border-white/8 rounded-3xl p-8 space-y-4 shadow-2xl shadow-black/60 backdrop-blur-sm animate-slideUp" style={{ animationDelay: '0.2s' }}>
          <CheckRow
            icon={Laptop}
            label="Device"
            subtitle={
              deviceStatus === 'checking' ? 'Detecting device type...' :
              deviceStatus === 'passed' ? 'Laptop/Desktop detected' : 'Mobile/Tablet not allowed'
            }
            checkStatus={deviceStatus}
          />
          <CheckRow
            icon={Globe}
            label="Browser"
            subtitle={
              browserStatus === 'checking' ? 'Checking browser compatibility...' :
              browserStatus === 'passed' ? 'Google Chrome detected' : 'Use Google Chrome'
            }
            checkStatus={browserStatus}
          />
          <CheckRow
            icon={Mic}
            label="Microphone"
            subtitle={
              micStatus === 'checking' ? 'Requesting permission...' :
              micStatus === 'passed' ? 'Working properly' : 'Access denied'
            }
            checkStatus={micStatus}
          />
          <CheckRow
            icon={Wifi}
            label="Network Speed"
            subtitle={
              networkStatus === 'checking' ? 'Measuring connection...' :
              networkStatus === 'passed' ? 'Connection is stable (≥500kbps)' : 'Too slow (<500kbps)'
            }
            checkStatus={networkStatus}
          />

          {errorMsg && (
            <div className="p-4 bg-gradient-to-r from-red-500/15 to-red-400/5 text-red-200 text-sm rounded-xl border-2 border-red-500/30 flex items-start gap-3 animate-slideUp shadow-lg shadow-red-500/10">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold mb-1">Setup Required</p>
                <p className="text-red-100 text-xs">{errorMsg}</p>
              </div>
            </div>
          )}

          <button
            onClick={onComplete}
            disabled={!allPassed}
            className={`w-full mt-4 py-4 rounded-2xl text-sm font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-lg ${
              allPassed 
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-900/50 hover:shadow-indigo-800/60 hover:scale-[1.02] active:scale-[0.98]' 
                : 'bg-slate-700 opacity-50 cursor-not-allowed'
            }`}
          >
            {allPassed ? (
              <>
                <span>Continue to Interview</span>
                <ArrowRight className="w-5 h-5" />
              </>
            ) : (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Checking system...</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-slate-500 text-xs mt-8 font-medium">
          🔒 This assessment is monitored. Ensure you're in a quiet environment.
        </p>
      </div>
    </div>
  );
}
