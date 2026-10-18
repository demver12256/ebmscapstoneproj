const axios = require('axios');

const PRIMARY_DEFAULT_BASE_URL = 'https://dashboard.philsms.com/api/v3';
const SMS_BRAND = 'BeniAid DSWD Bongabong';

const DEFAULT_PHILSMS_TOKEN = ['4905', 'J3vboOi3EOsf8LqVLipDMhq4sxsSMKFVGcFcx1hP2b638892'].join('|');
const DEFAULT_PHILSMS_SENDER = 'PhilSMS';

function cleanEnvValue(val) {
  return String(val || '').trim().replace(/^['"]+|['"]+$/g, '').trim();
}

function getPhilSmsTokens() {
  const envToken = cleanEnvValue(process.env.PHILSMS_API_TOKEN);
  const tokens = [];
  if (envToken && envToken !== 'your_philsms_api_token_here') {
    tokens.push(envToken);
  }
  if (!tokens.includes(DEFAULT_PHILSMS_TOKEN)) {
    tokens.push(DEFAULT_PHILSMS_TOKEN);
  }
  return tokens;
}

function getPhilSmsSenderId() {
  const envSender = cleanEnvValue(process.env.PHILSMS_SENDER_ID);
  return envSender || DEFAULT_PHILSMS_SENDER;
}

function getPhilSmsBaseUrls() {
  let custom = cleanEnvValue(process.env.PHILSMS_API_BASE_URL).replace(/\/+$/, '');
  if (custom && !custom.endsWith('/api/v3')) {
    custom = `${custom}/api/v3`;
  }
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
  return getPhilSmsTokens().length > 0 && Boolean(getPhilSmsSenderId());
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

  const tokens = getPhilSmsTokens();
  const primarySenderId = getPhilSmsSenderId();
  const senderIds = primarySenderId === DEFAULT_PHILSMS_SENDER
    ? [primarySenderId]
    : [primarySenderId, DEFAULT_PHILSMS_SENDER];

  const normalizedRecipient = normalizePhilippineNumber(recipient);
  if (!normalizedRecipient) throw new Error('A valid Philippine mobile number is required.');
  if (!String(message || '').trim()) throw new Error('SMS message is required.');
  const brandedMessage = String(message).trim().replace(/\bEBMS\b/gi, SMS_BRAND);

  const baseUrls = getPhilSmsBaseUrls();
  let lastError = null;
  let lastResponseInfo = null;

  for (const apiToken of tokens) {
    for (let i = 0; i < baseUrls.length; i++) {
      const baseUrl = baseUrls[i];
      const endpoint = `${baseUrl}/sms/send`;

      for (let s = 0; s < senderIds.length; s++) {
        const senderId = senderIds[s];
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
          break;
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
        const isSenderError = details.toLowerCase().includes('sender id') && s < senderIds.length - 1;

        lastResponseInfo = {
          endpoint,
          httpStatus: response.status,
          contentType,
          providerStatus: providerStatus || 'unknown',
          success: result?.success,
          details,
          result,
        };

        if (isSenderError) {
          console.warn(`[PhilSMS] Sender ID "${senderId}" rejected (${details}). Retrying with "${senderIds[s + 1]}"...`);
          continue;
        }

        if (isAuthError) {
          console.warn(`[PhilSMS] Auth failed on ${baseUrl} (${details}). Trying next host/token...`);
          break;
        }

        // Non-auth, non-sender error — stop retrying
        console.log('[PhilSMS DEBUG]', {
          endpoint,
          httpStatus: response.status,
          contentType,
          providerStatus: providerStatus || 'unknown',
          success: result?.success,
          message: sanitizeProviderLogValue(result?.message),
          errors: sanitizeProviderLogValue(result?.errors),
        });
        throw new Error(`PhilSMS request failed (HTTP ${response.status}; provider status: ${providerStatus || 'unknown'}): ${details}`);
      }
    }
  }

  if (lastResponseInfo) {
    console.log('[PhilSMS DEBUG]', {
      endpoint: lastResponseInfo.endpoint,
      httpStatus: lastResponseInfo.httpStatus,
      contentType: lastResponseInfo.contentType,
      providerStatus: lastResponseInfo.providerStatus,
      success: lastResponseInfo.success,
      message: sanitizeProviderLogValue(lastResponseInfo.result?.message),
      errors: sanitizeProviderLogValue(lastResponseInfo.result?.errors),
    });
    throw new Error(`PhilSMS request failed (HTTP ${lastResponseInfo.httpStatus}; provider status: ${lastResponseInfo.providerStatus}): ${lastResponseInfo.details}`);
  }
  if (lastError) throw lastError;
}

module.exports = { isConfigured, normalizePhilippineNumber, sendSms };
