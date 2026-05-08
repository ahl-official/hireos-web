import { useState, useEffect } from 'react';
import {
  UploadCloud, CheckCircle, Copy, MessageCircle, Loader2,
  RefreshCw, AlertTriangle, ListOrdered, FilePlus2, Users,
  TrendingUp, Clock, X, ChevronRight, Shield, CheckCircle2, XCircle, Trash2, Search
} from 'lucide-react';
import { extractTextFromPDF } from '../utils/pdfParser';
import { addCandidate, getAllCandidates, getCandidateDetails, generateQuestions, deleteCandidate, deleteCandidates } from '../utils/googleSheets';

/* ─── Small helpers ─────────────────────────────── */
const StatusBadge = ({ status }) => {
  const s = status === 'Completed'
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : 'bg-amber-100 text-amber-700 border-amber-200';
  return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${s}`}>{status || 'Pending'}</span>;
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color}`}><Icon className="w-5 h-5 text-white" /></div>
    <div>
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  </div>
);

/* ─── Candidate Detail Slide-over Panel ─────────── */
function CandidateDetailPanel({ candidateId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getCandidateDetails(candidateId);
        if (!data) throw new Error('Not found');

        const parse = (v) => {
          if (!v) return [];
          try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return []; }
        };

        setDetail({
          ...data,
          questions: parse(data.questions),
          correctAnswers: parse(data.correctAnswers),
          candidateAnswers: parse(data.candidateAnswers),
          topics: parse(data.topics),
          difficulty: parse(data.difficulty),
          perQuestionScores: parse(data.perQuestionScores),
        });
      } catch {
        setError('Could not load candidate details.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [candidateId]);

  const scoreColor = (s) => {
    const n = Number(s);
    if (n >= 70) return 'text-emerald-600';
    if (n >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-30 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {loading ? 'Loading...' : detail?.name || 'Candidate Report'}
            </h2>
            {detail && (
              <div className="text-xs text-slate-500 mt-1 flex flex-col gap-0.5">
                <span>Generated: {new Date(detail.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                {detail.submittedAt && <span>Submitted: {new Date(detail.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          )}

          {error && (
            <div className="text-center py-10 text-red-500">{error}</div>
          )}

          {!loading && detail && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <StatusBadge status={detail.status} />
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">AI Score</p>
                  <p className={`text-2xl font-extrabold ${scoreColor(detail.score)}`}>
                    {detail.status === 'Completed' ? `${detail.score}%` : '—'}
                  </p>
                </div>
                <div className={`rounded-xl p-4 text-center border ${Number(detail.tabSwitches) > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                  <p className="text-xs text-slate-500 mb-1">Tab Switches</p>
                  <p className={`text-2xl font-extrabold ${Number(detail.tabSwitches) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {detail.tabSwitches || 0}
                  </p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Contact Info</h3>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="font-medium w-16 text-slate-400">Mobile:</span>
                  +91 {detail.wp}
                </div>
                {detail.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="font-medium w-16 text-slate-400">Email:</span>
                    {detail.email}
                  </div>
                )}
              </div>

              {/* Questions & Answers */}
              {detail.questions.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assessment Questions</h3>
                  {detail.questions.map((q, i) => {
                    const candidateAns = detail.candidateAnswers?.[i] || null;
                    const correctAns = detail.correctAnswers?.[i] || '';
                    const topic = detail.topics?.[i];
                    const diff = detail.difficulty?.[i];
                    const qScore = detail.perQuestionScores?.[i];
                    const diffStyles = { medium: 'bg-blue-100 text-blue-700', hard: 'bg-orange-100 text-orange-700', very_hard: 'bg-red-100 text-red-700' };
                    return (
                      <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden">
                        {/* Question header */}
                        <div className="bg-indigo-50 px-4 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center shrink-0">{i + 1}</span>
                            {topic && <span className="text-xs bg-white text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">{topic}</span>}
                            {diff && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${diffStyles[diff] || 'bg-slate-100 text-slate-600'}`}>{diff.replace('_', ' ')}</span>}
                            {qScore && <span className="ml-auto text-xs font-bold text-indigo-700">{qScore.score}/10</span>}
                          </div>
                          <p className="text-sm font-semibold text-indigo-900">{q}</p>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {/* Expected Answer */}
                          <div className="px-4 py-3 flex gap-3">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-emerald-600 mb-1">Expected Answer</p>
                              <p className="text-sm text-slate-700">{correctAns}</p>
                            </div>
                          </div>

                          {/* Candidate Answer */}
                          <div className={`px-4 py-3 flex gap-3 ${!candidateAns ? 'opacity-50' : ''}`}>
                            {candidateAns
                              ? <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                              : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            }
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-1">Candidate's Answer</p>
                              <p className="text-sm text-slate-700 italic">{candidateAns || 'Not answered'}</p>
                            </div>
                          </div>

                          {/* AI Feedback */}
                          {qScore?.feedback && (
                            <div className="px-4 py-3 bg-amber-50 flex gap-3">
                              <span className="text-amber-500 text-xs shrink-0 mt-0.5">💬</span>
                              <div>
                                <p className="text-xs font-semibold text-amber-700 mb-1">AI Feedback</p>
                                <p className="text-xs text-amber-800">{qScore.feedback}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Candidate has not submitted the test yet.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Main Dashboard ─────────────────────────────── */
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('generate');
  const [formData, setFormData] = useState({ name: '', wp: '', email: '', position: '', timeLimit: '15' });
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [testLink, setTestLink] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [positionFilter, setPositionFilter] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchResults = async () => {
    setLoadingResults(true);
    try {
      const data = await getAllCandidates();
      setCandidates(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoadingResults(false); }
  };

  const filteredCandidates = candidates.filter(c => 
    !positionFilter || c.position?.toLowerCase().includes(positionFilter.toLowerCase())
  );

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this candidate?')) return;
    setIsDeleting(true);
    try {
      await deleteCandidate(id);
      await fetchResults();
      setSelectedCandidates(prev => prev.filter(selId => selId !== id));
    } catch {
      alert('Failed to delete candidate');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedCandidates.length} candidate(s)?`)) return;
    setIsDeleting(true);
    try {
      await deleteCandidates(selectedCandidates);
      setSelectedCandidates([]);
      await fetchResults();
    } catch {
      alert('Failed to delete candidates');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedCandidates.length === filteredCandidates.length && filteredCandidates.length > 0) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(filteredCandidates.map(c => c.id));
    }
  };

  const toggleSelect = (e, id) => {
    e.stopPropagation();
    setSelectedCandidates(prev => 
      prev.includes(id) ? prev.filter(selId => selId !== id) : [...prev, id]
    );
  };

  const handleInput = (e) => {
    const { name, value } = e.target;
    if (name === 'wp') {
      setFormData(p => ({ ...p, wp: value.replace(/\D/g, '').slice(0, 10) }));
    } else {
      setFormData(p => ({ ...p, [name]: value }));
    }
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f && (f.type === 'application/pdf' || f.name.endsWith('.pdf'))) setFile(f);
    else { alert('Please upload a valid PDF file.'); e.target.value = null; }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert('Please upload a CV (PDF)');
    if (formData.wp.length !== 10) return alert('Please enter a valid 10-digit mobile number.');
    try {
      setStatus('extracting');
      const cvText = await extractTextFromPDF(file);
      setStatus('generating');
      const generated = await generateQuestions(cvText, formData.position, Number(formData.timeLimit));
      setStatus('saving');
      const response = await addCandidate({
        name: formData.name, email: formData.email, wp: formData.wp, position: formData.position, timeLimit: formData.timeLimit,
        questions: JSON.stringify(generated.questions),
        answers: JSON.stringify(generated.correct_answers),
        topics: JSON.stringify(generated.topics || []),
        difficulty: JSON.stringify(generated.difficulty || []),
        questionTypes: JSON.stringify(generated.questionTypes || [])
      });
      const testId = response?.id || Date.now().toString();
      setTestLink(`${window.location.origin}/test/${testId}`);
      setStatus('success');
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred.');
      setStatus('error');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(testLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waMessage = () => encodeURIComponent(
`Hi ${formData.name},

You've been selected for an *AI Screening Assessment*.

📋 *Instructions — Please read carefully:*
• Do NOT switch browser tabs or minimize the window. All activity is monitored.
• Copy-pasting is strictly disabled on this platform.
• Any cheating will be reported to HR automatically.
• Attempt all questions honestly.

🔗 Start your assessment here:
${testLink}

Good luck! 🚀`);

  const completedCount = candidates.filter(c => c.status === 'Completed').length;
  const avgScore = completedCount > 0
    ? Math.round(candidates.filter(c => c.status === 'Completed').reduce((a, c) => a + (Number(c.score) || 0), 0) / completedCount)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40 bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">H</span>
            </div>
            <span className="text-xl font-extrabold text-slate-800">HireOS</span>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            {[{ key: 'generate', icon: FilePlus2, label: 'Generate' }, { key: 'results', icon: Users, label: 'Results' }].map(tab => (
              <button key={tab.key} onClick={() => {
                setActiveTab(tab.key);
                if (tab.key === 'results') fetchResults();
              }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:block">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* ── GENERATE TAB ── */}
        {activeTab === 'generate' && (
          <div className="flex flex-col items-center">
            <div className="w-full max-w-lg">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-extrabold text-slate-900">New Assessment</h1>
                <p className="text-slate-500 mt-2 text-sm">Upload a CV to auto-generate a personalized technical test</p>
              </div>
              <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 sm:p-8">
                {status === 'success' ? (
                  <div className="flex flex-col items-center text-center gap-5 py-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-9 h-9 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Test Ready!</h3>
                      <p className="text-slate-500 text-sm mt-1">Share the link with the candidate via WhatsApp</p>
                    </div>
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 break-all font-mono">{testLink}</div>
                    <div className="w-full flex flex-col sm:flex-row gap-3">
                      <button onClick={copyLink} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold border transition-all ${copied ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                        <Copy className="w-4 h-4" />{copied ? 'Copied!' : 'Copy Link'}
                      </button>
                      <a href={`https://wa.me/91${formData.wp}?text=${waMessage()}`} target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-all">
                        <MessageCircle className="w-4 h-4" />Share on WhatsApp
                      </a>
                    </div>
                    <button onClick={() => { setStatus('idle'); setFormData({ name: '', wp: '', email: '', position: '', timeLimit: '15' }); setFile(null); }} className="text-sm text-indigo-600 hover:underline mt-2">
                      + Generate another test
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Candidate Name <span className="text-red-500">*</span></label>
                      <input name="name" type="text" required placeholder="e.g. Rahul Sharma"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={formData.name} onChange={handleInput} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Job Position <span className="text-red-500">*</span></label>
                      <input name="position" type="text" required placeholder="e.g. Frontend Developer"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={formData.position} onChange={handleInput} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mobile Number <span className="text-red-500">*</span></label>
                      <div className="flex rounded-xl overflow-hidden border border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500">
                        <span className="bg-slate-100 px-3 flex items-center text-sm text-slate-600 border-r border-slate-300 font-medium">+91</span>
                        <input name="wp" type="text" placeholder="9876543210" maxLength={10}
                          className="flex-1 px-4 py-2.5 text-sm focus:outline-none"
                          value={formData.wp} onChange={handleInput} required />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email <span className="text-slate-400 font-normal">(Optional)</span></label>
                      <input name="email" type="email" placeholder="rahul@example.com"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={formData.email} onChange={handleInput} />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Time Limit <span className="text-red-500">*</span></label>
                      <select name="timeLimit" className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={formData.timeLimit} onChange={handleInput}>
                        <option value="15">15 Minutes</option>
                        <option value="30">30 Minutes</option>
                        <option value="45">45 Minutes</option>
                        <option value="60">1 Hour</option>
                        <option value="90">1 Hour 30 Minutes</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">CV / Resume <span className="text-red-500">*</span></label>
                      <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-indigo-50 hover:border-indigo-400 transition-all group">
                        <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 transition-colors mb-2" />
                        <span className="text-sm text-slate-500 group-hover:text-indigo-600 font-medium">{file ? file.name : 'Click to upload PDF'}</span>
                        <span className="text-xs text-slate-400 mt-1">PDF only, max 10MB</span>
                        <input type="file" accept="application/pdf" className="sr-only" onChange={handleFile} />
                      </label>
                    </div>
                    {status === 'error' && <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-xl">{errorMessage}</div>}
                    <button type="submit" disabled={status !== 'idle' && status !== 'error'}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-200">
                      {status === 'idle' || status === 'error' ? 'Generate Test →' : (
                        <><Loader2 className="w-4 h-4 animate-spin" />
                          {status === 'extracting' ? 'Reading CV...' : status === 'generating' ? 'AI Generating Questions...' : 'Saving...'}</>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTS TAB ── */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">Results & Analytics</h1>
                <p className="text-slate-500 text-sm mt-1">Click on a candidate name to view the full report</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {selectedCandidates.length > 0 && (
                  <button onClick={handleBulkDelete} disabled={isDeleting} className="flex items-center gap-2 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-4 py-2 rounded-xl transition-all">
                    <Trash2 className="w-4 h-4" />{isDeleting ? 'Deleting...' : `Delete (${selectedCandidates.length})`}
                  </button>
                )}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input type="text" placeholder="Filter by position..." value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-64" />
                </div>
                <button onClick={fetchResults} disabled={loadingResults} className="flex items-center gap-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-xl transition-all disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${loadingResults ? 'animate-spin' : ''}`} />Refresh
                </button>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total" value={candidates.length} color="bg-indigo-500" />
              <StatCard icon={CheckCircle} label="Completed" value={completedCount} color="bg-emerald-500" />
              <StatCard icon={Clock} label="Pending" value={candidates.length - completedCount} color="bg-amber-500" />
              <StatCard icon={TrendingUp} label="Avg Score" value={completedCount ? `${avgScore}%` : '—'} color="bg-purple-500" />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-800">Candidate List</h3>
                <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Click a row to view full report</span>
              </div>

              {loadingResults ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              ) : candidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Users className="w-10 h-10 mb-3 opacity-50" />
                  <p className="text-sm font-medium">No candidates yet.</p>
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Search className="w-10 h-10 mb-3 opacity-50" />
                  <p className="text-sm font-medium">No candidates match your filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-3 w-10">
                          <input type="checkbox" checked={selectedCandidates.length === filteredCandidates.length && filteredCandidates.length > 0}
                            onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Candidate</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden sm:table-cell">Role</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Score</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Integrity</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredCandidates.map((c) => (
                        <tr key={c.id} onClick={() => setSelectedId(c.id)}
                          className="hover:bg-indigo-50/50 cursor-pointer transition-colors group">
                          <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedCandidates.includes(c.id)}
                              onChange={(e) => toggleSelect(e, c.id)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-semibold text-indigo-700 group-hover:text-indigo-900 flex items-center gap-1">
                              {c.name}
                              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 flex flex-col gap-1">
                              <span>{c.email ? c.email : `+91 ${c.wp}`}</span>
                              <span className="text-[10px]">Gen: {new Date(c.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 hidden sm:table-cell">
                            <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                              {c.position || 'Not specified'}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge status={c.status} />
                            {c.status === 'Completed' && c.submittedAt && (
                              <div className="text-[10px] text-slate-400 mt-1.5">
                                Sub: {new Date(c.submittedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {c.status === 'Completed' ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                  <div className={`h-1.5 rounded-full ${Number(c.score) >= 70 ? 'bg-emerald-500' : Number(c.score) >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                    style={{ width: `${c.score}%` }} />
                                </div>
                                <span className="font-bold text-slate-700">{c.score}%</span>
                              </div>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-4 hidden md:table-cell">
                            {Number(c.tabSwitches) > 0
                              ? <span className="flex items-center gap-1.5 text-red-600 font-medium"><AlertTriangle className="w-3.5 h-3.5" />{c.tabSwitches}x detected</span>
                              : <span className="text-emerald-600 font-medium">✓ Clean</span>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={(e) => handleDelete(e, c.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Candidate Detail Slide-over */}
      {selectedId && (
        <CandidateDetailPanel candidateId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
