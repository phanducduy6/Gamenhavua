/**
 * botGameManager.js
 * 
 * Quản lý Bot cho các game bài (Ba Cây, Poker, ...)
 * 
 * Luồng chạy chung:
 * 1. Bốc 1 con bot đủ tiền từ MongoDB
 * 2. Khởi tạo FakeSocketClient cho bot
 * 3. Gắn Strategy tương ứng vào FakeSocketClient
 * 4. Gọi reg(client, data) để đăng ký
 * 5. Gọi ingame(client) để nhét bot vào phòng
 */

const FakeSocketClient = require('./FakeSocketClient');
const BacayStrategy = require('./strategies/BacayStrategy');
const PokerStrategy = require('./strategies/PokerStrategy');

// Import các hàm xử lý Poker
const regPoker = require('../game/poker/reg');

// Import Models
const UserInfo = require('../../Models/UserInfo');

class BotGameManager {
  /**
   * Spawn bot vào phòng Ba Cây
   * 
   * @param {number} roomBet - Mức cược của phòng (100, 200, 500, 1000, ...)
   * @param {object} config - Cấu hình AI: {difficulty, aggressiveness}
   * @returns {Promise<Object>} - {success, botClient, message}
   */
  static async spawnBotForBaCay(roomBet, config = {}) {
    try {
      const regBaCay = require('../game/BaCay/reg');
      const ingameBaCay = require('../game/BaCay/ingame');

      console.log(`[BotGameManager] Spawning bot for Ba Cay room (bet: ${roomBet})`);

      // ==================== BƯỚC 1: TÌM BOT ĐỦ TIỀN ====================
      const botUser = await this.findAvailableBot(roomBet);
       
      if (!botUser) {
        console.warn('[BotGameManager] No available bot found');
        return {
          success: false,
          message: 'No available bot with sufficient balance',
          botClient: null
        };
      }

      console.log("Kết quả tìm bot đủ tiền:", botUser);
      console.log(`[BotGameManager] Found bot: ${botUser.name} (UID: ${botUser.id}, balance: ${botUser.red})`);

      // ==================== BƯỚC 2: TẠO FAKE SOCKET CLIENT ====================
      const fakeClient = new FakeSocketClient({
        _id: botUser.id,
        name: botUser.name,
        avatar: botUser.avatar || 'default.jpg',
        red: botUser.red
      });

      // ==================== BƯỚC 3: GẮN STRATEGY VÀO CLIENT ====================
      const strategy = new BacayStrategy({
        difficulty: config.difficulty || 'medium',
        aggressiveness: config.aggressiveness || 0.5
      });
      fakeClient.attachStrategy(strategy);

      console.log('[BotGameManager] Strategy attached to client');

      // ==================== BƯỚC 4: ĐĂNG KÝ VÀO PHÒNG ====================
      // Gọi reg(client, room) để tạo Player instance
      regBaCay(fakeClient, roomBet);

      // Kiểm tra xem reg có thành công không (client.bacay sẽ được gán)
      if (!fakeClient.bacay) {
        console.warn('[BotGameManager] Bot registration failed');
        return {
          success: false,
          message: 'Failed to register bot to room',
          botClient: fakeClient
        };
      }

      console.log('[BotGameManager] Bot registered successfully');

      // ==================== BƯỚC 5: VÀO PHÒNG CHƠI ====================
      // Gọi ingame(client) để nhét bot vào phòng
      ingameBaCay(fakeClient);

      console.log('[BotGameManager] Bot entered game room');

      // ==================== RETURN KẾT QUẢ ====================
      return {
        success: true,
        botClient: fakeClient,
        message: `Bot ${botUser.name} successfully spawned`,
        botInfo: {
          uid: botUser.id,
          name: botUser.name,
          balance: botUser.red,
          room: roomBet,
          difficulty: config.difficulty || 'medium'
        }
      };

    } catch (error) {
      console.error('[BotGameManager] Error spawning bot:', error.message);
      return {
        success: false,
        message: error.message,
        botClient: null
      };
    }
  }

  /**
   * Tìm bot đủ tiền từ MongoDB
   * 
   * Bot phải:
   * - Có type = true (là bot)
   * - Có red >= roomBet * 4 (đủ tiền cấu thành)
   * - Chưa đang chơi game nào
   * 
   * @param {number} roomBet - Mức cược cần thiết
   * @returns {Promise<Object|null>} - Bot user object hoặc null
   */
  static async findAvailableBot(roomBet) {
    return new Promise((resolve) => {
      const minBalance = roomBet * 4; // Ba Cây yêu cầu tối thiểu 4x mức cược

      // Tìm bot trong UserInfo
      UserInfo.findOne(
        {
          type: true,                      // type=true = bot
          red: { $gte: minBalance }        // đủ tiền
        },
        'id name avatar red'
      ).exec((err, user) => {
        if (err) {
          console.error('[BotGameManager] Database error:', err.message);
          resolve(null);
          return;
        }

        if (!user) {
          console.warn(`[BotGameManager] No bot found with balance >= ${minBalance}`);
          resolve(null);
          return;
        }

        // Kiểm tra xem bot có đang chơi không
        if (process.redT && process.redT.game && process.redT.game.bacay) {
          const botInGame = process.redT.game.bacay.player[user.id];
          if (botInGame && botInGame.room) {
            console.log(`[BotGameManager] Bot ${user.id} is already in game, skipping`);
            // Tìm bot khác
            UserInfo.findOne(
              {
                type: true,
                red: { $gte: minBalance },
                id: { $ne: user.id }
              },
              'id name avatar red'
            ).exec((err2, user2) => {
              resolve(err2 ? null : user2);
            });
            return;
          }
        }

        resolve(user);
      });
    });
  }

  /**
   * Loại bỏ bot khỏi phòng & dọn dẹp
   * 
   * @param {FakeSocketClient} botClient - Bot client instance
   */
  static removeBotFromRoom(botClient) {
    if (!botClient) return;

    try {
      console.log(`[BotGameManager] Removing bot ${botClient.profile.name}`);

      // Dọn dẹp strategy timers
      if (botClient.strategy && typeof botClient.strategy.cleanup === 'function') {
        botClient.strategy.cleanup();
      }

      // Hủy liên kết
      if (botClient.bacay) {
        botClient.bacay.outGame(true);
        botClient.bacay = null;
      }

      console.log('[BotGameManager] Bot removed successfully');
    } catch (err) {
      console.error('[BotGameManager] Error removing bot:', err.message);
    }
  }

  /**
   * Debug: Lấy info về bot hiện tại
   * 
   * @param {FakeSocketClient} botClient - Bot client instance
   * @returns {object}
   */
  static getBotDebugInfo(botClient) {
    if (!botClient) return null;

    return {
      client: botClient.debug(),
      strategy: botClient.strategy ? botClient.strategy.debug() : null,
      bacay: botClient.bacay ? {
        isPlay: botClient.bacay.isPlay,
        map: botClient.bacay.map,
        betChuong: botClient.bacay.betChuong,
        betGa: botClient.bacay.betGa,
        point: botClient.bacay.point,
        card: botClient.bacay.card ? botClient.bacay.card.length : 0
      } : null
    };
  }

  /**
   * ==================== POKER ====================
   * Spawn bot vào phòng Poker
   * 
   * @param {number} roomBet - Mức cược của phòng
   * @param {object} config - Cấu hình AI: {difficulty, aggressiveness}
   * @returns {Promise<Object>} - {success, botClient, message}
   */
  static async spawnBotForPoker(roomBet, config = {}) {
    try {
      console.log(`[BotGameManager] Spawning bot for Poker room (bet: ${roomBet})`);

      // ==================== BƯỚC 1: TÌM BOT ĐỦ TIỀN ====================
      const botUser = await this.findAvailableBot(roomBet);
      
      if (!botUser) {
        console.warn('[BotGameManager] No available bot found for Poker');
        return {
          success: false,
          message: 'No available bot with sufficient balance for Poker',
          botClient: null
        };
      }

      console.log(`[BotGameManager] Found bot for Poker: ${botUser.name} (UID: ${botUser.id}, balance: ${botUser.red})`);

      // ==================== BƯỚC 2: TẠO FAKE SOCKET CLIENT ====================
      const fakeClient = new FakeSocketClient({
        _id: botUser.id,
        name: botUser.name,
        avatar: botUser.avatar,
        red: botUser.red
      });

      // ==================== BƯỚC 3: GẮN POKER STRATEGY ====================
      const strategy = new PokerStrategy({
        difficulty: config.difficulty || 'medium',
        aggressiveness: config.aggressiveness !== undefined ? config.aggressiveness : 0.5
      });

      fakeClient.attachStrategy(strategy);
      console.log('[BotGameManager] PokerStrategy attached to FakeSocketClient');

      // ==================== BƯỚC 4: ĐĂNG KÝ PLAYER ====================
      // Gọi reg() để tạo Player object và khởi tạo trạng thái
      regPoker(fakeClient, {room: roomBet, balans: botUser.red, auto: false});
      for (let attempt = 0; attempt < 20 && !fakeClient.poker; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      if (!fakeClient.poker) {
        throw new Error('Failed to register bot in Poker');
      }
      console.log('[BotGameManager] Bot registered in Poker');

      // ==================== BƯỚC 5: NHÉT BOT VÀO PHÒNG ====================
      const ingamePoker = require('../game/poker/ingame');
      ingamePoker(fakeClient);
      console.log('[BotGameManager] Bot entered Poker game');

      return {
        success: true,
        message: 'Bot spawned successfully for Poker',
        botClient: fakeClient
      };

    } catch (err) {
      console.error('[BotGameManager] Error spawning Poker bot:', err.message);
      return {
        success: false,
        message: `Error: ${err.message}`,
        botClient: null
      };
    }
  }

  static async spawnBotForTienLen(roomBet, config = {}) {
    try {
      console.log('Đã gọi Bot Tiến Lên');
      return {
        success: true,
        message: 'Đã gọi Bot Tiến Lên',
        botClient: null,
        roomBet: roomBet,
        config: config
      };
    } catch (err) {
      console.error('[BotGameManager] Error in spawnBotForTienLen:', err.message);
      return {
        success: false,
        message: err.message,
        botClient: null
      };
    }
  }

  static async spawnBotForLieng(roomBet, config = {}) {
    try {
      console.log('Đã gọi Bot Liêng');
      return {
        success: true,
        message: 'Đã gọi Bot Liêng',
        botClient: null,
        roomBet: roomBet,
        config: config
      };
    } catch (err) {
      console.error('[BotGameManager] Error in spawnBotForLieng:', err.message);
      return {
        success: false,
        message: err.message,
        botClient: null
      };
    }
  }

  static async spawnBotForPhom(roomBet, config = {}) {
    try {
      console.log('Đã gọi Bot Phỏm');
      return {
        success: true,
        message: 'Đã gọi Bot Phỏm',
        botClient: null,
        roomBet: roomBet,
        config: config
      };
    } catch (err) {
      console.error('[BotGameManager] Error in spawnBotForPhom:', err.message);
      return {
        success: false,
        message: err.message,
        botClient: null
      };
    }
  }

  static async spawnBotForRongHo(roomBet, config = {}) {
    try {
      console.log('Đã gọi Bot Rong Hổ');
      return {
        success: true,
        message: 'Đã gọi Bot Rong Hổ',
        botClient: null,
        roomBet: roomBet,
        config: config
      };
    } catch (err) {
      console.error('[BotGameManager] Error in spawnBotForRongHo:', err.message);
      return {
        success: false,
        message: err.message,
        botClient: null
      };
    }
  }

  static async spawnBotForXocXoc(roomBet, config = {}) {
    try {
      console.log('Đã gọi Bot Xóc Đĩa');
      return {
        success: true,
        message: 'Đã gọi Bot Xóc Đĩa',
        botClient: null,
        roomBet: roomBet,
        config: config
      };
    } catch (err) {
      console.error('[BotGameManager] Error in spawnBotForXocXoc:', err.message);
      return {
        success: false,
        message: err.message,
        botClient: null
      };
    }
  }
}

module.exports = BotGameManager;
