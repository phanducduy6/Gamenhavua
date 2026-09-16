const crypto = require('crypto');

module.exports = {
    verifyTelegramWebAppData: function (telegramInitData) {
        try {
            // Lấy Token riêng của Mini App từ file .env
            const botToken = process.env.TELEGRAM_MINIAPP_TOKEN;
            if (!botToken) throw new Error("Chưa cấu hình TELEGRAM_MINIAPP_TOKEN trong .env");

            // Phân rã chuỗi initData
            const urlParams = new URLSearchParams(telegramInitData);
            const hash = urlParams.get('hash');
            urlParams.delete('hash');

            // Sắp xếp các key theo bảng chữ cái A-Z
            const keys = Array.from(urlParams.keys()).sort();
            let dataCheckString = '';
            for (const key of keys) {
                dataCheckString += `${key}=${urlParams.get(key)}\n`;
            }
            dataCheckString = dataCheckString.slice(0, -1); // Xóa ký tự \n ở cuối

            // Tạo khóa giải mã từ Bot Token
            const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

            // Tính toán hash đối chiếu
            const checkHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

            // So sánh an toàn chống tấn công timing
            if (crypto.timingSafeEqual(Buffer.from(checkHash), Buffer.from(hash))) {
                // Xác minh auth_date để chặn Replay Attack (chỉ cho phép gói tin sống trong 24h)
                const authDate = parseInt(urlParams.get('auth_date'), 10);
                const now = Math.floor(Date.now() / 1000);
                if (now - authDate > 86400) {
                     throw new Error("Gói dữ liệu Telegram đã hết hạn");
                }

                // Trả về thông tin user an toàn
                return JSON.parse(urlParams.get('user'));
            } else {
                return false;
            }
        } catch (error) {
            console.error("Lỗi xác thực Telegram:", error.message);
            return false;
        }
    }
}
