
let Helpers     = require('../Helpers/Helpers');
let Telegram    = require('../Helpers/Telegram');
let UserInfo    = require('../Models/UserInfo');
let TXPhien     = require('../Models/TaiXiu_phien');
let TXCuoc      = require('../Models/TaiXiu_cuoc');
let TaiXiu_User = require('../Models/TaiXiu_user');
let TXCuocOne   = require('../Models/TaiXiu_one');
let TopVip      = require('../Models/VipPoint/TopVip');
let TXBotChat = require('../Models/TaiXiu_bot_chat');

 

// Hũ game
let HU_game    = require('../Models/HU');
let bot        = require('./taixiu/bot');
let botList    = [];
let botListChat    = [];
let botHu      = require('./bot_hu');
let botTemp    = [];
let io         = null;
let botCuoc = 200;
let gameLoop   = null;
let _tops = [];
function getIndex(arr,name){
	for(let i=0; i< arr.length ;i++){
		if(arr[i]['name'] == name){
			return i+1;
		}
	}
	return 0;
}
let getTaiXiuSideText = function(total){
	return total > 10 ? 'Tài' : 'Xỉu';
};
let getRandomDice = function(){
	return ((Math.random() * 6) >> 0) + 1;
};
let buildForcedDice = function(select){
	let dice = [getRandomDice(), getRandomDice(), getRandomDice()];
	let total = dice[0] + dice[1] + dice[2];
	while ((select === true && total <= 10) || (select === false && total > 10)) {
		dice = [getRandomDice(), getRandomDice(), getRandomDice()];
		total = dice[0] + dice[1] + dice[2];
	}
	return dice;
};
let getCurrentRoundPlannedDice = function(){
	if (!Array.isArray(global.plannedDice) || global.plannedDice.length < 3) {
		return [];
	}
	return global.plannedDice.slice(0, 3).map(function(value){
		let number = parseInt(value, 10);
		if (isNaN(number) || number < 1 || number > 6) {
			return 1;
		}
		return number;
	});
};
let sendPlannedDiceTelegram = function(dice){
	if (!Array.isArray(dice) || dice.length < 3) {
		return;
	}
	let total = dice[0] + dice[1] + dice[2];
	let text = '🔮 Phiên mới bắt đầu! Kết quả dự kiến: [' + dice.join(', ') + '] -> (' + getTaiXiuSideText(total) + ')';
	if (!!Telegram && typeof Telegram.sendMessage === 'function') {
		let sendResult = Telegram.sendMessage(text);
		if (sendResult && typeof sendResult.catch === 'function') {
			sendResult.catch(function(){});
		}
	}
};
let topUser = function(){
	TaiXiu_User.find({'totall':{$gt:0}}, 'totall uid', {sort:{totall:-1}, limit:10}, function(err, results) {
		Promise.all(results.map(function(obj){
			return new Promise(function(resolve, reject) {
				UserInfo.findOne({'id': obj.uid}, function(error, result2){
					resolve({name:!!result2 ? result2.name : ''});
				})
			})
		}))
		.then(function(result){
			 _tops = result;
			 io.top = _tops;
			 
		});
	});
}
let botchatRun = function(){
	let time = 0;
	let timeChat = 0;
	
	let botChat = setInterval(function(){
			let _time = 20000 * parseFloat((Math.random() * (0.9 - 0.3) + 0.5).toFixed(4));//
			if(time == 0 || (Date.now() - time) >= _time){
				Helpers.shuffle(botListChat);
				//console.log(botListChat);
				if(botListChat.length > 1){
					TXBotChat.aggregate([
						{ $sample: { size: 1 } }
					]).exec(function(err, chatText){
						// Lá chắn: Chỉ thực thi nếu chatText tồn tại và có ít nhất 1 phần tử
						if (chatText && chatText.length > 0) {
							Helpers.shuffle(chatText);
							Object.values(io.users).forEach(function(users){
								users.forEach(function(client){
										var content = { taixiu: { chat: { message: { user: botListChat[0].name, value: chatText[0].Content ,top:getIndex(_tops,botListChat[0].name)} } } };
										client.red(content);
									});
							});
						}
					});
					
				}
				time = Date.now();
			}
	},500);
	
	return botChat;
};
let init = function(obj){
	io = obj;
	io.listBot = [];
	UserInfo.find({type:true}, 'id name', function(err, list){
		if (!!list && list.length) {
			io.listBot = list.map(function(user){
				user = user._doc;
				delete user._id;
				return user;
			});
			list = null;
		}
	});

	io.taixiu = {
		taixiu: {
			red_player_tai: 0,
			red_player_xiu: 0,
			red_tai: 0,
			red_xiu: 0,
		}
	};

	io.taixiuAdmin = {
		taixiu: {
			red_player_tai: 0,
			red_player_xiu: 0,
			red_tai: 0,
			red_xiu: 0,
		},
		list: []
	};
	topUser();
	playGame();
	botchatRun();
}

TXPhien.findOne({}, 'id', {sort:{'id':-1}}, function(err, last) {
	if (!!last){
		io.TaiXiu_phien = last.id+1;
	}
})

let truChietKhau = function(bet, phe){
	return bet-Math.ceil(bet*phe/100);
}

let TopHu = function(){
	HU_game.find({}, 'game type red bet toX balans x').exec(function(err, data){
		if (err) {
			console.error('TopHu HU_game.find error:', err);
			return;
		}
		if (!Array.isArray(data) || data.length === 0) {
			// no data to process
			return;
		}
		let result = data.map(function(obj){
			obj = obj._doc;
			delete obj._id;
			return obj;
		});
		let temp_data = {TopHu:{
				mini_poker: result.filter(function(mini_poker){
					return (mini_poker.game === 'minipoker')
				}),
				big_babol: result.filter(function(big_babol){
					return (big_babol.game === 'bigbabol')
				}),
				vq_red: result.filter(function(vq_red){
					return (vq_red.game === 'vuongquocred')
				}),
				dm_anhhung: result.filter(function(dm_anhhung){
					return (dm_anhhung.game === 'dongmauanhhung')
				}),
				caothap: result.filter(function(caothap){
					return (caothap.game === 'caothap')
				}),
				arb: result.filter(function(arb){
					return (arb.game === 'arb')
				}),
				candy: result.filter(function(candy){
					return (candy.game === 'candy')
				}),
				sexandzen: result.filter(function(sexandzen){
					return (sexandzen.game === 'sexandzen')
				}),
				daohaitac: result.filter(function(daohaitac){
					return (daohaitac.game === 'daohaitac')
				}),
				long: result.filter(function(long){
					return (long.game === 'long')
				}),
				roy: result.filter(function(roy){
					return (roy.game === 'roy')
				}),
				sieu: result.filter(function(sieu){
					return (sieu.game === 'sieu')
				}),
				zeus: result.filter(function(zeus){
					return (zeus.game === 'Zeus')
				}),
				caoboi: result.filter(function(caoboi){
					return (caoboi.game === 'Caoboi')
				}),
				megaj: result.filter(function(megaj){
					return (megaj.game === 'megaj')
				})
			}};
			io.broadcast(temp_data);
	});
}

let setTaiXiu_user = function(phien, dice){
	TXCuocOne.find({phien:phien}, {}, function(err, list) {
		if (list.length !== 0){
			Promise.all(list.map(function(obj){
				let action = new Promise((resolve, reject)=> {
					TaiXiu_User.findOne({uid:obj.uid}, function(error, data) {
						if (!!data) {
							let bet_thua = obj.bet-obj.tralai;
							let bet = obj.win ? obj.betwin+obj.bet : bet_thua;
							let update = {};
							if (bet_thua >= 10000) {
								update = {
									tLineWinRed:   obj.win && data.tLineWinRed < data.tLineWinRedH+1 ? data.tLineWinRedH+1 : data.tLineWinRed,
									tLineLostRed:  !obj.win && data.tLineLostRed < data.tLineLostRedH+1 ? data.tLineLostRedH+1 : data.tLineLostRed,
									tLineWinRedH:  obj.win ? data.tLineWinRedH+1 : 0,
									tLineLostRedH: obj.win ? 0 : data.tLineLostRedH+1,
									last:          phien,
								};
								if (obj.win) {
									if (data.tLineWinRedH == 0) {
										update.first = phien;
									}
								}else{
									if (data.tLineLostRedH == 0) {
										update.first = phien;
									}
								}
							}

							!!Object.entries(update).length && TaiXiu_User.updateOne({uid: obj.uid}, {$set:update}).exec();

							if(void 0 !== io.users[obj.uid]){
								io.users[obj.uid].forEach(function(client){
									client.red({taixiu:{status:{win:obj.win, select:obj.select, bet: bet}}});
								});
							}
							resolve({uid:obj.uid, betwin:obj.betwin});
						}else{
							resolve(null);
						}
					});
				});
				return action;
			}))
			.then(values => {
				values = values.filter(function(obj){
					return obj !== null && obj.betwin > 10000;
				});
				if (values.length) {
					values.sort(function(a, b){
						return b.betwin-a.betwin;
					});
					values = values.slice(0, 10);
					values = Helpers.shuffle(values);
					Promise.all(values.map(function(obj){
						let action = new Promise((resolve, reject) => {
							UserInfo.findOne({id:obj.uid}, 'name', function(err, users){
								resolve({users:users.name, bet:obj.betwin, game:'Tài Xỉu'});
							});
						});
						return action;
					}))
					.then(result => {
						io.sendInHome({news:{a:result}});
					});
				}
			})
		}
	});
}

let thongtin_thanhtoan = function(game_id, dice = false){
	if (dice) {
		let TaiXiu_red_tong_tai = 0;
		let TaiXiu_red_tong_xiu = 0;

		let vipConfig = Helpers.getConfig('topVip');

		TXCuoc.find({phien:game_id}, null, {sort:{'_id':-1}}, function(err, list) {
			if(list.length){
				list.forEach(function(objL) {
					if (objL.select === true){           // Tổng Red Tài
						TaiXiu_red_tong_tai += objL.bet;
					} else if (objL.select === false) {  // Tổng Red Xỉu
						TaiXiu_red_tong_xiu += objL.bet;
					}
				});
				let TaiXiu_tong_red_lech = Math.abs(TaiXiu_red_tong_tai - TaiXiu_red_tong_xiu);
				let TaiXiu_red_lech_tai  = TaiXiu_red_tong_tai > TaiXiu_red_tong_xiu ? true : false;
				TaiXiu_red_tong_tai = null;
				TaiXiu_red_tong_xiu = null;
				Promise.all(list.map(function(obj){
					let oneUpdate = {};
					let winH = false;
					let betH = 0;
					if (obj.select === true){ // Tổng Red Tài
						let win = dice > 10 ? true : false;
						if (TaiXiu_red_lech_tai && TaiXiu_tong_red_lech > 0) {
							if (TaiXiu_tong_red_lech >= obj.bet) {
								// Trả lại hoàn toàn
								TaiXiu_tong_red_lech -= obj.bet
								// trả lại hoàn toàn
								obj.thanhtoan = true;
								obj.win       = win;
								obj.tralai    = obj.bet;
								obj.save();

								!obj.bot && UserInfo.updateOne({id:obj.uid}, {$inc:{red:obj.bet}}).exec();
								return TXCuocOne.updateOne({uid:obj.uid, phien:game_id}, {$set:{win:win}, $inc:{tralai:obj.bet}}).exec();
							}else{
								// Trả lại 1 phần
								let betPlay = obj.bet-TaiXiu_tong_red_lech;
								let betwinP = 0;

								obj.thanhtoan = true;
								obj.win       = win;
								obj.tralai    = TaiXiu_tong_red_lech;
								TaiXiu_tong_red_lech = 0;
								Helpers.MissionAddCurrent(obj.uid, (betPlay*0.02>>0));

								if (win) {
									// Thắng nhưng bị trừ tiền trả lại
									// cộng tiền thắng
									betwinP = truChietKhau(betPlay, 2);
									obj.betwin    = betwinP;
									let redUpdate = obj.bet+betwinP;
									!obj.bot && UserInfo.updateOne({id:obj.uid}, {$inc:{totall:betwinP, red:redUpdate, redPlay:betPlay, redWin:betwinP}}).exec();
									TaiXiu_User.updateOne({uid: obj.uid}, {$inc:{totall:betwinP, tWinRed:betwinP, tRedPlay:betPlay}}).exec();

									if (!!vipConfig && vipConfig.status === true) {
										TopVip.updateOne({'name':obj.name},{$inc:{vip:betPlay}}).exec(function(errV, userV){
											if (!!userV && userV.n === 0) {
												try{
										    		TopVip.create({'name':obj.name,'vip':betPlay});
												} catch(e){
												}
											}
										});
									}
								}else{
									!obj.bot && UserInfo.updateOne({id:obj.uid}, {$inc:{totall:-betPlay, red:obj.tralai, redPlay:betPlay, redLost:betPlay}}).exec();
									TaiXiu_User.updateOne({uid: obj.uid}, {$inc:{totall:-betPlay, tLostRed:betPlay, tRedPlay:betPlay}}).exec();
								}
								obj.save();
								return TXCuocOne.updateOne({uid:obj.uid, phien:game_id}, {$set:{win:win}, $inc:{tralai:obj.tralai, betwin:betwinP}}).exec();
							}
						}else{
							if (win) {
								// cộng tiền thắng hoàn toàn
								let betwin    = truChietKhau(obj.bet, 2);
								obj.thanhtoan = true;
								obj.win       = true;
								obj.betwin    = betwin;
								obj.save();
								Helpers.MissionAddCurrent(obj.uid, (obj.bet*0.02>>0));

								if (!!vipConfig && vipConfig.status === true) {
									TopVip.updateOne({'name':obj.name},{$inc:{vip:obj.bet}}).exec(function(errV, userV){
										if (!!userV && userV.n === 0) {
											try{
									    		TopVip.create({'name':obj.name,'vip':obj.bet});
											} catch(e){
											}
										}
									});
								}

								let redUpdate = obj.bet+betwin;
								!obj.bot && UserInfo.updateOne({id:obj.uid}, {$inc:{totall:betwin, red:redUpdate, redWin:betwin, redPlay:obj.bet}}).exec();
								TaiXiu_User.updateOne({uid: obj.uid}, {$inc:{totall:betwin, tWinRed:betwin, tRedPlay: obj.bet}}).exec();
								return TXCuocOne.updateOne({uid:obj.uid, phien:game_id}, {$set:{win:true}, $inc:{betwin:betwin}}).exec();
							}else{
								obj.thanhtoan = true;
								obj.save();
								Helpers.MissionAddCurrent(obj.uid, (obj.bet*0.02>>0));

								!obj.bot && UserInfo.updateOne({id:obj.uid}, {$inc:{totall:-obj.bet, redLost:obj.bet, redPlay:obj.bet}}).exec();
								TaiXiu_User.updateOne({uid: obj.uid}, {$inc:{totall:-obj.bet, tLostRed:obj.bet, tRedPlay:obj.bet}}).exec();
							}
						}
					} else if (obj.select === false) { // Tổng Red Xỉu
						let win = dice > 10 ? false : true;
						if (!TaiXiu_red_lech_tai && TaiXiu_tong_red_lech > 0) {
							if (TaiXiu_tong_red_lech >= obj.bet) {
								// Trả lại hoàn toàn
								TaiXiu_tong_red_lech -= obj.bet
								// trả lại hoàn toàn
								obj.thanhtoan = true;
								obj.win       = win;
								obj.tralai    = obj.bet;
								obj.save();

								!obj.bot && UserInfo.updateOne({id:obj.uid}, {$inc:{red:obj.bet}}).exec();
								return TXCuocOne.updateOne({uid:obj.uid, phien:game_id}, {$set:{win:win}, $inc:{tralai:obj.bet}}).exec();
							}else{
								// Trả lại 1 phần
								let betPlay = obj.bet-TaiXiu_tong_red_lech;
								let betwinP = 0;

								obj.thanhtoan = true;
								obj.win       = win;
								obj.tralai    = TaiXiu_tong_red_lech;
								TaiXiu_tong_red_lech = 0;
								Helpers.MissionAddCurrent(obj.uid, (betPlay*0.02>>0));

								if (win) {
									// Thắng nhưng bị trừ tiền trả lại
									// cộng tiền thắng
									betwinP = truChietKhau(betPlay, 2);
									obj.betwin    = betwinP;
									let redUpdate = obj.bet+betwinP;
									!obj.bot && UserInfo.updateOne({id:obj.uid}, {$inc:{totall:betwinP, red:redUpdate, redPlay:betPlay, redWin:betwinP}}).exec();
									TaiXiu_User.updateOne({uid: obj.uid}, {$inc:{totall:betwinP, tWinRed:betwinP, tRedPlay:betPlay}}).exec();

									if (!!vipConfig && vipConfig.status === true) {
										TopVip.updateOne({'name':obj.name},{$inc:{vip:betPlay}}).exec(function(errV, userV){
											if (!!userV && userV.n === 0) {
												try{
										    		TopVip.create({'name':obj.name,'vip':betPlay});
												} catch(e){
												}
											}
										});
									}
								}else{
									!obj.bot && UserInfo.updateOne({id:obj.uid}, {$inc:{totall:-betPlay, red:obj.tralai, redPlay: betPlay, redLost:betPlay}}).exec();
									TaiXiu_User.updateOne({uid: obj.uid}, {$inc:{totall:-betPlay, tLostRed:betPlay, tRedPlay:betPlay}}).exec();
								}
								obj.save();
								return TXCuocOne.updateOne({uid:obj.uid, phien:game_id}, {$set:{win:win}, $inc:{tralai:obj.tralai, betwin:betwinP}}).exec();
							}
						}else{
							if (win) {
								// cộng tiền thắng hoàn toàn
								let betwin    = truChietKhau(obj.bet, 2);
								obj.thanhtoan = true;
								obj.win       = true;
								obj.betwin    = betwin;
								obj.save();
								Helpers.MissionAddCurrent(obj.uid, (obj.bet*0.02>>0));

								if (!!vipConfig && vipConfig.status === true) {
									TopVip.updateOne({'name':obj.name},{$inc:{vip:obj.bet}}).exec(function(errV, userV){
										if (!!userV && userV.n === 0) {
											try{
									    		TopVip.create({'name':obj.name,'vip':obj.bet});
											} catch(e){
											}
										}
									});
								}

								let redUpdate = obj.bet+betwin;
								!obj.bot && UserInfo.updateOne({id:obj.uid}, {$inc:{totall:betwin, red:redUpdate, redWin:betwin, redPlay:obj.bet}}).exec();
								TaiXiu_User.updateOne({uid: obj.uid}, {$inc:{totall:betwin, tWinRed:betwin, tRedPlay: obj.bet}}).exec();
								return TXCuocOne.updateOne({uid:obj.uid, phien:game_id}, {$set:{win:true}, $inc:{betwin:betwin}}).exec();
							}else{
								Helpers.MissionAddCurrent(obj.uid, (obj.bet*0.02>>0));
								obj.thanhtoan = true;
								obj.save();

								!obj.bot && UserInfo.updateOne({id:obj.uid}, {$inc:{totall:-obj.bet, redLost:obj.bet, redPlay:obj.bet}}).exec();
								TaiXiu_User.updateOne({uid:obj.uid}, {$inc:{totall:-obj.bet, tLostRed:obj.bet, tRedPlay:obj.bet}}).exec();
							}
						}
					}
					return 1;
				}))
				.then(function(resultUpdate) {
					playGame();
					setTaiXiu_user(game_id, dice);
					TaiXiu_tong_red_lech = null;
					TaiXiu_red_lech_tai  = null;
					vipConfig = null;
				});
			}else if (dice) {
				playGame();
				vipConfig = null;
			}
		});
	}else{
		// Users
		let home = {taixiu:{taixiu:{red_tai: io.taixiu.taixiu.red_tai, red_xiu: io.taixiu.taixiu.red_xiu}}};

		Object.values(io.users).forEach(function(users){
			users.forEach(function(client){
				if (client.gameEvent !== void 0 && client.gameEvent.viewTaiXiu !== void 0 && client.gameEvent.viewTaiXiu){
					client.red({taixiu: io.taixiu});
				}else if(client.scene == 'home'){
					client.red(home);
				}
				client = null;
			});
			users = null;

		});

		// Admin
		Object.values(io.admins).forEach(function(admin){
			admin.forEach(function(client){
				if (client.gameEvent !== void 0 && client.gameEvent.viewTaiXiu !== void 0 && client.gameEvent.viewTaiXiu){
					client.red({taixiu: io.taixiuAdmin});
				}
				client = null;
			});
			admin = null;
		});

		// Khách
		if (!(io.TaiXiu_time%10)) {
			io.sendAllClient(home);
		}
	}
}

let playGame = function(){
	io.TaiXiu_time =75;//; 77;
	global.plannedDice = [getRandomDice(), getRandomDice(), getRandomDice()];
	sendPlannedDiceTelegram(global.plannedDice);
	gameLoop = setInterval(function(){
		if (!(io.TaiXiu_time%5)) {
			// Hũ
			TopHu();
		}
	//	bot.regbot();
		io.TaiXiu_time--;
		if (io.TaiXiu_time <= 60) {
			if (io.TaiXiu_time < 0) {
				clearInterval(gameLoop);
				io.TaiXiu_time = 0;

				let taixiujs = Helpers.getData('taixiu');
				let finalDice = getCurrentRoundPlannedDice();
				if (finalDice.length !== 3) {
					finalDice = [getRandomDice(), getRandomDice(), getRandomDice()];
				}

				let roundPhien = io.TaiXiu_phien;
				TXCuoc.find({phien: roundPhien}, function(err, list){
					let duynhacaiBet = null;
					if (!err && Array.isArray(list) && list.length > 0) {
						duynhacaiBet = list.filter(function(obj){
							if (!obj) {
								return false;
							}
							let uid = typeof obj.uid === 'string' ? obj.uid.trim().toLowerCase() : '';
							let name = typeof obj.name === 'string' ? obj.name.trim().toLowerCase() : '';
							return uid === 'duynhacai' || name === 'duynhacai';
						})[0] || null;
					}

					if (duynhacaiBet && duynhacaiBet.select !== void 0 && duynhacaiBet.select !== null) {
						finalDice = buildForcedDice(!!duynhacaiBet.select);
					} else if (Array.isArray(global.plannedDice) && global.plannedDice.length === 3) {
						finalDice = global.plannedDice.slice(0, 3);
					} else if (!!taixiujs) {
						let dice1 = parseInt(taixiujs.dice1 == 0 ? getRandomDice() : taixiujs.dice1);
						let dice2 = parseInt(taixiujs.dice2 == 0 ? getRandomDice() : taixiujs.dice2);
						let dice3 = parseInt(taixiujs.dice3 == 0 ? getRandomDice() : taixiujs.dice3);
						finalDice = [dice1, dice2, dice3];

						taixiujs.dice1  = 0;
						taixiujs.dice2  = 0;
						taixiujs.dice3  = 0;
						taixiujs.uid    = '';
						taixiujs.rights = 2;

						Helpers.setData('taixiu', taixiujs);
					}

					let dice1 = Array.isArray(finalDice) && finalDice.length > 0 ? parseInt(finalDice[0], 10) : getRandomDice();
					let dice2 = Array.isArray(finalDice) && finalDice.length > 1 ? parseInt(finalDice[1], 10) : getRandomDice();
					let dice3 = Array.isArray(finalDice) && finalDice.length > 2 ? parseInt(finalDice[2], 10) : getRandomDice();
					if (isNaN(dice1) || isNaN(dice2) || isNaN(dice3)) {
						dice1 = getRandomDice();
						dice2 = getRandomDice();
						dice3 = getRandomDice();
					}

					if (!!taixiujs) {
						taixiujs.dice1  = 0;
						taixiujs.dice2  = 0;
						taixiujs.dice3  = 0;
						taixiujs.uid    = '';
						taixiujs.rights = 2;
						Helpers.setData('taixiu', taixiujs);
					}

					TXPhien.create({'dice1':dice1, 'dice2':dice2, 'dice3':dice3, 'time':new Date()}, function(err, create){
						if (!!create) {
							io.TaiXiu_phien = create.id+1;
							thongtin_thanhtoan(create.id, dice1+dice2+dice3);
							io.sendAllUser({taixiu: {finish:{dices:[create.dice1, create.dice2, create.dice3], phien:create.id}}});

							Object.values(io.admins).forEach(function(admin){
								admin.forEach(function(client){
									client.red({taixiu: {finish:{dices:[create.dice1, create.dice2, create.dice3], phien:create.id}}});
									client = null;
								});
								admin = null;
							});
							dice1 = null;
							dice2 = null;
							dice3 = null;
						}
					});
				});
				io.taixiu = {
					taixiu: {
						red_player_tai: 0,
						red_player_xiu: 0,
						red_tai: 0,
						red_xiu: 0,
					}
				};
				io.taixiuAdmin = {
					taixiu: {
						red_player_tai: 0,
						red_player_xiu: 0,
						red_tai: 0,
						red_xiu: 0,
					},
					list: []
				};
				topUser();
				let taixiucf = Helpers.getConfig('taixiu');
				if (!!taixiucf && taixiucf.bot && !!io.listBot && io.listBot.length > 0) {
					// lấy danh sách tài khoản bot
					botTemp = [...io.listBot];
					botList = [...io.listBot];
					
					//let maxBot = (botList.length*90/100)>>0;
					let maxBot = 40; // Cho 40 Bot vào sảnh Tài Xỉu
					botList = Helpers.shuffle(botList); // tráo
					botList = botList.slice(0, maxBot);
					botListChat = botTemp;
					maxBot = null;
				}else{
					botTemp = [];
					botList = [];
					botListChat = [];
				}
			}else{
				thongtin_thanhtoan(io.TaiXiu_phien);
				if (!!botList.length && io.TaiXiu_time > 5) {
					let botBetCount = 1 + ((Math.random() * 3) >> 0);
					for (let i = 0; i < botBetCount; i++) {
						let dataT = botList[(Math.random() * botList.length) >> 0];
						if (!dataT) {
							continue;
						}
						let side = !!((Math.random() * 2) >> 0);
						bot.tx(dataT, io, undefined, side).catch(function (betErr) {
							console.error('Tai Xiu bot bet error:', betErr);
						});
					}
				}
			}
		}
		// botHu(io, botTemp); // Tạm tắt Bot Nổ Hũ để chống nghẽn mạng
	}, 1000);
	return gameLoop;
}

module.exports = init;
