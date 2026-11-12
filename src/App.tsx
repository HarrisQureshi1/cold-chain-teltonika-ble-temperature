import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AccountInfo,
  BleSensorReading,
  ColdChainConfig,
  EmailAlertLog,
  GatewayDevice,
} from './types/flespi';
import {
  DEFAULT_CHANNEL_ID,
  DEFAULT_FLESPI_TOKEN,
  extractBleSensorsFromMessages,
  fetchGatewaysAndData,
  verifyTokenAndGetAccount,
} from './services/flespiService';
import {
  sendTemperatureAlertEmail,
} from './services/resendService';
import { Header } from './components/Header';
import { ConfigurationTab } from './components/ConfigurationTab';
import { GatewaysTab } from './components/GatewaysTab';
import { LiveTemperatureTab } from './components/LiveTemperatureTab';
import { Mail, CheckCircle2, AlertTriangle, X } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'flespi_cold_chain_config_real_v3';
const ALERTS_STORAGE_KEY = 'flespi_cold_chain_alert_logs_v3';

export default function App() {
  // Load initial configuration from localStorage or initialize with defaults
  const [config, setConfig] = useState<ColdChainConfig>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          notificationEmail: parsed.notificationEmail || '',
          resendApiKey: parsed.resendApiKey || '',
          emailAlertsEnabled: parsed.emailAlertsEnabled ?? true,
          alertCooldownMinutes: parsed.alertCooldownMinutes || 15,
        };
      }
    } catch (_e) {}

    return {
      token: DEFAULT_FLESPI_TOKEN,
      channelId: DEFAULT_CHANNEL_ID,
      minTemp: 2.0, // 2°C (Cold Chain standard min)
      maxTemp: 8.0, // 8°C (Cold Chain standard max)
      tempUnit: 'C',
      autoRefreshInterval: 30,
      showAllBeacons: false,
      notificationEmail: '',
      resendApiKey: '',
      emailAlertsEnabled: true,
      alertCooldownMinutes: 15,
    };
  });

  const [activeTab, setActiveTab] = useState<'temperature' | 'gateways' | 'config'>('temperature');
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [devices, setDevices] = useState<GatewayDevice[]>([]);
  const [bleSensors, setBleSensors] = useState<BleSensorReading[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(Math.floor(Date.now() / 1000));

  // Email Alert Logs
  const [alertLogs, setAlertLogs] = useState<EmailAlertLog[]>(() => {
    try {
      const saved = localStorage.getItem(ALERTS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_e) {}
    return [];
  });

  // Track timestamps of last alerts sent per sensor to enforce cooldown
  const lastAlertTimes = useRef<Record<string, number>>({});
  const [sendingAlertSensorId, setSendingAlertSensorId] = useState<string | null>(null);

  // Active notification toast
  const [alertToast, setAlertToast] = useState<{
    id: string;
    message: string;
    subtext?: string;
    type: 'success' | 'alert' | 'error';
  } | null>(null);

  // Auto-dismiss toast after 7 seconds
  useEffect(() => {
    if (!alertToast) return;
    const t = setTimeout(() => setAlertToast(null), 7000);
    return () => clearTimeout(t);
  }, [alertToast]);

  // Timer to keep relative timestamps fresh every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync document title: "Cold Chain for [account name fetched from the API]"
  useEffect(() => {
    const accountName = account?.displayName || account?.name || '--';
    const title = `Cold Chain for ${accountName}`;
    document.title = title;
  }, [account]);

  // Append new alert log and persist to localStorage
  const recordAlertLog = useCallback((log: EmailAlertLog) => {
    setAlertLogs((prev) => {
      const updated = [log, ...prev].slice(0, 50);
      try {
        localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(updated));
      } catch (_e) {}
      return updated;
    });
  }, []);

  // Main data loader querying the real Flespi API
  const loadData = useCallback(async () => {
    if (!config.token.trim()) {
      setDevices([]);
      setBleSensors([]);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch real account info
      let accountName = 'Haris Qureshi';
      try {
        const accInfo = await verifyTokenAndGetAccount(config.token);
        setAccount(accInfo);
        accountName = accInfo.displayName || accInfo.name || accountName;
      } catch (e: any) {
        console.warn('Could not verify account details:', e);
      }

      // 2. Fetch real gateways and channel messages
      const { devices: realDevs, messages: realMsgs } = await fetchGatewaysAndData(
        config.token,
        config.channelId || DEFAULT_CHANNEL_ID
      );
      setDevices(realDevs);

      // 3. Extract real BLE sensors sending temperature readings
      const realSensors = extractBleSensorsFromMessages(
        realMsgs,
        realDevs,
        config.minTemp,
        config.maxTemp,
        config.showAllBeacons
      );
      setBleSensors(realSensors);
      setLastSyncTime(new Date());

      // 4. Automated Temperature Excursion Alert Checking
      if (
        config.emailAlertsEnabled !== false &&
        config.resendApiKey &&
        config.notificationEmail
      ) {
        const outOfBoundsSensors = realSensors.filter(
          (s) => s.isOutOfLimits && s.temperature !== null && s.temperature !== undefined
        );

        const cooldownMs = (config.alertCooldownMinutes || 15) * 60 * 1000;
        const now = Date.now();

        for (const sensor of outOfBoundsSensors) {
          const lastSent = lastAlertTimes.current[sensor.sensorId] || 0;
          if (now - lastSent > cooldownMs) {
            // Update cooldown timestamp
            lastAlertTimes.current[sensor.sensorId] = now;

            // Trigger Resend email alert asynchronously
            sendTemperatureAlertEmail(
              config.resendApiKey,
              config.notificationEmail,
              sensor,
              accountName,
              config.minTemp,
              config.maxTemp,
              config.tempUnit
            ).then((res) => {
              const tempStr = `${sensor.temperature}°C`;
              const thresholdText =
                sensor.temperature! > config.maxTemp
                  ? `${tempStr} > Max ${config.maxTemp}°C`
                  : `${tempStr} < Min ${config.minTemp}°C`;

              if (res.success) {
                recordAlertLog({
                  id: res.id || String(now),
                  timestamp: now,
                  sensorId: sensor.sensorId,
                  gatewayName: sensor.gatewayName,
                  ident: sensor.ident,
                  temperature: sensor.temperature!,
                  minTemp: config.minTemp,
                  maxTemp: config.maxTemp,
                  thresholdBroken: thresholdText,
                  recipientEmail: config.notificationEmail!,
                  status: 'sent',
                  resendId: res.id,
                });

                setAlertToast({
                  id: res.id || String(now),
                  type: 'alert',
                  message: `🚨 Excursion Alert Sent: Sensor ${sensor.sensorId} at ${tempStr}`,
                  subtext: `Notification dispatched via Resend to ${config.notificationEmail}`,
                });
              } else {
                recordAlertLog({
                  id: String(now),
                  timestamp: now,
                  sensorId: sensor.sensorId,
                  gatewayName: sensor.gatewayName,
                  ident: sensor.ident,
                  temperature: sensor.temperature!,
                  minTemp: config.minTemp,
                  maxTemp: config.maxTemp,
                  thresholdBroken: thresholdText,
                  recipientEmail: config.notificationEmail!,
                  status: 'failed',
                  error: res.error,
                });
              }
            });
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching Flespi data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [
    config.token,
    config.channelId,
    config.minTemp,
    config.maxTemp,
    config.tempUnit,
    config.showAllBeacons,
    config.emailAlertsEnabled,
    config.resendApiKey,
    config.notificationEmail,
    config.alertCooldownMinutes,
    recordAlertLog,
  ]);

  // Load data on mount and whenever config changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle auto-refresh interval
  useEffect(() => {
    if (config.autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      loadData();
    }, config.autoRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [config.autoRefreshInterval, loadData]);

  // Verify token from Configuration screen
  const handleVerifyToken = async (token: string, channelId: number): Promise<boolean> => {
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const acc = await verifyTokenAndGetAccount(token);
      setAccount(acc);

      const updatedConfig: ColdChainConfig = {
        ...config,
        token,
        channelId,
      };
      setConfig(updatedConfig);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedConfig));

      setIsVerifying(false);
      return true;
    } catch (err: any) {
      const msg = err.message || 'Failed to authenticate token with Flespi.';
      setVerifyError(msg);
      setIsVerifying(false);
      return false;
    }
  };

  // Save Config from Configuration Tab
  const handleSaveConfig = (newConfig: ColdChainConfig) => {
    setConfig(newConfig);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newConfig));
  };

  // Manual trigger for sending an alert email on demand
  const handleManualSendAlert = async (sensor: BleSensorReading): Promise<boolean> => {
    if (!config.resendApiKey || !config.notificationEmail) {
      setActiveTab('config');
      alert('Please configure your Notification Email and Resend API token in the Configuration tab.');
      return false;
    }

    setSendingAlertSensorId(sensor.sensorId);
    try {
      const now = Date.now();
      const res = await sendTemperatureAlertEmail(
        config.resendApiKey,
        config.notificationEmail,
        sensor,
        account?.displayName || account?.name || 'Haris Qureshi',
        config.minTemp,
        config.maxTemp,
        config.tempUnit
      );

      const tempStr = `${sensor.temperature}°C`;
      const thresholdText =
        (sensor.temperature || 0) > config.maxTemp
          ? `${tempStr} > Max ${config.maxTemp}°C`
          : `${tempStr} < Min ${config.minTemp}°C`;

      if (res.success) {
        lastAlertTimes.current[sensor.sensorId] = now;
        recordAlertLog({
          id: res.id || String(now),
          timestamp: now,
          sensorId: sensor.sensorId,
          gatewayName: sensor.gatewayName,
          ident: sensor.ident,
          temperature: sensor.temperature || 0,
          minTemp: config.minTemp,
          maxTemp: config.maxTemp,
          thresholdBroken: thresholdText,
          recipientEmail: config.notificationEmail,
          status: 'sent',
          resendId: res.id,
        });

        setAlertToast({
          id: res.id || String(now),
          type: 'success',
          message: `Email alert successfully sent to ${config.notificationEmail}`,
          subtext: `Sensor ${sensor.sensorId} • Reading: ${tempStr} • Resend ID: ${res.id}`,
        });
        return true;
      } else {
        recordAlertLog({
          id: String(now),
          timestamp: now,
          sensorId: sensor.sensorId,
          gatewayName: sensor.gatewayName,
          ident: sensor.ident,
          temperature: sensor.temperature || 0,
          minTemp: config.minTemp,
          maxTemp: config.maxTemp,
          thresholdBroken: thresholdText,
          recipientEmail: config.notificationEmail,
          status: 'failed',
          error: res.error,
        });

        setAlertToast({
          id: String(now),
          type: 'error',
          message: `Failed to dispatch alert: ${res.error}`,
        });
        return false;
      }
    } catch (err: any) {
      setAlertToast({
        id: String(Date.now()),
        type: 'error',
        message: `Error sending alert: ${err.message}`,
      });
      return false;
    } finally {
      setSendingAlertSensorId(null);
    }
  };

  // Toggle show all beacons vs only temperature-reporting sensors
  const handleToggleShowAllBeacons = (showAll: boolean) => {
    const updated = { ...config, showAllBeacons: showAll };
    setConfig(updated);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleClearAlertLogs = () => {
    setAlertLogs([]);
    localStorage.removeItem(ALERTS_STORAGE_KEY);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header with Dynamic Title */}
      <Header
        account={account}
        config={config}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        bleSensors={bleSensors}
        gatewaysCount={devices.length}
        isLoading={isLoading}
        onRefresh={loadData}
        lastSyncTime={lastSyncTime}
      />

      {/* Floating Alert Toast Notification */}
      {alertToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-slideUp">
          <div
            className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
              alertToast.type === 'alert'
                ? 'bg-rose-950/95 border-rose-600 text-rose-100 ring-2 ring-rose-500/30'
                : alertToast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-600 text-emerald-100'
                : 'bg-slate-900/95 border-rose-700 text-slate-200'
            }`}
          >
            {alertToast.type === 'alert' ? (
              <Mail className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
            ) : alertToast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 pr-2">
              <div className="font-bold text-xs sm:text-sm">{alertToast.message}</div>
              {alertToast.subtext && (
                <div className="text-[11px] opacity-80 mt-0.5">{alertToast.subtext}</div>
              )}
            </div>
            <button
              onClick={() => setAlertToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'config' && (
          <ConfigurationTab
            config={config}
            account={account}
            onSaveConfig={handleSaveConfig}
            onVerifyToken={handleVerifyToken}
            isVerifying={isVerifying}
            verifyError={verifyError}
            alertLogs={alertLogs}
            onClearAlertLogs={handleClearAlertLogs}
          />
        )}

        {activeTab === 'gateways' && (
          <GatewaysTab
            devices={devices}
            token={config.token}
            channelId={config.channelId}
            isLoading={isLoading}
            onRefresh={loadData}
            onNavigateToConfig={() => setActiveTab('config')}
          />
        )}

        {activeTab === 'temperature' && (
          <LiveTemperatureTab
            sensors={bleSensors}
            config={config}
            currentTimeSec={currentTimeSec}
            isLoading={isLoading}
            onRefresh={loadData}
            onNavigateToConfig={() => setActiveTab('config')}
            showAllBeacons={!!config.showAllBeacons}
            onToggleShowAllBeacons={handleToggleShowAllBeacons}
            onSendManualAlert={handleManualSendAlert}
            isSendingAlertId={sendingAlertSensorId}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">
              Cold Chain for {account?.displayName || '--'}
            </span>
            <span>•</span>
            <span>Flespi IoT Telematics</span>
            <span>•</span>
            <span className="text-cyan-400">Resend Notifications Active</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Acceptable: {config.minTemp}°C to {config.maxTemp}°C</span>
            <span>•</span>
            <span className="text-amber-400">Stale Threshold: &gt; 30m</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
