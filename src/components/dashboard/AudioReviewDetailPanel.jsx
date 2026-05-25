import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X, Loader2 } from 'lucide-react';
import { getAudioReviewDetails, regenerateAudioReview } from '../../utils/googleSheets';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { normalizeFlagItems, escapeHtml } from '../../utils/dashboardHelpers';

/* ─── Helpers ─────────────────────────────── */

export default function AudioReviewDetailPanel({ reviewId, onClose }) {
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
      const safeName = (detail.name || 'candidate-report')
        .replace(/[^a-z0-9-_]+/gi, '-')
        .toLowerCase();
      const safeRole =
        (detail.role || 'report').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'report';
      const downloadName = `audio-review-${safeName}-${safeRole}.pdf`;
      const generatedAt = detail.timestamp || detail.submittedAt || '';

      const renderFlagRowsPDF = (items, tone) =>
        items.length
          ? items
              .map(
                (flag) => `
          <tr>
            <td style="width: 30px; text-align: center; font-weight: bold; color: ${tone === 'green' ? '#28a745' : '#c0392b'};">${tone === 'green' ? '✔' : '✘'}</td>
            <td class="flag-title" style="width: 35%;">${escapeHtml(flag.title)}</td>
            <td class="flag-detail">${escapeHtml(flag.detail || 'Supported by overall assessment.')}</td>
          </tr>
        `
              )
              .join('')
          : `<tr><td colspan="3" style="text-align: center; color: #666; font-style: italic;">No major ${tone === 'green' ? 'positive' : 'risk'} indicators captured.</td></tr>`;

      const html = `<!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(detail.name || 'Audio Review Report')}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; color: #333; background: #fff; margin: 0; padding: 0; }
          .page { width: 800px; padding: 40px; box-sizing: border-box; background: #ffffff; }
          .top-header { display: flex; justify-content: space-between; font-size: 12pt; color: #666; margin-bottom: 5px; font-weight: bold; }
          .header-divider { border-bottom: 2px solid #1d4e89; margin-bottom: 30px; }
          .doc-title { text-align: center; color: #1d4e89; font-size: 28px; font-weight: bold; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px; }
          .doc-subtitle { text-align: center; color: #0056b3; font-size: 20px; font-weight: bold; margin: 0 0 10px 0; text-transform: uppercase; }
          .doc-meta { text-align: center; color: #666; font-size: 14px; margin-bottom: 40px; }
          .section { margin-bottom: 30px; }
          .section-title { color: #1d4e89; font-size: 18px; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase; }
          .section-divider { border-bottom: 2px solid #0056b3; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #cccccc; }
          th, td { padding: 10px; text-align: left; border: 1px solid #cccccc; font-size: 15px; vertical-align: top; }
          .profile-table td:first-child { background: #e6f0f8; font-weight: bold; width: 30%; color: #333; }
          .flag-table th { color: #fff; font-weight: bold; text-transform: uppercase; }
          .flag-table.green th { background: #1e7e34; border-color: #1e7e34; }
          .flag-table.red th { background: #a94442; border-color: #a94442; }
          .flag-title { font-weight: bold; color: #333; }
          .recommendation-box { background: #FFF3E0; border: 1px solid #FFCC80; padding: 20px; border-radius: 4px; margin-bottom: 30px; }
          .recommendation-title { color: #E65100; font-size: 16px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; }
          .recommendation-text { color: #333; font-size: 15px; line-height: 1.6; white-space: pre-wrap; }
          .content-text { font-size: 15px; line-height: 1.6; color: #333; white-space: pre-wrap; margin-bottom: 15px; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="top-header">
            <div>HR INTERVIEW EVALUATION REPORT | Confidential</div>
            <div>HireOS Platform</div>
          </div>
          <div class="header-divider"></div>
          
          <div class="doc-title">INTERVIEW EVALUATION REPORT</div>
          <div class="doc-subtitle">${escapeHtml(detail.role || 'General Role')}</div>
          <div class="doc-meta">Interview Date: ${generatedAt ? new Date(generatedAt).toLocaleDateString('en-IN') : 'N/A'} | Candidate: ${escapeHtml(detail.name || 'N/A')}</div>
          
          <div class="section">
            <div class="section-title">1. Candidate Profile</div>
            <div class="section-divider"></div>
            <table class="profile-table">
              <tr>
                <td>Candidate Name</td>
                <td>${escapeHtml(detail.name || 'N/A')}</td>
              </tr>
              <tr>
                <td>Applied Role</td>
                <td>${escapeHtml(detail.role || 'N/A')}</td>
              </tr>
              <tr>
                <td>Interview Status</td>
                <td>${escapeHtml(detail.status || 'Pending')}</td>
              </tr>
              <tr>
                <td>Overall Verdict</td>
                <td><strong>${escapeHtml(report.finalVerdict || 'Pending')}</strong></td>
              </tr>
            </table>
          </div>

          <div class="section">
            <div class="section-title">2. Assessment Summary</div>
            <div class="section-divider"></div>
            <div class="content-text"><strong>Profile Summary:</strong><br/>${escapeHtml(report.candidateProfile || 'No profile summary generated yet.')}</div>
            <div class="content-text"><strong>Interview Summary:</strong><br/>${escapeHtml(report.summary || 'No interview summary generated yet.')}</div>
            <div class="content-text"><strong>Communication:</strong><br/>${escapeHtml(report.communicationAssessment || 'Not available.')}</div>
            <div class="content-text"><strong>Role Fit:</strong><br/>${escapeHtml(report.roleFit || 'Not available.')}</div>
          </div>

          <div class="section">
            <div class="section-title">3. Evaluation Flags</div>
            <div class="section-divider"></div>
            <table class="flag-table green">
              <thead><tr><th colspan="3">Positive Indicators (Green Flags)</th></tr></thead>
              <tbody>${renderFlagRowsPDF(greenFlags, 'green')}</tbody>
            </table>
            <table class="flag-table red">
              <thead><tr><th colspan="3">Risk Indicators (Red Flags)</th></tr></thead>
              <tbody>${renderFlagRowsPDF(redFlags, 'red')}</tbody>
            </table>
          </div>
          
          <div class="recommendation-box">
            <div class="recommendation-title">RECOMMENDATION: ${escapeHtml(report.finalVerdict || 'PENDING')}</div>
            <div class="recommendation-text">${escapeHtml(report.recommendation || 'No recommendation available.')}</div>
          </div>

          <div class="section">
            <div class="section-title">4. HR Notes</div>
            <div class="section-divider"></div>
            <div class="content-text">${escapeHtml(detail.hrNotes || 'No HR notes provided.')}</div>
          </div>

          <div class="footer">
            --- END OF REPORT ---<br/>
            Confidential | Internal Use Only
          </div>
        </div>
      </body>
      </html>`;

      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'fixed';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '0';
      tempContainer.style.width = '800px';
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
                <span>
                  Created:{' '}
                  {new Date(detail.timestamp).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
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
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
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

          {error && <div className="text-center py-10 text-red-500">{error}</div>}

          {!loading && detail && (
            <div className="bg-slate-100/50 p-4 rounded-xl">
              <div
                className="bg-white p-8 sm:p-12 border border-slate-200 shadow-sm mx-auto max-w-4xl"
                style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
              >
                <div className="flex justify-between items-center text-[10px] text-slate-500 mb-2 font-semibold">
                  <span>HR INTERVIEW EVALUATION REPORT | Confidential</span>
                  <span>HireOS Platform</span>
                </div>
                <div className="border-b-2 border-[#1d4e89] mb-8"></div>

                <div className="text-center mb-10">
                  <h1 className="text-2xl font-bold text-[#1d4e89] mb-2 uppercase tracking-wide">
                    INTERVIEW EVALUATION REPORT
                  </h1>
                  <h2 className="text-lg font-bold text-[#0056b3] uppercase">
                    {detail.role || 'General Role'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-3">
                    Interview Date: {new Date(detail.timestamp).toLocaleDateString('en-IN')} |
                    Candidate: {detail.name}
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-base font-bold text-[#1d4e89] uppercase mb-2">
                    1. Candidate Profile
                  </h3>
                  <div className="border-b-2 border-[#0056b3] mb-4"></div>
                  <table className="w-full border-collapse border border-slate-300 text-sm">
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 p-3 bg-[#e6f0f8] font-bold w-1/3 text-slate-800">
                          Candidate Name
                        </td>
                        <td className="border border-slate-300 p-3 text-slate-700">
                          {detail.name}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-3 bg-[#e6f0f8] font-bold text-slate-800">
                          Applied Role
                        </td>
                        <td className="border border-slate-300 p-3 text-slate-700">
                          {detail.role}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-3 bg-[#e6f0f8] font-bold text-slate-800">
                          Interview Status
                        </td>
                        <td className="border border-slate-300 p-3 text-slate-700">
                          {detail.status}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-3 bg-[#e6f0f8] font-bold text-slate-800">
                          Overall Verdict
                        </td>
                        <td className="border border-slate-300 p-3 font-bold text-slate-900">
                          {report.finalVerdict || 'Pending'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mb-8">
                  <h3 className="text-base font-bold text-[#1d4e89] uppercase mb-2">
                    2. Assessment Summary
                  </h3>
                  <div className="border-b-2 border-[#0056b3] mb-4"></div>
                  <div className="space-y-4 text-sm text-slate-800 leading-relaxed">
                    <p>
                      <strong>Profile Summary:</strong>
                      <br />
                      {report.candidateProfile || 'No profile summary generated yet.'}
                    </p>
                    <p>
                      <strong>Interview Summary:</strong>
                      <br />
                      {report.summary || 'No interview summary generated yet.'}
                    </p>
                    <p>
                      <strong>Communication:</strong>
                      <br />
                      {report.communicationAssessment || 'Not available.'}
                    </p>
                    <p>
                      <strong>Role Fit:</strong>
                      <br />
                      {report.roleFit || 'Not available.'}
                    </p>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-base font-bold text-[#1d4e89] uppercase mb-2">
                    3. Evaluation Flags
                  </h3>
                  <div className="border-b-2 border-[#0056b3] mb-4"></div>

                  <table className="w-full border-collapse border border-slate-300 text-sm mb-4">
                    <thead>
                      <tr>
                        <th
                          colSpan="3"
                          className="bg-[#1e7e34] text-white p-3 text-left uppercase font-bold"
                        >
                          Positive Indicators (Green Flags)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {greenFlags.length ? (
                        greenFlags.map((flag, i) => (
                          <tr key={i}>
                            <td className="border border-slate-300 p-3 text-center text-[#28a745] font-bold w-10">
                              ✔
                            </td>
                            <td className="border border-slate-300 p-3 font-bold text-slate-800 w-1/3">
                              {flag.title}
                            </td>
                            <td className="border border-slate-300 p-3 text-slate-600">
                              {flag.detail || 'Supported by overall assessment.'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan="3"
                            className="border border-slate-300 p-3 text-center text-slate-500 italic"
                          >
                            No major positive indicators captured.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <table className="w-full border-collapse border border-slate-300 text-sm">
                    <thead>
                      <tr>
                        <th
                          colSpan="3"
                          className="bg-[#a94442] text-white p-3 text-left uppercase font-bold"
                        >
                          Risk Indicators (Red Flags)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {redFlags.length ? (
                        redFlags.map((flag, i) => (
                          <tr key={i}>
                            <td className="border border-slate-300 p-3 text-center text-[#c0392b] font-bold w-10">
                              ✘
                            </td>
                            <td className="border border-slate-300 p-3 font-bold text-slate-800 w-1/3">
                              {flag.title}
                            </td>
                            <td className="border border-slate-300 p-3 text-slate-600">
                              {flag.detail || 'Supported by overall assessment.'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan="3"
                            className="border border-slate-300 p-3 text-center text-slate-500 italic"
                          >
                            No major risk indicators captured.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-[#FFF3E0] border border-[#FFCC80] p-5 rounded mb-8">
                  <h4 className="text-[#E65100] font-bold uppercase mb-2 text-sm">
                    Recommendation: {report.finalVerdict || 'Pending'}
                  </h4>
                  <p className="text-slate-800 text-sm leading-relaxed">
                    {report.recommendation || 'No recommendation available.'}
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-base font-bold text-[#1d4e89] uppercase mb-2">4. HR Notes</h3>
                  <div className="border-b-2 border-[#0056b3] mb-4"></div>
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {detail.hrNotes || 'No HR notes provided.'}
                  </p>
                </div>

                <div className="mt-12 pt-6 border-t border-slate-200 text-center text-[10px] text-slate-400">
                  <p>--- END OF REPORT ---</p>
                  <p>Confidential | Internal Use Only</p>
                </div>
              </div>
              {note && <p className="text-xs text-slate-500 mt-4 text-center">{note}</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
