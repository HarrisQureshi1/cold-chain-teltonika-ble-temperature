export interface FlespiTokenInfo {
  id: number;
  name?: string;
  cid: number;
  owner_id?: number;
  type?: string;
  expire?: number;
  ttl?: number;
  created_at?: number;
  last_access_time?: number;
  info?: string;
}

export interface FlespiCustomer {
  id: number;
  name?: string;
  title?: string;
  company?: string;
  email?: string;
  created?: number;
  cid?: number;
}

export interface AccountInfo {
  cid: number;
  name: string;
  company?: string;
  email?: string;
  tokenName: string;
  tokenType: string;
  tokenExpire: number;
  displayName: string;
}

export interface ColdChainConfig {
  token: string;
  channelId: number;
  minTemp: number; // in Celsius
  maxTemp: number; // in Celsius
  tempUnit: 'C' | 'F';
  autoRefreshInterval: number; // in seconds (0 = off)
  showAllBeacons?: boolean; // whether to show all BLE beacons or only those with temperature
  notificationEmail?: string; // Email address to send notifications to
  resendApiKey?: string; // Resend API token
  emailAlertsEnabled?: boolean; // Whether automated excursion emails are active
  alertCooldownMinutes?: number; // Cooldown between alert emails per sensor (default: 15 mins)
}

export interface EmailAlertLog {
  id: string;
  timestamp: number; // Epoch timestamp in ms
  sensorId: string;
  gatewayName: string;
  ident?: string;
  temperature: number;
  minTemp: number;
  maxTemp: number;
  thresholdBroken: string; // e.g. "22.0°C exceeds maximum 8.0°C"
  recipientEmail: string;
  status: 'sent' | 'failed';
  resendId?: string;
  error?: string;
}

export interface GatewayDevice {
  id: number;
  name: string;
  device_type_id?: number;
  device_type_name?: string;
  channel_id?: number;
  ident?: string;
  phone?: string;
  created?: number;
  messages_ttl?: number;
  telemetry?: Record<string, { value: any; ts: number }>;
  status: 'online' | 'offline' | 'unknown';
  last_active_ts?: number; // Fetched from server.timestamp Epoch time from packet
  serverTimestamp?: number;
  location?: {
    lat: number;
    lon: number;
    speed?: number;
    altitude?: number;
  };
  batteryVoltage?: number;
  batteryLevel?: number;
  externalVoltage?: number;
  gsmSignal?: number;
  ignitionStatus?: boolean;
  movementStatus?: boolean;
  bleCount?: number;
  peer?: string;
  protocolId?: number;
}

export interface BleSensorReading {
  sensorId: string;
  sensorName?: string;
  gatewayId: number | string;
  gatewayName: string;
  ident?: string;
  temperature?: number | null; // in Celsius, null/undefined if not available -> show --
  humidity?: number | null;
  rssi?: number | null;
  batteryLevel?: number | null;
  batteryVoltage?: number | null;
  batteryLow?: boolean;
  lastReadingTs: number; // Unix timestamp in seconds (fetched from server.timestamp)
  serverTimestamp?: number;
  isStale: boolean; // lastReadingTs > 30 minutes ago
  isOutOfLimits: boolean; // temp < minTemp || temp > maxTemp
  tempStatus: 'normal' | 'too_high' | 'too_low' | 'unknown';
  rawParamKey?: string;
}

export interface FlespiMessage {
  timestamp: number;
  [key: string]: any;
}
