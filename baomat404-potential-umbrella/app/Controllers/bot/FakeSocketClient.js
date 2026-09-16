/**
 * FakeSocketClient.js
 * 
 * Giả mạo kết nối WebSocket của người chơi thật.
 * Lưu trữ thông tin tài khoản Bot và đóng vai trò là "listener" để bắt events từ server.
 */

class FakeSocketClient {
  constructor(botUserData) {
    // ==================== THÔNG TIN TÀI KHOẢN BOT ====================
    this.UID = botUserData._id.toString();           // ID MongoDB của bot
    this.profile = {
      name: botUserData.name || 'Bot_' + this.UID.slice(-6),
      avatar: botUserData.avatar || 'default_avatar.jpg',
      red: Number(botUserData.red) || 0
    };
    this.name = this.profile.name;
    this.balance = this.profile.red;                    // Số dư tài khoản
    
    // ==================== TRẠNG THÁI GAME ====================
    this.bacay = null;                               // Reference đến Player instance
    this.poker = null;                               // Reference đến Poker Player instance
    this.redT = process.redT;                          // Shared game state
    this.currentRoomInfo = {};                        // Lưu trữ info phòng cuối cùng nhận
    this.eventHandlers = [];                          // Danh sách callback lắng nghe events
    this.isThinking = false;                           // Khóa hành động cơ bản tránh bấm lặp

    if (this.redT && this.redT.users) {
      if (!this.redT.users[this.UID]) {
        this.redT.users[this.UID] = [];
      }
      this.redT.users[this.UID].push(this);
    }
    
    // ==================== STRATEGY INSTANCE ====================
    this.strategy = null;                            // BacayStrategy instance (gán sau)
  }

  /**
   * Hàm red(data) - CHÍNH YỀU
   * Server luôn gọi client.red(data) để gửi thông tin phòng/game.
   * Ở đây ta bắt được data và forward sang Strategy để xử lý.
   * 
   * Data nhận được thường có cấu trúc:
   * {
   *   infoRoom: {time, round, game, isPlay, ...},
   *   game: {listPlayer, chia_bai, btn_lat, ...},
   *   ingame: {...},
   *   ...
   * }
   */
  red(data) {
    if (!data) return;

    // Lưu trữ thông tin phòng mới nhất
    if (data.infoRoom) {
      this.currentRoomInfo = { ...this.currentRoomInfo, ...data.infoRoom };
    }

    // Chuyển data sang Strategy để xử lý logic
    if (this.strategy && typeof this.strategy.onReceiveData === 'function') {
      this.strategy.onReceiveData(data);
    } else {
      this.runBasicAction(data);
    }

    // Gọi các callback từ event handlers (nếu có)
    this.eventHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error('[FakeSocketClient] Error in event handler:', err.message);
      }
    });
  }

  runBasicAction(data) {
    if (this.isThinking) return;

    const pokerTurn = data.game && data.game.turn;
    const isPokerTurn = pokerTurn && this.poker && pokerTurn.ghe === this.poker.map;
    const isBacayFlip = this.bacay && this.bacay.room && this.bacay.room.game_round === 2 &&
      data.game && data.game.btn_lat;

    if (!isPokerTurn && !isBacayFlip) return;

    this.isThinking = true;
    const delay = 1500 + Math.floor(Math.random() * 1500);
    setTimeout(() => {
      try {
        if (isPokerTurn && this.poker && typeof this.poker.onTheo === 'function') {
          console.log(`[Bot AI] ${this.name} chọn Theo bài Poker`);
          this.poker.onTheo();
        } else if (isBacayFlip && this.bacay && typeof this.bacay.onLat === 'function') {
          console.log(`[Bot AI] ${this.name} lật bài Ba Cây`);
          this.bacay.onLat();
        }
      } catch (err) {
        console.error('[FakeSocketClient] Basic bot action failed:', err.message);
      } finally {
        this.isThinking = false;
      }
    }, delay);
  }

  /**
   * Gắn Strategy instance để nhận data từ hàm red()
   */
  attachStrategy(strategy) {
    if (!strategy) {
      throw new Error('[FakeSocketClient] Strategy cannot be null');
    }
    this.strategy = strategy;
    strategy.setClient(this);
  }

  /**
   * Lắng nghe event (tùy chọn, cho debug)
   */
  on(eventName, callback) {
    if (eventName === 'data' && typeof callback === 'function') {
      this.eventHandlers.push(callback);
    }
  }

  /**
   * Cập nhật số dư tài khoản
   */
  updateBalance(newBalance) {
    this.balance = Number(newBalance) || 0;
    this.profile.red = this.balance;
  }

  redUpdate(newBalance) {
    if (typeof newBalance === 'number') {
      this.updateBalance(newBalance);
    }
  }

  redT(newBalance) {
    if (typeof newBalance === 'number') {
      this.updateBalance(newBalance);
    }
  }

  /**
   * Cấp phát hành động (gọi trực tiếp vào function xử lý của Ba Cây)
   * Hàm này sẽ được gọi từ BacayStrategy khi bot cần thực hiện hành động
   */
  executeAction(actionType, payload) {
    if (!this.bacay && !this.poker) {
      console.warn('[FakeSocketClient] game instance not initialized');
      return;
    }

    try {
      switch (actionType) {
        case 'cuoc_chuong':
          // Gọi hàm cược Chương của Ba Cây
          if (typeof this.bacay.cuocChuong === 'function') {
            this.bacay.cuocChuong(payload.bet);
          }
          break;

        case 'cuoc_ga':
          // Gọi hàm cược Gà của Ba Cây
          if (typeof this.bacay.cuocGa === 'function') {
            this.bacay.cuocGa();
          }
          break;

        case 'lat_bai':
          // Gọi hàm lật bài của Ba Cây
          if (typeof this.bacay.onLat === 'function') {
            this.bacay.onLat();
          }
          break;

        case 'theo':
          if (typeof this.poker.onTheo === 'function') {
            this.poker.onTheo();
          }
          break;

        case 'to':
          if (typeof this.poker.onTo === 'function') {
            this.poker.onTo(payload && payload.amount);
          }
          break;

        case 'up':
          if (typeof this.poker.onHuy === 'function') {
            this.poker.onHuy();
          }
          break;

        default:
          console.warn('[FakeSocketClient] Unknown action type:', actionType);
      }
    } catch (err) {
      console.error('[FakeSocketClient] Error executing action:', actionType, err.message);
    }
  }

  /**
   * Debug: In ra trạng thái hiện tại
   */
  debug() {
    return {
      UID: this.UID,
      name: this.profile.name,
      balance: this.balance,
      roomInfo: this.currentRoomInfo,
      hasStrategy: !!this.strategy,
      hasBackay: !!this.bacay
    };
  }
}

module.exports = FakeSocketClient;
