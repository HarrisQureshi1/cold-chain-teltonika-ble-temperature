import { BleSensorReading, EmailAlertLog } from '../types/flespi';
import { formatTemp, formatTimestamp } from '../utils/formatters';

export const DEFAULT_RESEND_API_KEY = '';
export const DEFAULT_NOTIFICATION_EMAIL = '';

const PROXY_ENDPOINT = '/api/resend/emails';
const DIRECT_ENDPOINT = 'https://api.resend.com/emails';

export interface SendEmailPayload {
  from?: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResponse {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Sends an email via Resend API using proxy with fallback
 */
export async function sendResendEmail(
  apiKey: string,
  payload: SendEmailPayload
): Promise<SendEmailResponse> {
  const token = (apiKey || '').trim();
  if (!token) {
    return { success: false, error: 'Resend API key is missing. Please configure it in the Configuration tab.' };
  }

  const sender = payload.from || 'Cold Chain Monitor <onboarding@resend.dev>';
  const bodyData = {
    from: sender,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // 1. Try proxy first
  try {
    const res = await fetch(PROXY_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) {
      return { success: true, id: data.id };
    }

    if (data.message || data.error) {
      const errMsg = data.message || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      return { success: false, error: errMsg };
    }
  } catch (err: any) {
    console.warn('Proxy send failed, trying direct:', err);
  }

  // 2. Direct fallback
  try {
    const res = await fetch(DIRECT_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) {
      return { success: true, id: data.id };
    }

    const errMsg = data.message || `HTTP ${res.status}: Failed to dispatch email.`;
    return { success: false, error: errMsg };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error occurred while contacting Resend API.',
    };
  }
}

/**
 * Sends a test notification to verify Resend credentials and target inbox
 */
export async function sendTestEmail(
  apiKey: string,
  toEmail: string,
  accountName = 'Haris Qureshi'
): Promise<SendEmailResponse> {
  const cleanEmail = toEmail.trim();
  if (!cleanEmail) {
    return { success: false, error: 'Please enter a valid notification recipient email address.' };
  }

  const timestamp = new Date().toLocaleString();

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b; color: #f8fafc;">
      <div style="background: linear-gradient(135deg, #0ea5e9, #2563eb); padding: 24px 32px;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em;">
          ❄️ Cold Chain Telematics Monitor
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: #e0f2fe;">
          Notification Email Verification
        </p>
      </div>

      <div style="padding: 32px;">
        <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 6px 0; font-size: 16px; color: #34d399; font-weight: 700;">
            ✓ Resend Integration Active
          </h2>
          <p style="margin: 0; font-size: 14px; color: #cbd5e1; line-height: 1.5;">
            Your notification settings have been successfully tested. Cold chain excursion alerts for <strong>${accountName}</strong> will be delivered to this address.
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
          <tr>
            <td style="padding: 10px 0; color: #94a3b8; border-bottom: 1px solid #334155;">Account:</td>
            <td style="padding: 10px 0; color: #ffffff; font-weight: 600; text-align: right; border-bottom: 1px solid #334155;">${accountName}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #94a3b8; border-bottom: 1px solid #334155;">Notification Recipient:</td>
            <td style="padding: 10px 0; color: #38bdf8; font-weight: 600; text-align: right; border-bottom: 1px solid #334155;">${cleanEmail}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #94a3b8; border-bottom: 1px solid #334155;">Provider:</td>
            <td style="padding: 10px 0; color: #ffffff; font-weight: 600; text-align: right; border-bottom: 1px solid #334155;">Resend API (REST)</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #94a3b8;">Sent At:</td>
            <td style="padding: 10px 0; color: #ffffff; font-weight: 600; text-align: right;">${timestamp}</td>
          </tr>
        </table>

        <div style="background: #1e293b; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #94a3b8; line-height: 1.4;">
          ℹ️ When any live sensor reading drops below or exceeds the acceptable temperature limits configured in your dashboard, an alert email will be automatically sent with full sensor telemetry.
        </div>
      </div>

      <div style="background: #020617; padding: 16px 32px; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #64748b;">
        Cold Chain for ${accountName} • Powered by Flespi Telematics & Resend
      </div>
    </div>
  `;

  return sendResendEmail(apiKey, {
    to: [cleanEmail],
    subject: `[Test] Cold Chain Notification Active for ${accountName}`,
    html,
    text: `Cold Chain Notification Verification\nYour email ${cleanEmail} is configured to receive temperature alerts for ${accountName}.\nSent at: ${timestamp}`,
  });
}

/**
 * Sends an automated temperature excursion alert email
 */
export async function sendTemperatureAlertEmail(
  apiKey: string,
  toEmail: string,
  sensor: BleSensorReading,
  accountName: string,
  minTemp: number,
  maxTemp: number,
  tempUnit: 'C' | 'F' = 'C'
): Promise<SendEmailResponse> {
  const cleanEmail = toEmail.trim();
  if (!cleanEmail) {
    return { success: false, error: 'Recipient notification email not set.' };
  }

  const tempVal = sensor.temperature !== null && sensor.temperature !== undefined ? sensor.temperature : 0;
  const isTooHigh = tempVal > maxTemp;
  const alertType = isTooHigh ? 'HIGH TEMPERATURE EXCURSION' : 'LOW TEMPERATURE / FREEZING RISK';
  const alertColor = isTooHigh ? '#e11d48' : '#3b82f6';
  const alertBg = isTooHigh ? 'rgba(225, 29, 72, 0.15)' : 'rgba(59, 130, 246, 0.15)';

  const formattedReading = formatTemp(tempVal, tempUnit);
  const formattedMin = formatTemp(minTemp, tempUnit);
  const formattedMax = formatTemp(maxTemp, tempUnit);
  const readingTime = formatTimestamp(sensor.serverTimestamp || sensor.lastReadingTs);
  const serverTs = sensor.serverTimestamp || sensor.lastReadingTs;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b; color: #f8fafc;">
      <!-- Header -->
      <div style="background: ${alertColor}; padding: 24px 32px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255, 255, 255, 0.9); margin-bottom: 6px;">
          CRITICAL ALERT • COLD CHAIN BREACH
        </div>
        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em;">
          🚨 ${alertType}
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: rgba(255, 255, 255, 0.9);">
          Sensor ${sensor.sensorId} reading broke acceptable threshold limits
        </p>
      </div>

      <!-- Main Body -->
      <div style="padding: 32px;">
        <!-- Prominent Temperature Box -->
        <div style="background: ${alertBg}; border: 2px solid ${alertColor}; border-radius: 14px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #cbd5e1; letter-spacing: 0.05em; margin-bottom: 6px;">
            Current Temperature Reading
          </div>
          <div style="font-size: 44px; font-weight: 900; color: #ffffff; line-height: 1; font-family: monospace;">
            ${formattedReading}
          </div>
          <div style="margin-top: 10px; font-size: 13px; font-weight: 600; color: ${isTooHigh ? '#fda4af' : '#93c5fd'};">
            ${isTooHigh ? `⚠️ Exceeds safe limit by +${(tempVal - maxTemp).toFixed(1)}°C` : `⚠️ Below minimum limit by -${(minTemp - tempVal).toFixed(1)}°C`}
          </div>
          <div style="margin-top: 4px; font-size: 12px; color: #94a3b8;">
            Configured Acceptable Range: <strong>${formattedMin}</strong> to <strong>${formattedMax}</strong>
          </div>
        </div>

        <!-- Details Table -->
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.05em;">
          Telemetry Details
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
          <tr>
            <td style="padding: 10px 0; color: #94a3b8; border-bottom: 1px solid #334155;">Sensor ID:</td>
            <td style="padding: 10px 0; color: #38bdf8; font-weight: 700; font-family: monospace; text-align: right; border-bottom: 1px solid #334155;">
              ${sensor.sensorId}
            </td>
          </tr>
          ${sensor.sensorName ? `
          <tr>
            <td style="padding: 10px 0; color: #94a3b8; border-bottom: 1px solid #334155;">Sensor Name:</td>
            <td style="padding: 10px 0; color: #ffffff; text-align: right; border-bottom: 1px solid #334155;">${sensor.sensorName}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 10px 0; color: #94a3b8; border-bottom: 1px solid #334155;">Host Gateway:</td>
            <td style="padding: 10px 0; color: #ffffff; font-weight: 600; text-align: right; border-bottom: 1px solid #334155;">${sensor.gatewayName}</td>
          </tr>
          ${sensor.ident ? `
          <tr>
            <td style="padding: 10px 0; color: #94a3b8; border-bottom: 1px solid #334155;">Gateway Ident (IMEI):</td>
            <td style="padding: 10px 0; color: #cbd5e1; font-family: monospace; text-align: right; border-bottom: 1px solid #334155;">${sensor.ident}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 10px 0; color: #94a3b8; border-bottom: 1px solid #334155;">Packet Epoch (server.timestamp):</td>
            <td style="padding: 10px 0; color: #cbd5e1; font-family: monospace; text-align: right; border-bottom: 1px solid #334155;">${serverTs}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #94a3b8; border-bottom: 1px solid #334155;">Reading Time:</td>
            <td style="padding: 10px 0; color: #ffffff; font-weight: 600; text-align: right; border-bottom: 1px solid #334155;">${readingTime}</td>
          </tr>
          ${sensor.batteryVoltage !== null && sensor.batteryVoltage !== undefined ? `
          <tr>
            <td style="padding: 10px 0; color: #94a3b8; border-bottom: 1px solid #334155;">Sensor Battery Voltage:</td>
            <td style="padding: 10px 0; color: #34d399; font-weight: 600; text-align: right; border-bottom: 1px solid #334155;">${sensor.batteryVoltage} V</td>
          </tr>
          ` : ''}
          ${sensor.rssi !== null && sensor.rssi !== undefined ? `
          <tr>
            <td style="padding: 10px 0; color: #94a3b8;">Bluetooth RSSI:</td>
            <td style="padding: 10px 0; color: #ffffff; text-align: right;">${sensor.rssi} dBm</td>
          </tr>
          ` : ''}
        </table>

        <!-- Immediate Action Note -->
        <div style="background: #1e293b; border-left: 4px solid ${alertColor}; border-radius: 4px 8px 8px 4px; padding: 14px 18px; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
          <strong>Action Required:</strong> Immediate inspection of cargo or refrigeration unit is recommended to preserve cold chain compliance and prevent product loss.
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #020617; padding: 18px 32px; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #64748b;">
        Cold Chain for ${accountName} • Alert dispatched to ${cleanEmail}<br/>
        Telematics data stream monitored via Flespi IoT Platform
      </div>
    </div>
  `;

  const subject = `🚨 [ALERT] Temp Excursion ${formattedReading} on ${sensor.sensorId} (Allowed: ${formattedMin}-${formattedMax})`;

  return sendResendEmail(apiKey, {
    to: [cleanEmail],
    subject,
    html,
    text: `ALERT: Temperature Excursion Detected!\nSensor: ${sensor.sensorId}\nReading: ${formattedReading}\nAcceptable Range: ${formattedMin} to ${formattedMax}\nGateway: ${sensor.gatewayName} (${sensor.ident || '--'})\nReading Time: ${readingTime}\nAccount: Cold Chain for ${accountName}`,
  });
}
