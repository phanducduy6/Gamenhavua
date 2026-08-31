require('dotenv').config();

const mongoose = require('mongoose');
require('mongoose-long')(mongoose);
const UserInfo = require('../../Models/UserInfo');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/PlayGame';
const BOT_COUNT = 200;
const MIN_BALANCE = 100000000;
const MAX_BALANCE = 50000000000;

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildBotPayload(index) {
  const balance = randomBetween(MIN_BALANCE, MAX_BALANCE);
  const name = 'bot_' + Date.now() + '_' + index + '_' + randomBetween(1000, 9999);
  const id = 'bot_' + (index + 1) + '_' + randomBetween(100000, 999999);

  return {
    id: id,
    name: name,
    avatar: '0',
    red: balance,
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

    const existingBots = await UserInfo.countDocuments({ type: true }).exec();
    console.log('Existing bot count:', existingBots);

    const inserted = [];
    for (let i = 0; i < BOT_COUNT; i++) {
      const payload = buildBotPayload(i + existingBots);
      const exists = await UserInfo.findOne({ $or: [{ id: payload.id }, { name: payload.name }] }).exec();
      if (!exists) {
        const created = await UserInfo.create(payload);
        inserted.push(created.name);
      }
    }

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
