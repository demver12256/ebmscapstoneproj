const axios = require('axios');

const PRIMARY_DEFAULT_BASE_URL = 'https://dashboard.philsms.com/api/v3';
const SMS_BRAND = 'BeniAid DSWD Bongabong';

function getPhilSmsBaseUrls() {
  const custom = (process.env.PHILSMS_API_BASE_URL || '').trim().replace(/\/+$/, '');
  const primary = custom || PRIMARY_DEFAULT_BASE_URL;

  // Prepare fallback candidate (dashboard.philsms.com <-> app.philsms.com)
  const urls = [primary];
  if (primary.includes('dashboard.philsms.com')) {
    urls.push(primary.replace('dashboard.philsms.com', 'app.philsms.com'));
  } else if (primary.includes('app.philsms.com')) {
    urls.push(primary.replace('app.philsms.com', 'dashboard.philsms.com'));
  }
  return urls;
}

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

  const baseUrls = getPhilSmsBaseUrls();
  let lastError = null;

  for (let i = 0; i < baseUrls.length; i++) {
    const baseUrl = baseUrls[i];
    const endpoint = `${baseUrl}/sms/send`;

    let response;
    try {
      response = await axios.post(endpoint, {
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
      lastError = new Error(
        `PhilSMS connection failed before a complete response was received (${code}). The message may have been accepted; check provider delivery status before retrying.`
      );
      lastError.cause = error;
      if (i < baseUrls.length - 1) continue;
      throw lastError;
    }

    const rawBody = typeof response.data === 'string' ? response.data : '';
    const contentType = response.headers['content-type'] || '';
    let result = null;
    try { result = JSON.parse(rawBody); } catch { /* Keep raw body out of logs */ }

    const providerStatus = String(result?.status || result?.data?.status || '').toLowerCase();
    const providerAccepted = providerStatus === 'success' || result?.success === true;
    const httpSuccess = response.status >= 200 && response.status < 300;

    if (httpSuccess && providerAccepted) {
      const firstResult = Array.isArray(result.data) ? result.data[0] : result.data;
      return {
        providerMessageId: firstResult?.uid || firstResult?.id || result.uid || result.id || null,
        recipient: normalizedRecipient,
      };
    }

    const details = getProviderError(result, rawBody, contentType);
    const isAuthError = details.toLowerCase().includes('unauthenticated') || response.status === 401;

    // If unauthenticated or route not found, and there is a fallback host, try it
    if (isAuthError && i < baseUrls.length - 1) {
      console.warn(`[PhilSMS] Auth failed on ${baseUrl} (${details}). Retrying fallback host ${baseUrls[i + 1]}...`);
      continue;
    }

    console.log('[PhilSMS DEBUG]', {
      endpoint,
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

    throw new Error(`PhilSMS request failed (HTTP ${response.status}; provider status: ${providerStatus || 'unknown'}): ${details}`);
  }
}

module.exports = { isConfigured, normalizePhilippineNumber, sendSms };
