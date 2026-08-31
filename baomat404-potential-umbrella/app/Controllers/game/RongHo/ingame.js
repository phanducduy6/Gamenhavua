
let RongHo_phien = require('../../../Models/RongHo/RongHo_phien');
let RongHo_chat  = require('../../../Models/RongHo/RongHo_chat');
let RongHo_cuoc  = require('../../../Models/RongHo/RongHo_cuoc');
const BotGameManager = require('../../bot/botGameManager');

let safeTriggerRongHoBot = function(room, roomBet) {
	if (!room || !room.game) {
		return;
	}
	setTimeout(function() {
		try {
			if (typeof BotGameManager.spawnBotForRongHo !== 'function') {
				return;
			}
			BotGameManager.spawnBotForRongHo(roomBet, {
				difficulty: 'medium',
				aggressiveness: 0.5
			}).then(function(result) {
				if (result && result.success) {
					console.log('[RongHo/ingame] Bot spawned successfully');
				}
			}).catch(function(err) {
				console.error('[RongHo/ingame] Bot spawn failed:', err && err.message ? err.message : err);
			});
		} catch (err) {
			console.error('[RongHo/ingame] Error auto-spawning bot:', err && err.message ? err.message : err);
		}
	}, 1000);
};

module.exports = function(client){
	let rongho = client && client.redT && client.redT.rongho ? client.redT.rongho : null;
	if (rongho && rongho.clients && rongho.clients[client.UID] === client) {
		if (rongho && rongho.clients && Object.keys(rongho.clients).length === 1) {
			safeTriggerRongHoBot(rongho, rongho.game || 0);
		}
		let phien = rongho.phien;
		// Lấy thông tin phòng
		let data = {};
		data.time   = rongho.time;
		data.data   = rongho.data;
		data.chip   = rongho.chip;
		data.client = Object.keys(rongho.clients).length+Math.floor(Math.random() * Math.floor(50))>>0;

		var active1 = new Promise((resolve, reject) => {
			RongHo_phien.find({}, 'rong ho chatrong chatho', {sort:{'_id':-1}, limit:48}, function(err, logs) {
				Promise.all(logs.map(function(log){
					log = log._doc;
					delete log._id;
					return log;
				}))
				.then(function(result) {
					resolve(result);
				})
			});
		});

		var active2 = new Promise((resolve, reject) => {
			RongHo_chat.find({}, 'name value', {sort:{'_id':-1}, limit:20}, function(err, chats) {
				Promise.all(chats.map(function(chat){
					chat = chat._doc;
					delete chat._id;
					return chat;
				}))
				.then(function(result) {
					resolve(result);
				})
			});
		});

		var active3 = new Promise((resolve, reject) => {
			RongHo_cuoc.find({phien:phien}, 'bet type', {sort:{'_id':-1}}, function(err, phiens) {
				Promise.all(phiens.map(function(phien){
					phien = phien._doc;
					delete phien._id;
					return phien;
				}))
				.then(function(result) {
					resolve(result);
				})
			});
		});

		Promise.all([active1, active2, active3]).then(values => {
			data.logs  = values[0];
			data.chats = values[1];
			data.cuoc  = values[2];
			data.me = {};
			if (rongho.ingame && rongho.ingame.red && rongho.ingame.red[client.profile.name]) {
				data.me.red = rongho.ingame.red[client.profile.name]
			}
			if (rongho.ingame && rongho.ingame.xu && rongho.ingame.xu[client.profile.name]) {
				data.me.xu = rongho.ingame.xu[client.profile.name]
			}
			client.red({rongho:{ingame:data}});
			values = null;
			data   = null;
			client = null;
			rongho = null;
		});
	}else{
		// trở lại màn hình trang chủ
		client.red({toGame:'MainGame'});
		client = null;
		rongho = null;
	}
};
