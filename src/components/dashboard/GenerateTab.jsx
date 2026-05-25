import React, { useState, useMemo, useEffect } from 'react';
import {
  UploadCloud,
  CheckCircle,
  Copy,
  MessageCircle,
  Loader2,
  Shield,
  User,
  Briefcase,
  Zap,
  ListPlus,
  CheckCircle2,
  FileText,
  Smartphone,
  Clock,
  Target,
  ArrowRight,
  Globe,
  AlertTriangle,
  RefreshCw,
  LayoutDashboard,
  Bot,
} from 'lucide-react';
import { extractTextFromPDF } from '../../utils/pdfParser';
import { addCandidate, generateQuestions, getActiveICPs } from '../../utils/googleSheets';

const DOCX_FILE_PATTERN = /\.docx$/i;
const PDF_FILE_PATTERN = /\.pdf$/i;

const cleanExtractedText = (value) =>
  String(value || '')
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const extractTextFromUploadedFile = async (uploadedFile) => {
  const fileName = uploadedFile?.name || '';
  const fileType = uploadedFile?.type || '';
  const isPdf = fileType === 'application/pdf' || PDF_FILE_PATTERN.test(fileName);
  const isDocx =
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    DOCX_FILE_PATTERN.test(fileName);

  if (isPdf) {
    const text = await extractTextFromPDF(uploadedFile);
    return cleanExtractedText(text);
  }

  if (isDocx) {
    const raw = await uploadedFile.text();
    return cleanExtractedText(raw.replace(/<[^>]*>/g, ' '));
  }

  throw new Error('Only PDF or DOCX files are supported.');
};

/* ─── Presentational Components ─────────────────── */

const FormSection = ({ icon: Icon, title, description, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-6">
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
        {Icon && <Icon className="w-4 h-4 text-blue-600" />}
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {description && <p className="text-[11px] text-slate-500 font-medium">{description}</p>}
      </div>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const InterviewPlanPreview = ({
  formData,
  assessmentType = 'normal',
  activeICPs = [],
  selectedIcpId = '',
}) => {
  const customCount = formData.customQuestions.trim()
    ? formData.customQuestions.split('\n').filter((q) => q.trim()).length
    : 0;

  const isIcp = assessmentType === 'icp';
  const selectedIcp = (activeICPs || []).find((i) => i.icpId === selectedIcpId);

  // Normal: 8 HR + 4 Tech + Custom
  // ICP: 8 HR + 4 ICP + (0-2) Resume/Tools + Custom
  const hrCount = 8;
  const techCount = isIcp ? 4 : 4;
  const verificationCount = isIcp ? 2 : 0; // Approx max for icp mode
  const totalCount = hrCount + techCount + verificationCount + customCount;

  return (
    <div className="sticky top-24 space-y-4">
      <div className="bg-[#0F172A] rounded-2xl p-6 text-white shadow-xl shadow-blue-900/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm tracking-wide uppercase">Interview Plan</h3>
          </div>
          <div
            className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${isIcp ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}
          >
            {isIcp ? 'ICP Mode' : 'Normal'}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-white/10">
            <span className="text-xs text-slate-400 font-medium">HR Screening Questions</span>
            <span className="text-sm font-bold text-blue-400">08</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-white/10">
            <span className="text-xs text-slate-400 font-medium">
              {isIcp ? 'ICP Role-Fit Probes' : 'AI Technical Probes'}
            </span>
            <span className="text-sm font-bold text-blue-400">04</span>
          </div>
          {isIcp && (
            <div className="flex items-center justify-between py-2 border-b border-white/10">
              <span className="text-xs text-slate-400 font-medium">Resume & Tool Verification</span>
              <span className="text-sm font-bold text-indigo-400">Up to 02</span>
            </div>
          )}
          <div className="flex items-center justify-between py-2 border-b border-white/10">
            <span className="text-xs text-slate-400 font-medium">Custom Questions</span>
            <span className="text-sm font-bold text-amber-400">
              {String(customCount).padStart(2, '0')}
            </span>
          </div>
          <div className="flex items-center justify-between pt-4">
            <span className="text-sm font-bold">Total Assessment Length</span>
            <div className="text-right">
              <span className="text-2xl font-black text-white">~{totalCount}</span>
              <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Questions
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
            <p className="text-xs text-slate-300 leading-relaxed italic">
              {isIcp
                ? `"Using ICP Snapshot for ${selectedIcp?.roleName || 'role'} to evaluate role-specific maturity and technical fit."`
                : `"AI will analyze the CV to generate technical probes that match the candidate's real-world experience."`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Component ────────────────────────────── */

export default function GenerateTab() {
  const [formData, setFormData] = useState({
    name: '',
    wp: '',
    position: '',
    timeLimit: '15',
    mustCheckSkills: '',
    customQuestions: '',
  });
  const [assessmentType, setAssessmentType] = useState('normal'); // 'normal' or 'icp'
  const [activeICPs, setActiveICPs] = useState([]);
  const [selectedIcpId, setSelectedIcpId] = useState('');
  const [isLoadingICPs, setIsLoadingICPs] = useState(false);

  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedCandidateName, setGeneratedCandidateName] = useState('');
  const [generatedCandidateContact, setGeneratedCandidateContact] = useState('');
  const [testLink, setTestLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Fetch ICPs on mount
  useEffect(() => {
    const fetchICPs = async () => {
      setIsLoadingICPs(true);
      try {
        const icps = await getActiveICPs();
        setActiveICPs(icps || []);
        if (icps?.length > 0) setSelectedIcpId(icps[0].icpId);
      } catch (err) {
        console.error('Failed to fetch ICPs:', err);
      } finally {
        setIsLoadingICPs(false);
      }
    };
    fetchICPs();
  }, []);

  const handleInput = (e) => {
    const { name, value } = e.target;
    if (name === 'wp') {
      setFormData((p) => ({ ...p, wp: value.replace(/\D/g, '').slice(0, 10) }));
    } else {
      setFormData((p) => ({ ...p, [name]: value }));
    }
  };

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const isPdf = f.type === 'application/pdf' || PDF_FILE_PATTERN.test(f.name);
    const isDocx =
      f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      DOCX_FILE_PATTERN.test(f.name);
    if (!isPdf && !isDocx) {
      alert('Please upload a valid PDF or DOCX file.');
      e.target.value = null;
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      alert('Please upload a file smaller than 10MB.');
      e.target.value = null;
      return;
    }
    setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file && assessmentType === 'normal') return alert('Please upload a CV (PDF or DOCX).');
    if (formData.wp.length !== 10) return alert('Please enter a valid 10-digit mobile number.');
    if (assessmentType === 'icp' && !selectedIcpId) return alert('Please select an ICP role.');

    try {
      setStatus('extracting');
      let cvText = '';
      if (file) {
        cvText = await extractTextFromUploadedFile(file);
      }

      setStatus('generating');
      const selectedIcp = activeICPs.find((i) => i.icpId === selectedIcpId);

      const generated = await generateQuestions(
        cvText,
        formData.position || selectedIcp?.roleName || '',
        Number(formData.timeLimit),
        {
          assessmentType,
          selectedIcpId,
          mustCheckSkills: formData.mustCheckSkills,
          customQuestions: formData.customQuestions,
        }
      );

      setStatus('saving');
      const response = await addCandidate({
        name: formData.name,
        wp: formData.wp,
        position: formData.position || selectedIcp?.roleName || '',
        timeLimit: formData.timeLimit,
        mustCheckSkills: formData.mustCheckSkills,
        rawCustomQuestions: formData.customQuestions,
        questions: JSON.stringify(generated.questions),
        answers: JSON.stringify(generated.correct_answers),
        topics: JSON.stringify(generated.topics || []),
        difficulty: JSON.stringify(generated.difficulty || []),
        questionTypes: JSON.stringify(generated.questionTypes || []),
        assessmentType: assessmentType,
        selectedIcpId: selectedIcpId,
        selectedIcpRole: selectedIcp?.roleName || '',
        icpSnapshot: generated.icpSnapshot,
        resumeText: cvText,
        mustCheckTools: formData.mustCheckSkills,
      });

      const testId = response?.id || Date.now().toString();
      setTestLink(`${window.location.origin}/test/${testId}`);
      setGeneratedCandidateName(formData.name);
      setGeneratedCandidateContact(formData.wp);
      setStatus('success');
    } catch (err) {
      console.error('Submit Error:', err);
      setErrorMessage(err.message || 'An error occurred.');
      setStatus('error');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(testLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waMessage = () =>
    encodeURIComponent(
      `Hi ${generatedCandidateName || formData.name},

You've been selected for an *AI Screening Assessment*.

📋 *Instructions — Please read carefully:*
• Do NOT switch browser tabs or minimize the window. All activity is monitored.
• Copy-pasting is strictly disabled on this platform.
• Any cheating will be reported to HR automatically.
• Attempt all questions honestly.

🔗 Start your assessment here:
${testLink}

Good luck! 🚀`
    );

  if (status === 'success') {
    return (
      <div className="flex justify-center animate-fadeIn">
        <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col">
          {/* Success Header */}
          <div className="px-8 pt-6 pb-4 text-center space-y-3">
            <div className="relative mb-2">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100 shadow-lg shadow-emerald-500/10 transform hover:scale-105 transition-transform duration-500">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white border border-emerald-100 rounded-full flex items-center justify-center shadow-lg">
                <Zap className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em]">
                Assessment Created
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                Interview Link Ready
              </h2>
              <p className="text-slate-500 text-xs max-w-sm mx-auto leading-relaxed">
                The AI-powered screening for{' '}
                <span className="text-slate-900 font-bold">{generatedCandidateName}</span> is now
                live.
              </p>
            </div>
          </div>

          <div className="px-8 sm:px-12 pb-8 space-y-5 flex-1">
            {/* Candidate Summary Card */}
            <div className="bg-slate-50/80 border border-slate-200/60 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  Candidate
                </span>
                <p className="text-[11px] font-bold text-slate-800 truncate">
                  {generatedCandidateName}
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  Mobile
                </span>
                <p className="text-[11px] font-bold text-slate-800">
                  +91 {generatedCandidateContact}
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  Type
                </span>
                <p className="text-[11px] font-bold text-slate-800">AI Screening</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  Status
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wide">
                    Live
                  </p>
                </div>
              </div>
            </div>

            {/* Link Sharing Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  Unique Interview Link
                </label>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-2.5 h-2.5 text-slate-400" />
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                    Secure link
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-1 pl-4 bg-white border border-slate-200 rounded-xl shadow-sm focus-within:ring-4 focus-within:ring-blue-500/5 focus-within:border-blue-300 transition-all">
                <span className="flex-1 text-[11px] font-mono text-slate-500 truncate selection:bg-blue-100">
                  {testLink}
                </span>
                <button
                  onClick={copyLink}
                  className={`flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-[10px] font-black transition-all ${
                    copied
                      ? 'bg-slate-900 text-white shadow-lg'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span className="uppercase tracking-widest">{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Next Steps Guidance */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { icon: Smartphone, text: 'Send link to candidate' },
                { icon: Globe, text: 'Browser-based interview' },
                { icon: ListPlus, text: 'Results go to dashboard' },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white border border-slate-100 rounded-xl text-center shadow-sm"
                >
                  <item.icon className="w-3.5 h-3.5 text-blue-500/70" />
                  <p className="text-[9px] font-bold text-slate-600 leading-snug">{item.text}</p>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="grid sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100">
              <a
                href={`https://wa.me/91${generatedCandidateContact || formData.wp}?text=${waMessage()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-11 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-emerald-500/20 active:scale-95 group"
              >
                <MessageCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Share on WhatsApp
              </a>

              <button
                onClick={() => {
                  setStatus('idle');
                  setFormData({
                    name: '',
                    wp: '',
                    position: '',
                    timeLimit: '15',
                    mustCheckSkills: '',
                    customQuestions: '',
                  });
                  setGeneratedCandidateName('');
                  setGeneratedCandidateContact('');
                  setFile(null);
                  setTestLink('');
                }}
                className="flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-slate-900 text-slate-900 font-black uppercase tracking-widest text-[10px] hover:bg-slate-900 hover:text-white transition-all active:scale-95"
              >
                <span>Generate New</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start lg:h-[calc(100vh-140px)] lg:overflow-hidden">
      {/* Form Area */}
      <div className="h-full overflow-y-auto pr-4 custom-scrollbar space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Generate Assessment</h1>
          <p className="text-slate-500 mt-2 font-medium">
            Create a personalized AI-led technical screening in seconds.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="pb-10">
          {/* Assessment Type Selection */}
          <FormSection
            icon={LayoutDashboard}
            title="Assessment Configuration"
            description="Choose between CV-based AI probes or pre-defined ICP role standards."
          >
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setAssessmentType('normal')}
                  className={`flex-1 flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left group ${assessmentType === 'normal' ? 'border-blue-600 bg-blue-50/30' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap
                      className={`w-4 h-4 ${assessmentType === 'normal' ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                    />
                    <span
                      className={`text-[11px] font-black uppercase tracking-widest ${assessmentType === 'normal' ? 'text-blue-900' : 'text-slate-500'}`}
                    >
                      Normal Mode
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    AI analyzes CV to create specific technical probes.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAssessmentType('icp')}
                  className={`flex-1 flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left group ${assessmentType === 'icp' ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Shield
                      className={`w-4 h-4 ${assessmentType === 'icp' ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}
                    />
                    <span
                      className={`text-[11px] font-black uppercase tracking-widest ${assessmentType === 'icp' ? 'text-indigo-900' : 'text-slate-500'}`}
                    >
                      ICP Mode
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    Benchmark against role-specific standards & fit.
                  </p>
                </button>
              </div>

              {assessmentType === 'icp' && (
                <div className="space-y-2 animate-fadeIn">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                    <Bot className="w-3 h-3 text-indigo-500" /> Select ICP Role Standards{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    {isLoadingICPs ? (
                      <div className="w-full h-11 bg-slate-50 rounded-xl border border-slate-200 flex items-center px-4">
                        <Loader2 className="w-3 h-3 animate-spin text-slate-400 mr-2" />
                        <span className="text-xs text-slate-400 font-medium">
                          Loading Standards...
                        </span>
                      </div>
                    ) : (
                      <select
                        value={selectedIcpId}
                        onChange={(e) => setSelectedIcpId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236366f1%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px_20px] bg-[right_12px_center] bg-no-repeat cursor-pointer font-bold"
                      >
                        {activeICPs.map((icp) => (
                          <option key={icp.icpId} value={icp.icpId}>
                            {icp.roleName} — {icp.level} ({icp.department})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-400 italic pl-1 font-medium">
                    ICP mode uses verified industry standards to evaluate core competencies.
                  </p>
                </div>
              )}
            </div>
          </FormSection>

          <FormSection
            icon={User}
            title="Candidate Details"
            description="Basic contact information to track the application."
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  <FileText className="w-3 h-3 text-blue-500" /> Full Name{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-300"
                  value={formData.name}
                  onChange={handleInput}
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  <Smartphone className="w-3 h-3 text-blue-500" /> WhatsApp Number{' '}
                  <span className="text-red-500">*</span>
                </label>
                <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
                  <div className="flex items-center border-r border-slate-100 bg-slate-50 px-4 text-xs font-bold text-slate-400 tracking-wider">
                    +91
                  </div>
                  <input
                    name="wp"
                    type="text"
                    placeholder="9876543210"
                    maxLength={10}
                    className="flex-1 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-300"
                    value={formData.wp}
                    onChange={handleInput}
                    required
                  />
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            icon={Briefcase}
            title="Role & Setup"
            description="Define the target position and assessment constraints."
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  <Target className="w-3 h-3 text-blue-500" /> Position / Role{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  name="position"
                  type="text"
                  required
                  placeholder="e.g. Senior Frontend Engineer"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-300"
                  value={formData.position}
                  onChange={handleInput}
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  <Clock className="w-3 h-3 text-blue-500" /> Time Limit{' '}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  name="timeLimit"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%2364748b%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px_20px] bg-[right_12px_center] bg-no-repeat cursor-pointer"
                  value={formData.timeLimit}
                  onChange={handleInput}
                >
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="45">45 Minutes</option>
                  <option value="60">1 Hour</option>
                  <option value="90">1 Hour 30 Minutes</option>
                </select>
              </div>
            </div>
          </FormSection>

          <FormSection
            icon={UploadCloud}
            title="CV / Resume"
            description="AI uses this text to generate personalized technical questions."
          >
            <label className="group relative flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/30 px-4 text-center transition-all hover:border-blue-400 hover:bg-blue-50/40">
              <div
                className={`mb-3 w-12 h-12 rounded-full flex items-center justify-center transition-all ${file ? 'bg-emerald-100' : 'bg-white shadow-sm'}`}
              >
                {file ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : (
                  <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                )}
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">
                {file ? file.name : 'Click to upload or drag & drop'}
              </span>
              <span className="mt-1 text-[10px] text-slate-400 font-medium">
                PDF or DOCX — max 10 MB
              </span>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={handleFile}
              />
            </label>
          </FormSection>

          <FormSection
            icon={Zap}
            title="Tech Alignment"
            description="Focus the AI on specific stacks or internal tools."
          >
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                Must-check skills/tools
              </label>
              <input
                name="mustCheckSkills"
                type="text"
                placeholder="e.g. React, Docker, Kubernetes, Python FastAPI"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-300"
                value={formData.mustCheckSkills}
                onChange={handleInput}
              />
            </div>
          </FormSection>

          <FormSection
            icon={ListPlus}
            title="Custom Questions"
            description="These will be added at the end of the base assessment."
          >
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                Questions (one per line)
              </label>
              <textarea
                name="customQuestions"
                rows={3}
                placeholder={
                  'e.g. Are you comfortable with Night Shifts?\nWhat is your current notice period?'
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 resize-none placeholder:text-slate-300 leading-relaxed"
                value={formData.customQuestions}
                onChange={handleInput}
              />
              <p className="text-[10px] text-slate-400 italic pl-1 font-medium italic">
                Custom questions are asked verbatim after the HR and AI sections.
              </p>
            </div>
          </FormSection>

          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-red-500 font-bold text-xs">!</span>
              </div>
              <p className="text-xs text-red-600 font-medium leading-relaxed">{errorMessage}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={status !== 'idle' && status !== 'error'}
            className="w-full relative flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'idle' || status === 'error' ? (
              <>
                Generate Assessment Link
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-bold tracking-wide">
                  {status === 'extracting'
                    ? 'Analyzing CV...'
                    : status === 'generating'
                      ? 'AI Generating Probes...'
                      : 'Finalizing...'}
                </span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Sidebar Area */}
      <div className="hidden lg:block h-full">
        <InterviewPlanPreview
          formData={formData}
          assessmentType={assessmentType}
          activeICPs={activeICPs}
          selectedIcpId={selectedIcpId}
        />
      </div>
    </div>
  );
}
