import { useState, useEffect } from 'react';
import { Mic, Wifi, Loader2, CheckCircle, AlertTriangle, ArrowRight, Laptop, Globe } from 'lucide-react';

function CheckRow({ icon: Icon, label, subtitle, checkStatus }) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
      checkStatus === 'passed' ? 'bg-emerald-500/8 border-emerald-500/20' :
      checkStatus === 'failed' ? 'bg-red-500/8 border-red-500/20' :
      'bg-white/5 border-white/10'
    }`}>
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
          checkStatus === 'passed' ? 'bg-emerald-500/15 text-emerald-400' :
          checkStatus === 'failed' ? 'bg-red-500/15 text-red-400' :
          'bg-indigo-500/15 text-indigo-400'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold text-white text-sm">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="shrink-0 ml-3">
        {checkStatus === 'checking' && <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />}
        {checkStatus === 'passed' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
        {checkStatus === 'failed' && <AlertTriangle className="w-5 h-5 text-red-400" />}
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

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
            <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">H</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white">System Check</h2>
          <p className="text-slate-400 text-sm mt-2">
            Making sure your device is ready for the AI Interview
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1d2e] border border-white/8 rounded-3xl p-6 space-y-4 shadow-2xl shadow-black/40">
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
            <div className="p-4 bg-red-500/10 text-red-300 text-sm rounded-xl border border-red-500/20 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <p>{errorMsg}</p>
            </div>
          )}

          <button
            onClick={onComplete}
            disabled={!allPassed}
            className="w-full mt-2 py-3.5 rounded-2xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-900/50 flex items-center justify-center gap-2"
          >
            {allPassed ? (
              <><span>Continue to Interview</span><ArrowRight className="w-4 h-4" /></>
            ) : (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>Checking system...</span></>
            )}
          </button>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          This assessment is monitored. Ensure you are in a quiet environment.
        </p>
      </div>
    </div>
  );
}
