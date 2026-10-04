const axios = require('axios');

const PHILSMS_API_BASE_URL = (
  process.env.PHILSMS_API_BASE_URL || 'https://app.philsms.com/api/v3'
)
  .trim()
  // Older local .env files may still use the dashboard host. Route those to
  // PhilSMS's documented API host without requiring the secret-bearing file
  // to be opened or rewritten.
  .replace(/^(https?:\/\/)dashboard\.philsms\.com(?=\/|$)/i, '$1app.philsms.com')
  .replace(/\/+$/, '');
const PHILSMS_ENDPOINT = `${PHILSMS_API_BASE_URL}/sms/send`;
const SMS_BRAND = 'BeniAid DSWD Bongabong';

function isConfigured() {
  return Boolean(process.env.PHILSMS_API_TOKEN?.trim() && process.env.PHILSMS_SENDER_ID?.trim());
}

function sanitizeProviderLogValue(value) {
  if (Array.isArray(value)) return value.slice(0, 3).map(sanitizeProviderLogValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).slice(0, 5).map(([key, item]) => [key, sanitizeProviderLogValue(item)])
    );
  }
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
      .replace(/\b\d+\|[A-Za-z0-9._-]{12,}\b/g, '[redacted token]')
      .replace(/\b\d{6,}\b/g, '[redacted]')
      .slice(0, 240);
  }
  return value;
}

function normalizePhilippineNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return `63${digits.slice(1)}`;
  if (/^639\d{9}$/.test(digits)) return digits;
  return null;
}

function getProviderError(result, rawBody, contentType) {
  const detail = result?.message ||
    result?.error?.message ||
    result?.error ||
    result?.errors ||
    result?.data?.message;

  let message = '';
  if (typeof detail === 'string' || typeof detail === 'number') {
    message = String(detail);
  } else if (Array.isArray(detail)) {
    message = detail.map(String).slice(0, 3).join('; ');
  } else if (detail && typeof detail === 'object') {
    message = Object.values(detail)
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .filter((value) => typeof value === 'string' || typeof value === 'number')
      .map(String)
      .slice(0, 3)
      .join('; ');
  }

  if (!message && typeof result === 'string') message = result;
  if (!message && !result && contentType.includes('text/plain')) message = rawBody.slice(0, 180);
  message = message
    .replace(/\b\d{6,}\b/g, '[redacted]')
    .replace(/\b\d+\|[A-Za-z0-9._-]{12,}\b/g, '[redacted token]')
    .slice(0, 240);

  if (message) return message;
  const keys = result && typeof result === 'object' ? Object.keys(result).slice(0, 8).join(', ') : 'unrecognized response body';
  return `No provider error message returned; response fields: ${keys || 'none'}`;
}

async function sendSms(recipient, message) {
  if (!isConfigured()) throw new Error('PhilSMS is not configured. Set PHILSMS_API_TOKEN and PHILSMS_SENDER_ID.');

  const apiToken = process.env.PHILSMS_API_TOKEN.trim();
  const senderId = process.env.PHILSMS_SENDER_ID.trim();
  const normalizedRecipient = normalizePhilippineNumber(recipient);
  if (!normalizedRecipient) throw new Error('A valid Philippine mobile number is required.');
  if (!String(message || '').trim()) throw new Error('SMS message is required.');
  const brandedMessage = String(message).trim().replace(/\bEBMS\b/gi, SMS_BRAND);

  let response;
  try {
    response = await axios.post(PHILSMS_ENDPOINT, {
      recipient: normalizedRecipient,
      sender_id: senderId,
      type: 'plain',
      message: brandedMessage,
    }, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
      responseType: 'text',
      transformResponse: [(body) => body],
      validateStatus: () => true,
    });
  } catch (error) {
    const code = error.code || 'network error';
    const transportError = new Error(
      `PhilSMS connection failed before a complete response was received (${code}). The message may have been accepted; check provider delivery status before retrying.`
    );
    transportError.cause = error;
    throw transportError;
  }

  const rawBody = typeof response.data === 'string' ? response.data : '';
  const contentType = response.headers['content-type'] || '';
  let result = null;
  try { result = JSON.parse(rawBody); } catch { /* Keep the raw body out of logs unless it is safe plain text. */ }

  const providerStatus = String(result?.status || result?.data?.status || '').toLowerCase();
  const providerAccepted = providerStatus === 'success' || result?.success === true;
  const httpSuccess = response.status >= 200 && response.status < 300;
  if (!httpSuccess || !providerAccepted) {
    console.log('[PhilSMS DEBUG]', {
      httpStatus: response.status,
      contentType,
      providerStatus: providerStatus || 'unknown',
      success: result?.success,
      message: sanitizeProviderLogValue(result?.message),
      errors: sanitizeProviderLogValue(result?.errors),
      responseKeys: result && typeof result === 'object'
        ? Object.keys(result).slice(0, 8)
        : result === null ? 'null' : typeof result,
    });
    const details = getProviderError(result, rawBody, contentType);
    throw new Error(`PhilSMS request failed (HTTP ${response.status}; provider status: ${providerStatus || 'unknown'}): ${details}`);
  }

  const firstResult = Array.isArray(result.data) ? result.data[0] : result.data;
  return {
    providerMessageId: firstResult?.uid || firstResult?.id || result.uid || result.id || null,
    recipient: normalizedRecipient,
  };
}

module.exports = { isConfigured, normalizePhilippineNumber, sendSms };
