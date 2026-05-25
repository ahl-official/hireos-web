import { useState, useEffect } from 'react';
import {
  Download,
  RefreshCw,
  X,
  Loader2,
  CheckCircle2,
  ChevronRight,
  XCircle,
  Shield,
} from 'lucide-react';
import {
  getCandidateDetails,
  regenerateReport,
  generateDetailedSummary,
  saveCandidateSummary,
} from '../../utils/googleSheets';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { normalizeFlagItems, escapeHtml, parseJsonOrArray } from '../../utils/dashboardHelpers';
import StatusBadge from './StatusBadge';

const toPercentScore = (value) => {
  const num = Number(value || 0);
  return num <= 10 ? Math.round(num * 10) : Math.round(num);
};

const buildReportSummary = (detail) => {
  if (!detail) return '';
  const perScores = parseJsonOrArray(detail.perQuestionScores) || [];
  const questionTypes = parseJsonOrArray(detail.questionTypes) || [];

  if (!perScores.length) return 'Candidate has not completed the test yet.';

  const scores = perScores.map((q) => toPercentScore(q?.score || 0));
  const avgScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);

  const hrScores = perScores
    .filter((_, i) => questionTypes[i] === 'hr')
    .map((q) => toPercentScore(q?.score || 0));
  const techScores = perScores
    .filter((_, i) => questionTypes[i] === 'technical')
    .map((q) => toPercentScore(q?.score || 0));
  const hrAvg = hrScores.length
    ? Math.round(hrScores.reduce((a, b) => a + b, 0) / hrScores.length)
    : 0;
  const techAvg = techScores.length
    ? Math.round(techScores.reduce((a, b) => a + b, 0) / techScores.length)
    : 0;

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

  const scores = perScores.map((q) => toPercentScore(q?.score || 0));
  const avgScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highScores = scores.filter((s) => s >= 80).length;
  const lowScores = scores.filter((s) => s <= 30).length;

  const hrScores = perScores
    .filter((_, i) => questionTypes[i] === 'hr')
    .map((q) => toPercentScore(q?.score || 0));
  const techScores = perScores
    .filter((_, i) => questionTypes[i] === 'technical')
    .map((q) => toPercentScore(q?.score || 0));
  const hrAvg = hrScores.length
    ? Math.round(hrScores.reduce((a, b) => a + b, 0) / hrScores.length)
    : 0;
  const techAvg = techScores.length
    ? Math.round(techScores.reduce((a, b) => a + b, 0) / techScores.length)
    : 0;

  const emptyAnswers = candidateAnswers.filter((ans) => !ans || String(ans).trim() === '').length;
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

export default function CandidateDetailPanel({ candidateId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [regeneratingFullReport, setRegeneratingFullReport] = useState(false);
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
          try {
            return typeof v === 'string' ? JSON.parse(v) : v;
          } catch {
            return [];
          }
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
      if (
        !detail ||
        detail.status !== 'Completed' ||
        !detail.questions?.length ||
        !detail.candidateAnswers?.length
      ) {
        setDetailedSummary(null);
        setLoadingSummary(false);
        return;
      }

      // Check if summary already exists and is cached
      if (detail.detailedSummary) {
        try {
          const cached =
            typeof detail.detailedSummary === 'string'
              ? JSON.parse(detail.detailedSummary)
              : detail.detailedSummary;
          if (!ignore) {
            setDetailedSummary({
              summary: cached.summary || '',
              recommendation: cached.recommendation || '',
              icpFitAnalysis: cached.icpFitAnalysis || '',
              greenFlags: normalizeFlagItems(cached.greenFlags),
              redFlags: normalizeFlagItems(cached.redFlags),
            });
            setLoadingSummary(false);
          }
          return; // Exit early - use cached summary
        } catch {
          console.log('Cached summary invalid, regenerating...');
        }
      }

      // Generate summary only if not cached
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
          const summaryData = {
            summary: result?.summary || '',
            recommendation: result?.recommendation || '',
            icpFitAnalysis: result?.icpFitAnalysis || '',
            greenFlags: result?.greenFlags || [],
            redFlags: result?.redFlags || [],
          };

          setDetailedSummary({
            ...summaryData,
            greenFlags: normalizeFlagItems(summaryData.greenFlags),
            redFlags: normalizeFlagItems(summaryData.redFlags),
          });

          // Save to database for future use
          try {
            await saveCandidateSummary(candidateId, summaryData);
          } catch (saveErr) {
            console.warn('Could not cache summary:', saveErr);
          }
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
    return () => {
      ignore = true;
    };
  }, [detail, candidateId]);

  const scoreColor = (s) => {
    const n = Number(s);
    if (n >= 70) return 'text-emerald-600';
    if (n >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const handleRegenerateFullReport = async () => {
    if (!detail || regeneratingFullReport) return;

    try {
      setRegeneratingFullReport(true);
      setReportNote('');

      // Step 1: Regenerate report (re-grade all answers)
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

      // Step 2: Regenerate AI summary
      const result = await generateDetailedSummary(
        parsedDetail.questions,
        parsedDetail.candidateAnswers,
        parsedDetail.perQuestionScores || [],
        parsedDetail.questionTypes || [],
        parsedDetail.topics || []
      );

      const summaryData = {
        summary: result?.summary || '',
        recommendation: result?.recommendation || '',
        greenFlags: result?.greenFlags || [],
        redFlags: result?.redFlags || [],
      };

      setDetailedSummary({
        ...summaryData,
        greenFlags: normalizeFlagItems(summaryData.greenFlags),
        redFlags: normalizeFlagItems(summaryData.redFlags),
      });

      // Save updated summary
      try {
        await saveCandidateSummary(candidateId, summaryData);
      } catch (saveErr) {
        console.warn('Could not save regenerated summary:', saveErr);
      }

      setReportNote('Full report regenerated successfully.');
    } catch (err) {
      console.error('Regenerate full report failed:', err);
      setReportNote('Could not regenerate the full report.');
    } finally {
      setRegeneratingFullReport(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!detail || downloadingPdf) return;

    try {
      setDownloadingPdf(true);
      const safeName = (detail.name || 'candidate-report')
        .replace(/[^a-z0-9-_]+/gi, '-')
        .toLowerCase();
      const safeRole =
        (detail.position || detail.role || 'report').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() ||
        'report';
      const downloadName = `${safeName}-${safeRole}.pdf`;
      const generatedAt = detail.timestamp || detail.submittedAt || '';

      const questionRows = (detail.questions || [])
        .map((q, i) => {
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
        })
        .join('');

      const fallbackFlags = buildReportFlags(detail);
      const greenFlagItems = detailedSummary?.greenFlags?.length
        ? detailedSummary.greenFlags
        : fallbackFlags.greenFlags.map((flag) => ({ title: flag, detail: '' }));
      const redFlagItems = detailedSummary?.redFlags?.length
        ? detailedSummary.redFlags
        : fallbackFlags.redFlags.map((flag) => ({ title: flag, detail: '' }));

      const renderFlagRows = (items, tone) =>
        items.length
          ? items
              .map(
                (flag) => `
          <div class="flag-row ${tone}">
            <div class="flag-title">${escapeHtml(flag.title)}</div>
            <div class="flag-detail">${escapeHtml(flag.detail || 'Supported by overall assessment and candidate responses.')}</div>
          </div>
        `
              )
              .join('')
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
              <div class="sub">Generated: ${generatedAt ? new Date(generatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown'}${detail.submittedAt ? ` • Submitted: ${new Date(detail.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</div>
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

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.75);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
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
                <span>
                  Generated:{' '}
                  {new Date(detail.timestamp).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
                {detail.submittedAt && (
                  <span>
                    Submitted:{' '}
                    {new Date(detail.submittedAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                )}
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
                onClick={handleRegenerateFullReport}
                disabled={regeneratingFullReport}
                title="Re-grade all answers and regenerate AI summary"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${regeneratingFullReport ? 'animate-spin' : ''}`} />
                {regeneratingFullReport ? 'Regenerating...' : 'Re-gen Full Report'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
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

          {error && <div className="text-center py-10 text-red-500">{error}</div>}

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
                <div
                  className={`rounded-xl p-4 text-center border ${Number(detail.tabSwitches) > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}
                >
                  <p className="text-xs text-slate-500 mb-1">Tab Switches</p>
                  <p
                    className={`text-2xl font-extrabold ${Number(detail.tabSwitches) > 0 ? 'text-red-600' : 'text-emerald-600'}`}
                  >
                    {detail.tabSwitches || 0}
                  </p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Contact Info
                  </h3>
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
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Summary
                  </h3>
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
                      {detailedSummary?.icpFitAnalysis && (
                        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 mt-2">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-1 flex items-center gap-1.5">
                            <Shield className="w-3 h-3" /> ICP Role Fit Analysis
                          </h4>
                          <p className="text-sm leading-relaxed text-indigo-900 italic">
                            "{detailedSummary.icpFitAnalysis}"
                          </p>
                        </div>
                      )}
                      {detailedSummary?.recommendation && (
                        <p className="text-sm font-medium text-slate-800">
                          Recommendation:{' '}
                          <span className="font-normal text-slate-700">
                            {detailedSummary.recommendation}
                          </span>
                        </p>
                      )}
                    </>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-3">
                        Green Flags
                      </h4>
                      <div className="space-y-3">
                        {greenFlagItems.length ? (
                          greenFlagItems.map((flag, index) => (
                            <div
                              key={`${flag.title}-${index}`}
                              className="rounded-lg bg-white/70 px-3 py-2 border border-emerald-100"
                            >
                              <p className="text-sm font-semibold text-emerald-800">{flag.title}</p>
                              {flag.detail && (
                                <p className="text-xs text-slate-600 mt-1 leading-5">
                                  {flag.detail}
                                </p>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-emerald-700">
                            No major positive flags captured yet.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 mb-3">
                        Red Flags
                      </h4>
                      <div className="space-y-3">
                        {redFlagItems.length ? (
                          redFlagItems.map((flag, index) => (
                            <div
                              key={`${flag.title}-${index}`}
                              className="rounded-lg bg-white/70 px-3 py-2 border border-red-100"
                            >
                              <p className="text-sm font-semibold text-red-800">{flag.title}</p>
                              {flag.detail && (
                                <p className="text-xs text-slate-600 mt-1 leading-5">
                                  {flag.detail}
                                </p>
                              )}
                            </div>
                          ))
                        ) : (
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
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Assessment Questions
                  </h3>
                  {detail.questions.map((q, i) => {
                    const candidateAns = detail.candidateAnswers?.[i] || null;
                    const correctAns = detail.correctAnswers?.[i] || '';
                    const topic = detail.topics?.[i];
                    const diff = detail.difficulty?.[i];
                    const qScore = detail.perQuestionScores?.[i];
                    const diffStyles = {
                      medium: 'bg-blue-100 text-blue-700',
                      hard: 'bg-orange-100 text-orange-700',
                      very_hard: 'bg-red-100 text-red-700',
                    };
                    return (
                      <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden">
                        {/* Question header */}
                        <div className="bg-indigo-50 px-4 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>
                            {topic && (
                              <span className="text-xs bg-white text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                                {topic}
                              </span>
                            )}
                            {diff && (
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${diffStyles[diff] || 'bg-slate-100 text-slate-600'}`}
                              >
                                {diff.replace('_', ' ')}
                              </span>
                            )}
                            {qScore && (
                              <span className="ml-auto text-xs font-bold text-indigo-700">
                                {qScore.score}/10
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-indigo-900">{q}</p>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {/* Expected Answer */}
                          <div className="px-4 py-3 flex gap-3">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-emerald-600 mb-1">
                                Expected Answer
                              </p>
                              <p className="text-sm text-slate-700">{correctAns}</p>
                            </div>
                          </div>

                          {/* Candidate Answer */}
                          <div
                            className={`px-4 py-3 flex gap-3 ${!candidateAns ? 'opacity-50' : ''}`}
                          >
                            {candidateAns ? (
                              <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-1">
                                Candidate's Answer
                              </p>
                              <p className="text-sm text-slate-700 italic">
                                {candidateAns || 'Not answered'}
                              </p>
                            </div>
                          </div>

                          {/* AI Feedback */}
                          {qScore?.feedback && (
                            <div className="px-4 py-3 bg-amber-50 flex gap-3">
                              <span className="text-amber-500 text-xs shrink-0 mt-0.5">💬</span>
                              <div>
                                <p className="text-xs font-semibold text-amber-700 mb-1">
                                  AI Feedback
                                </p>
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
