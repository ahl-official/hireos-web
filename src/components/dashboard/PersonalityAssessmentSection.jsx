import { useState } from 'react';
import { ChevronRight, MessageCircle, Loader2 } from 'lucide-react';

const DISC_BAR_STYLES = {
  D: { label: 'Dominance', track: 'bg-rose-100', fill: 'bg-rose-500' },
  I: { label: 'Influence', track: 'bg-amber-100', fill: 'bg-amber-500' },
  S: { label: 'Steadiness', track: 'bg-emerald-100', fill: 'bg-emerald-500' },
  C: { label: 'Conscientiousness', track: 'bg-sky-100', fill: 'bg-sky-500' },
};

const normalizeRecommendedRoles = (raw) => {
  if (Array.isArray(raw)) {
    return raw
      .map((role) => {
        if (typeof role === 'string') return role.trim();
        if (role?.roleName) {
          const score = role.fitScore != null ? ` — ${role.fitScore}%` : '';
          const label = role.fitLabel ? ` ${role.fitLabel}` : '';
          return `${role.roleName}${score}${label}`.trim();
        }
        return '';
      })
      .filter(Boolean);
  }

  if (typeof raw === 'string' && raw.trim()) {
    try {
      return normalizeRecommendedRoles(JSON.parse(raw));
    } catch {
      return raw
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const getPsychometricLink = (id, entityType = 'Candidate') => {
  const base = (
    import.meta.env.VITE_PSYCHOMETRIC_PORTAL_URL ||
    import.meta.env.VITE_CANDIDATE_PORTAL_URL ||
    window.location.origin
  ).replace(/\/$/, '');
  const entity =
    String(entityType || 'Candidate').trim().toLowerCase() === 'employee'
      ? 'Employee'
      : 'Candidate';
  const qs = entity === 'Employee' ? '?entity=Employee' : '';
  return `${base}/psychometric/${encodeURIComponent(id)}${qs}`;
};

function DiscBar({ dim, value }) {
  const style = DISC_BAR_STYLES[dim];
  const pct = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-600">
          {dim} · {style.label}
        </span>
        <span className="font-bold text-slate-800">{pct}%</span>
      </div>
      <div className={`h-2 rounded-full overflow-hidden ${style.track}`}>
        <div className={`h-full rounded-full ${style.fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PersonalityAssessmentSection({
  psychometric,
  loading,
  onResend,
  interviewCompleted = false,
}) {
  const [open, setOpen] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState(null);

  const status = String(psychometric?.status || 'Not Started').trim();
  const statusLower = status.toLowerCase();
  const isCompleted = statusLower === 'completed';
  const isPending = statusLower === 'pending';
  const isNotStarted =
    statusLower === 'not started' || statusLower === '';
  const recommendedRoles = normalizeRecommendedRoles(psychometric?.recommendedRoles);
  // Interview completed + DISC not completed → allow Send / Resend
  const canResend = interviewCompleted && !isCompleted && !!onResend;
  const sendLabel = isPending ? 'Resend Link' : 'Send Link';

  const handleResend = async () => {
    if (!canResend || sending) return;
    try {
      setSending(true);
      const result = await onResend(psychometric);
      if (result?.skipped) {
        setLastSent(null);
        window.alert(
          result.reason === 'ALREADY_COMPLETED'
            ? 'Assessment already completed — link not resent.'
            : result.reason === 'INTERVIEW_NOT_COMPLETED'
              ? 'Interview is not completed yet — personality link can only be sent after the interview.'
            : result.reason === 'NOT_PENDING'
              ? 'Personality assessment cannot be sent in this state.'
              : 'Link send was skipped.'
        );
      } else if (result?.message) {
        setLastSent({
          message: result.message,
          link: result.link || '',
          at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Resend failed:', err);
      setLastSent(null);
      window.alert(err?.message || 'Failed to send personality assessment link.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-100/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Personality Assessment
          </h3>
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
          ) : isCompleted ? (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
              Completed
            </span>
          ) : isPending ? (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              Test Pending
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 border border-slate-300">
              Not Completed
            </span>
          )}
        </div>
        <ChevronRight
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 bg-white">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 pt-3">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              Loading personality assessment...
            </div>
          )}

          {!loading && isCompleted && psychometric && (
            <div className="pt-3 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {psychometric.discProfile && (
                  <span className="inline-flex items-center rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-sm font-black text-indigo-700">
                    {psychometric.discProfile}
                  </span>
                )}
                {psychometric.roleFitLabel && (
                  <span className="inline-flex items-center rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    {psychometric.appliedRole || 'Applied role'}: {psychometric.roleFitScore}%{' '}
                    {psychometric.roleFitLabel}
                  </span>
                )}
              </div>

              {psychometric.discSummary && (
                <p className="text-sm leading-6 text-slate-700">{psychometric.discSummary}</p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <DiscBar dim="D" value={psychometric.discD} />
                <DiscBar dim="I" value={psychometric.discI} />
                <DiscBar dim="S" value={psychometric.discS} />
                <DiscBar dim="C" value={psychometric.discC} />
              </div>

              {recommendedRoles.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                    Recommended Roles
                  </h4>
                  <ul className="space-y-1.5">
                    {recommendedRoles.map((role) => (
                      <li
                        key={role}
                        className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2"
                      >
                        {role}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!loading && !isCompleted && (
            <div className="pt-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-slate-600">
                  {!interviewCompleted
                    ? 'Personality assessment is available only after the interview is completed.'
                    : isPending
                      ? 'Personality assessment sent — waiting for the candidate to finish.'
                      : isNotStarted
                        ? 'Personality assessment has not been sent yet.'
                        : 'Candidate did not complete the personality assessment.'}
                </p>
                <button
                  type="button"
                  disabled={sending || !canResend}
                  title={
                    !interviewCompleted
                      ? 'Interview must be completed first'
                      : undefined
                  }
                  onClick={handleResend}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 disabled:pointer-events-none text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageCircle className="w-4 h-4" />
                  )}
                  {sending ? 'Sending…' : sendLabel}
                </button>
              </div>

              {lastSent?.message && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-3 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    WhatsApp message sent
                  </p>
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-6">
                    {lastSent.message}
                  </pre>
                  {lastSent.link && (
                    <a
                      href={lastSent.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-emerald-700 underline break-all"
                    >
                      {lastSent.link}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { getPsychometricLink };
