import React, { useState } from 'react';
import {
  Thermometer,
  Clock,
  Flame,
  CheckCircle2,
  Search,
  Download,
  Sliders,
  Radio,
  Battery,
  Signal,
  RefreshCw,
  Eye,
  Layers,
  Mail,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { BleSensorReading, ColdChainConfig } from '../types/flespi';
import { formatTemp, formatTimestamp, timeAgo, valOrDash } from '../utils/formatters';

interface LiveTemperatureTabProps {
  sensors: BleSensorReading[];
  config: ColdChainConfig;
  currentTimeSec: number;
  isLoading: boolean;
  onRefresh: () => void;
  onNavigateToConfig: () => void;
  showAllBeacons: boolean;
  onToggleShowAllBeacons: (val: boolean) => void;
  onSendManualAlert?: (sensor: BleSensorReading) => Promise<boolean>;
  isSendingAlertId?: string | null;
}

export const LiveTemperatureTab: React.FC<LiveTemperatureTabProps> = ({
  sensors,
  config,
  currentTimeSec,
  isLoading,
  onRefresh,
  onNavigateToConfig,
  showAllBeacons,
  onToggleShowAllBeacons,
  onSendManualAlert,
  isSendingAlertId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'red' | 'yellow' | 'normal'>('all');
  const [sortBy, setSortBy] = useState<'status' | 'temp_desc' | 'temp_asc' | 'time_newest' | 'time_oldest'>('status');

  // Sensors with temperature vs all
  const tempReportingSensors = sensors.filter((s) => s.temperature !== null && s.temperature !== undefined);

  // Categorize sensors based on user criteria:
  // 1. Red: Temperature outside of acceptable limits
  // 2. Yellow: Last reading time is > 30 minutes
  const outOfBoundsSensors = sensors.filter((s) => s.isOutOfLimits);
  const staleSensors = sensors.filter((s) => s.isStale && !s.isOutOfLimits);
  const normalSensors = sensors.filter((s) => !s.isOutOfLimits && !s.isStale && s.temperature !== null);

  // Filtering
  const filteredSensors = sensors.filter((s) => {
    const matchesSearch =
      s.sensorId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.sensorName && s.sensorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      s.gatewayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.ident && s.ident.toLowerCase().includes(searchQuery.toLowerCase()));

    let matchesFilter = true;
    if (filterType === 'red') {
      matchesFilter = s.isOutOfLimits;
    } else if (filterType === 'yellow') {
      matchesFilter = s.isStale && !s.isOutOfLimits;
    } else if (filterType === 'normal') {
      matchesFilter = !s.isOutOfLimits && !s.isStale && s.temperature !== null;
    }

    return matchesSearch && matchesFilter;
  });

  // Sorting
  const sortedSensors = [...filteredSensors].sort((a, b) => {
    if (sortBy === 'status') {
      const score = (s: BleSensorReading) => (s.isOutOfLimits ? 2 : s.isStale ? 1 : 0);
      return score(b) - score(a);
    }
    if (sortBy === 'temp_desc') return (b.temperature ?? -999) - (a.temperature ?? -999);
    if (sortBy === 'temp_asc') return (a.temperature ?? 999) - (b.temperature ?? 999);
    if (sortBy === 'time_newest') return b.lastReadingTs - a.lastReadingTs;
    if (sortBy === 'time_oldest') return a.lastReadingTs - b.lastReadingTs;
    return 0;
  });

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Sensor ID',
      'Gateway Name',
      'Gateway Ident',
      `Temperature (°${config.tempUnit})`,
      'Temperature (°C)',
      'Min Acceptable Limit (°C)',
      'Max Acceptable Limit (°C)',
      'Compliance Status',
      'Is Out of Bounds',
      'Is Stale (>30m)',
      'Last Reading Timestamp',
      'Last Reading Time',
    ];

    const rows = sortedSensors.map((s) => {
      const statusText =
        s.isOutOfLimits && s.isStale
          ? 'OUT_OF_BOUNDS_AND_STALE'
          : s.isOutOfLimits
          ? 'OUT_OF_BOUNDS_RED'
          : s.isStale
          ? 'STALE_OVER_30M_YELLOW'
          : s.temperature !== null
          ? 'COMPLIANT_NORMAL'
          : 'NO_TEMP_DATA';

      return [
        `"${s.sensorId}"`,
        `"${s.gatewayName}"`,
        `"${s.ident || '--'}"`,
        s.temperature !== null ? formatTemp(s.temperature, config.tempUnit).replace(/°[CF]/, '') : '--',
        s.temperature !== null ? s.temperature : '--',
        config.minTemp,
        config.maxTemp,
        statusText,
        s.isOutOfLimits ? 'YES' : 'NO',
        s.isStale ? 'YES' : 'NO',
        s.lastReadingTs || '--',
        `"${formatTimestamp(s.lastReadingTs)}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cold_chain_live_temperature_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 mb-2">
              <Thermometer className="w-3.5 h-3.5" /> Flespi Live Telemetry
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Live Temperature</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Live BLE temperature telemetry extracted directly from Flespi API messages.
              Rows are automatically color-coded to enforce cold chain compliance rules.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleExportCSV}
              disabled={sensors.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Telemetry</span>
            </button>
          </div>
        </div>

        {/* Active Limits Info Bar */}
        <div className="mt-5 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-slate-400 font-medium">Acceptable Temperature Limits:</span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/70 text-emerald-400 font-mono font-bold border border-emerald-800/60">
              Min: {formatTemp(config.minTemp, config.tempUnit)}
            </span>
            <span className="text-slate-600">to</span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/70 text-emerald-400 font-mono font-bold border border-emerald-800/60">
              Max: {formatTemp(config.maxTemp, config.tempUnit)}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-400 flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5" /> Stale Row: &gt; 30m
            </span>
            <span className="text-slate-500">•</span>
            {config.resendApiKey && config.notificationEmail ? (
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                <Mail className="w-3.5 h-3.5 text-cyan-400" /> Alerts to: {config.notificationEmail}
              </span>
            ) : config.notificationEmail ? (
              <button
                type="button"
                onClick={onNavigateToConfig}
                className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition"
                title="Enter Resend API Key in Configuration to enable automated email alerts"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Resend Key Required in Config
              </button>
            ) : (
              <button
                type="button"
                onClick={onNavigateToConfig}
                className="text-slate-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition"
              >
                <Mail className="w-3.5 h-3.5" /> Set Up Alerts
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onToggleShowAllBeacons(!showAllBeacons)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                showAllBeacons
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700'
              }`}
              title="Toggle between displaying only sensors with temperature or all scanned BLE beacons"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showAllBeacons ? 'Showing All Scanned Beacons' : 'Showing BLE Temperature Sensors'}</span>
            </button>
            <button
              onClick={onNavigateToConfig}
              className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition"
            >
              <Sliders className="w-3.5 h-3.5" /> Adjust Limits
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          {/* Total */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              {showAllBeacons ? 'All BLE Beacons' : 'BLE Temperature Sensors'}
            </span>
            <div className="text-2xl font-bold font-mono text-white mt-1">
              {sensors.length > 0 ? sensors.length : '--'}
            </div>
          </div>

          {/* Red Alert: Out of Bounds */}
          <div
            onClick={() => setFilterType('red')}
            className={`border rounded-xl p-3.5 cursor-pointer transition ${
              filterType === 'red'
                ? 'bg-rose-950/80 border-rose-500 ring-2 ring-rose-500/20'
                : 'bg-rose-950/30 border-rose-900/60 hover:bg-rose-950/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400">
                Out of Limits (Red)
              </span>
              <Flame className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
              {outOfBoundsSensors.length}
            </div>
          </div>

          {/* Yellow Alert: Stale > 30m */}
          <div
            onClick={() => setFilterType('yellow')}
            className={`border rounded-xl p-3.5 cursor-pointer transition ${
              filterType === 'yellow'
                ? 'bg-amber-950/80 border-amber-500 ring-2 ring-amber-500/20'
                : 'bg-amber-950/30 border-amber-900/60 hover:bg-amber-950/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                Stale &gt; 30m (Yellow)
              </span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
              {staleSensors.length}
            </div>
          </div>

          {/* Normal Compliant */}
          <div
            onClick={() => setFilterType('normal')}
            className={`border rounded-xl p-3.5 cursor-pointer transition ${
              filterType === 'normal'
                ? 'bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-500/20'
                : 'bg-emerald-950/30 border-emerald-900/60 hover:bg-emerald-950/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Compliant In-Range
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {normalSensors.length}
            </div>
          </div>
        </div>
      </div>

      {/* Legend & Filter Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Sensor ID, MAC address, or gateway ident..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400 mr-1 hidden sm:inline">Filter:</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              filterType === 'all'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All ({sensors.length})
          </button>
          <button
            onClick={() => setFilterType('red')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 ${
              filterType === 'red'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-950 text-rose-400 hover:text-rose-300 border border-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Out of Bounds ({outOfBoundsSensors.length})</span>
          </button>
          <button
            onClick={() => setFilterType('yellow')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 ${
              filterType === 'yellow'
                ? 'bg-amber-600 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Stale &gt; 30m ({staleSensors.length})</span>
          </button>
          <button
            onClick={() => setFilterType('normal')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 ${
              filterType === 'normal'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950 text-emerald-400 hover:text-emerald-300 border border-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Compliant ({normalSensors.length})</span>
          </button>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans"
          >
            <option value="status">By Alert Priority</option>
            <option value="temp_desc">Temperature (High to Low)</option>
            <option value="temp_asc">Temperature (Low to High)</option>
            <option value="time_newest">Reading Time (Newest)</option>
            <option value="time_oldest">Reading Time (Oldest)</option>
          </select>
        </div>
      </div>

      {/* Live Temperature Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {sortedSensors.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Thermometer className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No BLE Temperature Readings Received</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {sensors.length === 0
                ? 'No BLE temperature readings currently in the Flespi channel buffer. Ensure gateway units are scanning and transmitting BLE tags.'
                : 'No sensor matches your active filter or search query.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 w-44">Status / Alert</th>
                  <th className="py-3.5 px-4">Sensor ID</th>
                  <th className="py-3.5 px-4">Temperature Reading</th>
                  <th className="py-3.5 px-4">Last Reading Time</th>
                  <th className="py-3.5 px-4">Host Gateway</th>
                  <th className="py-3.5 px-4">Signal & Battery</th>
                  <th className="py-3.5 px-4 text-right">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {sortedSensors.map((sensor) => {
                  // Rule 1: If the last reading time is more than 30 mins, show the data row in yellow.
                  // Rule 2: If the temperature reading is outside of the 'acceptable temperature limits', show the row in red color.
                  const isRed = sensor.isOutOfLimits;
                  const isYellow = sensor.isStale && !isRed;
                  const isBoth = sensor.isOutOfLimits && sensor.isStale;

                  let rowStyle = 'hover:bg-slate-800/50 transition border-l-4 ';
                  if (isBoth) {
                    rowStyle += 'bg-rose-950/60 hover:bg-rose-950/80 border-rose-500 text-rose-100 shadow-inner';
                  } else if (isRed) {
                    rowStyle += 'bg-rose-950/50 hover:bg-rose-950/70 border-rose-500 text-rose-100 shadow-inner';
                  } else if (isYellow) {
                    rowStyle += 'bg-amber-950/45 hover:bg-amber-950/65 border-amber-400 text-amber-100 shadow-inner';
                  } else {
                    rowStyle += 'bg-slate-900/40 hover:bg-slate-800/60 border-emerald-500/70 text-slate-200';
                  }

                  const hasTemp = sensor.temperature !== null && sensor.temperature !== undefined;
                  const diffHigh = hasTemp ? (sensor.temperature! - config.maxTemp).toFixed(1) : '0';
                  const diffLow = hasTemp ? (config.minTemp - sensor.temperature!).toFixed(1) : '0';

                  return (
                    <tr key={`${sensor.gatewayId}-${sensor.sensorId}`} className={rowStyle}>
                      {/* Status / Alert column */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isBoth ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white shadow-sm animate-pulse">
                              <Flame className="w-3 h-3" /> OUT OF LIMITS
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                              <Clock className="w-2.5 h-2.5" /> STALE (&gt;30m)
                            </span>
                          </div>
                        ) : isRed ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-600 text-white shadow-md shadow-rose-600/30">
                              <Flame className="w-3 h-3" />
                              {sensor.tempStatus === 'too_high' ? 'EXCURSION (HIGH)' : 'FREEZING RISK (LOW)'}
                            </span>
                            <span className="text-[10px] text-rose-300 pl-1 font-medium">
                              {sensor.tempStatus === 'too_high'
                                ? `+${diffHigh}°C above max`
                                : `-${diffLow}°C below min`}
                            </span>
                          </div>
                        ) : isYellow ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20">
                              <Clock className="w-3 h-3" /> STALE (&gt;30m)
                            </span>
                            <span className="text-[10px] text-amber-300 pl-1 font-medium">
                              Updated {timeAgo(sensor.lastReadingTs, currentTimeSec)}
                            </span>
                          </div>
                        ) : hasTemp ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                              <CheckCircle2 className="w-3 h-3" /> COMPLIANT
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono">--</span>
                        )}
                      </td>

                      {/* Sensor ID */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="font-mono font-bold text-xs flex items-center gap-1.5">
                            <span className={isRed ? 'text-rose-200' : isYellow ? 'text-amber-200' : 'text-cyan-300'}>
                              {sensor.sensorId}
                            </span>
                          </div>
                          {sensor.sensorName ? (
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">
                              {sensor.sensorName}
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* Temperature Reading */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {hasTemp ? (
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span
                                className={`text-base font-extrabold font-mono tracking-tight ${
                                  isRed
                                    ? 'text-white bg-rose-600/60 px-2 py-0.5 rounded-md border border-rose-400'
                                    : isYellow
                                    ? 'text-amber-300 font-bold'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {formatTemp(sensor.temperature, config.tempUnit)}
                              </span>
                              {config.tempUnit === 'F' && (
                                <span className="text-[11px] text-slate-400 font-mono">
                                  ({sensor.temperature?.toFixed(1)}°C)
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {isRed ? (
                                <span className="text-rose-300 font-semibold">
                                  Allowed: {formatTemp(config.minTemp, config.tempUnit)} - {formatTemp(config.maxTemp, config.tempUnit)}
                                </span>
                              ) : (
                                <span className="text-emerald-400/80">Within safe range</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono text-sm">--</span>
                        )}
                      </td>

                      {/* Last Reading Time (fetched from server.timestamp Epoch time) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {sensor.lastReadingTs > 0 ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 font-medium">
                              <span
                                className={`text-xs ${
                                  sensor.isStale
                                    ? 'text-amber-300 font-bold bg-amber-950/70 px-1.5 py-0.2 rounded border border-amber-700/60'
                                    : 'text-slate-200'
                                }`}
                              >
                                {timeAgo(sensor.lastReadingTs, currentTimeSec)}
                              </span>
                              {sensor.isStale && (
                                <span className="text-[10px] text-amber-400 font-bold uppercase">
                                  [&gt;30m]
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              {formatTimestamp(sensor.lastReadingTs)}
                            </span>
                            <span className="text-[9px] text-cyan-400 font-mono mt-0.5" title="Epoch time sent in server.timestamp from packet">
                              server.ts: {sensor.lastReadingTs}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 font-mono">--</span>
                        )}
                      </td>

                      {/* Host Gateway */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-slate-200 truncate max-w-[200px]">
                          {valOrDash(sensor.gatewayName)}
                        </div>
                        {sensor.ident ? (
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Radio className="w-2.5 h-2.5 text-cyan-400" />
                            <span>Ident: {sensor.ident}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[10px]">--</span>
                        )}
                      </td>

                      {/* Signal & Battery */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3 text-xs">
                          {sensor.rssi !== null && sensor.rssi !== undefined ? (
                            <div className="flex items-center gap-1 text-slate-300" title="Bluetooth RSSI signal strength">
                              <Signal className="w-3 h-3 text-blue-400" />
                              <span className="font-mono text-[11px]">{sensor.rssi} dBm</span>
                            </div>
                          ) : (
                            <span className="text-slate-500" title="RSSI not available">--</span>
                          )}

                          {sensor.batteryVoltage !== null && sensor.batteryVoltage !== undefined ? (
                            <div className="flex items-center gap-1 text-slate-300" title="Sensor Battery Voltage">
                              <Battery className="w-3 h-3 text-emerald-400" />
                              <span className="font-mono text-[11px]">{sensor.batteryVoltage} V</span>
                            </div>
                          ) : sensor.batteryLevel !== null && sensor.batteryLevel !== undefined ? (
                            <div className="flex items-center gap-1 text-slate-300" title="Sensor Battery Level">
                              <Battery className="w-3 h-3 text-emerald-400" />
                              <span className="font-mono text-[11px]">{sensor.batteryLevel}%</span>
                            </div>
                          ) : null}

                          {sensor.humidity !== null && sensor.humidity !== undefined ? (
                            <div className="text-[11px] text-slate-400" title="Relative Humidity">
                              {sensor.humidity}% RH
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* Parameter Source & Alert Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono text-[11px]">
                        <div className="flex items-center justify-end gap-2">
                          {sensor.isOutOfLimits && onSendManualAlert && (
                            <button
                              type="button"
                              onClick={() => onSendManualAlert(sensor)}
                              disabled={isSendingAlertId === sensor.sensorId}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition active:scale-95 disabled:opacity-50"
                              title={`Send email alert for ${sensor.sensorId} to ${config.notificationEmail || 'configured address'}`}
                            >
                              {isSendingAlertId === sensor.sensorId ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Mail className="w-3 h-3" />
                              )}
                              <span>Send Alert Email</span>
                            </button>
                          )}
                          <span className="px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-slate-400">
                            {sensor.rawParamKey || '--'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Compliance Legend Note */}
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-slate-300">Required Row Highlighting Rules:</span>
          <span className="flex items-center gap-1.5 text-rose-300">
            <span className="w-3 h-3 rounded bg-rose-500 inline-block"></span>
            <strong>RED:</strong> Temperature reading is outside acceptable limits (&lt; {formatTemp(config.minTemp, config.tempUnit)} or &gt; {formatTemp(config.maxTemp, config.tempUnit)})
          </span>
          <span className="flex items-center gap-1.5 text-amber-300">
            <span className="w-3 h-3 rounded bg-amber-400 inline-block"></span>
            <strong>YELLOW:</strong> Last reading time is more than 30 minutes old
          </span>
        </div>
        <span className="text-[11px] text-cyan-400 font-mono">
          Data source: Flespi Channel #{config.channelId}
        </span>
      </div>
    </div>
  );
};
