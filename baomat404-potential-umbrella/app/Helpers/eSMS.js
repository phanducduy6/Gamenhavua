const axios = require('axios');
const smsConfig = require('../../config/sms');

const normalizePhone = function (value) {
    if (!value) {
        return '';
    }

    let digits = String(value).replace(/\D/g, '');
    if (!digits) {
        return '';
    }

    if (digits.startsWith('84')) {
        return digits;
    }

    if (digits.startsWith('0')) {
        return '84' + digits.slice(1);
    }

    return digits;
};

const sendSMS = async function ({ phone, content, brandname }) {
    const apiKey = smsConfig.API_KEY || process.env.ESMS_API_KEY;
    const secretKey = smsConfig.SECRET_KEY || process.env.ESMS_SECRET_KEY;
    const brand = brandname || smsConfig.BRAND_NAME || process.env.ESMS_BRANDNAME || '';

    if (!apiKey || !secretKey) {
        throw new Error('Missing eSMS credentials: set ESMS_API_KEY and ESMS_SECRET_KEY in .env');
    }

    const payload = {
        ApiKey: apiKey,
        SecretKey: secretKey,
        Phone: normalizePhone(phone),
        Content: String(content || '').trim(),
        Brandname: brand,
        SmsType: '2',
        IsUnicode: '0',
    };

    if (!payload.Phone) {
        throw new Error('Invalid phone number for eSMS');
    }

    if (!payload.Content) {
        throw new Error('SMS content is empty');
    }

    try {
        const response = await axios.post(smsConfig.URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            timeout: 30000,
        });

        return response && response.data ? response.data : response;
    } catch (error) {
        if (error && error.response) {
            throw new Error(JSON.stringify(error.response.data || error.response.statusText || error.message));
        }
        throw error;
    }
};

module.exports = {
    normalizePhone,
    sendSMS,
};
