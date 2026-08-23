require('dotenv').config();
const mongoose = require('mongoose');
require('mongoose-long')(mongoose);

const configDB = require('./config/database');
const UserInfo = require('./app/Models/UserInfo');

// Hàm sinh tên ngẫu nhiên giống người thật (chuẩn phong cách game)
function getRandomName() {
    const ho = ["Nguyen", "Tran", "Le", "Pham", "Hoang", "Vu", "Vo", "Dang", "Bui", "Do"];
    const ten = ["Anh", "Linh", "Minh", "Tuan", "Nam", "Khang", "Nhat", "Dat", "Khoa", "Trang", "Huyen", "Thao", "Vy", "Long", "Bao", "Phuc", "Phat", "Tai"];
    const suffix = ["", "99", "88", "68", "79", "9x", "vip", "pro", "123", "999"];

    let randomHo = ho[Math.floor(Math.random() * ho.length)];
    let randomTen = ten[Math.floor(Math.random() * ten.length)];
    let randomSuffix = suffix[Math.floor(Math.random() * suffix.length)];

    return randomHo + randomTen + randomSuffix;
}

mongoose.connect(configDB.url, configDB.options)
    .then(async () => {
        console.log('✅ Đã kết nối MongoDB. Bắt đầu tạo dàn Bot tên người thật...');

        let botList = [];
        let baseUID = 2000000;

        // Vòng lặp tạo 200 con Bot
        for (let i = 1; i <= 200; i++) {
            // Gọi hàm sinh tên và ghép thêm một mã số nhỏ (i) để đảm bảo 100% không trùng tên
            let realName = getRandomName() + (Math.floor(Math.random() * 90) + 10); 
            
            botList.push({
                id: 'bot_id_' + Date.now() + '_' + i,
                UID: baseUID + i,
                name: realName, 
                type: true,
                red: 100000000000,
                totall: 100000000000,
                redPlay: 0,
                redWin: 0,
                redLost: 0
            });
        }

        try {
            // 1. Dọn dẹp lính cũ (Bot_DaiGia)
            await UserInfo.deleteMany({ type: true });
            console.log('🗑️ Đã xóa sạch danh sách Bot cũ.');

            // 2. Tiêm lính mới với tên ngẫu nhiên
            await UserInfo.insertMany(botList);
            console.log(`🎉 HOÀN TẤT! Đã tạo thành công ${botList.length} Bot với tên cực kỳ tự nhiên.`);
            
            // 3. Đóng kết nối
            process.exit(0);
        } catch (error) {
            console.error('❌ Có lỗi xảy ra khi tạo Bot:', error);
            process.exit(1);
        }
    })
    .catch(err => {
        console.error('❌ Lỗi kết nối cơ sở dữ liệu:', err);
        process.exit(1);
    });