
let XocXoc_phien = require('../../../Models/XocXoc/XocXoc_phien');
let XocXoc_chat  = require('../../../Models/XocXoc/XocXoc_chat');
let XocXoc_cuoc  = require('../../../Models/XocXoc/XocXoc_cuoc');

let safeTriggerXocXocBot = function(room, roomBet) {
	if (!room || !room.game) {
		return;
	}
	setTimeout(function() {
		try {
			const BotGameManager = require('../../bot/botGameManager');
			if (typeof BotGameManager.spawnBotForXocXoc !== 'function') {
				return;
			}
			BotGameManager.spawnBotForXocXoc(roomBet, {
				difficulty: 'medium',
				aggressiveness: 0.5
			}).then(function(result) {
				if (result && result.success) {
					console.log('[XocXoc/ingame] Bot spawned successfully');
				}
			}).catch(function(err) {
				console.error('[XocXoc/ingame] Bot spawn failed:', err && err.message ? err.message : err);
			});
		} catch (err) {
			console.error('[XocXoc/ingame] Error auto-spawning bot:', err && err.message ? err.message : err);
		}
	}, 1000);
};

module.exports = function(client){
	let xocxoc = client && client.redT && client.redT.game && client.redT.game.xocxoc ? client.redT.game.xocxoc : null;
	if (xocxoc && xocxoc.clients && xocxoc.clients[client.UID] === client) {
		let phien = xocxoc.phien;
		if (xocxoc && xocxoc.clients && Object.keys(xocxoc.clients).length === 1 && xocxoc.botCount === 0) {
			safeTriggerXocXocBot(xocxoc, xocxoc.game || 0);
		}
		// Lấy thông tin phòng
		let data = {};
		data.time   = xocxoc.time;
		data.data   = xocxoc.data;
		data.chip   = xocxoc.chip;
		data.client = Object.keys(xocxoc.clients).length + xocxoc.botCount;

		var active1 = new Promise((resolve, reject) => {
			XocXoc_phien.find({}, 'red1 red2 red3 red4', {sort:{'_id':-1}, limit:48}, function(err, logs) {
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
			XocXoc_chat.find({}, 'name value', {sort:{'_id':-1}, limit:20}, function(err, chats) {
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
			XocXoc_cuoc.find({phien:phien}, 'bet type', {sort:{'_id':-1}}, function(err, phiens) {
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
			if (xocxoc.ingame && xocxoc.ingame.red && xocxoc.ingame.red[client.profile.name]) {
				data.me.red = xocxoc.ingame.red[client.profile.name]
			}
			client.red({xocxoc:{ingame:data}});
			values = null;
			data   = null;
			client = null;
			xocxoc = null;
		});
	}else{
		// trở lại màn hình trang chủ
		client.red({toGame:'MainGame'});
		client = null;
		xocxoc = null;
	}
};
