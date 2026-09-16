let validator = require('validator');
let User      = require('./app/Models/Users');
let UserInfo  = require('./app/Models/UserInfo');
let helpers   = require('./app/Helpers/Helpers');
let TelegramAuth = require('./app/Helpers/TelegramAuth');
let socket    = require('./app/socket.js');
let captcha   = require('./captcha');
let forgotpass = require('./app/Controllers/user/for_got_pass');

// Authenticate!
let authenticate = function(client, data, callback) {
	if (!!data){
		if (!!data.initData) {
			let tgUser = TelegramAuth.verifyTelegramWebAppData(data.initData);
			if (!tgUser || tgUser.id === undefined || tgUser.id === null) {
				callback({title:'LỖI', text:'Xác thực Telegram thất bại!'}, false);
				return void 0;
			}

			let telegramId = tgUser.id.toString();
			User.findOne({'telegram.id':telegramId}, function(err, user){
				if (err) {
					console.error('Lỗi truy vấn DB:', err);
					callback({title:'LỖI', text:'Không thể xác thực tài khoản.'}, false);
					return void 0;
				}
				if (user) {
					if (user.lock === true || user.local.ban_login) {
						callback({title:'CẤM', text:'Tài khoản bị vô hiệu hóa.'}, false);
						return void 0;
					}
					client.UID = user._id.toString();
					console.log(`[Telegram] Đăng nhập thành công: ${tgUser.first_name || telegramId}`);
					callback(false, true);
					return void 0;
				}

				let username = 'tg' + telegramId;
				let password = helpers.generateHash(require('crypto').randomBytes(32).toString('hex'));
				User.create({
					'local.username': username,
					'local.password': password,
					'local.regDate': new Date(),
					telegram: {id: telegramId, username: tgUser.username || ''}
				}, function(createErr, newUser){
					if (createErr || !newUser) {
						console.error('Lỗi tạo tài khoản Telegram:', createErr);
						callback({title:'LỖI', text:'Không thể tạo tài khoản Telegram.'}, false);
						return void 0;
					}
					UserInfo.create({
						id: newUser._id.toString(),
						name: username
					}, function(infoErr){
						if (infoErr) {
							console.error('Lỗi tạo thông tin tài khoản Telegram:', infoErr);
							User.deleteOne({_id:newUser._id}).exec();
							callback({title:'LỖI', text:'Không thể tạo thông tin tài khoản Telegram.'}, false);
							return void 0;
						}
						client.UID = newUser._id.toString();
						console.log(`[Telegram] Bắt đầu tạo tài khoản mới cho: ${tgUser.first_name || telegramId}`);
						callback(false, true);
					});
				});
			});
			return void 0;
		}

		let token = data.token;
		if (!!token && !!data.id) {
			let id = data.id>>0;
			UserInfo.findOne({'UID':id}, 'id', function(err, userI){
				if (!!userI) {
					User.findOne({'_id':userI.id}, 'local fail lock', function(err, userToken){
						if (!!userToken) {
							if (userToken.lock === true) {
								callback({title:'CẤM', text:'Tài khoản bị vô hiệu hóa.'}, false);
								return void 0;
							}
							if (void 0 !== userToken.fail && userToken.fail > 3) {
								callback({title:'THÔNG BÁO', text: 'Vui lòng đăng nhập !!'}, false);
								userToken.fail  = userToken.fail>>0;
								userToken.fail += 1;
								userToken.save();
							}else{
								if (userToken.local.token === token) {
									userToken.fail = 0;
									userToken.save();
									client.UID = userToken._id.toString();
									callback(false, true);
								}else{
									callback({title:'THẤT BẠI', text:'Bạn hoặc ai đó đã đăng nhập trên 1 thiết bị khác !!'}, false);
								}
							}
						}else{
							callback({title:'THẤT BẠI', text: 'Truy cập bị từ chối !!'}, false);
						}
					});
				}else{
					callback({title:'THẤT BẠI', text:'Truy cập bị từ chối !!'}, false);
				}
			});
		} else if(!!data.username && !!data.password){
			let username = ''+data.username+'';
			let password = ''+data.password+'';
			let captcha  = data.captcha;
			let register = !!data.register;
			let az09     = new RegExp('^[a-zA-Z0-9]+$');
			let testName = az09.test(username);

			if (!validator.isLength(username, {min: 3, max: 32})) {
				register && client.c_captcha('signUp');
				callback({title: register ? 'ĐĂNG KÝ' : 'ĐĂNG NHẬP', text: 'Tài khoản (3-32 kí tự).'}, false);
			}else if (!validator.isLength(password, {min: 6, max: 32})) {
				register && client.c_captcha('signUp');
				callback({title: register ? 'ĐĂNG KÝ' : 'ĐĂNG NHẬP', text: 'Mật khẩu (6-32 kí tự)'}, false);
			}else if (!testName) {
				register && client.c_captcha('signUp');
				callback({title: register ? 'ĐĂNG KÝ' : 'ĐĂNG NHẬP', text: 'Tên đăng nhập chỉ gồm kí tự và số !!'}, false);
			}else if (username === password) {
				register && client.c_captcha('signUp');
				callback({title: register ? 'ĐĂNG KÝ' : 'ĐĂNG NHẬP', text: 'Tài khoản không được trùng với mật khẩu!!'}, false);
			}else{
				try {
					username = username.toLowerCase();
					// Đăng Ký
					if (register) {
						if (!client.c_captcha) {
							client.c_captcha('signUp');
							callback({title: 'ĐĂNG KÝ', text: 'Captcha không tồn tại.'}, false);
						}else{
							let checkCaptcha = new RegExp();
							checkCaptcha     = checkCaptcha.test(captcha);
							if (checkCaptcha) {
								User.findOne({'local.username':username}).exec(function(err, check){
									if (!!check){
										client.c_captcha('signUp');
										callback({title: 'ĐĂNG KÝ', text: 'Tên tài khoản đã tồn tại !!'}, false);
									}else{
										User.create({'local.username':username, 'local.password':helpers.generateHash(password), 'local.regDate': new Date()}, function(err, user){
											if (!!user){
												client.UID = user._id.toString();
												callback(false, true);
											}else{
												client.c_captcha('signUp');
												callback({title: 'ĐĂNG KÝ', text: 'Tên tài khoản đã tồn tại !!'}, false);
											}
										});
									}
								});
							}else{
								client.c_captcha('signUp');
								callback({title: 'ĐĂNG KÝ', text: 'Captcha không đúng.'}, false);
							}
						}
					} else {
						// Đăng Nhập
						User.findOne({'local.username':username}, function(err, user){
							if (user){
								if (user.lock === true) {
									callback({title:'CẤM', text:'Tài khoản bị vô hiệu hóa.'}, false);
									return void 0;
								}
								if (void 0 !== user.fail && user.fail > 3) {
									if (!captcha || !client.c_captcha) {
										client.c_captcha('signIn');
										callback({title:'ĐĂNG NHẬP', text:'Phát hiện truy cập trái phép, vui lòng nhập captcha để tiếp tục.'}, false);
									}else{
										let checkCLogin = new RegExp('^' + client.captcha + '$', 'i');
										checkCLogin     = checkCLogin.test(captcha);
										if (checkCLogin) {
											if (user.validPassword(password)){
												user.fail = 0;
												user.save();
												client.UID = user._id.toString();
												callback(false, true);
												global['userOnline']++;
											}else{
												client.c_captcha('signIn');
												user.fail += 1;
												user.save();
												callback({title: 'ĐĂNG NHẬP', text: 'Mật khẩu không chính xác!!'}, false);
											}
										}else{
											user.fail += 1;
											user.save();
											client.c_captcha('signIn');
											callback({title: 'ĐĂNG NHẬP', text: 'Captcha không đúng...'}, false);
										}
									}
								}else{
									if (user.validPassword(password)){
									if(!user.local.ban_login){
										user.fail = 0;
										user.save();
										client.UID = user._id.toString();
										callback(false, true);
									}else{
										callback({title: 'ĐĂNG NHẬP', text: 'Tài khoản bị khoá. Vui lòng liên hệ CSKH để được hỗ trợ'}, false);
									}
									}else{
										user.fail  = user.fail>>0;
										user.fail += 1;
										user.save();
										callback({title: 'ĐĂNG NHẬP', text: 'Mật khẩu không chính xác!!'}, false);
									}
								}
							}else{
								callback({title: 'ĐĂNG NHẬP', text: 'Tên Tài Khoản không tồn tại!!'}, false);
							}
						});
					}
				} catch (error) {
					callback({title: 'THÔNG BÁO', text: 'Có lỗi xảy ra, vui lòng kiểm tra lại!!'}, false);
				}
			}
		}
	}
};

module.exports = function(ws, redT){
	ws.auth      = false;
	ws.UID       = null;
	ws.captcha   = {};
	ws.c_captcha = captcha;
	ws.red = function(data){
		try {
			this.readyState == 1 && this.send(JSON.stringify(data));
		} catch(err) {}
	}
	socket.signMethod(ws);
	ws.on('message', function(message) {
		try {
			if (!!message) {
				message = JSON.parse(message);
				if (!!message.captcha) {
					this.c_captcha(message.captcha);
				}
				if (!!message.forgotpass) {
					forgotpass(this, message.forgotpass);
				}
				if (this.auth == false && !!message.authentication) {
					authenticate(this, message.authentication, function(err, success){
						if (success) {
							this.auth = true;
							this.redT = redT;
							socket.auth(this);
							redT = null;
						} else if (!!err) {
							this.red({unauth: err});
							//this.close();
						} else {
							this.red({unauth: {message:'Authentication failure'}});
							//this.close();
						}
					}.bind(this));
				}else if(!!this.auth){
					socket.message(this, message);
				}
			}
		} catch (error) {
		}
	});
	ws.on('close', function(message) {
		if (this.UID !== null && void 0 !== this.redT.users[this.UID]) {
			if (this.redT.users[this.UID].length === 1 && this.redT.users[this.UID][0] === this) {
				delete this.redT.users[this.UID];
			}else{
				var self = this;
				this.redT.users[this.UID].forEach(function(obj, index){
					if (obj === self) {
						self.redT.users[self.UID].splice(index, 1);
					}
				});
			}
		}
		this.auth = false;
		void 0 !== this.TTClear && this.TTClear();
		global['userOnline'] = global['userOnline']--;
	});
}
