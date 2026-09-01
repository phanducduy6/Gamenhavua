require('dotenv').config();

const mongoose = require('mongoose');
require('mongoose-long')(mongoose);
const UserInfo = require('../../Models/UserInfo');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/PlayGame';
const BOT_COUNT = 2000;
const MIN_BALANCE = 10000000000;
const MAX_BALANCE = 50000000000;

const LAST_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
const MIDDLE_NAMES = ['Văn', 'Thị', 'Hữu', 'Minh', 'Ngọc', 'Đức', 'Thanh', 'Quốc', 'Gia', 'Thành', 'Hoàng', 'Kim', 'Tuấn', 'Anh'];
const FIRST_NAMES = ['Nam', 'Hải', 'Linh', 'Trang', 'Hùng', 'Duy', 'Thảo', 'Lan', 'Long', 'Vy', 'Phúc', 'Tâm', 'Quân', 'Mai', 'Khang', 'Khánh', 'Anh', 'Sơn', 'My', 'Tú'];
const SEED_RUN_ID = Date.now().toString();

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildBotPayload(index) {
  const balance = randomBetween(MIN_BALANCE, MAX_BALANCE);
  const uniqueSuffix = SEED_RUN_ID + '_' + index;
  const displayName = LAST_NAMES[randomBetween(0, LAST_NAMES.length - 1)] + ' ' +
    MIDDLE_NAMES[randomBetween(0, MIDDLE_NAMES.length - 1)] + ' ' +
    FIRST_NAMES[randomBetween(0, FIRST_NAMES.length - 1)];
  const name = displayName + ' ' + index + '_' + randomBetween(1000, 9999);
  const id = 'bot_' + uniqueSuffix;
  const UID = String(Number(SEED_RUN_ID) * BOT_COUNT + index);

  return {
    id: id,
    UID: UID,
    name: name,
    avatar: '0',
    red: mongoose.Types.Long.fromString(String(balance)),
    joinedOn: new Date(),
    type: true,
    rights: 0,
    veryphone: false,
    veryold: false,
    otpFirst: false,
    email: '',
    cmt: '',
    security: { login: 0 },
    ketSat: 0,
    redWin: 0,
    redLost: 0,
    redPlay: 0,
    totall: 0,
    vip: 0,
    lastVip: 0,
    hu: 0,
    gitCode: 0,
    gitRed: 0,
    gitTime: null
  };
}

async function seedBots() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB:', MONGO_URI);

    const deleted = await UserInfo.deleteMany({
      type: true,
      $or: [
        { id: { $ne: 'BOT_CANDOITRONG' } },
        { name: { $ne: 'BOT_CANDOITRONG' } }
      ]
    }).exec();
    console.log('Deleted old bot accounts:', deleted.deletedCount);

    const payloads = [];
    for (let i = 0; i < BOT_COUNT; i++) {
      payloads.push(buildBotPayload(i + 1));
    }
    const inserted = await UserInfo.insertMany(payloads, { ordered: true });

    console.log('Seeded bot accounts:', inserted.length);
    console.log('Done.');
  } catch (err) {
    console.error('Error seeding bots:', err && err.message ? err.message : err);
    process.exitCode = 1;
  } finally {
    mongoose.disconnect();
  }
}

seedBots();
