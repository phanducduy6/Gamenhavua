
let TXCuoc = require('../../Models/TaiXiu_cuoc');
let TXCuocOne = require('../../Models/TaiXiu_one');
let TXChat = require('../../Models/TaiXiu_chat');
let TXBotChat = require('../../Models/TaiXiu_bot_chat');

let User = require('../../Models/Users');
let UserInfo = require('../../Models/UserInfo');
let helpers = require('../../Helpers/Helpers');
var validator = require('validator');
var shortid = require('shortid');
var fs = require('fs');

// Game User
let TaiXiu_User = require('../../Models/TaiXiu_user');
let MiniPoker_User = require('../../Models/miniPoker/miniPoker_users');
let Bigbabol_User = require('../../Models/BigBabol/BigBabol_users');
let VQRed_User = require('../../Models/VuongQuocRed/VuongQuocRed_users');
let DMAnhung_User = require('../../Models/DongMauAnhhung/DongMauAnhhung_users');
let BauCua_User = require('../../Models/BauCua/BauCua_user');
let Mini3Cay_User = require('../../Models/Mini3Cay/Mini3Cay_user');
let CaoThap_User = require('../../Models/CaoThap/CaoThap_user');
let AngryBirds_user = require('../../Models/AngryBirds/AngryBirds_user');
let Candy_user = require('../../Models/Candy/Candy_user');
let Sexandzen_user = require('../../Models/Sexandzen/Sexandzen_user');
let Daohaitac_user = require('../../Models/Daohaitac/Daohaitac_user');
let LongLan_user = require('../../Models/LongLan/LongLan_user');
//let ThuongHai_user    = require('../../Models/ThuongHai/ThuongHai_user');
let RoyAl_user = require('../../Models/RoyAl/RoyAl_user');
let SieuXe_user = require('../../Models/SieuXe/SieuXe_user');
let Zeus_user = require('../../Models/Zeus/Zeus_user');
let Caoboi_user = require('../../Models/Caoboi/Caoboi_user');
let XocXoc_user = require('../../Models/XocXoc/XocXoc_user');
let MegaJP_user = require('../../Models/MegaJP/MegaJP_user');
let RongHo_user = require('../../Models/RongHo/RongHo_user');
/**
 * Ngẫu nhiên cược
 * return {number}
*/
let random = function () {
	return Math.floor(Math.random() * 4900000001) + 100000000;
};

/**
 * Cược
*/
// Tài Xỉu RED
let tx = function (bot, io, amount, side) {
	let cuoc = amount === undefined ? random() : amount;
	let select = side === undefined ? !!((Math.random() * 2) >> 0) : side;
	return UserInfo.findOneAndUpdate(
		{id: bot.id, type: true, red: {$gte: cuoc}},
		{$inc: {red: -cuoc}},
		{new: true}
	).exec().then(function (user) {
		if (!user) {
			return false;
		}

		if (select) {
			io.taixiu.taixiu.red_tai += cuoc;
			io.taixiu.taixiu.red_player_tai += 1;
			console.log('bot đã cược tài');
		} else {
			io.taixiu.taixiu.red_xiu += cuoc;
			io.taixiu.taixiu.red_player_xiu += 1;
			console.log('bot đã cược xĩu');
		}

		return Promise.all([
			TXCuocOne.create({uid: bot.id, phien: io.TaiXiu_phien, taixiu: true, red: true, select: select, bet: cuoc}),
			TXCuoc.create({uid: bot.id, bot: true, name: bot.name, phien: io.TaiXiu_phien, bet: cuoc, taixiu: true, red: true, select: select, time: new Date()})
		]).then(function () {
			return true;
		});
	});
};

let balance = function (io, amount, side) {
	return UserInfo.find({type: true, red: {$gte: amount}}, 'id name').exec().then(function (bots) {
		if (!bots.length) {
			return false;
		}
		let selectedBot = bots[(Math.random() * bots.length) >> 0];
		return tx(selectedBot, io, amount, side);
	});
};
let regbot = function () {
	var username = 'nohu' + helpers.RandomUserName(5) + helpers.RandomUserName(1);
	var name = 'nohu' + helpers.RandomUserName(1) + helpers.RandomUserName(2) + helpers.RandomUserName(3);
	User.create({ 'local.username': username, 'local.password': helpers.generateHash(username), 'local.regDate': new Date() }, function (err, user) {
		if (!!user) {
			var bot_uid = user._id.toString();
			UserInfo.create({ 'id': bot_uid, 'name': name, 'type': true, 'joinedOn': new Date() }, function (errC, userB) {
				if (!!errC) {
					console.log('reg fail name: ' + name);
				} else {
					userB = userB._doc;
					userB.level = 1;
					userB.vipNext = 100;
					userB.vipHT = 0;
					userB.phone = '';

					delete userB._id;
					delete userB.redWin;
					delete userB.redLost;
					delete userB.redPlay;
					delete userB.xuWin;
					delete userB.xuLost;
					delete userB.xuPlay;
					delete userB.thuong;
					delete userB.vip;
					delete userB.hu;
					delete userB.huXu;

					TaiXiu_User.create({ 'uid': bot_uid });

					MiniPoker_User.create({ 'uid': bot_uid });
					Bigbabol_User.create({ 'uid': bot_uid });
					VQRed_User.create({ 'uid': bot_uid });
					DMAnhung_User.create({ 'uid': bot_uid });
					BauCua_User.create({ 'uid': bot_uid });
					Mini3Cay_User.create({ 'uid': bot_uid });
					CaoThap_User.create({ 'uid': bot_uid });
					AngryBirds_user.create({ 'uid': bot_uid });
					RongHo_user.create({ 'uid': bot_uid });
					Candy_user.create({ 'uid': bot_uid });
					Sexandzen_user.create({ 'uid': bot_uid });
					Daohaitac_user.create({ 'uid': bot_uid });
					LongLan_user.create({ 'uid': bot_uid });
					//	ThuongHai_user.create({'uid': bot_uid});
					RoyAl_user.create({ 'uid': bot_uid });
					SieuXe_user.create({ 'uid': bot_uid });
					Zeus_user.create({ 'uid': bot_uid });
					Caoboi_user.create({ 'uid': bot_uid });
					XocXoc_user.create({ 'uid': bot_uid });
					MegaJP_user.create({ 'uid': bot_uid });

					TXBotChat.create({ 'Content': bot_uid });

					console.log('reg suss name: ' + name);

				}
			});
			console.log('reg suss acc: ' + username);
		} else {
			console.log('reg fail acc: ' + username);
		}
	});

};

module.exports = {
	tx: tx,
	balance: balance,
	//cl: cl,
	regbot: regbot,
}