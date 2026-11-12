import React, { useState } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Building,
  User,
  Shield,
  Calendar,
  ThermometerSnowflake,
  Flame,
  Info,
  Save,
  Check,
  Radio,
  Mail,
  Send,
  Bell,
  BellRing,
  Clock,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { AccountInfo, ColdChainConfig, EmailAlertLog } from '../types/flespi';
import { formatTimestamp, fromCelsius, toCelsius, valOrDash } from '../utils/formatters';
import {
  sendTestEmail,
} from '../services/resendService';

interface ConfigurationTabProps {
  config: ColdChainConfig;
  account: AccountInfo | null;
  onSaveConfig: (newConfig: ColdChainConfig) => void;
  onVerifyToken: (token: string, channelId: number) => Promise<boolean>;
  isVerifying: boolean;
  verifyError: string | null;
  alertLogs?: EmailAlertLog[];
  onClearAlertLogs?: () => void;
}

const PRESETS = [
  { label: 'Pharma Vaccines & Biologics', min: 2.0, max: 8.0, desc: 'Standard cold chain for vaccines, insulin, and biologics' },
  { label: 'Deep Frozen & Ice Cream', min: -25.0, max: -18.0, desc: 'Frozen food and cryogenic storage' },
  { label: 'Chilled Produce & Dairy', min: 0.0, max: 4.0, desc: 'Fresh fruits, vegetables, and milk distribution' },
  { label: 'Controlled Room Temperature', min: 15.0, max: 25.0, desc: 'Ambient medical and laboratory storage' },
];

export const ConfigurationTab: React.FC<ConfigurationTabProps> = ({
  config,
  account,
  onSaveConfig,
  onVerifyToken,
  isVerifying,
  verifyError,
  alertLogs = [],
  onClearAlertLogs,
}) => {
  // Flespi Credentials
  const [tokenInput, setTokenInput] = useState(config.token || '');
  const [channelIdInput, setChannelIdInput] = useState(String(config.channelId || 1401599));
  const [showToken, setShowToken] = useState(false);

  // Temperature Thresholds
  const [minTempInput, setMinTempInput] = useState(fromCelsius(config.minTemp, config.tempUnit).toString());
  const [maxTempInput, setMaxTempInput] = useState(fromCelsius(config.maxTemp, config.tempUnit).toString());
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>(config.tempUnit);
  const [autoRefresh, setAutoRefresh] = useState(config.autoRefreshInterval);

  // Email & Resend API Token Storage Fields (inputted by user)
  const [emailInput, setEmailInput] = useState(config.notificationEmail || '');
  const [resendTokenInput, setResendTokenInput] = useState(config.resendApiKey || '');
  const [showResendToken, setShowResendToken] = useState(false);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(config.emailAlertsEnabled ?? true);
  const [alertCooldown, setAlertCooldown] = useState(config.alertCooldownMinutes ?? 15);

  // Test Email State
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    success: boolean;
    message: string;
    id?: string;
  } | null>(null);

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Handle unit switch
  const handleUnitToggle = (newUnit: 'C' | 'F') => {
    if (newUnit === tempUnit) return;
    const currentMinC = toCelsius(parseFloat(minTempInput) || 0, tempUnit);
    const currentMaxC = toCelsius(parseFloat(maxTempInput) || 0, tempUnit);
    setTempUnit(newUnit);
    setMinTempInput(fromCelsius(currentMinC, newUnit).toString());
    setMaxTempInput(fromCelsius(currentMaxC, newUnit).toString());
  };

  const handleApplyPreset = (presetMin: number, presetMax: number) => {
    setMinTempInput(fromCelsius(presetMin, tempUnit).toString());
    setMaxTempInput(fromCelsius(presetMax, tempUnit).toString());
  };

  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    const chanId = parseInt(channelIdInput, 10) || 1401599;
    await onVerifyToken(tokenInput.trim(), chanId);
  };

  // Test Resend Email Notification
  const handleTestEmail = async () => {
    const email = emailInput.trim();
    const apiKey = resendTokenInput.trim();

    if (!email) {
      setTestEmailResult({ success: false, message: 'Please enter a notification email address first.' });
      return;
    }
    if (!apiKey) {
      setTestEmailResult({ success: false, message: 'Please enter a valid Resend API key.' });
      return;
    }

    setIsTestingEmail(true);
    setTestEmailResult(null);

    try {
      const res = await sendTestEmail(
        apiKey,
        email,
        account?.displayName || account?.name || 'Haris Qureshi'
      );

      if (res.success) {
        setTestEmailResult({
          success: true,
          message: `Verification email sent successfully to ${email}!`,
          id: res.id,
        });
      } else {
        setTestEmailResult({
          success: false,
          message: res.error || 'Failed to send test email. Check your Resend API token and permissions.',
        });
      }
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: err.message || 'Error communicating with Resend API.',
      });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleSaveAll = () => {
    const minVal = parseFloat(minTempInput);
    const maxVal = parseFloat(maxTempInput);
    const chanId = parseInt(channelIdInput, 10) || 1401599;

    if (isNaN(minVal) || isNaN(maxVal)) {
      alert('Please enter valid numerical values for temperature limits.');
      return;
    }

    const minC = toCelsius(minVal, tempUnit);
    const maxC = toCelsius(maxVal, tempUnit);

    if (minC >= maxC) {
      alert('Minimum acceptable temperature must be strictly less than maximum temperature.');
      return;
    }

    onSaveConfig({
      token: tokenInput.trim(),
      channelId: chanId,
      minTemp: minC,
      maxTemp: maxC,
      tempUnit,
      autoRefreshInterval: autoRefresh,
      notificationEmail: emailInput.trim(),
      resendApiKey: resendTokenInput.trim(),
      emailAlertsEnabled,
      alertCooldownMinutes: alertCooldown,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const currentMinNum = parseFloat(minTempInput) || 0;
  const currentMaxNum = parseFloat(maxTempInput) || 0;
  const currentMinC = toCelsius(currentMinNum, tempUnit);
  const currentMaxC = toCelsius(currentMaxNum, tempUnit);

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      {/* Page Title & Intro */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 mb-2">
              <KeyRound className="w-3.5 h-3.5" /> Flespi & Resend Authentication
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Configuration</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Authenticate using your Flespi token, configure acceptable cold chain temperature thresholds,
              and set up your Resend API token and email address to receive automated excursion alerts.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Token Auth & Account Identity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Token Input Form */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" /> Flespi API Token & Channel
              </h3>
              <span className="text-xs font-mono text-cyan-400">flespi.io/gw/channels/1401599</span>
            </div>

            <form onSubmit={handleConnectToken} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Flespi Security Token (Authorization Header)
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Enter Flespi Token..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 pr-12 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 font-mono transition"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 transition"
                      title={showToken ? 'Hide token' : 'Show token'}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Gateway Channel ID
                </label>
                <div className="relative">
                  <Radio className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    value={channelIdInput}
                    onChange={(e) => setChannelIdInput(e.target.value)}
                    placeholder="1401599"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 font-mono transition"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Default: 1401599 (Teltonika Asset Tracking channel)
                </p>
              </div>

              {verifyError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/70 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <span className="font-semibold">Authentication Error:</span> {verifyError}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isVerifying || !tokenInput.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white shadow-md shadow-cyan-600/10 transition active:scale-95"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      <span>Verifying Token with Flespi...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify & Connect Token</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Direct API validation via flespi.io</span>
            <span className="text-cyan-400 font-mono">channel.id: {channelIdInput}</span>
          </div>
        </div>

        {/* Account Details Card (Shows which account token belongs to) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-cyan-400" /> Account Owner
              </h3>
              {account ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60">
                  --
                </span>
              )}
            </div>

            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                  Account Name
                </span>
                <div className="text-base font-bold text-cyan-300 mt-0.5">
                  {valOrDash(account?.displayName || account?.name)}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  App Title: <strong className="text-white">Cold Chain for {valOrDash(account?.displayName || account?.name)}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Customer ID (CID)</span>
                  <span className="text-sm font-mono font-bold text-slate-200 mt-0.5 block">
                    {account?.cid ? `#${account.cid}` : '--'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Token Type</span>
                  <span className="text-sm font-mono font-bold capitalize text-slate-200 mt-0.5 block">
                    {valOrDash(account?.tokenType)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 px-1">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">Name:</span>
                  <span className="text-slate-200 font-medium">{valOrDash(account?.name)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">Email:</span>
                  <span className="text-slate-200 font-medium">{valOrDash(account?.email)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">Expiration:</span>
                  <span className="text-slate-200 font-medium">
                    {account?.tokenExpire && account.tokenExpire > 0
                      ? formatTimestamp(account.tokenExpire)
                      : account
                      ? 'Never expires'
                      : '--'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
            Account identity retrieved via Flespi Platform REST API.
          </div>
        </div>
      </div>

      {/* Resend Email Notifications Integration Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/60 mb-1">
              <BellRing className="w-3.5 h-3.5" /> Email Notifications & Resend Integration
            </div>
            <h3 className="text-lg font-bold text-white">Automated Excursion Notifications</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Whenever any live temperature reading breaks the acceptable limits, an email alert will be automatically
              dispatched via Resend to the configured address.
            </p>
          </div>

          {/* Alert Toggle Status */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setEmailAlertsEnabled(!emailAlertsEnabled)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                emailAlertsEnabled
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  emailAlertsEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              ></span>
              <span>{emailAlertsEnabled ? 'Alerts Active' : 'Alerts Paused'}</span>
            </button>
          </div>
        </div>

        {/* Notification Input Fields: Email & Resend API Token */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Email Address Storage Field */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Mail className="w-4 h-4" /> Notification Recipient Email
                </label>
                <span className="text-[11px] text-slate-400 font-mono">Destination Inbox</span>
              </div>
              <div className="relative mt-2">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="e.g. catalyst1@gmail.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                All critical temperature excursion alerts will be dispatched directly to this address.
              </p>
            </div>
          </div>

          {/* Resend API Token Storage Field */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" /> Resend API Token
                </label>
                <div className="flex items-center gap-2">
                  {resendTokenInput.trim() ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-semibold">
                      Key Entered
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/60 font-semibold">
                      Input Required
                    </span>
                  )}
                  <a
                    href="https://resend.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
                  >
                    <span>Get Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="relative mt-2">
                <input
                  type={showResendToken ? 'text' : 'password'}
                  value={resendTokenInput}
                  onChange={(e) => setResendTokenInput(e.target.value)}
                  placeholder="Enter your Resend API Token (re_...)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 pr-12 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <button
                    type="button"
                    onClick={() => setShowResendToken(!showResendToken)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 transition"
                    title={showResendToken ? 'Hide token' : 'Show token'}
                  >
                    {showResendToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Input your token here to enable automated excursion emails. Stored in local configuration (never hardcoded).
              </p>
            </div>
          </div>
        </div>

        {/* Alert Cooldown and Test Button */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="text-xs font-semibold text-white block">Alert Cooldown Per Sensor</span>
              <span className="text-[11px] text-slate-400">
                Prevents inbox flooding: wait before sending repeated alerts for the same sensor while it remains out of bounds.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            {[
              { val: 5, label: '5 min' },
              { val: 15, label: '15 min (Recommended)' },
              { val: 30, label: '30 min' },
              { val: 60, label: '1 hour' },
            ].map((cd) => (
              <button
                key={cd.val}
                type="button"
                onClick={() => setAlertCooldown(cd.val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  alertCooldown === cd.val
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cd.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Send Test Email Button & Response Banner */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Verify Resend Email Delivery
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Sends an immediate live test email to <strong>{emailInput || '--'}</strong> using your configured Resend token.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestEmail}
            disabled={isTestingEmail || !emailInput.trim() || !resendTokenInput.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 hover:text-white border border-slate-700 transition"
          >
            {isTestingEmail ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin"></div>
                <span>Sending via Resend...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 text-cyan-400" />
                <span>Send Test Notification</span>
              </>
            )}
          </button>
        </div>

        {/* Test Email Result Banner */}
        {testEmailResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 animate-fadeIn ${
              testEmailResult.success
                ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-200'
                : 'bg-rose-950/70 border-rose-800/80 text-rose-200'
            }`}
          >
            {testEmailResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-semibold">{testEmailResult.message}</div>
              {testEmailResult.id && (
                <div className="mt-1 font-mono text-[11px] text-emerald-300">
                  Resend Message ID: <strong>{testEmailResult.id}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Alert Logs Table */}
        {alertLogs.length > 0 && (
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Recent Email Alert History ({alertLogs.length})
                </h4>
              </div>
              {onClearAlertLogs && (
                <button
                  type="button"
                  onClick={onClearAlertLogs}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                >
                  Clear History
                </button>
              )}
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Sensor ID</th>
                    <th className="py-2.5 px-3">Reading & Limit</th>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3 text-right">Resend ID / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {alertLogs.slice(0, 10).map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-slate-400 font-sans">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2 px-3 text-cyan-300 font-bold">{log.sensorId}</td>
                      <td className="py-2 px-3 text-rose-300 font-sans">
                        <span className="font-mono font-bold text-rose-400">{log.temperature}°C</span>{' '}
                        (Threshold: {log.thresholdBroken})
                      </td>
                      <td className="py-2 px-3 text-slate-300 font-sans">{log.recipientEmail}</td>
                      <td className="py-2 px-3 text-right">
                        {log.status === 'sent' ? (
                          <span className="text-emerald-400 font-bold" title={log.resendId}>
                            SENT ({log.resendId?.slice(0, 8)}...)
                          </span>
                        ) : (
                          <span className="text-rose-400" title={log.error}>
                            FAILED
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Acceptable Temperature Limits Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 mb-1">
              <ThermometerSnowflake className="w-3.5 h-3.5" /> Temperature Boundaries
            </div>
            <h3 className="text-lg font-bold text-white">Acceptable Temperature Limits</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Readings outside this range are highlighted in <strong className="text-rose-400">RED</strong> and trigger an automatic Resend email alert.
            </p>
          </div>

          {/* Unit Toggle */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl self-start sm:self-center">
            <button
              type="button"
              onClick={() => handleUnitToggle('C')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                tempUnit === 'C' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Celsius (°C)
            </button>
            <button
              type="button"
              onClick={() => handleUnitToggle('F')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                tempUnit === 'F' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Fahrenheit (°F)
            </button>
          </div>
        </div>

        {/* Input Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Min Limit */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <ThermometerSnowflake className="w-4 h-4" /> Min Acceptable Temperature
              </label>
              <span className="text-[11px] text-slate-400 font-mono">Below this = FREEZING HAZARD</span>
            </div>
            <div className="relative mt-2">
              <input
                type="number"
                step="0.1"
                value={minTempInput}
                onChange={(e) => setMinTempInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-lg font-bold text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
              />
              <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-sm font-bold text-slate-400">
                °{tempUnit}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Values below <span className="text-cyan-300 font-mono">{minTempInput}°{tempUnit}</span> trigger an immediate red alert & email notification.
            </p>
          </div>

          {/* Max Limit */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4" /> Max Acceptable Temperature
              </label>
              <span className="text-[11px] text-slate-400 font-mono">Above this = SPOILAGE HAZARD</span>
            </div>
            <div className="relative mt-2">
              <input
                type="number"
                step="0.1"
                value={maxTempInput}
                onChange={(e) => setMaxTempInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-lg font-bold text-white font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500"
              />
              <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-sm font-bold text-slate-400">
                °{tempUnit}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Values above <span className="text-rose-300 font-mono">{maxTempInput}°{tempUnit}</span> trigger an immediate red alert & email notification.
            </p>
          </div>
        </div>

        {/* Visual Range Indicator Spectrum */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="text-rose-400 font-semibold flex items-center gap-1">
              &lt; {minTempInput}°{tempUnit} (Red Excursion)
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              ✓ Compliant Safe Zone ({minTempInput}°{tempUnit} to {maxTempInput}°{tempUnit})
            </span>
            <span className="text-rose-400 font-semibold flex items-center gap-1">
              &gt; {maxTempInput}°{tempUnit} (Red Excursion)
            </span>
          </div>

          <div className="h-4 w-full rounded-full bg-slate-800 flex overflow-hidden border border-slate-700">
            <div className="w-1/4 bg-gradient-to-r from-blue-700 to-rose-600/80"></div>
            <div className="w-2/4 bg-emerald-500/90 flex items-center justify-center text-[10px] text-slate-950 font-black tracking-wider uppercase">
              ACCEPTABLE ZONE
            </div>
            <div className="w-1/4 bg-gradient-to-r from-rose-600/80 to-rose-700"></div>
          </div>
        </div>

        {/* Industry Presets */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
            Quick Cold Chain Presets
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PRESETS.map((p) => {
              const pMinDisplay = fromCelsius(p.min, tempUnit);
              const pMaxDisplay = fromCelsius(p.max, tempUnit);
              const isSelected =
                Math.abs(currentMinC - p.min) < 0.1 && Math.abs(currentMaxC - p.max) < 0.1;

              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleApplyPreset(p.min, p.max)}
                  className={`text-left p-3 rounded-xl border transition ${
                    isSelected
                      ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200 shadow-sm'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs text-white">{p.label}</div>
                  <div className="font-mono text-cyan-400 text-xs font-bold mt-1">
                    {pMinDisplay}°{tempUnit} to {pMaxDisplay}°{tempUnit}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {p.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Polling & Auto-refresh rate */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <label className="text-xs font-semibold text-white block">API Auto-Refresh Interval</label>
            <p className="text-[11px] text-slate-400">Regularly query Flespi channel messages for live BLE updates</p>
          </div>
          <div className="flex items-center gap-2">
            {[
              { val: 0, label: 'Manual' },
              { val: 10, label: '10s' },
              { val: 30, label: '30s' },
              { val: 60, label: '60s' },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setAutoRefresh(opt.val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  autoRefresh === opt.val
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {savedSuccess ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5 animate-fadeIn">
                <Check className="w-4 h-4" /> Configuration saved successfully!
              </span>
            ) : (
              <span>Click Save to update acceptable limits and notification parameters.</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 transition active:scale-95"
          >
            <Save className="w-4 h-4" /> Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
