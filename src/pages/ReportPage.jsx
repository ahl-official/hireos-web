import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCandidateDetails, generateDetailedSummary, saveCandidateSummary } from '../utils/googleSheets';
import { Download, ChevronLeft, AlertTriangle, CheckCircle, Award, Clock } from 'lucide-react';

const parseJSON = (str, fallback = []) => {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
};

export default function ReportPage() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Loading candidate data...');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCandidate() {
      try {
        const data = await getCandidateDetails(id);
        if (data) {
          // If the AI hasn't generated the detailed summary yet, generate it now!
          if (!data.detailedSummary && data.candidateAnswers && data.candidateAnswers.length > 0) {
            setLoadingMsg('Analyzing AI results and generating detailed report (this takes about 15 seconds)...');
            try {
              const result = await generateDetailedSummary(
                data.id,
                parseJSON(data.questions),
                parseJSON(data.candidateAnswers),
                parseJSON(data.perQuestionScores),
                parseJSON(data.questionTypes),
                parseJSON(data.topics)
              );
              
              const summaryStr = typeof result === 'string' ? result : JSON.stringify(result);
              data.detailedSummary = summaryStr;
              await saveCandidateSummary(data.id, summaryStr);
            } catch (err) {
              console.error("Failed to generate AI summary on the fly:", err);
            }
          }
          setCandidate(data);
        } else {
          setError('Candidate not found');
        }
      } catch (err) {
        setError('Error loading report');
      } finally {
        setLoading(false);
      }
    }
    loadCandidate();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
        <p className="text-slate-600 font-medium animate-pulse">{loadingMsg}</p>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Report Not Found</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <Link to="/" className="text-indigo-600 font-semibold hover:underline flex items-center gap-2 justify-center">
            <ChevronLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  let summaryObj = { summary: 'No summary available.', greenFlags: [], redFlags: [] };
  if (candidate.detailedSummary) {
    try {
      summaryObj = JSON.parse(candidate.detailedSummary);
    } catch (e) {
      summaryObj.summary = candidate.detailedSummary;
    }
  }

  const questions = parseJSON(candidate.questions);
  const correctAnswers = parseJSON(candidate.correctAnswers);
  const candidateAnswers = parseJSON(candidate.candidateAnswers);
  const scores = parseJSON(candidate.perQuestionScores);
  const difficulty = parseJSON(candidate.difficulty);
  const questionTypes = parseJSON(candidate.questionTypes);

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white pb-20">
      {/* Top Navigation - Hidden when printing */}
      <nav className="bg-white border-b border-slate-200 px-4 py-4 print:hidden sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link to="/" className="text-slate-600 hover:text-slate-900 flex items-center gap-2 font-medium transition-colors">
            <ChevronLeft className="w-5 h-5" /> Dashboard
          </Link>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto mt-8 px-4 print:mt-0 print:px-0">
        {/* Report Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6 print:shadow-none print:border-none print:p-0 print:mb-8">
          <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 mb-1">{candidate.name}</h1>
              <p className="text-lg text-slate-500 font-medium">{candidate.position}</p>
              <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> Evaluated: {new Date(candidate.submittedAt).toLocaleDateString()}</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" /> AI Assessed</span>
              </div>
            </div>
            <div className="text-center bg-slate-50 rounded-2xl p-4 border border-slate-100 min-w-[140px]">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Score</p>
              <div className="text-5xl font-extrabold text-indigo-600">{candidate.score}<span className="text-2xl text-slate-400">/100</span></div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-500" /> Evaluation Summary
            </h2>
            <div className="text-slate-700 leading-relaxed bg-slate-50 p-5 rounded-xl border border-slate-100">
              {summaryObj.summary}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2">
            {/* Green Flags */}
            <div>
              <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Strengths & Green Flags
              </h3>
              <div className="space-y-3">
                {summaryObj.greenFlags?.map((flag, i) => (
                  <div key={i} className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
                    <p className="font-bold text-slate-900 mb-1">{flag.title}</p>
                    <p className="text-sm text-slate-600">{flag.detail}</p>
                  </div>
                ))}
                {(!summaryObj.greenFlags || summaryObj.greenFlags.length === 0) && (
                  <p className="text-slate-500 italic text-sm">No green flags recorded.</p>
                )}
              </div>
            </div>

            {/* Red Flags */}
            <div>
              <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div> Concerns & Red Flags
              </h3>
              <div className="space-y-3">
                {summaryObj.redFlags?.map((flag, i) => (
                  <div key={i} className="bg-red-50/50 border border-red-100 p-4 rounded-xl">
                    <p className="font-bold text-slate-900 mb-1">{flag.title}</p>
                    <p className="text-sm text-slate-600">{flag.detail}</p>
                  </div>
                ))}
                {(!summaryObj.redFlags || summaryObj.redFlags.length === 0) && (
                  <p className="text-slate-500 italic text-sm">No red flags recorded.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Assessment Questions */}
        {questions.length > 0 && (
          <div className="mt-12">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Assessment Questions</h2>
            <div className="space-y-6">
              {questions.map((q, i) => {
                const scoreObj = scores[i] || { score: 0, feedback: 'No feedback provided.' };
                const qType = questionTypes[i] || 'technical';
                const diff = difficulty[i] || 'medium';
                
                return (
                  <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-b print:rounded-none print:shadow-none print:break-inside-avoid">
                    <div className="bg-indigo-50/50 px-6 py-4 flex items-center gap-3 border-b border-slate-100">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex gap-2 text-xs font-semibold">
                        <span className="bg-white px-2 py-1 rounded-full text-slate-600 border border-slate-200 uppercase tracking-wider">{qType}</span>
                        <span className="bg-white px-2 py-1 rounded-full text-slate-600 border border-slate-200 uppercase tracking-wider">{diff}</span>
                        <span className="bg-indigo-100 px-2 py-1 rounded-full text-indigo-700 font-bold border border-indigo-200">{scoreObj.score}/10</span>
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-lg font-bold text-slate-900 mb-6">{q}</h3>
                      
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Expected Answer</h4>
                          <p className="text-sm text-slate-700">{correctAnswers[i] || 'N/A'}</p>
                        </div>
                        
                        <div className="pt-4 border-t border-slate-100">
                          <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Candidate's Answer</h4>
                          <p className="text-sm text-slate-700">{candidateAnswers[i] || '(No answer provided)'}</p>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <h4 className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">AI Feedback</h4>
                          <p className="text-sm text-slate-700">{scoreObj.feedback}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Print Only Footer */}
        <div className="hidden print:block text-center text-sm text-slate-400 mt-12 pt-8 border-t border-slate-100">
          Generated by HireOS AI Evaluation System • ID: {candidate.id}
        </div>
      </main>
    </div>
  );
}
