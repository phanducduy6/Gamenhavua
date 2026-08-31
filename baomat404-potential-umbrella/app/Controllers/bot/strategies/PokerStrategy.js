/**
 * PokerStrategy.js
 * 
 * Bộ não AI cho game Poker (Texas Hold'em).
 * Nhận data từ FakeSocketClient, xử lý logic theo từng lượt của game.
 * 
 * Poker Flow:
 * - Round 1: Chia 2 lá đầu tiên
 * - Lượt chơi: Người chơi lần lượt hành động (Xem/Theo, Tố, Úp bỏ, Tất tay)
 * - Mở bàn: Mở 3 lá (flop), 1 lá (turn), 1 lá (river)
 * - Kết thúc: Tính điểm, chia tiền
 */

class PokerStrategy {
  constructor(config = {}) {
    // ==================== CẤU HÌNH AI ====================
    this.difficulty = config.difficulty || 'medium'; // easy, medium, hard
    this.aggressiveness = config.aggressiveness !== undefined ? config.aggressiveness : 0.5;
    
    // ==================== TRẠNG THÁI ====================
    this.client = null;                              // FakeSocketClient reference
    this.lastAction = null;                          // Hành động trước đó
    this.actionInProgress = false;                   // Đang chờ action execute
    this.pendingTimers = [];                         // Lưu timeout IDs để cleanup
    
    // ==================== POKER LOGIC ====================
    this.myCard = [];                                // 2 lá của bot
    this.mainCard = [];                              // Bài trên bàn
    this.currentBet = 0;                             // Cược hiện tại
    this.myBet = 0;                                  // Cược của bot
    this.canBet = [];                                // Các tùy chọn có thể làm
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

    // Nhận bài từ Round 1
    if (data.game && data.game.chia_bai) {
      this.handleReceiveCards(data.game.chia_bai);
    }

    // Đến lượt của bot
    if (data.game && data.game.turn) {
      this.handlePlayerTurn(data.game.turn);
    }

    // Bài trên bàn được mở
    if (data.game && data.game.card) {
      this.handleMainCard(data.game.card);
    }

    // Hết giờ hoặc game kết thúc
    if (data.game && data.game.done) {
      this.handleGameEnd(data.game.done);
    }

    // Lưu info phòng
    if (data.infoRoom) {
      this.currentBet = data.infoRoom.bet || this.currentBet;
    }
  }

  /**
   * ==================== BOT NHẬN BÀI ====================
   */
  handleReceiveCards(chiaBaiData) {
    // Tìm lá bài của bot trong danh sách chia
    chiaBaiData.forEach((baiInfo) => {
      if (baiInfo.data && Array.isArray(baiInfo.data)) {
        // Đây là lá bài của bot (server chỉ gửi data cho người chơi)
        this.myCard = baiInfo.data;
        console.log(`[PokerStrategy] Received 2 cards: ${this.myCard.length} cards`);
      }
    });
  }

  /**
   * ==================== LƯỢT CHƠI POKER ====================
   */
  handlePlayerTurn(turnData) {
    // Kiểm tra xem đây có phải lượt của bot không
    if (!this.client.poker) {
      console.warn('[PokerStrategy] poker not initialized');
      return;
    }

    // Nếu map của bot trùng với ghế đang đến lượt
    if (this.client.poker.map !== turnData.ghe) {
      // Không phải lượt của bot
      return;
    }

    // Đây là lượt của bot!
    console.log('[PokerStrategy] It\'s my turn! Available actions:', turnData.select);

    if (this.actionInProgress) return;

    this.actionInProgress = true;
    this.canBet = turnData.select || [];

    // Random delay: 2-4 giây để trông tự nhiên
    const delayMs = this.randomDelay(2000, 4000);

    const timerId = setTimeout(() => {
      this.makeDecision();
      this.actionInProgress = false;
    }, delayMs);

    this.pendingTimers.push(timerId);

    console.log(`[PokerStrategy] Will make decision in ${(delayMs / 1000).toFixed(1)}s`);
  }

  /**
   * AI quyết định hành động
   * 
   * Logic:
   * - Theo (onTheo): 60% - Xem tiếp được xem thêm bài
   * - Tố (onTo): 20% - Cặp lên để tống các người khác
   * - Úp bỏ (onHuy): 20% - Bỏ bài
   */
  makeDecision() {
    if (!this.client || !this.client.poker) {
      console.warn('[PokerStrategy] Cannot make decision: poker not initialized');
      return;
    }

    try {
      const rand = Math.random();
      let action = null;

      // Quyết định hành động
      if (rand < 0.6) {
        action = 'theo';
      } else if (rand < 0.8) {
        action = 'to';
      } else {
        action = 'huy';
      }

      console.log(`[PokerStrategy] Decision: ${action} (random: ${rand.toFixed(2)})`);

      // Thực thi hành động
      switch (action) {
        case 'theo':
          this.executeTheo();
          break;
        case 'to':
          this.executeTo();
          break;
        case 'huy':
          this.executeHuy();
          break;
      }

      this.lastAction = action;
    } catch (err) {
      console.error('[PokerStrategy] Error making decision:', err.message);
    }
  }

  /**
   * HÀNH ĐỘNG 1: THEO (onTheo)
   * Bot sẽ theo cược hiện tại, xem tiếp được xem thêm bài
   */
  executeTheo() {
    if (!this.client || !this.client.poker) {
      console.warn('[PokerStrategy] Cannot theo: poker not initialized');
      return;
    }

    try {
      console.log('[PokerStrategy] Executing: THEO (call)');
      
      this.client.executeAction('theo', {});
    } catch (err) {
      console.error('[PokerStrategy] Error in theo action:', err.message);
    }
  }

  /**
   * HÀNH ĐỘNG 2: TỐ (onTo)
   * Bot tính toán số tiền tố dựa vào:
   * - Mức cược hiện tại
   * - Số dư của bot
   * - Độ khó AI (aggressiveness)
   */
  executeTo() {
    if (!this.client || !this.client.poker) {
      console.warn('[PokerStrategy] Cannot to: poker not initialized');
      return;
    }

    try {
      const player = this.client.poker;
      const roomBet = player.game || 100;
      const balance = player.balans || 0;

      // Tính mức tố
      let toAmount = this.currentBet;
      
      if (this.difficulty === 'hard') {
        // Bot khó tố cao hơn
        toAmount = Math.floor(this.currentBet * (1 + this.aggressiveness));
      } else if (this.difficulty === 'medium') {
        // Bot trung bình tố vừa phải
        toAmount = Math.floor(this.currentBet * (0.5 + this.aggressiveness));
      } else {
        // Bot dễ tố nhẹ nhàng
        toAmount = Math.floor(this.currentBet * (0.2 + this.aggressiveness * 0.3));
      }

      // Giới hạn không tố quá số tiền có
      toAmount = Math.max(roomBet, Math.min(toAmount, balance));

      // Kiểm tra điều kiện tố
      if (toAmount >= roomBet && balance >= toAmount) {
        console.log(`[PokerStrategy] Executing: TỐ (raise to ${toAmount})`);
        
        if (typeof this.client.poker.onTo === 'function') {
          this.client.executeAction('to', {amount: toAmount});
        } else {
          console.warn('[PokerStrategy] onTo function not found');
        }
      } else {
        console.log(`[PokerStrategy] Cannot to (insufficient balance: ${balance} < ${toAmount}), falling back to theo`);
        this.executeTheo();
      }
    } catch (err) {
      console.error('[PokerStrategy] Error in to action:', err.message);
    }
  }

  /**
   * HÀNH ĐỘNG 3: ÚP BỎ (onHuy)
   * Bot bỏ bài, không tham gia vòng này nữa
   */
  executeHuy() {
    if (!this.client || !this.client.poker) {
      console.warn('[PokerStrategy] Cannot huy: poker not initialized');
      return;
    }

    try {
      console.log('[PokerStrategy] Executing: ÚP BỎ (fold)');
      
      if (typeof this.client.poker.onHuy === 'function') {
        this.client.executeAction('up', {});
      } else {
        console.warn('[PokerStrategy] onHuy function not found');
      }
    } catch (err) {
      console.error('[PokerStrategy] Error in huy action:', err.message);
    }
  }

  /**
   * ==================== BÀI TRÊN BÀN ĐƯỢC MỞ ====================
   */
  handleMainCard(cardData) {
    // Cập nhật bài trên bàn
    if (Array.isArray(cardData)) {
      this.mainCard = cardData;
      console.log(`[PokerStrategy] Main cards updated: ${this.mainCard.length} cards on table`);
    }
  }

  /**
   * ==================== GAME KẾT THÚC ====================
   */
  handleGameEnd(doneData) {
    console.log('[PokerStrategy] Game ended, results calculated');
    
    // Reset lá bài
    this.myCard = [];
    this.mainCard = [];
    this.myBet = 0;
    this.lastAction = null;
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
    console.log('[PokerStrategy] Cleaned up pending timers');
  }

  /**
   * Debug: In ra trạng thái Strategy
   */
  debug() {
    return {
      difficulty: this.difficulty,
      aggressiveness: this.aggressiveness,
      lastAction: this.lastAction,
      actionInProgress: this.actionInProgress,
      myCardCount: this.myCard.length,
      mainCardCount: this.mainCard.length,
      currentBet: this.currentBet,
      pendingTimersCount: this.pendingTimers.length
    };
  }
}

module.exports = PokerStrategy;
