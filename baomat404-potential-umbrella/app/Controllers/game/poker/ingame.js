
let Room   = require('./lib/room');
let crypto = require('crypto');
const BotGameManager = require('../../bot/botGameManager');

let safeTriggerBot = function(room, method, roomBet, label) {
	if (!room || !room.game) {
		return;
	}
	setTimeout(function() {
		try {
			if (typeof BotGameManager[method] !== 'function') {
				return;
			}
			BotGameManager[method](roomBet, {
				difficulty: 'medium',
				aggressiveness: 0.5
			}).then(function(result) {
				if (result && result.success) {
					console.log('[' + label + '] Bot spawned successfully');
				}
			}).catch(function(err) {
				console.error('[' + label + '] Bot spawn failed:', err && err.message ? err.message : err);
			});
		} catch (err) {
			console.error('[' + label + '] Error auto-spawning bot:', err && err.message ? err.message : err);
		}
	}, 1000);
};

let ingame = function(client){
	let poker = client.poker;
	if (!!poker && poker.room == null) {
		let PhongCho = Object.values(client.redT.game.poker.room[poker.game]);
		PhongCho = PhongCho[0];
		// vào phòng
		if (PhongCho !== void 0) {
			// vào phòng chơi
			if (PhongCho.online > 5) {
				ingame(client);
			}else{
				PhongCho.inroom(poker);
				if (PhongCho && PhongCho.game && PhongCho.online === 1 && !PhongCho.isPlay) {
					safeTriggerBot(PhongCho, 'spawnBotForPoker', poker.game, 'Poker/ingame');
				}
			}
		}else{
			let singID = new Date().getTime()+client.UID;
			singID = crypto.createHash('md5').update(singID).digest('hex');
			let newRoom = new Room(client.redT.game.poker, singID, poker.game);
			// vào phòng chơi
			newRoom.inroom(poker);
			if (newRoom && newRoom.game && newRoom.online === 1 && !newRoom.isPlay) {
				safeTriggerBot(newRoom, 'spawnBotForPoker', poker.game, 'Poker/ingame');
			}
		}
	}
	poker  = null;
	client = null;
}

module.exports = ingame;