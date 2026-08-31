
let Room   = require('./lib/room');
let crypto = require('crypto');

let trySpawnBotForBaCay = function(room, roomBet) {
	if (!room || !room.game) {
		return;
	}
	setTimeout(async function() {
		try {
			const BotGameManager = require('../../bot/botGameManager');
			if (typeof BotGameManager.spawnBotForBaCay !== 'function') {
				return;
			}
			const botResult = await BotGameManager.spawnBotForBaCay(roomBet, {
				difficulty: 'medium',
				aggressiveness: 0.5
			});
			if (botResult && botResult.success) {
				console.log('[BaCay] ✅ Bot auto-spawned: ' + (botResult.botInfo && botResult.botInfo.name ? botResult.botInfo.name : 'bot'));
			} else if (botResult) {
				console.log('[BaCay] ⚠️ Bot spawn failed: ' + botResult.message);
			}
		} catch (err) {
			console.error('[BaCay] Error spawning bot:', err && err.message ? err.message : err);
		}
	}, 1000);
};

let ingame = function(client){
	let bacay = client.bacay;
	if (!!bacay){
		if(bacay.room == null){
			let PhongCho = Object.values((process.redT && process.redT.game && process.redT.game.bacay && process.redT.game.bacay.room && process.redT.game.bacay.room[bacay && bacay.game]) || {});
			PhongCho = PhongCho[0];
			// vào phòng
			if (PhongCho !== void 0) {
				// vào phòng chơi
				console.log("Phòng Ba Cây có người vào. Số người:", PhongCho.online);
				if (PhongCho.online > 5) {
					ingame(client);
				}else{
					PhongCho.inroom(bacay);
					if (PhongCho && PhongCho.game && PhongCho.online === 1 && !PhongCho.isPlay) {
						trySpawnBotForBaCay(PhongCho, PhongCho.game);
					}
				}
			}else{
				let singID = new Date().getTime()+client.UID;
				singID = crypto.createHash('md5').update(singID).digest('hex');
				let newRoom = new Room(client.redT.game.bacay, singID, bacay && bacay.game);
				const roomBet = (newRoom && newRoom.game) || (bacay && bacay.game);
				// vào phòng chơi
				newRoom.inroom(bacay);

				if (newRoom && newRoom.game && newRoom.online === 1 && !newRoom.isPlay && roomBet != null) {
					trySpawnBotForBaCay(newRoom, roomBet);
				}
			}
			bacay  = null;
			client = null;
		}else{
			// kết nối lại
			bacay.reconnect();
			bacay  = null;
			client = null;
		}
	}
}

module.exports = ingame;