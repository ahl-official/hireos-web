import { useState, useEffect } from 'react';
import {
  CheckCircle,
  Loader2,
  RefreshCw,
  FilePlus2,
  Users,
  Clock,
  ChevronRight,
  Mic,
  FileAudio,
  BookOpen,
} from 'lucide-react';
import {
  getAllCandidates,
  deleteCandidate,
  deleteCandidates,
  getAllAudioReviews,
  processAudioReview,
} from '../utils/googleSheets';
import AudioReviewDetailPanel from '../components/dashboard/AudioReviewDetailPanel';
import CandidateDetailPanel from '../components/dashboard/CandidateDetailPanel';
import ResultsTable from '../components/dashboard/ResultsTable';
import AudioReviewList from '../components/dashboard/AudioReviewList';
import GenerateTab from '../components/dashboard/GenerateTab';
import IcpTab from '../components/dashboard/IcpTab';

/* ─── Small helpers ─────────────────────────────── */
import StatCard from '../components/dashboard/StatCard';

const AUDIO_MAX_BYTES = 20 * 1024 * 1024;
const AUDIO_FILE_PATTERN =
  /\.(mp3|wav|m4a|aac|ogg|oga|flac|webm|mp4|mpeg|mpga|amr|3gp|mkv|mov|aif|aiff|caf|wma|opus)$/i;

/* ─── Main Dashboard ─────────────────────────────── */
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('generate');

  const [candidates, setCandidates] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [positionFilter, setPositionFilter] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [audioFormData, setAudioFormData] = useState({ name: '', role: '', hrNotes: '' });
  const [audioFile, setAudioFile] = useState(null);
  const [audioStatus, setAudioStatus] = useState('idle');
  const [audioError, setAudioError] = useState('');
  const [audioReviews, setAudioReviews] = useState([]);
  const [loadingAudioReviews, setLoadingAudioReviews] = useState(false);
  const [selectedAudioReviewId, setSelectedAudioReviewId] = useState(null);
  const [latestAudioReview, setLatestAudioReview] = useState(null);

  const fetchResults = async () => {
    setLoadingResults(true);
    try {
      const data = await getAllCandidates();
      setCandidates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingResults(false);
    }
  };

  const fetchAudioReviews = async () => {
    setLoadingAudioReviews(true);
    try {
      const data = await getAllAudioReviews();
      setAudioReviews(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAudioReviews(false);
    }
  };

  const filteredCandidates = candidates.filter(
    (c) => !positionFilter || c.position?.toLowerCase().includes(positionFilter.toLowerCase())
  );

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this candidate?')) return;
    setIsDeleting(true);
    try {
      await deleteCandidate(id);
      await fetchResults();
      setSelectedCandidates((prev) => prev.filter((selId) => selId !== id));
    } catch {
      alert('Failed to delete candidate');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (
      !window.confirm(`Are you sure you want to delete ${selectedCandidates.length} candidate(s)?`)
    )
      return;
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
      setSelectedCandidates(filteredCandidates.map((c) => c.id));
    }
  };

  const toggleSelect = (e, id) => {
    e.stopPropagation();
    setSelectedCandidates((prev) =>
      prev.includes(id) ? prev.filter((selId) => selId !== id) : [...prev, id]
    );
  };

  const handleAudioInput = (e) => {
    const { name, value } = e.target;
    setAudioFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAudioFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const looksLikeAudio =
      (f.type && (f.type.startsWith('audio/') || f.type.startsWith('video/'))) ||
      AUDIO_FILE_PATTERN.test(f.name || '');
    if (!looksLikeAudio) {
      alert('Please upload a valid audio or media file.');
      e.target.value = null;
      return;
    }
    if (f.size > AUDIO_MAX_BYTES) {
      alert('Please upload an audio file smaller than 20MB for this version.');
      e.target.value = null;
      return;
    }
    setAudioFile(f);
  };

  const handleAudioSubmit = async (e) => {
    e.preventDefault();
    if (!audioFormData.name.trim()) return alert('Please enter candidate name.');
    if (!audioFormData.role.trim()) return alert('Please enter role.');
    if (!audioFile) return alert('Please upload an audio file.');

    try {
      setAudioStatus('uploading');
      setAudioError('');

      const toBase64 = (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            let encoded = reader.result.toString().replace(/^data:(.*,)?/, '');
            if (encoded.length % 4 > 0) {
              encoded += '='.repeat(4 - (encoded.length % 4));
            }
            resolve(encoded);
          };
          reader.onerror = (error) => reject(error);
        });

      const audioBase64 = await toBase64(audioFile);

      setAudioStatus('processing');
      const payload = {
        name: audioFormData.name.trim(),
        role: audioFormData.role.trim(),
        hrNotes: audioFormData.hrNotes.trim(),
        audioBase64: audioBase64,
        audioFileName: audioFile.name,
        audioMimeType: audioFile.type || 'audio/mpeg',
      };

      const result = await processAudioReview(payload);

      setLatestAudioReview(result);
      setAudioStatus('success');
      setAudioFormData({ name: '', role: '', hrNotes: '' });
      setAudioFile(null);
      await fetchAudioReviews();
    } catch (err) {
      console.error(err);
      setAudioError(err.message || 'Could not process the audio review.');
      setAudioStatus('error');
    }
  };

  const completedCount = candidates.filter((c) => c.status === 'Completed').length;
  const avgScore =
    completedCount > 0
      ? Math.round(
          candidates
            .filter((c) => c.status === 'Completed')
            .reduce((a, c) => a + (Number(c.score) || 0), 0) / completedCount
        )
      : 0;
  const completedAudioReviews = audioReviews.filter(
    (review) => review.status === 'Completed'
  ).length;

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
            {[
              { key: 'generate', icon: FilePlus2, label: 'Generate' },
              { key: 'icp', icon: BookOpen, label: 'ICPs' },
              { key: 'results', icon: Users, label: 'Results' },
              { key: 'audio', icon: Mic, label: 'Audio Review' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === 'results') fetchResults();
                  if (tab.key === 'audio') fetchAudioReviews();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:block">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* ── GENERATE TAB ── */}
        {activeTab === 'generate' && <GenerateTab />}

        {/* ── ICP MANAGEMENT TAB ── */}
        {activeTab === 'icp' && <IcpTab />}

        {/* ── RESULTS TAB ── */}
        {activeTab === 'results' && (
          <ResultsTable
            candidates={candidates}
            filteredCandidates={filteredCandidates}
            selectedCandidates={selectedCandidates}
            positionFilter={positionFilter}
            setPositionFilter={setPositionFilter}
            loadingResults={loadingResults}
            fetchResults={fetchResults}
            handleDelete={handleDelete}
            handleBulkDelete={handleBulkDelete}
            toggleSelectAll={toggleSelectAll}
            toggleSelect={toggleSelect}
            setSelectedId={setSelectedId}
            isDeleting={isDeleting}
            completedCount={completedCount}
            avgScore={avgScore}
          />
        )}

        {/* ── AUDIO REVIEW TAB ── */}
        {activeTab === 'audio' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">Audio Interview Review</h1>
                <p className="text-slate-500 text-sm mt-1">
                  Upload interview audio directly, then we normalize, chunk, transcribe, and store
                  the final PDF in Drive.
                </p>
              </div>
              <button
                onClick={fetchAudioReviews}
                disabled={loadingAudioReviews}
                className="flex items-center gap-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-xl transition-all disabled:opacity-50 self-start sm:self-auto"
              >
                <RefreshCw className={`w-4 h-4 ${loadingAudioReviews ? 'animate-spin' : ''}`} />
                Refresh Reviews
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard
                icon={Mic}
                label="Audio Reviews"
                value={audioReviews.length}
                color="bg-indigo-600"
              />
              <StatCard
                icon={CheckCircle}
                label="Completed"
                value={completedAudioReviews}
                color="bg-emerald-500"
              />
              <StatCard
                icon={Clock}
                label="Pending"
                value={audioReviews.length - completedAudioReviews}
                color="bg-amber-500"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 sm:p-8">
                {audioStatus === 'success' && latestAudioReview ? (
                  <div className="flex flex-col gap-5">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">Audio review ready</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          Transcript, evaluation report, and Drive PDF have been created
                          successfully.
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {latestAudioReview.name}
                      </p>
                      <p className="text-xs text-slate-500">{latestAudioReview.role}</p>
                      <p className="text-sm text-slate-700">
                        {latestAudioReview.recommendation ||
                          'Recommendation will appear in the detailed report.'}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => setSelectedAudioReviewId(latestAudioReview.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                        View Detailed Report
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setAudioStatus('idle');
                        setLatestAudioReview(null);
                      }}
                      className="text-sm text-indigo-600 hover:underline self-start"
                    >
                      + Process another audio review
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleAudioSubmit} className="space-y-5">
                    <div className="text-center mb-2">
                      <h2 className="text-2xl font-extrabold text-slate-900">
                        Upload Interview Audio
                      </h2>
                      <p className="text-slate-500 mt-2 text-sm">
                        Supports audio uploads up to 50MB, transcribes them, and generates a
                        downloadable PDF report.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Candidate Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="name"
                        type="text"
                        required
                        placeholder="e.g. Shagufta Khan"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                        value={audioFormData.name}
                        onChange={handleAudioInput}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Role <span className="text-red-500">*</span>
                      </label>
                      <input
                        name="role"
                        type="text"
                        required
                        placeholder="e.g. Junior Cosmetology Doctor"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                        value={audioFormData.role}
                        onChange={handleAudioInput}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        HR Notes{' '}
                        <span className="text-slate-400 font-normal normal-case tracking-normal">
                          (Optional)
                        </span>
                      </label>
                      <textarea
                        name="hrNotes"
                        rows={4}
                        placeholder="Add any context for the evaluator, such as round type, clinic, or interview focus."
                        className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                        value={audioFormData.hrNotes}
                        onChange={handleAudioInput}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Interview Audio <span className="text-red-500">*</span>
                      </label>
                      <label className="group flex min-h-[168px] w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 text-center transition-all hover:border-indigo-400 hover:bg-indigo-50">
                        <FileAudio className="mb-3 h-9 w-9 text-slate-400 transition-colors group-hover:text-indigo-500" />
                        <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700">
                          {audioFile ? audioFile.name : 'Click to upload audio'}
                        </span>
                        <span className="mt-1 text-xs text-slate-400">
                          Audio/Media file, max 20MB.
                        </span>
                        <input
                          type="file"
                          accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.oga,.flac,.webm,.mp4,.mpeg,.amr,.3gp,.mkv,.mov,.aif,.aiff,.caf,.wma,.opus"
                          className="sr-only"
                          onChange={handleAudioFile}
                        />
                      </label>
                    </div>

                    {audioError && (
                      <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-xl">
                        {audioError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={audioStatus === 'uploading' || audioStatus === 'processing'}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {audioStatus === 'idle' || audioStatus === 'error' ? (
                        <>
                          Generate Audio Report <Mic className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {audioStatus === 'uploading'
                            ? 'Uploading Audio...'
                            : 'Transcribing & Generating Report...'}
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>

              <AudioReviewList
                loadingAudioReviews={loadingAudioReviews}
                audioReviews={audioReviews}
                setSelectedAudioReviewId={setSelectedAudioReviewId}
              />
            </div>
          </div>
        )}
      </main>

      {/* Candidate Detail Slide-over */}
      {selectedId && (
        <CandidateDetailPanel candidateId={selectedId} onClose={() => setSelectedId(null)} />
      )}
      {selectedAudioReviewId && (
        <AudioReviewDetailPanel
          reviewId={selectedAudioReviewId}
          onClose={() => setSelectedAudioReviewId(null)}
        />
      )}
    </div>
  );
}
