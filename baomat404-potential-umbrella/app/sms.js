
/**
 * SMS Controller
 */

const axios = require('axios');
const config = require('../config/sms');

let sendOTP = async function(phone, otp) {
	const normalizedPhone = String(phone || '').replace(/\D/g, '');
	const code = String(otp || '').trim();

	if (!normalizedPhone || !code) {
		return { status: false, message: 'Invalid phone or OTP' };
	}

	const payload = {
		ApiKey: config.API_KEY,
		SecretKey: config.SECRET_KEY,
		Phone: normalizedPhone.startsWith('84') ? normalizedPhone : normalizedPhone.startsWith('0') ? '84' + normalizedPhone.slice(1) : normalizedPhone,
		Content: 'Mã OTP của bạn là: ' + code + '. Hết hạn sau 3 phút.',
		Brandname: config.BRAND_NAME || config.Brandname || '',
		SmsType: '2',
		IsUnicode: '0',
	};

	try {
		const response = await axios.post(config.URL, payload, {
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			timeout: 30000,
		});
		return response && response.data ? response.data : { status: true };
	} catch (error) {
		console.error('eSMS OTP send error:', error && error.response ? error.response.data : error.message);
		return { status: false, message: error && error.response ? error.response.data : error.message };
	}
};

module.exports = {
	sendOTP: sendOTP,
};
