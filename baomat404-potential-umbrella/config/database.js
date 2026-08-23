const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/PlayGame';

module.exports = {
    url: mongoUri,
    options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // keep dbName only if needed for older Mongoose setups without a URI path
        // dbName: 'PlayGame',
    },
};
