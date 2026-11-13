import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, X } from 'lucide-react';
import type { CompletedSession, LoungeTable } from '../types';
import { TAX_RATE } from '../data/menu';
import {
  getGoogleAccessToken,
  initGoogleAuth,
  signInWithGoogleDocs,
} from '../services/googleDocsAuth';
import {
  buildDailyReportPayload,
  exportDailyTotalToGoogleDocs,
} from '../services/googleDocsExport';

interface BatchOutModalProps {
  visible: boolean;
  tables: LoungeTable[];
  history: CompletedSession[];
  staffName: string;
  onClose: () => void;
  onConfirmBatchOut: () => Promise<unknown>;
}

export const BatchOutModal: React.FC<BatchOutModalProps> = ({
  visible,
  tables,
  history,
  staffName,
  onClose,
  onConfirmBatchOut,
}) => {
  const [exportToDocs, setExportToDocs] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [doneResult, setDoneResult] = useState<{
    total: number;
    tabCount: number;
    docUrl?: string;
    docTitle?: string;
  } | null>(null);

  useEffect(() => {
    const unsub = initGoogleAuth((_user, tokenReady) => {
      setHasToken(tokenReady);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (visible) {
      setErrorMsg('');
      setDoneResult(null);
      setExportToDocs(false);
      setHasToken(Boolean(getGoogleAccessToken()));
    }
  }, [visible]);

  if (!visible) return null;

  const openTables = tables.filter((t) => t.status === 'occupied');
  const preview = buildDailyReportPayload({
    tables,
    history,
    staffName,
    includeOpenTables: true,
  });

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setIsLoggingIn(true);
    try {
      const res = await signInWithGoogleDocs();
      setHasToken(Boolean(res.accessToken));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Google sign-in was cancelled.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleExecuteBatchOut = async () => {
    setErrorMsg('');
    if (exportToDocs && !getGoogleAccessToken()) {
      setErrorMsg('Please sign in with Google first, or uncheck Google Docs export.');
      return;
    }

    setIsProcessing(true);
    try {
      let docUrl: string | undefined;
      let docTitle: string | undefined;

      if (exportToDocs) {
        const token = getGoogleAccessToken()!;
        const doc = await exportDailyTotalToGoogleDocs(token, preview);
        docUrl = doc.documentUrl;
        docTitle = doc.title;
      }

      await onConfirmBatchOut();
      setDoneResult({
        total: preview.total,
        tabCount: preview.closedSessions.length,
        docUrl,
        docTitle,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Batch close-out failed.';
      setErrorMsg(
        msg === 'AUTH_EXPIRED'
          ? 'Google authorization expired. Sign in again to export to Google Docs.'
          : msg
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full sm:max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-fuchsia-500/35 bg-[#0A0F1C] p-5 shadow-[0_0_40px_rgba(217,70,239,0.16)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-fuchsia-500/40 sm:hidden" />

        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-fuchsia-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-100 font-display tracking-wide">
                Close All Tables &amp; Batch Out Day
              </h2>
              <p className="text-xs text-slate-400">
                Closes open tabs, archives daily batch total, and resets floor for next day
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-200"
            aria-label="Close batch modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {doneResult ? (
            <div className="space-y-4 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 p-4 cyber-glow-emerald">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-200">
                    Day Batched Out &amp; Floor Reset
                  </h3>
                  <p className="mt-1 text-xs text-slate-300">
                    Closed {doneResult.tabCount} total tab
                    {doneResult.tabCount === 1 ? '' : 's'} for a batch total of{' '}
                    <strong className="font-mono text-emerald-300">
                      ${doneResult.total.toFixed(2)}
                    </strong>
                    . All tables across Floor 1, Floor 2, and Outside are now reset and ready for tomorrow.
                  </p>
                </div>
              </div>

              {doneResult.docUrl && (
                <a
                  href={doneResult.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300"
                >
                  <FileText className="h-4 w-4" />
                  Open Exported Google Doc
                </a>
              )}

              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] w-full rounded-xl border border-cyan-500/30 bg-[#060913] text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Open Tables Being Auto-Closed */}
              <div className="rounded-2xl border border-cyan-500/20 bg-[#060913] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-cyan-200">
                    Open Tables to Close ({openTables.length})
                  </span>
                  <span className="font-mono text-slate-400">
                    +{history.length} already closed
                  </span>
                </div>

                {openTables.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    All tables are already closed. Confirming will archive today&apos;s{' '}
                    {history.length} closed tab{history.length === 1 ? '' : 's'} and reset shift totals to $0.00.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto divide-y divide-cyan-500/10">
                    {openTables.map((t) => {
                      const tTotal =
                        t.orders.reduce((s, o) => s + o.unitPrice * o.quantity, 0) *
                        (1 + TAX_RATE);
                      return (
                        <div
                          key={t.id}
                          className="flex items-center justify-between py-2 text-xs"
                        >
                          <span className="text-slate-200">
                            {t.floor} · {t.name}
                            {t.guestName ? ` (${t.guestName})` : ''}
                          </span>
                          <span className="font-mono font-semibold text-cyan-300 tabular-nums">
                            ${tTotal.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="border-t border-cyan-500/20 pt-2.5 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Total Tabs in Batch</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      {preview.closedSessions.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Batch Subtotal</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      ${preview.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Tax (8%)</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      ${preview.tax.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 text-base font-bold text-slate-100">
                    <span>Batch Out Grand Total</span>
                    <span className="font-mono text-cyan-300 tabular-nums">
                      ${preview.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Optional Google Docs Export Before Reset */}
              <div className="rounded-2xl border border-cyan-500/20 bg-[#060913] p-4 space-y-3">
                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportToDocs}
                    onChange={(e) => setExportToDocs(e.target.checked)}
                    className="h-4 w-4 rounded border-cyan-500/40 bg-slate-900 accent-cyan-400"
                  />
                  Export final Daily Total to Google Docs before resetting
                </label>

                {exportToDocs && !hasToken && (
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoggingIn}
                    className="gsi-material-button w-full"
                  >
                    <div className="gsi-material-button-state" />
                    <div className="gsi-material-button-content-wrapper">
                      <div className="gsi-material-button-icon">
                        <svg
                          version="1.1"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 48 48"
                          style={{ display: 'block' }}
                        >
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                          />
                          <path
                            fill="#4285F4"
                            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                          />
                          <path
                            fill="#34A853"
                            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                          />
                          <path fill="none" d="M0 0h48v48H0z" />
                        </svg>
                      </div>
                      <span className="gsi-material-button-contents">
                        {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
                      </span>
                    </div>
                  </button>
                )}
              </div>

              {errorMsg && (
                <p className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-300">
                  {errorMsg}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[48px] rounded-xl border border-cyan-500/30 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBatchOut}
                  disabled={isProcessing || (exportToDocs && !hasToken)}
                  className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-fuchsia-500 px-4 text-sm font-bold text-white transition-colors hover:bg-fuchsia-400 cyber-glow-magenta disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isProcessing
                    ? 'Batching Out...'
                    : 'Confirm Batch Out & Reset'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
