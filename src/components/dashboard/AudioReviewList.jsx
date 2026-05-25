import React from 'react';
import { ListOrdered, Loader2, Mic, ChevronRight, ExternalLink } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function AudioReviewList({
  loadingAudioReviews,
  audioReviews,
  setSelectedAudioReviewId,
}) {
  return (
    <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <ListOrdered className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-bold text-slate-800">Recent Audio Reviews</h3>
        <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          Click a row to open the full report
        </span>
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
                  <p className="text-xs text-slate-500 mt-1">
                    {review.role || 'Role not specified'}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    {new Date(review.timestamp).toLocaleString('en-IN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status={review.status} />
                  <span className="text-xs font-medium text-slate-600 max-w-40 text-right">
                    {review.finalVerdict || review.recommendation || 'Processing'}
                  </span>
                  {review.pdfDriveUrl && (
                    <a
                      href={review.pdfDriveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-900"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      PDF
                    </a>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
