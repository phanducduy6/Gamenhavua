/**
 * BacayStrategy.js
 * 
 * Bộ não AI cho game Ba Cây.
 * Nhận data từ FakeSocketClient, xử lý logic theo từng Round/Phase của game.
 * 
 * Round 1: Đặt cược (15 giây) - Bot đặt cược sau 2-5s random
 * Round 2: Chia/Lật bài (12 giây) - Bot lật bài sau 1-3s random
 * Round 3: Tính điểm & kết thúc
 */

class BacayStrategy {
  constructor(config = {}) {
    // ==================== CẤU HÌNH AI ====================
    this.difficulty = config.difficulty || 'medium'; // easy, medium, hard
    this.aggressiveness = config.aggressiveness || 0.5; // 0-1, mức độ cược cao
    
    // ==================== TRẠNG THÁI ====================
    this.client = null;                              // FakeSocketClient reference
    this.lastRound = 0;                              // Round trước đó
    this.actionInProgress = false;                   // Đang chờ action execute
    this.pendingTimers = [];                         // Lưu timeout IDs để cleanup
  }

  /**
   * Gắn FakeSocketClient instance
   */
  setClient(client) {
    this.client = client;
  }

  /**
   * MAIN ENTRY POINT: Nhận data từ server (qua FakeSocketClient.red())
   */
  onReceiveData(data) {
    if (!data) return;

    // Kiểm tra nếu có thông tin phòng
    if (data.infoRoom) {
      const round = data.infoRoom.round;
      const time = data.infoRoom.time;

      // ROUND 1: Đặt cược
      if (round === 1) {
        this.handleRound1(data, time);
      }

      // ROUND 2: Chia/Lật bài
      else if (round === 2) {
        this.handleRound2(data, time);
      }

      // ROUND 3: Kết thúc ván
      else if (round === 3) {
        this.handleRound3(data);
      }
    }

    // Kiểm tra thông tin người chơi (nhận bài, điểm, v.v.)
    if (data.game) {
      this.handleGameData(data.game);
    }

    // Kiểm tra thông tin phòng (ai ngồi, ai thoát, v.v.)
    if (data.ingame) {
      this.handleInGameData(data.ingame);
    }
  }

  /**
   * ================== ROUND 1: ĐẶT CƯỢC ==================
   */
  handleRound1(data, timeRemaining) {
    // Bot chỉ đặt cược 1 lần mỗi round
    if (this.lastRound === 1 || this.actionInProgress) {
      return;
    }

    this.lastRound = 1;
    this.actionInProgress = true;

    // Random delay: 2-5 giây để trông tự nhiên hơn
    const delayMs = this.randomDelay(2000, 5000);

    const timerId = setTimeout(() => {
      this.executeBettingAction();
      this.actionInProgress = false;
    }, delayMs);

    this.pendingTimers.push(timerId);

    console.log(`[BacayStrategy] Round 1 detected. Will bet in ${(delayMs / 1000).toFixed(1)}s`);
  }

  /**
   * Logic xác định mức cược cho Bot
   * Dựa vào:
   * - Mức cược của phòng (this.client.bacay.game)
   * - Số dư tài khoản
   * - Độ khó AI (difficulty)
   * - Mức độ tham lam (aggressiveness)
   */
  executeBettingAction() {
    if (!this.client || !this.client.bacay) {
      console.warn('[BacayStrategy] Cannot execute betting: bacay not initialized');
      return;
    }

    try {
      const player = this.client.bacay;
      const roomBet = player.game || 100; // Mức cược của phòng
      const balance = this.client.balance;

      // Kiểm tra bot có đủ tiền không
      if (balance < roomBet) {
        console.log(`[BacayStrategy] Insufficient balance: ${balance} < ${roomBet}`);
        return;
      }

      // Tính mức cược dựa vào difficulty
      let betAmount = roomBet;

      if (this.difficulty === 'easy') {
        // Bot dễ chỉ cược mức tối thiểu
        betAmount = roomBet;
      } else if (this.difficulty === 'medium') {
        // Bot trung bình cược từ 1-2x mức phòng
        betAmount = Math.floor(roomBet * (1 + Math.random() * this.aggressiveness));
      } else if (this.difficulty === 'hard') {
        // Bot khó cược cao hơn
        betAmount = Math.floor(roomBet * (1 + 1.5 * this.aggressiveness));
      }

      // Giới hạn cược trong khoảng cho phép (1x đến 2x mức phòng)
      betAmount = Math.max(roomBet, Math.min(betAmount, roomBet * 2));

      // Đảm bảo đủ tiền cược
      if (balance >= betAmount) {
        console.log(`[BacayStrategy] Betting ${betAmount} (balance: ${balance}, bet: ${roomBet})`);
        this.client.executeAction('cuoc_chuong', { bet: betAmount });

        // Random chance để cược Gà (30% xác suất)
        if (Math.random() < 0.3) {
          setTimeout(() => {
            console.log('[BacayStrategy] Also betting Ga');
            this.client.executeAction('cuoc_ga', {});
          }, 500);
        }
      }
    } catch (err) {
      console.error('[BacayStrategy] Error in betting action:', err.message);
    }
  }

  /**
   * ================== ROUND 2: CHIA/LẬT BÀI ==================
   */
  handleRound2(data, timeRemaining) {
    // Chỉ lật bài 1 lần mỗi round
    if (this.lastRound === 2 || this.actionInProgress) {
      return;
    }

    this.lastRound = 2;
    this.actionInProgress = true;

    // Random delay: 1-3 giây
    const delayMs = this.randomDelay(1000, 3000);

    const timerId = setTimeout(() => {
      this.executeFlipAction();
      this.actionInProgress = false;
    }, delayMs);

    this.pendingTimers.push(timerId);

    console.log(`[BacayStrategy] Round 2 detected. Will flip in ${(delayMs / 1000).toFixed(1)}s`);
  }

  /**
   * Thực thi lật bài
   */
  executeFlipAction() {
    if (!this.client || !this.client.bacay) {
      console.warn('[BacayStrategy] Cannot execute flip: bacay not initialized');
      return;
    }

    try {
      const player = this.client.bacay;

      // Kiểm tra bot có bài không (round 2 phải có bài)
      if (!player.card || player.card.length === 0) {
        console.warn('[BacayStrategy] No card to flip');
        return;
      }

      console.log(`[BacayStrategy] Flipping cards. Point: ${player.point}`);
      this.client.executeAction('lat_bai', {});
    } catch (err) {
      console.error('[BacayStrategy] Error in flip action:', err.message);
    }
  }

  /**
   * ================== ROUND 3: KẾT THÚC VĂN ==================
   */
  handleRound3(data) {
    this.lastRound = 3;
    console.log('[BacayStrategy] Round 3 - Game ending. Waiting for next round...');
    
    // Reset trạng thái để sẵn sàng cho vòng tiếp theo
    setTimeout(() => {
      this.lastRound = 0;
      this.actionInProgress = false;
    }, 1000);
  }

  /**
   * Xử lý game data (bài, điểm, v.v.)
   */
  handleGameData(gameData) {
    // Nếu nhận được thông tin chia bài
    if (gameData.chia_bai) {
      console.log('[BacayStrategy] Received card info');
    }

    // Nếu nhận được thông tin lật bài
    if (gameData.lat) {
      console.log('[BacayStrategy] Someone flipped');
    }

    // Nếu nhận được kết quả game
    if (gameData.done) {
      console.log('[BacayStrategy] Game done, calculating result...');
    }
  }

  /**
   * Xử lý in-game data (người chơi vào/ra phòng)
   */
  handleInGameData(inGameData) {
    if (inGameData.ghe) {
      console.log(`[BacayStrategy] Player joined at seat ${inGameData.ghe}`);
    }
  }

  /**
   * Tạo delay random trong khoảng [min, max] ms
   */
  randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Dọn dẹp: hủy tất cả pending timers
   */
  cleanup() {
    this.pendingTimers.forEach(timerId => clearTimeout(timerId));
    this.pendingTimers = [];
    console.log('[BacayStrategy] Cleaned up pending timers');
  }

  /**
   * Debug: In ra trạng thái Strategy
   */
  debug() {
    return {
      difficulty: this.difficulty,
      aggressiveness: this.aggressiveness,
      lastRound: this.lastRound,
      actionInProgress: this.actionInProgress,
      pendingTimersCount: this.pendingTimers.length
    };
  }
}

module.exports = BacayStrategy;
