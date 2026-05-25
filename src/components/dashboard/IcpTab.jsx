import React, { useState, useEffect } from 'react';
import {
  Plus,
  Save,
  Loader2,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  FileText,
  LayoutDashboard,
  Shield,
  Bot,
} from 'lucide-react';
import { getAllICPs, saveICP } from '../../utils/googleSheets';

export default function IcpTab() {
  const [icps, setIcps] = useState([]);
  const [selectedIcp, setSelectedIcp] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Form State
  const [formData, setFormData] = useState({
    roleName: '',
    status: 'active',
    icpContent: '',
  });

  const fetchICPs = async () => {
    setIsLoading(true);
    setMessage({ type: '', text: '' });
    try {
      console.log('[IcpTab] Fetching all ICPs...');
      const data = await getAllICPs();
      console.log('[IcpTab] ICP Data received:', data);

      if (!Array.isArray(data)) {
        console.warn('[IcpTab] Data is not an array:', data);
        setIcps([]);
      } else {
        setIcps(data);
      }
    } catch (err) {
      console.error('[IcpTab] Load error:', err);
      setMessage({
        type: 'error',
        text: 'Could not reach the database. Please ensure you have run the "Setup" in Apps Script and deployed the latest Code.gs.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchICPs();
  }, []);

  const handleSelectIcp = (icp) => {
    setSelectedIcp(icp);
    setFormData({
      roleName: icp.roleName || '',
      status: icp.status || 'active',
      icpContent: icp.icpContent || '',
    });
    setMessage({ type: '', text: '' });
  };

  const handleCreateNew = () => {
    setSelectedIcp(null);
    setFormData({
      roleName: '',
      status: 'active',
      icpContent: '',
    });
    setMessage({ type: '', text: '' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.roleName || !formData.icpContent) {
      alert('Please provide Role Name and ICP Content.');
      return;
    }

    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const payload = {
        ...formData,
        icpId: selectedIcp?.icpId || null,
      };
      const result = await saveICP(payload);
      setMessage({ type: 'success', text: `ICP for "${result.roleName}" saved successfully!` });
      await fetchICPs(); // Refresh list

      // Update local state if it was an update
      if (selectedIcp) {
        setSelectedIcp((prev) => ({ ...prev, ...result }));
      }
    } catch (err) {
      console.error('[IcpTab] Save error:', err);
      setMessage({
        type: 'error',
        text:
          err.message ||
          'Failed to save ICP. Please ensure your spreadsheet is connected and try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-8 lg:h-[calc(100vh-140px)] lg:overflow-hidden">
      {/* 1. Left Sidebar: ICP List */}
      <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5" /> All ICPs
          </h3>
          <button
            onClick={handleCreateNew}
            className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
            title="Create New ICP"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-32 space-y-2">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
              <p className="text-[10px] text-slate-400 font-bold uppercase">Loading...</p>
            </div>
          ) : icps.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-400">No ICPs found. Create your first one!</p>
            </div>
          ) : (
            icps.map((icp) => (
              <button
                key={icp.icpId}
                onClick={() => handleSelectIcp(icp)}
                className={`w-full text-left p-3 rounded-xl transition-all group border ${
                  selectedIcp?.icpId === icp.icpId
                    ? 'bg-blue-50 border-blue-100 shadow-sm'
                    : 'bg-white border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-bold truncate ${selectedIcp?.icpId === icp.icpId ? 'text-blue-900' : 'text-slate-700'}`}
                  >
                    {icp.roleName}
                  </span>
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${icp.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  />
                </div>
                <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-slate-400">
                  <span>v{icp.version || '1.0'}</span>
                  <span className="group-hover:text-blue-500 transition-colors">
                    Edit Details →
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2. Main Area: Editor */}
      <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <Bot className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {selectedIcp ? `Edit ICP: ${selectedIcp.roleName}` : 'Create New ICP Standard'}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                Define the core benchmark for AI assessments.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {message.text && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold animate-fadeIn ${
                  message.type === 'success'
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    : 'bg-red-50 border-red-100 text-red-700'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                {message.text}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-slate-900/10"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save Standard
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <form className="max-w-4xl space-y-8">
            <div className="grid sm:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  Role Name / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. AI Developer"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10"
                  value={formData.roleName}
                  onChange={(e) => setFormData((p) => ({ ...p, roleName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">
                  Standard Status
                </label>
                <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, status: 'active' }))}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      formData.status === 'active'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, status: 'inactive' }))}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                      formData.status === 'inactive'
                        ? 'bg-white text-slate-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between pl-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Full ICP Document (Markdown)
                </label>
                <span className="text-[9px] text-slate-400 italic">
                  Paste your raw HR document here. AI will parse everything automatically.
                </span>
              </div>
              <textarea
                rows={18}
                placeholder={
                  '# IDEAL CANDIDATE PROFILE\n\n## 1. BASIC DETAILS\nRole: ...\n\n## 2. SKILLS\n- Skill 1\n- Skill 2\n...'
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/30 px-5 py-4 text-sm text-slate-800 outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 font-mono leading-relaxed"
                value={formData.icpContent}
                onChange={(e) => setFormData((p) => ({ ...p, icpContent: e.target.value }))}
              />
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-indigo-100">
                <Shield className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-900 mb-1 uppercase tracking-wide">
                  Why paste the full text?
                </h4>
                <p className="text-[11px] text-indigo-700 leading-relaxed">
                  Our advanced AI model reads the entire document to extract **Mandatory Skills**,
                  **Top Traits**, **Red Flags**, and **Work Scenarios**. It then uses these to
                  generate role-specific questions and grade the candidate's answers with
                  human-level accuracy.
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
