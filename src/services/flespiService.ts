import { AccountInfo, BleSensorReading, FlespiMessage, GatewayDevice } from '../types/flespi';

export const DEFAULT_FLESPI_TOKEN = '9CRHNb7y7IVwIuf6tVt4LAxDP6Hd8PcG0vbK1jPtjFqO0LmfbewIcQfDEyIZJCbG';
export const DEFAULT_CHANNEL_ID = 1401599;

const BASE_DIRECT = 'https://flespi.io';
const BASE_PROXY = '/api/flespi';

function cleanToken(rawToken: string): string {
  if (!rawToken) return '';
  let token = String(rawToken).trim();
  // Strip surrounding quotes
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }
  // Strip common prefixes
  if (token.toLowerCase().startsWith('flespitoken ')) {
    token = token.slice(12).trim();
  } else if (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }
  return token;
}

/**
 * Universal Flespi API fetcher.
 * Primary: Directly queries https://flespi.io (which has full native CORS support for Vercel production and all domains).
 * Secondary: Fallback to /api/flespi proxy (Vite dev proxy or vercel.json rewrite) if direct fetch encounters a client-side firewall.
 */
async function flespiFetch(endpoint: string, token: string): Promise<any> {
  const cleaned = cleanToken(token);
  if (!cleaned) {
    throw new Error('Please provide a valid Flespi token.');
  }

  const headers: Record<string, string> = {
    Authorization: `FlespiToken ${cleaned}`,
    Accept: 'application/json',
  };

  // 1. Primary: Direct request to https://flespi.io (CORS supported on all production environments)
  try {
    const directRes = await fetch(`${BASE_DIRECT}${endpoint}`, {
      method: 'GET',
      headers,
    });

    const contentType = directRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await directRes.json();
      if (directRes.ok) {
        return data;
      }
      // Flespi error payload returned
      const errorReason = data?.errors?.[0]?.reason || data?.message;
      const msg = errorReason
        ? `Flespi API error: ${errorReason} (${directRes.status})`
        : `HTTP ${directRes.status} ${directRes.statusText}`;
      const err = new Error(msg);
      (err as any).status = directRes.status;
      (err as any).data = data;
      throw err;
    }

    if (!directRes.ok) {
      const msg = `Flespi API HTTP ${directRes.status}: ${directRes.statusText}`;
      const err = new Error(msg);
      (err as any).status = directRes.status;
      throw err;
    }
  } catch (err: any) {
    // If it's an explicit authentication error from Flespi (401 invalid token, 403 forbidden), throw immediately
    if (err.status === 401 || err.status === 403) {
      throw err;
    }
    console.warn('Direct Flespi call encountered an issue, trying fallback proxy:', err.message);
  }

  // 2. Secondary: Fallback to proxy route
  try {
    const proxyRes = await fetch(`${BASE_PROXY}${endpoint}`, { headers });
    const contentType = proxyRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await proxyRes.json();
      if (proxyRes.ok) {
        return data;
      }
      const errorReason = data?.errors?.[0]?.reason || data?.message;
      const msg = errorReason
        ? `Flespi API error: ${errorReason} (${proxyRes.status})`
        : `HTTP ${proxyRes.status} ${proxyRes.statusText}`;
      const err = new Error(msg);
      (err as any).status = proxyRes.status;
      (err as any).data = data;
      throw err;
    }
  } catch (proxyErr: any) {
    if (proxyErr.status === 401 || proxyErr.status === 403) {
      throw proxyErr;
    }
  }

  throw new Error('Failed to connect to Flespi API. Please verify token and network connectivity.');
}

/**
 * Verify token and fetch real account information from Flespi API
 */
export async function verifyTokenAndGetAccount(token: string): Promise<AccountInfo> {
  const cleaned = cleanToken(token);
  if (!cleaned) {
    throw new Error('Please enter a valid Flespi token.');
  }

  // 1. Fetch /auth/info
  const authData = await flespiFetch('/auth/info', cleaned);
  const tokenRecord = authData?.result?.[0];
  if (!tokenRecord) {
    throw new Error('No token information returned from Flespi.');
  }

  const cid = tokenRecord.cid || tokenRecord.owner_id || 0;
  let accountName = tokenRecord.info || tokenRecord.name || `Account #${cid}`;
  let company: string | undefined;
  let email: string | undefined;

  // 2. Fetch /platform/customer
  try {
    const custData = await flespiFetch('/platform/customer', cleaned);
    const customer = custData?.result?.[0];
    if (customer) {
      if (customer.name) accountName = customer.name;
      if (customer.company) company = customer.company;
      if (customer.email) email = customer.email;
    }
  } catch (_e) {
    // Standard tokens might not have platform read permissions
  }

  const displayName = company || accountName || `Account #${cid}`;

  return {
    cid,
    name: accountName,
    company,
    email,
    tokenName: tokenRecord.info || tokenRecord.name || 'Flespi Token',
    tokenType: tokenRecord.access?.type === 1 ? 'Master (Full Access)' : tokenRecord.type || 'Standard',
    tokenExpire: tokenRecord.expire || 0,
    displayName,
  };
}

/**
 * Fetch all available gateways/devices in that account and surrounding data from real API
 */
export async function fetchGatewaysAndData(
  token: string,
  channelId = DEFAULT_CHANNEL_ID
): Promise<{
  devices: GatewayDevice[];
  messages: FlespiMessage[];
}> {
  const currentTimeSec = Math.floor(Date.now() / 1000);

  // 1. Fetch registered devices
  let rawDevices: any[] = [];
  try {
    const devRes = await flespiFetch('/gw/devices/all', token);
    rawDevices = devRes?.result || [];
  } catch (err) {
    console.warn('Could not fetch devices list:', err);
  }

  // 2. Fetch registered channels
  let rawChannels: any[] = [];
  try {
    const chanRes = await flespiFetch('/gw/channels/all', token);
    rawChannels = chanRes?.result || [];
  } catch (err) {
    console.warn('Could not fetch channels list:', err);
  }

  // 3. Fetch real messages from channel buffer and devices using count & reverse: true to get the latest live packets
  let messages: FlespiMessage[] = [];
  try {
    const [channelRes, deviceMsgsRes] = await Promise.allSettled([
      flespiFetch(
        `/gw/channels/${channelId}/messages?data=${encodeURIComponent(JSON.stringify({ count: 250, reverse: true }))}`,
        token
      ),
      flespiFetch(
        `/gw/devices/all/messages?data=${encodeURIComponent(JSON.stringify({ count: 100, reverse: true }))}`,
        token
      ),
    ]);

    const chanList: FlespiMessage[] =
      channelRes.status === 'fulfilled' && channelRes.value?.result ? channelRes.value.result : [];
    const devList: FlespiMessage[] =
      deviceMsgsRes.status === 'fulfilled' && deviceMsgsRes.value?.result ? deviceMsgsRes.value.result : [];

    // Combine and deduplicate
    const combined = [...chanList, ...devList];
    const seen = new Set<string>();
    messages = combined.filter((m) => {
      const sTs = m['server.timestamp'] !== undefined ? m['server.timestamp'] : m.timestamp;
      const key = `${m.ident || ''}_${sTs || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // If reverse failed for any reason, fallback to basic channel fetch
    if (messages.length === 0) {
      const fallbackRes = await flespiFetch(
        `/gw/channels/${channelId}/messages?data=${encodeURIComponent(JSON.stringify({ limit_count: 50 }))}`,
        token
      );
      messages = fallbackRes?.result || [];
    }
  } catch (err) {
    console.warn('Could not fetch channel messages:', err);
  }

  // Map messages by device ident to attach latest live telemetry
  // "Last activity" should be fetched from Epoch time sent in "server.timestamp" from the packet
  const identLatestMsg: Record<string, FlespiMessage> = {};
  for (const m of messages) {
    if (m.ident) {
      const existing = identLatestMsg[m.ident];
      const mServerTs = m['server.timestamp'] !== undefined ? Number(m['server.timestamp']) : (m.timestamp || 0);
      const exServerTs = existing
        ? (existing['server.timestamp'] !== undefined ? Number(existing['server.timestamp']) : (existing.timestamp || 0))
        : 0;
      if (!existing || mServerTs > exServerTs) {
        identLatestMsg[m.ident] = m;
      }
    }
  }

  // Build device list with actual data from API (no dummy data)
  const devices: GatewayDevice[] = [];

  for (const dev of rawDevices) {
    const devIdent = dev.configuration?.ident || dev.ident;
    const latestMsg = devIdent ? identLatestMsg[devIdent] : undefined;

    // Collect all parameters from latest message as telemetry
    const teleRecord: Record<string, { value: any; ts: number }> = {};

    // "Last activity" should be fetched from Epoch time sent in "server.timestamp" from the packet
    const serverTimestamp = latestMsg?.['server.timestamp'] !== undefined
      ? Number(latestMsg['server.timestamp'])
      : (latestMsg?.timestamp !== undefined ? Number(latestMsg.timestamp) : undefined);

    if (latestMsg) {
      const msgTs = serverTimestamp || 0;
      for (const [k, v] of Object.entries(latestMsg)) {
        teleRecord[k] = { value: v, ts: msgTs };
      }
    }

    // Determine Online/Offline from real server.timestamp (online if active within 30 min)
    const isOnline = serverTimestamp !== undefined && currentTimeSec - serverTimestamp < 1800;

    const lat = latestMsg?.['position.latitude'];
    const lon = latestMsg?.['position.longitude'];
    const speed = latestMsg?.['position.speed'];
    const alt = latestMsg?.['position.altitude'];

    const location =
      lat !== undefined && lon !== undefined
        ? {
            lat: Number(lat),
            lon: Number(lon),
            speed: speed !== undefined ? Number(speed) : undefined,
            altitude: alt !== undefined ? Number(alt) : undefined,
          }
        : undefined;

    // Count BLE beacons if present in latest message
    let bleCount: number | undefined = undefined;
    if (Array.isArray(latestMsg?.['ble.beacons'])) {
      bleCount = latestMsg['ble.beacons'].length;
    }

    devices.push({
      id: dev.id,
      name: dev.name || `Device #${dev.id}`,
      device_type_id: dev.device_type_id,
      device_type_name: dev.device_type_id === 579 ? 'Teltonika FMC130 / FMB' : dev.device_type_id === 578 ? 'Teltonika FMM125' : undefined,
      channel_id: dev.channel_id || channelId,
      ident: devIdent,
      created: dev.created,
      messages_ttl: dev.messages_ttl,
      status: isOnline ? 'online' : serverTimestamp !== undefined ? 'offline' : 'unknown',
      last_active_ts: serverTimestamp,
      serverTimestamp,
      location,
      batteryVoltage: latestMsg?.['battery.voltage'],
      batteryLevel: latestMsg?.['battery.level'],
      externalVoltage: latestMsg?.['external.powersource.voltage'],
      gsmSignal: latestMsg?.['gsm.signal.level'],
      ignitionStatus: latestMsg?.['engine.ignition.status'],
      movementStatus: latestMsg?.['movement.status'],
      bleCount,
      peer: latestMsg?.peer,
      protocolId: dev.protocol_id || latestMsg?.['protocol.id'],
      telemetry: teleRecord,
    });
  }

  // Also include the channel gateway if not already represented
  for (const chan of rawChannels) {
    const isAlreadyIncluded = devices.some((d) => d.id === chan.id || d.name === chan.name);
    if (!isAlreadyIncluded) {
      // Find latest message for this channel
      const latestChanMsg = messages.find((m) => m['channel.id'] === chan.id) || messages[0];
      const channelServerTs = latestChanMsg?.['server.timestamp'] !== undefined
        ? Number(latestChanMsg['server.timestamp'])
        : (latestChanMsg?.timestamp || undefined);

      devices.push({
        id: chan.id,
        name: chan.name || `Gateway Channel #${chan.id}`,
        channel_id: chan.id,
        device_type_name: 'Gateway Channel Listener',
        status: messages.length > 0 ? 'online' : 'offline',
        last_active_ts: channelServerTs,
        serverTimestamp: channelServerTs,
        messages_ttl: chan.messages_ttl,
        peer: chan.uri,
        protocolId: chan.protocol_id,
        bleCount: messages.filter((m) => Array.isArray(m['ble.beacons'])).length > 0 ? undefined : 0,
      });
    }
  }

  return { devices, messages };
}

/**
 * Fetch raw historical messages for a specific device or channel from real API
 */
export async function fetchDeviceMessages(
  deviceId: number,
  ident?: string,
  channelId = DEFAULT_CHANNEL_ID,
  token = DEFAULT_FLESPI_TOKEN
): Promise<FlespiMessage[]> {
  // First try device messages endpoint with reverse: true to get newest first
  try {
    const devRes = await flespiFetch(
      `/gw/devices/${deviceId}/messages?data=${encodeURIComponent(JSON.stringify({ count: 50, reverse: true }))}`,
      token
    );
    if (devRes?.result && devRes.result.length > 0) {
      return devRes.result;
    }
  } catch (_e) {
    // If device messages endpoint fails or is empty, fallback to channel messages filtered by ident
  }

  // Query channel messages with reverse: true
  try {
    const chanRes = await flespiFetch(
      `/gw/channels/${channelId}/messages?data=${encodeURIComponent(JSON.stringify({ count: 100, reverse: true }))}`,
      token
    );
    const msgs: FlespiMessage[] = chanRes?.result || [];
    if (ident) {
      const filtered = msgs.filter((m) => m.ident === ident);
      if (filtered.length > 0) return filtered;
    }
    return msgs;
  } catch (_e) {
    return [];
  }
}

/**
 * Extract BLE sensors sending temperature readings from real API messages
 */
export function extractBleSensorsFromMessages(
  messages: FlespiMessage[],
  devices: GatewayDevice[],
  minTemp: number,
  maxTemp: number,
  showAllBeacons = false
): BleSensorReading[] {
  const currentTimeSec = Math.floor(Date.now() / 1000);
  const sensorMap = new Map<string, BleSensorReading>();

  // Map ident to device for friendly name resolution
  const identToDeviceName: Record<string, string> = {};
  for (const d of devices) {
    if (d.ident) identToDeviceName[d.ident] = d.name;
  }

  // Process messages in chronological order based on Epoch server.timestamp from the packet
  const sortedMsgs = [...messages].sort((a, b) => {
    const aTs = a['server.timestamp'] !== undefined ? Number(a['server.timestamp']) : (a.timestamp || 0);
    const bTs = b['server.timestamp'] !== undefined ? Number(b['server.timestamp']) : (b.timestamp || 0);
    return aTs - bTs;
  });

  for (const m of sortedMsgs) {
    // "Last activity" fetched from Epoch time sent in "server.timestamp" from the packet
    const serverTimestamp = m['server.timestamp'] !== undefined ? Number(m['server.timestamp']) : undefined;
    const msgTs = serverTimestamp ?? (m.timestamp || 0);
    const ident = m.ident || '';
    const gatewayName = ident ? identToDeviceName[ident] || `Gateway (Ident: ${ident})` : `Channel #${m['channel.id'] || DEFAULT_CHANNEL_ID}`;
    const gatewayId = m['device.id'] || m['channel.id'] || DEFAULT_CHANNEL_ID;

    // 1. Process ble.beacons array
    if (Array.isArray(m['ble.beacons'])) {
      m['ble.beacons'].forEach((b: any, idx: number) => {
        const sensorId = b.id || b.mac || `BEACON-${idx}`;
        if (!sensorId) return;

        const hasTemp = b.temperature !== undefined && b.temperature !== null && !isNaN(Number(b.temperature));
        const numTemp = hasTemp ? Number(b.temperature) : null;

        // If not showing all beacons and this beacon has no temperature, check if existing already has temp
        const existing = sensorMap.get(sensorId);
        if (!showAllBeacons && !hasTemp && (!existing || existing.temperature === null)) {
          return;
        }

        // If existing sensor already has a temperature and this beacon does not, keep existing reading
        if (existing && existing.temperature !== null && numTemp === null) {
          return;
        }

        // "Last activity" fetched from Epoch time sent in "server.timestamp" from the packet
        const readingTs = serverTimestamp ?? (b.timestamp || b.ts || msgTs);
        // Rule: If last reading time is more than 30 mins, flag stale
        const isStale = readingTs > 0 && currentTimeSec - readingTs > 30 * 60;

        // Rule: If temperature reading is outside acceptable limits, flag out of limits
        const isOutOfLimits = numTemp !== null && (numTemp < minTemp || numTemp > maxTemp);
        const tempStatus =
          numTemp === null
            ? 'unknown'
            : numTemp > maxTemp
            ? 'too_high'
            : numTemp < minTemp
            ? 'too_low'
            : 'normal';

        sensorMap.set(sensorId, {
          sensorId,
          sensorName: b.name || b.local_name,
          gatewayId,
          gatewayName,
          ident,
          temperature: numTemp,
          humidity: b.humidity !== undefined ? Number(b.humidity) : null,
          rssi: b.rssi !== undefined ? Number(b.rssi) : null,
          batteryLevel: b['battery.level'] !== undefined ? Number(b['battery.level']) : null,
          batteryVoltage: b['battery.voltage'] !== undefined ? Number(b['battery.voltage']) : null,
          batteryLow: b['battery.low'],
          lastReadingTs: readingTs,
          serverTimestamp,
          isStale,
          isOutOfLimits,
          tempStatus,
          rawParamKey: `ble.beacons[${idx}]`,
        });
      });
    }

    // 2. Direct top-level sensor.temperature.* or ble.sensor.temperature.* or ble.temperature
    for (const key of Object.keys(m)) {
      if (
        key === 'sensor.temperature' ||
        key.startsWith('sensor.temperature.') ||
        key === 'ble.sensor.temperature' ||
        key.startsWith('ble.sensor.temperature.') ||
        key === 'ble.temperature' ||
        key.startsWith('ble.temperature.')
      ) {
        const val = m[key];
        if (val !== undefined && val !== null && !isNaN(Number(val))) {
          const numTemp = Number(val);
          const suffix = key.split('.').pop() || '';
          const idKey = `ble.sensor.id.${suffix}`;
          const macKey = `ble.sensor.mac.${suffix}`;
          const sensorId = m[idKey] || m[macKey] || (ident ? `${key} (${ident})` : key);

          // "Last activity" fetched from server.timestamp
          const readingTs = serverTimestamp ?? msgTs;
          const isStale = readingTs > 0 && currentTimeSec - readingTs > 30 * 60;
          const isOutOfLimits = numTemp < minTemp || numTemp > maxTemp;
          const tempStatus = numTemp > maxTemp ? 'too_high' : numTemp < minTemp ? 'too_low' : 'normal';

          sensorMap.set(sensorId, {
            sensorId,
            gatewayId,
            gatewayName,
            ident,
            temperature: numTemp,
            rssi: m[`ble.sensor.rssi.${suffix}`] !== undefined ? Number(m[`ble.sensor.rssi.${suffix}`]) : null,
            batteryVoltage: m[`ble.sensor.battery.voltage.${suffix}`] !== undefined ? Number(m[`ble.sensor.battery.voltage.${suffix}`]) : null,
            lastReadingTs: readingTs,
            serverTimestamp,
            isStale,
            isOutOfLimits,
            tempStatus,
            rawParamKey: key,
          });
        }
      }
    }
  }

  return Array.from(sensorMap.values());
}
