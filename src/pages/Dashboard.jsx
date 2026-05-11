import { useState, useEffect } from 'react';
import {
  UploadCloud, CheckCircle, Copy, MessageCircle, Loader2,
  RefreshCw, AlertTriangle, ListOrdered, FilePlus2, Users,
  TrendingUp, Clock, X, ChevronRight, Shield, CheckCircle2, XCircle, Trash2, Search,
  Download, Mic, FileAudio, ExternalLink
} from 'lucide-react';
import { extractTextFromPDF } from '../utils/pdfParser';
import {
  addCandidate,
  getAllCandidates,
  getCandidateDetails,
  generateQuestions,
  regenerateReport,
  generateDetailedSummary,
  deleteCandidate,
  deleteCandidates,
  getAllAudioReviews,
  getAudioReviewDetails,
  regenerateAudioReview,
  processAudioReview
} from '../utils/googleSheets';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';


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

const parseJsonOrArray = (value) => {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};

const normalizeFlagItems = (flags) => {
  if (!Array.isArray(flags)) return [];
  return flags
    .map((flag) => {
      if (typeof flag === 'string') {
        return { title: flag, detail: '' };
      }
      if (!flag || typeof flag !== 'object') return null;
      const title = String(flag.title || flag.label || flag.name || '').trim();
      const detail = String(flag.detail || flag.description || flag.reason || '').trim();
      if (!title && !detail) return null;
      return {
        title: title || 'Flag',
        detail
      };
    })
    .filter(Boolean);
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const toPercentScore = (value) => {
  const num = Number(value || 0);
  return num <= 10 ? Math.round(num * 10) : Math.round(num);
};

const AUDIO_MAX_BYTES = 20 * 1024 * 1024;
const AUDIO_FILE_PATTERN = /\.(mp3|wav|m4a|aac|ogg|oga|flac|webm|mp4|mpeg|mpga|amr|3gp|mkv|mov|aif|aiff|caf)$/i;

const buildReportSummary = (detail) => {
  if (!detail) return '';
  const perScores = parseJsonOrArray(detail.perQuestionScores) || [];
  const questionTypes = parseJsonOrArray(detail.questionTypes) || [];

  if (!perScores.length) return 'Candidate has not completed the test yet.';

  const scores = perScores.map(q => toPercentScore(q?.score || 0));
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  const hrScores = perScores.filter((_, i) => questionTypes[i] === 'hr').map(q => toPercentScore(q?.score || 0));
  const techScores = perScores.filter((_, i) => questionTypes[i] === 'technical').map(q => toPercentScore(q?.score || 0));
  const hrAvg = hrScores.length ? Math.round(hrScores.reduce((a, b) => a + b, 0) / hrScores.length) : 0;
  const techAvg = techScores.length ? Math.round(techScores.reduce((a, b) => a + b, 0) / techScores.length) : 0;

  const parts = [];
  if (avgScore >= 70) {
    parts.push('Strong overall performance');
  } else if (avgScore >= 50) {
    parts.push('Moderate overall performance');
  } else {
    parts.push('Needs improvement in answers');
  }

  if (hrAvg > 0 && techAvg > 0) {
    if (hrAvg > techAvg + 10) {
      parts.push(`excels in HR questions (${hrAvg}% avg)`);
    } else if (techAvg > hrAvg + 10) {
      parts.push(`excels in technical questions (${techAvg}% avg)`);
    }
  }

  const consistency = maxScore - minScore;
  if (consistency > 40) {
    parts.push('with inconsistent answer quality');
  }

  const switches = Number(detail.tabSwitches) || 0;
  if (switches > 0) {
    parts.push(`${switches} tab switch${switches === 1 ? '' : 'es'}`);
  }

  return parts.join(', ') + '.';
};

const buildReportFlags = (detail) => {
  const redFlags = [];
  const greenFlags = [];
  if (!detail) return { redFlags, greenFlags };

  const perScores = parseJsonOrArray(detail.perQuestionScores) || [];
  const questionTypes = parseJsonOrArray(detail.questionTypes) || [];
  const candidateAnswers = parseJsonOrArray(detail.candidateAnswers) || [];

  if (!perScores.length) {
    redFlags.push('Test not completed');
    return { redFlags, greenFlags };
  }

  const scores = perScores.map(q => toPercentScore(q?.score || 0));
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highScores = scores.filter(s => s >= 80).length;
  const lowScores = scores.filter(s => s <= 30).length;

  const hrScores = perScores.filter((_, i) => questionTypes[i] === 'hr').map(q => toPercentScore(q?.score || 0));
  const techScores = perScores.filter((_, i) => questionTypes[i] === 'technical').map(q => toPercentScore(q?.score || 0));
  const hrAvg = hrScores.length ? Math.round(hrScores.reduce((a, b) => a + b, 0) / hrScores.length) : 0;
  const techAvg = techScores.length ? Math.round(techScores.reduce((a, b) => a + b, 0) / techScores.length) : 0;

  const emptyAnswers = candidateAnswers.filter(ans => !ans || String(ans).trim() === '').length;
  const switches = Number(detail.tabSwitches) || 0;
  const consistency = Math.max(...scores) - Math.min(...scores);

  // RED FLAGS: Real performance issues
  if (techScores.length > 0 && techAvg < 40) {
    redFlags.push(`Weak technical answers (${techAvg}%)`);
  }
  if (hrScores.length > 0 && hrAvg < 40) {
    redFlags.push(`Poor HR responses (${hrAvg}%)`);
  }
  if (emptyAnswers > 0) {
    redFlags.push(`${emptyAnswers} unanswered question${emptyAnswers === 1 ? '' : 's'}`);
  }
  if (lowScores >= Math.ceil(scores.length / 2)) {
    redFlags.push('Mostly weak answers');
  }
  if (consistency > 50) {
    redFlags.push('Very inconsistent performance');
  }
  if (switches > 2) {
    redFlags.push(`Multiple tab switches (${switches}x)`);
  } else if (switches === 1) {
    redFlags.push('One tab switch');
  }

  // GREEN FLAGS: Positive indicators
  if (detail.status === 'Completed') {
    greenFlags.push('Completed test');
  }
  if (avgScore >= 70) {
    greenFlags.push(`Strong answers (${avgScore}% avg)`);
  } else if (avgScore >= 50) {
    greenFlags.push(`Solid effort (${avgScore}% avg)`);
  }
  if (highScores >= Math.ceil(scores.length / 3)) {
    greenFlags.push(`${highScores} excellent answer${highScores === 1 ? '' : 's'}`);
  }
  if (techScores.length > 0 && techAvg >= 70) {
    greenFlags.push(`Strong technical (${techAvg}%)`);
  }
  if (hrScores.length > 0 && hrAvg >= 70) {
    greenFlags.push(`Good communication (${hrAvg}%)`);
  }
  if (switches === 0) {
    greenFlags.push('Full focus');
  }
  if (consistency <= 20) {
    greenFlags.push('Consistent quality');
  }
  if (emptyAnswers === 0 && avgScore >= 50) {
    greenFlags.push('Complete effort');
  }

  return {
    redFlags: Array.from(new Set(redFlags)),
    greenFlags: Array.from(new Set(greenFlags)),
  };
};

/* ─── Candidate Detail Slide-over Panel ─────────── */
function CandidateDetailPanel({ candidateId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [regeneratingReport, setRegeneratingReport] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const [detailedSummary, setDetailedSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

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
          questionTypes: parse(data.questionTypes),
        });
      } catch {
        setError('Could not load candidate details.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [candidateId]);

  useEffect(() => {
    let ignore = false;

    const loadDetailedSummary = async () => {
      if (!detail || detail.status !== 'Completed' || !detail.questions?.length || !detail.candidateAnswers?.length) {
        setDetailedSummary(null);
        setLoadingSummary(false);
        return;
      }

      try {
        setLoadingSummary(true);
        const result = await generateDetailedSummary(
          detail.questions,
          detail.candidateAnswers,
          detail.perQuestionScores || [],
          detail.questionTypes || [],
          detail.topics || []
        );

        if (!ignore) {
          setDetailedSummary({
            summary: result?.summary || '',
            recommendation: result?.recommendation || '',
            greenFlags: normalizeFlagItems(result?.greenFlags),
            redFlags: normalizeFlagItems(result?.redFlags),
          });
        }
      } catch (err) {
        console.error('Detailed summary generation failed:', err);
        if (!ignore) {
          setDetailedSummary(null);
        }
      } finally {
        if (!ignore) {
          setLoadingSummary(false);
        }
      }
    };

    loadDetailedSummary();
    return () => { ignore = true; };
  }, [detail]);

  const scoreColor = (s) => {
    const n = Number(s);
    if (n >= 70) return 'text-emerald-600';
    if (n >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const handleDownloadPdf = async () => {
    if (!detail || downloadingPdf) return;

    try {
      setDownloadingPdf(true);
      const safeName = (detail.name || 'candidate-report').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
      const safeRole = (detail.position || detail.role || 'report').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'report';
      const downloadName = `${safeName}-${safeRole}.pdf`;

      const questionRows = (detail.questions || []).map((q, i) => {
        const candidateAns = detail.candidateAnswers?.[i] || 'Not answered';
        const correctAns = detail.correctAnswers?.[i] || '';
        const topic = detail.topics?.[i] || '';
        const diff = detail.difficulty?.[i] || '';
        const qScore = detail.perQuestionScores?.[i];

        return `
          <div class="q-card">
            <div class="q-head">
              <div class="q-num">${i + 1}</div>
              <div class="q-meta">${topic ? `<span>${topic}</span>` : ''}${diff ? `<span>${String(diff).replace('_', ' ')}</span>` : ''}${qScore ? `<span class="score">${qScore.score}/10</span>` : ''}</div>
            </div>
            <div class="q-title">${q}</div>
            <div class="section"><strong>Expected Answer</strong><div>${correctAns || '—'}</div></div>
            <div class="section"><strong>Candidate's Answer</strong><div>${candidateAns}</div></div>
            ${qScore?.feedback ? `<div class="section feedback"><strong>AI Feedback</strong><div>${qScore.feedback}</div></div>` : ''}
          </div>`;
      }).join('');

      const fallbackFlags = buildReportFlags(detail);
      const greenFlagItems = detailedSummary?.greenFlags?.length
        ? detailedSummary.greenFlags
        : fallbackFlags.greenFlags.map((flag) => ({ title: flag, detail: '' }));
      const redFlagItems = detailedSummary?.redFlags?.length
        ? detailedSummary.redFlags
        : fallbackFlags.redFlags.map((flag) => ({ title: flag, detail: '' }));

      const renderFlagRows = (items, tone) => items.length
        ? items.map((flag) => `
          <div class="flag-row ${tone}">
            <div class="flag-title">${escapeHtml(flag.title)}</div>
            <div class="flag-detail">${escapeHtml(flag.detail || 'Supported by overall assessment and candidate responses.')}</div>
          </div>
        `).join('')
        : `<div class="flag-empty">No major ${tone === 'green' ? 'positive' : 'risk'} indicators captured.</div>`;

      const html = `<!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${detail.name || 'Candidate Report'}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 0; }
          .page { width: 1200px; padding: 24px; box-sizing: border-box; background: #ffffff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
          h1 { margin: 0; font-size: 30px; }
          .sub { color: #64748b; font-size: 14px; margin-top: 6px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
          .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background: #f8fafc; }
          .label { font-size: 12px; color: #64748b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .04em; }
          .value { font-size: 18px; font-weight: 700; }
          .section-block { margin-top: 16px; }
          .section-title { font-size: 12px; font-weight: 700; color: #475569; margin: 0 0 10px; text-transform: uppercase; letter-spacing: .06em; }
          .contact { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 16px; }
          .summary-box { border: 1px solid #dbeafe; border-radius: 12px; padding: 14px; margin-bottom: 16px; background: #f8fbff; }
          .summary-text { font-size: 13px; line-height: 1.6; color: #1e293b; }
          .recommendation { margin-top: 10px; font-size: 12px; color: #0f172a; }
          .flag-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
          .flag-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
          .flag-card.green { background: #f0fdf4; border-color: #bbf7d0; }
          .flag-card.red { background: #fef2f2; border-color: #fecaca; }
          .flag-row { border-top: 1px solid rgba(148, 163, 184, 0.2); padding-top: 8px; margin-top: 8px; }
          .flag-row:first-child { border-top: none; padding-top: 0; margin-top: 0; }
          .flag-title { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
          .flag-card.green .flag-title { color: #166534; }
          .flag-card.red .flag-title { color: #991b1b; }
          .flag-detail, .flag-empty { font-size: 12px; color: #334155; line-height: 1.5; }
          .q-card { border: 1px solid #cbd5e1; border-radius: 14px; overflow: hidden; margin-bottom: 12px; }
          .q-head { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #eef2ff; }
          .q-num { width: 28px; height: 28px; border-radius: 999px; background: #4f46e5; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
          .q-meta span { display: inline-block; background: white; border: 1px solid #cbd5e1; border-radius: 999px; padding: 2px 8px; font-size: 10px; margin-right: 6px; color: #334155; }
          .q-meta .score { background: #e0e7ff; color: #3730a3; }
          .q-title { padding: 10px 12px; font-weight: 700; color: #1e293b; }
          .section { padding: 10px 12px; border-top: 1px solid #e2e8f0; font-size: 12px; }
          .section strong { display: block; font-size: 11px; color: #059669; margin-bottom: 4px; text-transform: uppercase; }
          .feedback strong { color: #b45309; }
          .footer { margin-top: 20px; font-size: 11px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div>
              <h1>${detail.name || 'Candidate Report'}</h1>
              <div class="sub">Generated: ${new Date(detail.timestamp || Date.now()).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}${detail.submittedAt ? ` • Submitted: ${new Date(detail.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</div>
            </div>
          </div>

          <div class="grid">
            <div class="card"><div class="label">Status</div><div class="value">${detail.status || 'Pending'}</div></div>
            <div class="card"><div class="label">AI Score</div><div class="value">${detail.status === 'Completed' ? `${detail.score}%` : '—'}</div></div>
            <div class="card"><div class="label">Tab Switches</div><div class="value">${detail.tabSwitches || 0}</div></div>
          </div>

          <div class="contact">
            <div class="section-title">Contact Info</div>
            <div><strong>Mobile:</strong> +91 ${detail.wp || ''}</div>
            ${detail.email ? `<div style="margin-top:6px"><strong>Email:</strong> ${detail.email}</div>` : ''}
          </div>

          <div class="summary-box">
            <div class="section-title">Hiring Summary</div>
            <div class="summary-text">${escapeHtml(detailedSummary?.summary || buildReportSummary(detail))}</div>
            ${(detailedSummary?.recommendation || '').trim() ? `<div class="recommendation"><strong>Recommendation:</strong> ${escapeHtml(detailedSummary.recommendation)}</div>` : ''}
          </div>

          <div class="flag-grid">
            <div class="flag-card green">
              <div class="section-title">Green Flags</div>
              ${renderFlagRows(greenFlagItems, 'green')}
            </div>
            <div class="flag-card red">
              <div class="section-title">Red Flags</div>
              ${renderFlagRows(redFlagItems, 'red')}
            </div>
          </div>

          <div class="section-block">
            <div class="section-title">Assessment Questions</div>
            ${questionRows || '<div>No submitted answers.</div>'}
          </div>

          <div class="footer">HireOS candidate report</div>
        </div>
      </body>
      </html>`;

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '1200px';
      tempContainer.style.background = '#ffffff';
      tempContainer.innerHTML = html;
      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(downloadName);
      document.body.removeChild(tempContainer);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Could not generate the PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleRegenerateReport = async () => {
    if (!detail || regeneratingReport) return;
    try {
      setRegeneratingReport(true);
      setReportNote('');
      const updated = await regenerateReport(detail.id);
      const parsedDetail = {
        ...updated,
        questions: parseJsonOrArray(updated.questions),
        correctAnswers: parseJsonOrArray(updated.correctAnswers),
        candidateAnswers: parseJsonOrArray(updated.candidateAnswers),
        topics: parseJsonOrArray(updated.topics),
        difficulty: parseJsonOrArray(updated.difficulty),
        perQuestionScores: parseJsonOrArray(updated.perQuestionScores),
        questionTypes: parseJsonOrArray(updated.questionTypes),
      };
      setDetail(parsedDetail);
      setReportNote('Report regenerated successfully.');
    } catch (err) {
      console.error('Regenerate report failed:', err);
      setReportNote('Could not regenerate the report.');
    } finally {
      setRegeneratingReport(false);
    }
  };

  const fallbackFlags = buildReportFlags(detail);
  const greenFlagItems = detailedSummary?.greenFlags?.length
    ? detailedSummary.greenFlags
    : fallbackFlags.greenFlags.map((flag) => ({ title: flag, detail: '' }));
  const redFlagItems = detailedSummary?.redFlags?.length
    ? detailedSummary.redFlags
    : fallbackFlags.redFlags.map((flag) => ({ title: flag, detail: '' }));

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
          <div className="flex items-center gap-2">
            {detail && !loading && (
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-60"
              >
                <Download className={`w-4 h-4 ${downloadingPdf ? 'animate-pulse' : ''}`} />
                {downloadingPdf ? 'Preparing...' : 'Download PDF'}
              </button>
            )}
            {detail && !loading && (
              <button
                onClick={handleRegenerateReport}
                disabled={regeneratingReport}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${regeneratingReport ? 'animate-spin' : ''}`} />
                {regeneratingReport ? 'Regenerating...' : 'Regenerate Report'}
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
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
            <div className="space-y-6 bg-white">
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
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                <div>
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

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Summary</h3>
                  {loadingSummary ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                      Building candidate summary from answers...
                    </div>
                  ) : (
                    <>
                      <p className="text-sm leading-6 text-slate-700">
                        {detailedSummary?.summary || buildReportSummary(detail)}
                      </p>
                      {detailedSummary?.recommendation && (
                        <p className="text-sm font-medium text-slate-800">
                          Recommendation: <span className="font-normal text-slate-700">{detailedSummary.recommendation}</span>
                        </p>
                      )}
                    </>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-3">Green Flags</h4>
                      <div className="space-y-3">
                        {greenFlagItems.length ? greenFlagItems.map((flag, index) => (
                          <div key={`${flag.title}-${index}`} className="rounded-lg bg-white/70 px-3 py-2 border border-emerald-100">
                            <p className="text-sm font-semibold text-emerald-800">{flag.title}</p>
                            {flag.detail && <p className="text-xs text-slate-600 mt-1 leading-5">{flag.detail}</p>}
                          </div>
                        )) : (
                          <p className="text-xs text-emerald-700">No major positive flags captured yet.</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 mb-3">Red Flags</h4>
                      <div className="space-y-3">
                        {redFlagItems.length ? redFlagItems.map((flag, index) => (
                          <div key={`${flag.title}-${index}`} className="rounded-lg bg-white/70 px-3 py-2 border border-red-100">
                            <p className="text-sm font-semibold text-red-800">{flag.title}</p>
                            {flag.detail && <p className="text-xs text-slate-600 mt-1 leading-5">{flag.detail}</p>}
                          </div>
                        )) : (
                          <p className="text-xs text-red-700">No major red flags captured yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {reportNote && <p className="text-xs text-slate-500">{reportNote}</p>}
                </div>
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
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Main Dashboard ─────────────────────────────── */
function AudioReviewDetailPanel({ reviewId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [note, setNote] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getAudioReviewDetails(reviewId);
        if (!data) throw new Error('Not found');
        setDetail({ ...data, report: data.report || {} });
      } catch (err) {
        console.error(err);
        setError('Could not load audio review details.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [reviewId]);

  const handleRegenerate = async () => {
    if (!detail || regenerating) return;
    try {
      setRegenerating(true);
      setNote('');
      const updated = await regenerateAudioReview(detail.id);
      setDetail({ ...updated, report: updated.report || {} });
      setNote('Audio report regenerated successfully.');
    } catch (err) {
      console.error(err);
      setNote('Could not regenerate the audio report.');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!detail || downloadingPdf) return;

    try {
      setDownloadingPdf(true);
      const safeName = (detail.name || 'candidate-report').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
      const safeRole = (detail.role || 'report').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'report';
      const downloadName = `audio-review-${safeName}-${safeRole}.pdf`;

      const renderFlagRows = (items, tone) => items.length
        ? items.map((flag) => `
          <div class="flag-row ${tone}">
            <div class="flag-title">${escapeHtml(flag.title)}</div>
            <div class="flag-detail">${escapeHtml(flag.detail || 'Supported by overall assessment.')}</div>
          </div>
        `).join('')
        : `<div class="flag-empty">No major ${tone === 'green' ? 'positive' : 'risk'} indicators captured.</div>`;

      const html = `<!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${detail.name || 'Audio Review Report'}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 0; }
          .page { width: 1200px; padding: 24px; box-sizing: border-box; background: #ffffff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
          h1 { margin: 0; font-size: 30px; }
          .sub { color: #64748b; font-size: 14px; margin-top: 6px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
          .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background: #f8fafc; }
          .label { font-size: 12px; color: #64748b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .04em; }
          .value { font-size: 18px; font-weight: 700; }
          .section-block { margin-top: 16px; }
          .section-title { font-size: 12px; font-weight: 700; color: #475569; margin: 0 0 10px; text-transform: uppercase; letter-spacing: .06em; }
          .summary-box { border: 1px solid #dbeafe; border-radius: 12px; padding: 14px; margin-bottom: 16px; background: #f8fbff; }
          .summary-text { font-size: 13px; line-height: 1.6; color: #1e293b; white-space: pre-wrap; }
          .recommendation { margin-top: 10px; font-size: 13px; color: #0f172a; font-weight: bold; }
          .flag-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
          .flag-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
          .flag-card.green { background: #f0fdf4; border-color: #bbf7d0; }
          .flag-card.red { background: #fef2f2; border-color: #fecaca; }
          .flag-row { border-top: 1px solid rgba(148, 163, 184, 0.2); padding-top: 8px; margin-top: 8px; }
          .flag-row:first-child { border-top: none; padding-top: 0; margin-top: 0; }
          .flag-title { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
          .flag-card.green .flag-title { color: #166534; }
          .flag-card.red .flag-title { color: #991b1b; }
          .flag-detail, .flag-empty { font-size: 12px; color: #334155; line-height: 1.5; }
          .footer { margin-top: 20px; font-size: 11px; color: #64748b; }
          .transcript-box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background: #f8fafc; font-size: 12px; line-height: 1.6; white-space: pre-wrap; color: #334155; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div>
              <h1>${detail.name || 'Audio Review Report'}</h1>
              <div class="sub">Generated: ${new Date(detail.timestamp || Date.now()).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
            </div>
          </div>

          <div class="grid">
            <div class="card"><div class="label">Status</div><div class="value">${detail.status || 'Pending'}</div></div>
            <div class="card"><div class="label">Role</div><div class="value">${detail.role || 'Not specified'}</div></div>
            <div class="card"><div class="label">Verdict</div><div class="value">${report.finalVerdict || 'Pending'}</div></div>
          </div>

          <div class="summary-box">
            <div class="section-title">Candidate Profile Summary</div>
            <div class="summary-text">${escapeHtml(report.candidateProfile || 'No profile summary generated yet.')}</div>
            <div class="section-title" style="margin-top: 12px;">Interview Summary</div>
            <div class="summary-text">${escapeHtml(report.summary || 'No interview summary generated yet.')}</div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
              <div>
                <div class="section-title">Communication</div>
                <div class="summary-text">${escapeHtml(report.communicationAssessment || 'Not available.')}</div>
              </div>
              <div>
                <div class="section-title">Role Fit</div>
                <div class="summary-text">${escapeHtml(report.roleFit || 'Not available.')}</div>
              </div>
            </div>
            
            ${(report.recommendation || '').trim() ? `<div class="recommendation">Recommendation: ${escapeHtml(report.recommendation)}</div>` : ''}
          </div>

          <div class="flag-grid">
            <div class="flag-card green">
              <div class="section-title">Green Flags</div>
              ${renderFlagRows(greenFlags, 'green')}
            </div>
            <div class="flag-card red">
              <div class="section-title">Red Flags</div>
              ${renderFlagRows(redFlags, 'red')}
            </div>
          </div>

          <div class="section-block">
            <div class="section-title">HR Notes</div>
            <div class="transcript-box">${escapeHtml(detail.hrNotes || 'No HR notes provided.')}</div>
          </div>

          <div class="section-block">
            <div class="section-title">Transcript</div>
            <div class="transcript-box">${escapeHtml(detail.transcript || 'Transcript not available.')}</div>
          </div>

          <div class="footer">HireOS Audio Review Report</div>
        </div>
      </body>
      </html>`;

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '1200px';
      tempContainer.style.background = '#ffffff';
      tempContainer.innerHTML = html;
      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(downloadName);
      document.body.removeChild(tempContainer);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Could not generate the PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const report = detail?.report || {};
  const greenFlags = normalizeFlagItems(report.greenFlags);
  const redFlags = normalizeFlagItems(report.redFlags);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-white shadow-2xl z-30 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {loading ? 'Loading...' : detail?.name || 'Audio Review'}
            </h2>
            {detail && (
              <div className="text-xs text-slate-500 mt-1 flex flex-col gap-0.5">
                <span>Role: {detail.role || 'Not specified'}</span>
                <span>Created: {new Date(detail.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {detail && !loading && detail.status === 'Completed' && (
              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-60"
              >
                <Download className={`w-4 h-4 ${downloadingPdf ? 'animate-pulse' : ''}`} />
                {downloadingPdf ? 'Preparing...' : 'Download PDF'}
              </button>
            )}
            {detail && !loading && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                {regenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

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
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <StatusBadge status={detail.status} />
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Verdict</p>
                  <p className="text-sm font-semibold text-slate-800">{detail.finalVerdict || 'Pending'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Recommendation</p>
                  <p className="text-sm text-slate-700">{detail.recommendation || 'Not available yet'}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span><span className="font-medium text-slate-800">Candidate:</span> {detail.name}</span>
                  <span><span className="font-medium text-slate-800">Role:</span> {detail.role}</span>
                </div>
                {detail.hrNotes && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">HR Notes</h3>
                    <p className="text-sm text-slate-700 leading-6">{detail.hrNotes}</p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-indigo-50">
                  <h3 className="text-sm font-bold text-indigo-900">Candidate Profile Summary</h3>
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-sm text-slate-700 leading-7">{report.candidateProfile || 'No profile summary generated yet.'}</p>
                  <p className="text-sm text-slate-700 leading-7">{report.summary || 'No interview summary generated yet.'}</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Communication</h4>
                      <p className="text-sm text-slate-700 leading-6">{report.communicationAssessment || 'Not available.'}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Role Fit</h4>
                      <p className="text-sm text-slate-700 leading-6">{report.roleFit || 'Not available.'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-3">Green Flags</h4>
                  <div className="space-y-3">
                    {greenFlags.length ? greenFlags.map((flag, index) => (
                      <div key={`${flag.title}-${index}`} className="rounded-lg bg-white/70 px-3 py-2 border border-emerald-100">
                        <p className="text-sm font-semibold text-emerald-800">{flag.title}</p>
                        {flag.detail && <p className="text-xs text-slate-600 mt-1 leading-5">{flag.detail}</p>}
                      </div>
                    )) : (
                      <p className="text-xs text-emerald-700">No major green flags captured.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 mb-3">Red Flags</h4>
                  <div className="space-y-3">
                    {redFlags.length ? redFlags.map((flag, index) => (
                      <div key={`${flag.title}-${index}`} className="rounded-lg bg-white/70 px-3 py-2 border border-red-100">
                        <p className="text-sm font-semibold text-red-800">{flag.title}</p>
                        {flag.detail && <p className="text-xs text-slate-600 mt-1 leading-5">{flag.detail}</p>}
                      </div>
                    )) : (
                      <p className="text-xs text-red-700">No major red flags captured.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-bold text-slate-800">Transcript</h3>
                </div>
                <div className="p-4">
                  <p className="text-sm text-slate-700 leading-7 whitespace-pre-wrap">
                    {detail.transcript || 'Transcript not available.'}
                  </p>
                </div>
              </div>

              {note && <p className="text-xs text-slate-500">{note}</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

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
    } catch (e) { console.error(e); }
    finally { setLoadingResults(false); }
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

  const handleAudioInput = (e) => {
    const { name, value } = e.target;
    setAudioFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAudioFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const looksLikeAudio = (f.type && f.type.startsWith('audio/')) || AUDIO_FILE_PATTERN.test(f.name || '');
    if (!looksLikeAudio) {
      alert('Please upload an audio file only.');
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

  const handleAudioSubmit = async (e) => {
    e.preventDefault();
    if (!audioFormData.name.trim()) return alert('Please enter candidate name.');
    if (!audioFormData.role.trim()) return alert('Please enter role.');
    if (!audioFile) return alert('Please upload an audio file.');

    try {
      setAudioStatus('uploading');
      setAudioError('');

      const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          let encoded = reader.result.toString().replace(/^data:(.*,)?/, '');
          if ((encoded.length % 4) > 0) {
            encoded += '='.repeat(4 - (encoded.length % 4));
          }
          resolve(encoded);
        };
        reader.onerror = error => reject(error);
      });

      const audioBase64 = await toBase64(audioFile);

      setAudioStatus('processing');
      const payload = {
        name: audioFormData.name.trim(),
        role: audioFormData.role.trim(),
        hrNotes: audioFormData.hrNotes.trim(),
        audioBase64: audioBase64,
        audioFileName: audioFile.name,
        audioMimeType: audioFile.type || 'audio/mpeg'
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
  const completedAudioReviews = audioReviews.filter((review) => review.status === 'Completed').length;

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
            {[{ key: 'generate', icon: FilePlus2, label: 'Generate' }, { key: 'results', icon: Users, label: 'Results' }, { key: 'audio', icon: Mic, label: 'Audio Review' }].map(tab => (
              <button key={tab.key} onClick={() => {
                setActiveTab(tab.key);
                if (tab.key === 'results') fetchResults();
                if (tab.key === 'audio') fetchAudioReviews();
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

        {activeTab === 'audio' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">Audio Interview Review</h1>
                <p className="text-slate-500 text-sm mt-1">Upload interview audio directly, then we normalize, chunk, transcribe, and store the final PDF in Drive.</p>
              </div>
              <button onClick={fetchAudioReviews} disabled={loadingAudioReviews} className="flex items-center gap-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-xl transition-all disabled:opacity-50 self-start sm:self-auto">
                <RefreshCw className={`w-4 h-4 ${loadingAudioReviews ? 'animate-spin' : ''}`} />Refresh Reviews
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard icon={Mic} label="Audio Reviews" value={audioReviews.length} color="bg-indigo-500" />
              <StatCard icon={CheckCircle} label="Completed" value={completedAudioReviews} color="bg-emerald-500" />
              <StatCard icon={Clock} label="Pending" value={audioReviews.length - completedAudioReviews} color="bg-amber-500" />
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
                        <p className="text-sm text-slate-500 mt-1">Transcript, evaluation report, and Drive PDF have been created successfully.</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                      <p className="text-sm font-semibold text-slate-800">{latestAudioReview.name}</p>
                      <p className="text-xs text-slate-500">{latestAudioReview.role}</p>
                      <p className="text-sm text-slate-700">{latestAudioReview.recommendation || 'Recommendation will appear in the detailed report.'}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={() => setSelectedAudioReviewId(latestAudioReview.id)} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all">
                        <ChevronRight className="w-4 h-4" />View Detailed Report
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
                      <h2 className="text-2xl font-extrabold text-slate-900">Upload Interview Audio</h2>
                      <p className="text-slate-500 mt-2 text-sm">Supports audio uploads up to 50MB, transcribes them, and generates a downloadable PDF report.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Candidate Name <span className="text-red-500">*</span></label>
                      <input
                        name="name"
                        type="text"
                        required
                        placeholder="e.g. Shagufta Khan"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={audioFormData.name}
                        onChange={handleAudioInput}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Role <span className="text-red-500">*</span></label>
                      <input
                        name="role"
                        type="text"
                        required
                        placeholder="e.g. Junior Cosmetology Doctor"
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={audioFormData.role}
                        onChange={handleAudioInput}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">HR Notes <span className="text-slate-400 font-normal">(Optional)</span></label>
                      <textarea
                        name="hrNotes"
                        rows={4}
                        placeholder="Add any context for the evaluator, such as round type, clinic, or interview focus."
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        value={audioFormData.hrNotes}
                        onChange={handleAudioInput}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Interview Audio <span className="text-red-500">*</span></label>
                      <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-indigo-50 hover:border-indigo-400 transition-all group">
                        <FileAudio className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 transition-colors mb-2" />
                        <span className="text-sm text-slate-500 group-hover:text-indigo-600 font-medium">{audioFile ? audioFile.name : 'Click to upload audio'}</span>
                        <span className="text-xs text-slate-400 mt-1">Audio only, max 50MB. Large files upload directly before processing.</span>
                        <input type="file" accept="audio/*" className="sr-only" onChange={handleAudioFile} />
                      </label>
                    </div>

                    {audioError && <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-xl">{audioError}</div>}

                    <button
                      type="submit"
                      disabled={audioStatus === 'uploading' || audioStatus === 'processing'}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-200"
                    >
                      {audioStatus === 'idle' || audioStatus === 'error' ? (
                        <>Generate Audio Report <Mic className="w-4 h-4" /></>
                      ) : (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {audioStatus === 'uploading' ? 'Uploading Audio...' : 'Transcribing & Generating Report...'}
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>

              <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-bold text-slate-800">Recent Audio Reviews</h3>
                  <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Click a row to open the full report</span>
                </div>

                {loadingAudioReviews ? (
                  <div className="flex justify-center items-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  </div>
                ) : audioReviews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <Mic className="w-10 h-10 mb-3 opacity-50" />
                    <p className="text-sm font-medium">No audio reviews yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
                    {audioReviews.map((review) => (
                      <button
                        key={review.id}
                        onClick={() => setSelectedAudioReviewId(review.id)}
                        className="w-full text-left px-6 py-4 hover:bg-indigo-50/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-indigo-700 truncate">{review.name}</p>
                              <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{review.role || 'Role not specified'}</p>
                            <p className="text-xs text-slate-400 mt-2">
                              {new Date(review.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <StatusBadge status={review.status} />
                            <span className="text-xs font-medium text-slate-600 max-w-40 text-right">{review.finalVerdict || review.recommendation || 'Processing'}</span>
                            {review.pdfDriveUrl && (
                              <a
                                href={review.pdfDriveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-900"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />PDF
                              </a>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Candidate Detail Slide-over */}
      {selectedId && (
        <CandidateDetailPanel candidateId={selectedId} onClose={() => setSelectedId(null)} />
      )}
      {selectedAudioReviewId && (
        <AudioReviewDetailPanel reviewId={selectedAudioReviewId} onClose={() => setSelectedAudioReviewId(null)} />
      )}
    </div>
  );
}
