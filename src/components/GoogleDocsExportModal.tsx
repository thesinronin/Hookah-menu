import React, { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, FileText, LogOut, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { BatchReport, CompletedSession, LoungeTable } from '../types';
import {
  getGoogleAccessToken,
  initGoogleAuth,
  signInWithGoogleDocs,
  signOutGoogle,
} from '../services/googleDocsAuth';
import {
  buildDailyReportPayload,
  exportDailyTotalToGoogleDocs,
} from '../services/googleDocsExport';

interface GoogleDocsExportModalProps {
  visible: boolean;
  tables: LoungeTable[];
  history: CompletedSession[];
  staffName: string;
  batchReport?: BatchReport | null;
  onClose: () => void;
}

export const GoogleDocsExportModal: React.FC<GoogleDocsExportModalProps> = ({
  visible,
  tables,
  history,
  staffName,
  batchReport,
  onClose,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [includeOpenTables, setIncludeOpenTables] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [exportedDoc, setExportedDoc] = useState<{
    documentId: string;
    documentUrl: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    const unsub = initGoogleAuth((authUser, tokenReady) => {
      setUser(authUser);
      setHasToken(tokenReady);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (visible) {
      setErrorMsg('');
      setExportedDoc(null);
      setHasToken(Boolean(getGoogleAccessToken()));
    }
  }, [visible]);

  if (!visible) return null;

  const report = buildDailyReportPayload({
    tables,
    history,
    staffName,
    includeOpenTables,
    fromBatch: batchReport,
  });

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setIsLoggingIn(true);
    try {
      const res = await signInWithGoogleDocs();
      setUser(res.user);
      setHasToken(Boolean(res.accessToken));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Google sign-in was cancelled.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleConfirmExport = async () => {
    setErrorMsg('');
    const token = getGoogleAccessToken();
    if (!token) {
      setHasToken(false);
      setErrorMsg('Please sign in with Google to authorize Google Docs export.');
      return;
    }

    setIsExporting(true);
    try {
      const result = await exportDailyTotalToGoogleDocs(token, report);
      setExportedDoc(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      if (msg === 'AUTH_EXPIRED') {
        setHasToken(false);
        setErrorMsg('Your Google session expired. Please sign in again.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full sm:max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-cyan-500/30 bg-[#0A0F1C] p-5 shadow-[0_0_40px_rgba(6,182,212,0.16)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-cyan-500/40 sm:hidden" />

        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-100 font-display tracking-wide">
                Export Daily Total to Google Docs
              </h2>
              <p className="text-xs text-slate-400">
                Creates a formatted daily summary document in your Google Docs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-200"
            aria-label="Close export modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {exportedDoc ? (
            <div className="space-y-4 rounded-2xl border border-emerald-400/35 bg-emerald-500/10 p-4 cyber-glow-emerald">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <h3 className="text-sm font-bold text-emerald-200">
                    Exported to Google Docs
                  </h3>
                  <p className="mt-1 text-xs text-slate-300">
                    Document &ldquo;{exportedDoc.title}&rdquo; has been created with your daily totals and tab breakdown.
                  </p>
                </div>
              </div>

              <a
                href={exportedDoc.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300"
              >
                <ExternalLink className="h-4 w-4" />
                Open Google Doc
              </a>
            </div>
          ) : (
            <>
              {/* Confirmation Preview */}
              <div className="rounded-2xl border border-cyan-500/20 bg-[#060913] p-4 space-y-2.5">
                <p className="text-xs font-semibold text-cyan-200">
                  Confirm Export Details
                </p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Document Title</span>
                    <span className="font-medium text-slate-200 text-right">
                      {report.title}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Tabs Included</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      {report.closedSessions.length}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-cyan-500/20 pt-2 text-sm font-bold text-slate-100">
                    <span>Grand Total</span>
                    <span className="font-mono text-cyan-300 tabular-nums">
                      ${report.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {!batchReport && (
                  <label className="mt-2 flex items-center gap-2.5 pt-2 border-t border-cyan-500/15 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeOpenTables}
                      onChange={(e) => setIncludeOpenTables(e.target.checked)}
                      className="h-4 w-4 rounded border-cyan-500/40 bg-slate-900 accent-cyan-400"
                    />
                    Include active open tables in snapshot total
                  </label>
                )}
              </div>

              {/* Google Auth Status & Official Sign-in Button */}
              {!hasToken ? (
                <div className="space-y-3 rounded-2xl border border-cyan-500/20 bg-[#060913] p-4">
                  <p className="text-xs text-slate-300">
                    Sign in with Google to grant permission to create this document in your Google Docs account.
                  </p>
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
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-[#060913] px-3.5 py-2.5 text-xs">
                  <span className="text-slate-300 truncate">
                    Signed in as{' '}
                    <strong className="text-cyan-200">
                      {user?.email || user?.displayName || 'Google User'}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      signOutGoogle();
                      setHasToken(false);
                    }}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-cyan-200 ml-2 shrink-0"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>
              )}

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
                  onClick={handleConfirmExport}
                  disabled={!hasToken || isExporting}
                  className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300 cyber-glow-cyan disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <FileText className="h-4 w-4" />
                  {isExporting
                    ? 'Creating Google Doc...'
                    : 'Confirm & Create Google Doc'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
