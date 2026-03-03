const https = require('https');
const querystring = require('querystring');
const dotenv = require('dotenv');
const { generateOtp } = require('./otpUtils');

dotenv.config();

const validateIndianMobileNumber = (mobile) => {
  const cleaned = (mobile || '').trim();

  if (!/^\d{10}$/.test(cleaned)) {
    throw new Error(
      'Mobile number must be a valid 10-digit Indian mobile without country code (e.g., 9200000000)'
    );
  }

  return cleaned;
};

const callSmsBitsApi = ({ apiId, numbers, senderId, message, port, dltId, tempId }) => {
  const params = {
    id: apiId,
    senderid: senderId,
    to: numbers,
    msg: message,
    port,
  };

  // Optional DLT-related parameters (only sent if provided)
  if (dltId) {
    params.dltid = dltId;
  }
  if (tempId) {
    params.tempid = tempId;
  }

  const query = querystring.stringify(params);

  const options = {
    hostname: 'app.smsbits.in',
    path: `/api/web?${query}`,
    method: 'GET',
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const httpCode = res.statusCode;

        if (httpCode !== 200) {
          return reject(
            new Error(`SMSBits HTTP ${httpCode} - Response: ${data || 'No response body'}`)
          );
        }

        resolve({
          success: true,
          httpCode,
          rawResponse: data,
        });
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Failed to call SMSBits API: ${err.message}`));
    });

    req.end();
  });
};

/**
 * Send OTP via SMSBits for Indian mobile numbers.
 *
 * Environment variables used (can be overridden via options):
 * - SMSBITS_API_ID        (required if apiId not provided)
 * - SMSBITS_SENDER_ID     (required if senderId not provided)
 * - SMSBITS_PORT          (optional; defaults to "TA" if not provided)
 * - SMSBITS_DLT_ID        (optional entity ID)
 * - SMSBITS_OTP_TEMPID    (optional template ID)
 *
 * @param {string} mobile 10-digit Indian mobile number (no +91 / 0)
 * @param {string} otp OTP value as string
 * @param {Object} options
 * @param {string} [options.apiId]
 * @param {string} [options.senderId]
 * @param {string} [options.template] Message content for the SMS (name/OTP injected into placeholders)
 * @param {string} [options.port] Optional route port (defaults to "TA")
 * @param {string} [options.dltId] Optional DLT entity ID
 * @param {string} [options.tempId] Optional DLT template ID
 * @param {string} [options.name] Optional user name for template
 * @returns {Promise<{success: boolean, to: string, httpCode: number, rawResponse: string}>}
 */
const sendSmsBitsOtp = async (
  mobile,
  otp,
  { apiId, senderId, template, port, dltId, tempId, name } = {}
) => {
  if (!mobile || !otp) {
    throw new Error('Mobile number and OTP are required');
  }

  const to = validateIndianMobileNumber(mobile);

  const resolvedApiId = apiId || process.env.SMSBITS_API_ID;
  const resolvedSenderId = senderId || process.env.SMSBITS_SENDER_ID;
  const resolvedPort = port || process.env.SMSBITS_PORT || 'TA';
  const resolvedDltId = dltId || process.env.SMSBITS_DLT_ID;
  const resolvedTempId = tempId || process.env.SMSBITS_OTP_TEMPID;

  if (!resolvedApiId || !resolvedSenderId || !resolvedPort) {
    throw new Error(
      'SMSBits configuration missing. Please set SMSBITS_API_ID, SMSBITS_SENDER_ID and SMSBITS_PORT (or pass them in options).'
    );
  }

  // Use hardcoded approved template by default; no .env template required
  let baseTemplate = template || 'Dear {#var#}, Your OTP is {#var#} by CNTSMS';

  // Handle common placeholder patterns:
  // - First {#var#} (or {{NAME}}) -> name (or mobile as fallback)
  // - Second {#var#} (or {{OTP}})  -> OTP
  let resolvedTemplate = baseTemplate;
  // Use explicit user name for the first placeholder; do NOT fall back to mobile number
  const displayName = name || '';

  if (resolvedTemplate.includes('{#var#}')) {
    // Replace first occurrence with name/mobile
    resolvedTemplate = resolvedTemplate.replace('{#var#}', displayName);
    // Replace second occurrence (if present) with OTP
    if (resolvedTemplate.includes('{#var#}')) {
      resolvedTemplate = resolvedTemplate.replace('{#var#}', otp);
    }
  } else {
    // Fallback named placeholders
    resolvedTemplate = resolvedTemplate
      .replace('{{NAME}}', displayName)
      .replace('{{OTP}}', otp);
  }

  const result = await callSmsBitsApi({
    apiId: resolvedApiId,
    numbers: to,
    senderId: resolvedSenderId,
    message: resolvedTemplate,
    port: resolvedPort,
    dltId: resolvedDltId,
    tempId: resolvedTempId,
  });

  return {
    success: true,
    to,
    httpCode: result.httpCode,
    rawResponse: result.rawResponse,
  };
};

module.exports = {
  generateOtp,
  sendSmsBitsOtp,
};

