require('dotenv').config();

const mongoose = require('mongoose');
const Admin = require('../app/Models/Admin');
const Helpers = require('../app/Helpers/Helpers');

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error('Usage: node scripts/create-admin.js <username> <password>');
  process.exit(1);
}

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/PlayGame';

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');
    try {
      const hash = Helpers.generateHash(password);
      const existing = await Admin.findOne({ username }).exec();
      if (existing) {
        existing.password = hash;
        existing.rights = 9;
        existing.regDate = existing.regDate || new Date();
        await existing.save();
        console.log(`Updated existing admin user: ${username}`);
      } else {
        await Admin.create({ username, password: hash, rights: 9, regDate: new Date() });
        console.log(`Created admin user: ${username}`);
      }
    } catch (e) {
      console.error('Error creating admin:', e);
      process.exit(2);
    } finally {
      mongoose.disconnect();
    }
  })
  .catch(err => {
    console.error('Mongo connection error:', err);
    process.exit(3);
  });
