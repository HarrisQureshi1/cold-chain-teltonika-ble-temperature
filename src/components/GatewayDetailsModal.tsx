import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Clock,
  Layers,
  MapPin,
  Battery,
  Signal,
  Search,
  Copy,
  Check,
  Code,
  ListFilter,
  RefreshCw,
} from 'lucide-react';
import { FlespiMessage, GatewayDevice } from '../types/flespi';
import { formatTimestamp, timeAgo } from '../utils/formatters';
import { fetchDeviceMessages } from '../services/flespiService';

interface GatewayDetailsModalProps {
  device: GatewayDevice | null;
  token: string;
  channelId: number;
  onClose: () => void;
}

export const GatewayDetailsModal: React.FC<GatewayDetailsModalProps> = ({
  device,
  token,
  channelId,
  onClose,
}) => {
  const [activeView, setActiveView] = useState<'telemetry' | 'messages' | 'json'>('telemetry');
  const [paramFilter, setParamFilter] = useState('');
  const [messages, setMessages] = useState<FlespiMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!device) return;

    let isMounted = true;
    setLoadingMessages(true);
    fetchDeviceMessages(device.id, device.ident, channelId, token)
      .then((msgs) => {
        if (isMounted) {
          setMessages(msgs);
          setLoadingMessages(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load messages:', err);
        if (isMounted) setLoadingMessages(false);
      });

    return () => {
      isMounted = false;
    };
  }, [device, token, channelId]);

  if (!device) return null;

  const telemetryEntries = Object.entries(device.telemetry || {}).map(([key, data]) => ({
    key,
    value: data.value,
    ts: data.ts,
  }));

  const filteredTelemetry = telemetryEntries.filter((item) =>
    item.key.toLowerCase().includes(paramFilter.toLowerCase()) ||
    String(item.value).toLowerCase().includes(paramFilter.toLowerCase())
  );

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(
      JSON.stringify(
        {
          gateway: device,
          telemetry: device.telemetry,
          recentMessages: messages,
        },
        null,
        2
      )
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-950/70 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800/60 text-cyan-400 flex items-center justify-center font-bold">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">{device.name}</h3>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  ID: {device.id}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    device.status === 'online'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {device.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-3">
                {device.ident && <span>Ident: <strong className="text-slate-300 font-mono">{device.ident}</strong></span>}
                {device.device_type_name && <span>Protocol: <strong className="text-slate-300">{device.device_type_name}</strong></span>}
                {device.channel_id && <span>Channel: #{device.channel_id}</span>}
                <span>Last Seen: {timeAgo(device.last_active_ts)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJSON}
              className="p-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
              title="Copy device data JSON"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick telemetry badges */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center gap-4 text-xs">
          {device.location && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {device.location.lat.toFixed(5)}, {device.location.lon.toFixed(5)} ({device.location.speed || 0} km/h)
              </span>
            </div>
          )}
          {device.batteryVoltage !== undefined && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <Battery className="w-3.5 h-3.5 text-emerald-400" />
              <span>Battery: {device.batteryVoltage}V</span>
            </div>
          )}
          {device.gsmSignal !== undefined && (
            <div className="flex items-center gap-1.5 text-slate-300">
              <Signal className="w-3.5 h-3.5 text-blue-400" />
              <span>GSM RSSI: {device.gsmSignal}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-slate-300">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Parameters Cached: {telemetryEntries.length}</span>
          </div>
        </div>

        {/* Tabs inside modal */}
        <div className="px-4 sm:px-6 pt-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveView('telemetry')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition ${
                activeView === 'telemetry'
                  ? 'border-cyan-400 text-cyan-300 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Telemetry Parameters ({telemetryEntries.length})
            </button>
            <button
              onClick={() => setActiveView('messages')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition ${
                activeView === 'messages'
                  ? 'border-cyan-400 text-cyan-300 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Recent Raw Messages ({messages.length})
            </button>
            <button
              onClick={() => setActiveView('json')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition ${
                activeView === 'json'
                  ? 'border-cyan-400 text-cyan-300 bg-slate-800/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Raw JSON
            </button>
          </div>

          {activeView === 'telemetry' && (
            <div className="relative mb-1">
              <input
                type="text"
                placeholder="Filter parameters..."
                value={paramFilter}
                onChange={(e) => setParamFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono w-48"
              />
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeView === 'telemetry' && (
            <div>
              {filteredTelemetry.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No telemetry parameters found matching "{paramFilter}".
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4 font-mono">Parameter Name</th>
                        <th className="py-2.5 px-4">Current Value</th>
                        <th className="py-2.5 px-4 text-right">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {filteredTelemetry.map((item) => {
                        const isBle = item.key.includes('ble');
                        const isTemp = item.key.includes('temperature');

                        return (
                          <tr
                            key={item.key}
                            className={`hover:bg-slate-800/50 transition ${
                              isBle || isTemp ? 'bg-cyan-950/20' : ''
                            }`}
                          >
                            <td className="py-2.5 px-4 text-cyan-300 font-semibold break-all">
                              {item.key}
                            </td>
                            <td className="py-2.5 px-4 text-slate-200 break-all font-sans">
                              {typeof item.value === 'object' ? (
                                <pre className="text-[11px] font-mono text-slate-300 bg-slate-950/80 p-1.5 rounded max-h-32 overflow-y-auto">
                                  {JSON.stringify(item.value, null, 2)}
                                </pre>
                              ) : typeof item.value === 'boolean' ? (
                                <span className={item.value ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                                  {item.value ? 'true' : 'false'}
                                </span>
                              ) : (
                                <span className="font-mono text-white font-medium">{String(item.value)}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-slate-400 text-right text-[11px] whitespace-nowrap">
                              {timeAgo(item.ts)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeView === 'messages' && (
            <div className="space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Loading recent messages from Flespi API...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No historical messages recorded for this gateway yet.
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const serverTs = msg['server.timestamp'] !== undefined ? Number(msg['server.timestamp']) : msg.timestamp;
                  return (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 font-mono text-xs">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800/60 mb-2">
                        <span className="text-cyan-400 font-bold">Message #{messages.length - idx}</span>
                        <span>
                          {formatTimestamp(serverTs)} ({timeAgo(serverTs)}) • Epoch: {serverTs}
                        </span>
                      </div>
                      <pre className="text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(msg, null, 2)}
                      </pre>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeView === 'json' && (
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-[60vh]">
              {JSON.stringify(device, null, 2)}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">Flespi REST /gw/devices/{device.id}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
