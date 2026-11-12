import React, { useState } from 'react';
import {
  Radio,
  Search,
  MapPin,
  Battery,
  Signal,
  Eye,
  ExternalLink,
  Layers,
  Cpu,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { GatewayDevice } from '../types/flespi';
import { formatTimestamp, timeAgo, valOrDash } from '../utils/formatters';
import { GatewayDetailsModal } from './GatewayDetailsModal';

interface GatewaysTabProps {
  devices: GatewayDevice[];
  token: string;
  channelId: number;
  isLoading: boolean;
  onRefresh: () => void;
  onNavigateToConfig: () => void;
}

export const GatewaysTab: React.FC<GatewaysTabProps> = ({
  devices,
  token,
  channelId,
  isLoading,
  onRefresh,
  onNavigateToConfig,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [selectedDevice, setSelectedDevice] = useState<GatewayDevice | null>(null);

  const filteredDevices = devices.filter((dev) => {
    const matchesSearch =
      dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(dev.id).includes(searchQuery) ||
      (dev.ident && dev.ident.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (dev.device_type_name && dev.device_type_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'online'
        ? dev.status === 'online'
        : dev.status === 'offline';

    return matchesSearch && matchesStatus;
  });

  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const offlineCount = devices.filter((d) => d.status === 'offline').length;
  const totalBleCount = devices.reduce((acc, d) => acc + (d.bleCount || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 mb-2">
              <Radio className="w-3.5 h-3.5" /> Flespi Gateway Infrastructure
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Gateways and Data</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Live inventory of telematics gateways and devices configured in this account.
              Showing all parameters and surrounding telemetry extracted directly from Flespi API.
            </p>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Sync Gateways</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Total Gateways / Devices
            </span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {devices.length > 0 ? devices.length : '--'}
            </div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 block">
              Online Gateways
            </span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {onlineCount > 0 ? onlineCount : '--'}
            </div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Offline Gateways
            </span>
            <div className="text-xl font-bold font-mono text-slate-400 mt-1">
              {offlineCount > 0 ? offlineCount : '--'}
            </div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 block">
              Detected BLE Beacons
            </span>
            <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
              {totalBleCount > 0 ? totalBleCount : '--'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search gateways by name, ID, IMEI/ident..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-xs text-slate-400 hidden md:inline">Status:</span>
          {(['all', 'online', 'offline'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                statusFilter === st
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Gateways and Data Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {filteredDevices.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Radio className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No Gateways Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {devices.length === 0
                ? 'No gateway devices returned from the Flespi API. Please verify token permissions in Configuration.'
                : 'No gateways match your search or filter.'}
            </p>
            {devices.length === 0 && (
              <button
                onClick={onNavigateToConfig}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                Go to Configuration
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Gateway / Device</th>
                  <th className="py-3 px-4">Ident (IMEI)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">GPS Position</th>
                  <th className="py-3 px-4">Telemetry Surrounding Gateway</th>
                  <th className="py-3 px-4">BLE Scans</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right">Inspect Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDevices.map((dev) => {
                  const paramCount = Object.keys(dev.telemetry || {}).length;

                  return (
                    <tr
                      key={dev.id}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-bold shrink-0">
                            <Cpu className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs group-hover:text-cyan-300 transition">
                              {dev.name}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-cyan-400">ID #{dev.id}</span>
                              {dev.device_type_name && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[140px]">{dev.device_type_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Ident */}
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {dev.ident ? (
                          <span>{dev.ident}</span>
                        ) : (
                          <span className="text-slate-500 font-sans">--</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            dev.status === 'online'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                              : 'bg-slate-800/80 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              dev.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                            }`}
                          ></span>
                          <span className="capitalize">{dev.status}</span>
                        </span>
                      </td>

                      {/* Coordinates */}
                      <td className="py-3.5 px-4">
                        {dev.location ? (
                          <div>
                            <a
                              href={`https://maps.google.com/?q=${dev.location.lat},${dev.location.lon}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] flex items-center gap-1"
                              title="Open in Google Maps"
                            >
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span>
                                {dev.location.lat.toFixed(5)}, {dev.location.lon.toFixed(5)}
                              </span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>
                            {dev.location.speed !== undefined && (
                              <span className="text-[10px] text-slate-400 mt-0.5 block font-mono">
                                Speed: {dev.location.speed} km/h
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                      </td>

                      {/* Telemetry Metrics */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 text-[11px]">
                          {dev.batteryVoltage !== undefined ? (
                            <span className="flex items-center gap-1 text-slate-300">
                              <Battery className="w-3 h-3 text-emerald-400" />
                              <span>Battery: {dev.batteryVoltage} V</span>
                            </span>
                          ) : null}
                          {dev.externalVoltage !== undefined ? (
                            <span className="flex items-center gap-1 text-cyan-300">
                              <Zap className="w-3 h-3 text-cyan-400" />
                              <span>Ext Power: {dev.externalVoltage} V</span>
                            </span>
                          ) : null}
                          {dev.gsmSignal !== undefined ? (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Signal className="w-3 h-3 text-blue-400" />
                              <span>GSM RSSI: {dev.gsmSignal}</span>
                            </span>
                          ) : null}
                          {dev.batteryVoltage === undefined && dev.externalVoltage === undefined && dev.gsmSignal === undefined ? (
                            <span className="text-slate-500">--</span>
                          ) : null}
                        </div>
                      </td>

                      {/* BLE Sensors */}
                      <td className="py-3.5 px-4">
                        {dev.bleCount !== undefined && dev.bleCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-800/60">
                            <Layers className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{dev.bleCount} Beacons</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                      </td>

                      {/* Last Activity (fetched from server.timestamp Epoch time) */}
                      <td className="py-3.5 px-4 text-slate-300">
                        {dev.last_active_ts ? (
                          <div className="text-[11px]">
                            <span className="font-semibold text-slate-200">{timeAgo(dev.last_active_ts)}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {formatTimestamp(dev.last_active_ts)}
                            </span>
                            <span className="text-[9px] text-cyan-400 font-mono block mt-0.5" title="Epoch time sent in server.timestamp from packet">
                              server.ts: {dev.last_active_ts}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedDevice(dev)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-cyan-600 text-slate-200 hover:text-white border border-slate-700 hover:border-cyan-500 transition shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Data</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Gateway Telemetry & Messages Modal */}
      {selectedDevice && (
        <GatewayDetailsModal
          device={selectedDevice}
          token={token}
          channelId={channelId}
          onClose={() => setSelectedDevice(null)}
        />
      )}
    </div>
  );
};
