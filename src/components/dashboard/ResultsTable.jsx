import React, { useState } from 'react';
import {
  Users,
  CheckCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  Search,
  Trash2,
  ListOrdered,
  Loader2,
  ChevronRight,
  AlertTriangle,
  Link,
  Check,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import StatCard from './StatCard';

export default function ResultsTable({
  candidates,
  filteredCandidates,
  selectedCandidates,
  positionFilter,
  setPositionFilter,
  loadingResults,
  fetchResults,
  handleDelete,
  handleBulkDelete,
  toggleSelectAll,
  toggleSelect,
  setSelectedId,
  isDeleting,
  completedCount,
  avgScore,
}) {
  const [copiedId, setCopiedId] = useState(null);

  const handleCopyLink = (e, id) => {
    e.stopPropagation();
    const link = `${window.location.origin}/test/${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Results & Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">
            Click on a candidate name to view the full report
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {selectedCandidates.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 active:scale-95 border border-red-200 px-4 py-2.5 rounded-xl transition-all shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Deleting...' : `Delete (${selectedCandidates.length})`}
            </button>
          )}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Filter by position..."
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 w-full sm:w-64 transition-all"
            />
          </div>
          <button
            onClick={fetchResults}
            disabled={loadingResults}
            className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 active:scale-95 border border-blue-200 px-4 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loadingResults ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total" value={candidates.length} color="bg-indigo-600" />
        <StatCard
          icon={CheckCircle}
          label="Completed"
          value={completedCount}
          color="bg-emerald-500"
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={candidates.length - completedCount}
          color="bg-amber-500"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Score"
          value={completedCount ? `${avgScore}%` : '—'}
          color="bg-blue-600"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800">Candidate List</h3>
          <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            Click a row to view full report
          </span>
        </div>

        {loadingResults ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-50">
                {[...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4 w-10">
                      <div className="w-4 h-4 bg-slate-200 rounded"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2">
                        <div className="h-4 bg-slate-200 rounded w-32"></div>
                        <div className="h-3 bg-slate-100 rounded w-24"></div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <div className="h-5 bg-slate-100 rounded-full w-20"></div>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <div className="h-5 bg-slate-100 rounded w-12"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-6 bg-slate-200 rounded-full w-24"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 bg-slate-200 rounded w-16"></div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      <div className="h-4 bg-slate-100 rounded w-20"></div>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <div className="w-8 h-8 bg-slate-100 rounded-xl"></div>
                      <div className="w-8 h-8 bg-slate-100 rounded-xl"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    <input
                      type="checkbox"
                      checked={
                        selectedCandidates.length === filteredCandidates.length &&
                        filteredCandidates.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Candidate
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden sm:table-cell">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Score
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">
                    Integrity
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredCandidates.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedCandidates.includes(c.id)}
                        onChange={(e) => toggleSelect(e, c.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-blue-600 group-hover:text-blue-800 flex items-center gap-1 transition-colors">
                        {c.name}
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex flex-col gap-1">
                        <span>{c.email ? c.email : `+91 ${c.wp}`}</span>
                        <span className="text-[10px] font-medium opacity-80">
                          Gen:{' '}
                          {new Date(c.timestamp).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 text-slate-500 text-[11px] font-bold border border-slate-200 uppercase tracking-wide">
                        {c.position || 'Not specified'}
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <div
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
                          c.assessmentType === 'icp'
                            ? 'bg-indigo-50 border-indigo-100 text-indigo-600'
                            : 'bg-blue-50 border-blue-100 text-blue-600'
                        }`}
                      >
                        {c.assessmentType === 'icp' ? 'ICP' : 'Normal'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={c.status} />
                      {c.status === 'Completed' && c.submittedAt && (
                        <div className="text-[10px] text-slate-400 mt-2 font-medium">
                          Sub:{' '}
                          {new Date(c.submittedAt).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {c.status === 'Completed' ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-1000 ${Number(c.score) >= 70 ? 'bg-emerald-500' : Number(c.score) >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${c.score}%` }}
                            />
                          </div>
                          <span className="font-extrabold text-slate-700">{c.score}%</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      {Number(c.tabSwitches) > 0 ? (
                        <span className="flex items-center gap-1.5 text-red-500 font-bold text-xs uppercase tracking-tight">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {c.tabSwitches}x detected
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-bold text-xs uppercase tracking-tight flex items-center gap-1">
                          ✓ Clean
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => handleCopyLink(e, c.id)}
                          title="Copy Interview Link"
                          className={`p-2 rounded-xl transition-all active:scale-90 flex items-center gap-1.5 ${
                            copiedId === c.id
                              ? 'bg-slate-900 text-white shadow-lg'
                              : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                        >
                          {copiedId === c.id ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Link className="w-4 h-4" />
                          )}
                          {copiedId === c.id && (
                            <span className="text-[10px] font-bold uppercase tracking-widest">
                              Copied
                            </span>
                          )}
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, c.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
