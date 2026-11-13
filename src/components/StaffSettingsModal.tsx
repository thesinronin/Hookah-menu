import React, { useEffect, useState } from 'react';
import { Monitor, Printer, RotateCcw, Sparkles, Users, Volume2, Wifi, X } from 'lucide-react';
import type {
  ActiveStaffMember,
  AlertMode,
  LoungeSettings,
  PrinterMode,
  PrinterPaperWidth,
  StaffProfile,
  StaffRole,
} from '../types';
import { triggerTimerAlert, unlockAudioEngine } from '../services/audioAlerts';
import { PWAInstallButton } from './PWAInstallButton';

interface StaffSettingsModalProps {
  visible: boolean;
  profile: StaffProfile;
  settings: LoungeSettings;
  activeStaff: ActiveStaffMember[];
  connectionState: 'connecting' | 'live' | 'reconnecting';
  wakeLockSupported: boolean;
  wakeLockEnabled: boolean;
  wakeLockActive: boolean;
  onToggleWakeLock: (enabled: boolean) => void;
  onClose: () => void;
  onSaveProfile: (profile: StaffProfile) => void;
  onUpdateSettings: (settings: LoungeSettings) => void;
  onResetDemo: () => void;
  onOpenFlavorManager: () => void;
}

export const StaffSettingsModal: React.FC<StaffSettingsModalProps> = ({
  visible,
  profile,
  settings,
  activeStaff,
  connectionState,
  wakeLockSupported,
  wakeLockEnabled,
  wakeLockActive,
  onToggleWakeLock,
  onClose,
  onSaveProfile,
  onUpdateSettings,
  onResetDemo,
  onOpenFlavorManager,
}) => {
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState<StaffRole>(profile.role);
  const [alertMode, setAlertMode] = useState<AlertMode>(profile.alertMode);
  const [coalMins, setCoalMins] = useState(String(settings.coalAlertMinutes));
  const [stayMins, setStayMins] = useState(String(settings.longStayAlertMinutes));
  const [printerMode, setPrinterMode] = useState<PrinterMode>(
    settings.kitchenPrinterMode || 'system'
  );
  const [printerIp, setPrinterIp] = useState(settings.kitchenPrinterIp || '');
  const [printerPort, setPrinterPort] = useState(
    String(settings.kitchenPrinterPort || 9100)
  );
  const [printerWidth, setPrinterWidth] = useState<PrinterPaperWidth>(
    settings.kitchenPrinterWidth || '80mm'
  );
  const [autoPrint, setAutoPrint] = useState(
    Boolean(settings.autoPrintKitchenTicket)
  );
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(profile.name);
    setRole(profile.role);
    setAlertMode(profile.alertMode);
    setCoalMins(String(settings.coalAlertMinutes));
    setStayMins(String(settings.longStayAlertMinutes));
    setPrinterMode(settings.kitchenPrinterMode || 'system');
    setPrinterIp(settings.kitchenPrinterIp || '');
    setPrinterPort(String(settings.kitchenPrinterPort || 9100));
    setPrinterWidth(settings.kitchenPrinterWidth || '80mm');
    setAutoPrint(Boolean(settings.autoPrintKitchenTicket));
    setConfirmReset(false);
  }, [visible, profile, settings]);

  if (!visible) return null;

  const handleSave = () => {
    onSaveProfile({
      ...profile,
      name: name.trim() || 'Staff',
      role,
      alertMode,
    });
    onUpdateSettings({
      coalAlertMinutes: Math.max(5, parseInt(coalMins, 10) || 25),
      longStayAlertMinutes: Math.max(15, parseInt(stayMins, 10) || 120),
      kitchenPrinterMode: printerMode,
      kitchenPrinterIp: printerIp.trim(),
      kitchenPrinterPort: Math.max(1, parseInt(printerPort, 10) || 9100),
      kitchenPrinterWidth: printerWidth,
      autoPrintKitchenTicket: autoPrint,
    });
    onClose();
  };

  const handleTestAudio = async () => {
    await unlockAudioEngine();
    await triggerTimerAlert(
      'coal',
      'Coal check due for Floor 2, VIP 1',
      alertMode === 'silent' ? 'chime_voice' : alertMode
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full sm:max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-cyan-500/30 bg-[#0A0F1C] p-5 shadow-[0_0_40px_rgba(6,182,212,0.16)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-cyan-500/40 sm:hidden" />

        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100 font-display tracking-wide">
              Staff, Audio &amp; Sync Settings
            </h2>
            <p className="text-xs text-slate-400">
              Multi-device live sync &amp; audible timer reminders
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-cyan-500/10 hover:text-cyan-200"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {/* Staff Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-cyan-200/80 mb-1.5">
                Your Staff Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nadia"
                className="w-full min-h-[44px] rounded-xl border border-cyan-500/25 bg-[#060913] px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-cyan-200/80 mb-1.5">
                Station Role
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Server', 'Hookah Master', 'Manager'] as StaffRole[]).map(
                  (r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition-colors ${
                        role === r
                          ? 'border-cyan-400 bg-cyan-400 text-slate-950 cyber-glow-cyan'
                          : 'border-cyan-500/25 bg-[#060913] text-slate-300 hover:border-cyan-400/50'
                      }`}
                    >
                      {r === 'Hookah Master' ? 'Station' : r}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Audio Alerts */}
          <div className="space-y-3 border-t border-cyan-500/20 pt-4">
            <span className="block text-xs font-medium text-cyan-200/80">
              Timer Audio Alert Mode
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'chime_voice', label: 'Chime + Voice' },
                  { id: 'chime_only', label: 'Chime Only' },
                  { id: 'silent', label: 'Visual Only' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAlertMode(opt.id)}
                  className={`min-h-[44px] rounded-xl border px-2 text-xs font-bold transition-colors whitespace-nowrap ${
                    alertMode === opt.id
                      ? 'border-cyan-400 bg-cyan-400 text-slate-950 cyber-glow-cyan'
                      : 'border-cyan-500/25 bg-[#060913] text-slate-300 hover:border-cyan-400/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-cyan-200/80 mb-1.5">
                  Coal Check Alert (mins)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={coalMins}
                  onChange={(e) => setCoalMins(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-cyan-500/25 bg-[#060913] px-3.5 py-2 font-mono text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-cyan-200/80 mb-1.5">
                  Long Stay Alert (mins)
                </label>
                <input
                  type="number"
                  min={15}
                  max={360}
                  value={stayMins}
                  onChange={(e) => setStayMins(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-cyan-500/25 bg-[#060913] px-3.5 py-2 font-mono text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestAudio}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-2.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
            >
              <Volume2 className="h-4 w-4 text-cyan-400" />
              Test Chime &amp; Voice Alert
            </button>
          </div>

          {/* Live Multi-Staff Sync Roster */}
          <div className="space-y-2.5 border-t border-cyan-500/20 pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
                <Wifi
                  className={`h-3.5 w-3.5 ${
                    connectionState === 'live'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                />
                Sync Status:{' '}
                <span
                  className={
                    connectionState === 'live'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }
                >
                  {connectionState === 'live'
                    ? 'Connected Live'
                    : connectionState === 'connecting'
                    ? 'Connecting...'
                    : 'Reconnecting...'}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-cyan-300 font-mono">
                <Users className="h-3.5 w-3.5" />
                {activeStaff.length} online
              </span>
            </div>

            <div className="rounded-xl border border-cyan-500/20 bg-[#060913] divide-y divide-cyan-500/10">
              {activeStaff.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-slate-500">
                  Open this app on another phone or browser tab to see live staff presence and instant table sync.
                </p>
              ) : (
                activeStaff.map((member) => (
                  <div
                    key={member.clientId}
                    className="flex items-center justify-between px-3.5 py-2 text-xs"
                  >
                    <span className="font-medium text-slate-200">
                      {member.name}
                      {member.clientId === profile.clientId ? ' (You)' : ''}
                    </span>
                    <span className="text-cyan-300/80">{member.role}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Android Shift Controls & Install */}
          <div className="space-y-2.5 border-t border-cyan-500/20 pt-4">
            <span className="block text-xs font-medium text-cyan-200/80">
              Android Device &amp; Shift Mode
            </span>
            <button
              type="button"
              onClick={() => onToggleWakeLock(!wakeLockEnabled)}
              className={`flex min-h-[44px] w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                wakeLockEnabled
                  ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
                  : 'border-cyan-500/25 bg-[#060913] text-slate-300'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Monitor className="h-4 w-4 text-cyan-400" />
                Keep Screen Awake During Shift
              </span>
              <span className="font-mono text-[11px]">
                {!wakeLockSupported
                  ? 'UNAVAILABLE'
                  : wakeLockEnabled
                  ? wakeLockActive
                    ? 'ACTIVE'
                    : 'ON'
                  : 'OFF'}
              </span>
            </button>
            <PWAInstallButton variant="card" />
          </div>

          {/* Shisha Flavor Inventory */}
          <div className="space-y-2 border-t border-cyan-500/20 pt-4">
            <span className="block text-xs font-medium text-cyan-200/80">
              Shisha Flavor Menu &amp; Stock
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFlavorManager();
              }}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2.5 text-xs font-bold text-fuchsia-200 hover:bg-fuchsia-500/20"
            >
              <Sparkles className="h-4 w-4 text-fuchsia-400" />
              Edit Available &amp; Sold-Out Flavors
            </button>
          </div>

          {/* Kitchen Thermal Printer Setup */}
          <div className="space-y-2.5 border-t border-cyan-500/20 pt-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-200/80">
              <Printer className="h-3.5 w-3.5 text-cyan-400" />
              Kitchen Thermal Printer
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'system', label: 'Android / USB' },
                  { id: 'network', label: 'LAN IP :9100' },
                  { id: 'bluetooth', label: 'Bluetooth BLE' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPrinterMode(opt.id)}
                  className={`min-h-[40px] rounded-xl border px-2 text-xs font-bold transition-colors ${
                    printerMode === opt.id
                      ? 'border-cyan-400 bg-cyan-400 text-slate-950 cyber-glow-cyan'
                      : 'border-cyan-500/25 bg-[#060913] text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {printerMode === 'network' && (
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={printerIp}
                  onChange={(e) => setPrinterIp(e.target.value)}
                  placeholder="Printer IP (192.168.1.50)"
                  className="col-span-2 min-h-[42px] rounded-xl border border-cyan-500/25 bg-[#060913] px-3 py-2 font-mono text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
                <input
                  type="number"
                  value={printerPort}
                  onChange={(e) => setPrinterPort(e.target.value)}
                  placeholder="9100"
                  className="min-h-[42px] rounded-xl border border-cyan-500/25 bg-[#060913] px-3 py-2 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {(['80mm', '58mm'] as PrinterPaperWidth[]).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setPrinterWidth(w)}
                    className={`min-h-[36px] rounded-lg border px-3 font-mono text-xs font-bold ${
                      printerWidth === w
                        ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
                        : 'border-cyan-500/20 bg-[#060913] text-slate-400'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => setAutoPrint(e.target.checked)}
                  className="h-4 w-4 rounded border-cyan-500/40 bg-slate-900 accent-cyan-400"
                />
                Auto-print new LAN tickets
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="min-h-[48px] w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-300 cyber-glow-emerald"
            >
              Save Settings
            </button>

            <button
              type="button"
              onClick={() => {
                if (!confirmReset) {
                  setConfirmReset(true);
                  return;
                }
                onResetDemo();
                setConfirmReset(false);
                onClose();
              }}
              className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-colors ${
                confirmReset
                  ? 'border-fuchsia-500 bg-fuchsia-500 text-white cyber-glow-magenta'
                  : 'border-cyan-500/20 text-slate-400 hover:border-fuchsia-400/50 hover:text-fuchsia-300'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {confirmReset
                ? 'Confirm Reset All Floors & Demo Timers'
                : 'Reset Demo Floor State'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
