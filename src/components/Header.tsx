import React from 'react';
import {
  Thermometer,
  Radio,
  Sliders,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Clock,
  Mail,
} from 'lucide-react';
import { AccountInfo, BleSensorReading, ColdChainConfig } from '../types/flespi';

interface HeaderProps {
  account: AccountInfo | null;
  config: ColdChainConfig;
  activeTab: 'config' | 'gateways' | 'temperature';
  setActiveTab: (tab: 'config' | 'gateways' | 'temperature') => void;
  bleSensors: BleSensorReading[];
  gatewaysCount: number;
  isLoading: boolean;
  onRefresh: () => void;
  lastSyncTime: Date | null;
}

export const Header: React.FC<HeaderProps> = ({
  account,
  config,
  activeTab,
  setActiveTab,
  bleSensors,
  gatewaysCount,
  isLoading,
  onRefresh,
  lastSyncTime,
}) => {
  // Required title: "Cold Chain for [account name fetched from the API]"
  const accountDisplayName = account?.displayName || (account?.name ? account.name : '--');
  const appTitle = `Cold Chain for ${accountDisplayName}`;

  // Count alerts
  const outOfBoundsCount = bleSensors.filter((s) => s.isOutOfLimits).length;
  const staleCount = bleSensors.filter((s) => s.isStale && !s.isOutOfLimits).length;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3.5 gap-3">
          {/* Brand & Dynamic Title */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 text-white font-bold">
              <Thermometer className="w-6 h-6" />
              {outOfBoundsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-[9px] font-bold text-white items-center justify-center">
                    !
                  </span>
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Cold Chain for</span>
                  <span className="text-cyan-400 font-extrabold truncate max-w-[280px] sm:max-w-md">
                    {account ? accountDisplayName : <span className="text-slate-400">--</span>}
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Flespi API</span>
                <span>•</span>
                {account ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 inline" /> CID #{account.cid} ({account.tokenType})
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 inline" /> Connecting to Flespi...
                  </span>
                )}
                {lastSyncTime && (
                  <>
                    <span>•</span>
                    <span className="text-slate-400 hidden sm:inline">
                      Synced {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Action & Sync Controls */}
          <div className="flex items-center gap-2.5 self-end md:self-center">
            {config.notificationEmail ? (
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-slate-300 bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/80 transition"
                title={config.resendApiKey ? `Email notifications active for ${config.notificationEmail}` : 'Resend API key required in Configuration'}
              >
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400">Alerts:</span>
                <span className="font-semibold text-slate-200 truncate max-w-[140px]">{config.notificationEmail}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    config.resendApiKey && config.emailAlertsEnabled !== false ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                  title={config.resendApiKey ? 'Resend connected' : 'Resend key pending in Configuration'}
                ></span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700/60 transition"
              >
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                <span>Set Up Alerts</span>
              </button>
            )}
            {config.autoRefreshInterval > 0 && (
              <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
                <Clock className="w-3 h-3 text-cyan-400" /> Auto-sync: {config.autoRefreshInterval}s
              </span>
            )}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh Flespi Data"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : 'text-slate-300'}`} />
              <span className="hidden sm:inline">Refresh API</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 border-t border-slate-800/80 pt-2 pb-2">
          {/* Interface 1: Configuration */}
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'config'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Configuration</span>
          </button>

          {/* Interface 2: Gateways and Data */}
          <button
            onClick={() => setActiveTab('gateways')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'gateways'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Gateways and Data</span>
            {gatewaysCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-md text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {gatewaysCount}
              </span>
            )}
          </button>

          {/* Interface 3: Live Temperature */}
          <button
            onClick={() => setActiveTab('temperature')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'temperature'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-sm shadow-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
            }`}
          >
            <Thermometer className="w-4 h-4" />
            <span>Live Temperature</span>
            {bleSensors.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.2 rounded-md text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {bleSensors.length}
                </span>
                {outOfBoundsCount > 0 && (
                  <span
                    className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-rose-500 text-white flex items-center gap-0.5"
                    title={`${outOfBoundsCount} sensors out of temperature limits`}
                  >
                    <Flame className="w-2.5 h-2.5" /> {outOfBoundsCount}
                  </span>
                )}
                {staleCount > 0 && (
                  <span
                    className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-amber-500 text-slate-950 flex items-center gap-0.5"
                    title={`${staleCount} sensors stale (>30 mins)`}
                  >
                    <Clock className="w-2.5 h-2.5" /> {staleCount}
                  </span>
                )}
              </div>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
};
