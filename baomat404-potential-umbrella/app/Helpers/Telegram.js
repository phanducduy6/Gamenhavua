const axios = require('axios');

const TOKEN = '8779717544:AAGPQpBZx-6wujbjdHfLsqgj_9icyrssZLQ';
const CHAT_ID = '5885388309';

class Telegram {
    static sendMessage(text) {
        if (!text && text !== 0) {
            return Promise.resolve(false);
        }

        const url = 'https://api.telegram.org/bot' + TOKEN + '/sendMessage?chat_id=' + CHAT_ID + '&text=' + encodeURIComponent(text);
        return axios.get(url, { timeout: 10000 }).then(function(response) {
            return response && response.data ? response.data : true;
        }).catch(function() {
            return false;
        });
    }
}

module.exports = Telegram;
