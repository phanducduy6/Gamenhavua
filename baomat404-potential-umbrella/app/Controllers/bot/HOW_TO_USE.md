/**
 * HOW_TO_USE.md
 * 
 * Hướng dẫn sử dụng hệ thống Bot Ba Cây
 */

# CÁCH SỬ DỤNG BOT BA CÂY

## 📋 TỔNG QUAN LUỒNG CHẠY

```
botGameManager.spawnBotForBaCay(roomBet)
  ↓
1. Tìm bot đủ tiền từ MongoDB (type=true, red >= roomBet*4)
  ↓
2. Tạo FakeSocketClient(botUserData)
  ↓
3. Tạo BacayStrategy(config) và gắn vào client
  ↓
4. Gọi reg(client, roomBet) → tạo Player instance
  ↓
5. Gọi ingame(client) → nhét bot vào phòng trống
  ↓
6. Server gọi client.red(data) → FakeSocketClient nhận
  ↓
7. FakeSocketClient.red() → forward sang BacayStrategy.onReceiveData()
  ↓
8. BacayStrategy xử lý logic:
   - Round 1: Đặt cược (delay 2-5s random)
   - Round 2: Lật bài (delay 1-3s random)
   - Round 3: Kết thúc
  ↓
9. BacayStrategy gọi client.executeAction() → thực thi hành động
```

---

## 🚀 CÁCH SPAWN BOT

### Cách 1: Spawn bot vào phòng Ba Cây (1000 xu)

```javascript
const BotGameManager = require('./app/Controllers/bot/botGameManager');

// Spawn bot
const result = await BotGameManager.spawnBotForBaCay(1000, {
  difficulty: 'medium',
  aggressiveness: 0.5
});

if (result.success) {
  console.log('✅ Bot spawned:', result.botInfo);
  // result.botClient là FakeSocketClient instance
} else {
  console.log('❌ Spawn failed:', result.message);
}
```

### Cách 2: Spawn bot vào phòng khác

```javascript
// Phòng 5000 xu, Bot chơi khó
await BotGameManager.spawnBotForBaCay(5000, {
  difficulty: 'hard',
  aggressiveness: 0.8
});
```

---

## ⚙️ CẤU HÌNH AI

### Độ khó (difficulty)
- `'easy'`: Cược mức tối thiểu, chỉ ngồi chơi
- `'medium'`: Cược 1-2x mức phòng, đôi khi cược Gà
- `'hard'`: Cược cao, thường cược Gà, lật bài nhanh

### Mức độ tham lam (aggressiveness)
- `0.0 - 0.3`: Bảo thủ, cược nhỏ
- `0.4 - 0.6`: Bình thường
- `0.7 - 1.0`: Tham lam, cược cao

---

## 🔄 LUỒNG GAME CHI TIẾT

### ROUND 1: ĐẶT CƯỢC (15 giây)

```
Server gửi: {infoRoom: {round: 1, time: 15}}
  ↓
BacayStrategy.handleRound1() được gọi
  ↓
Bot tính delay random (2-5s)
  ↓
Sau delay → executeBettingAction()
  ↓
client.executeAction('cuoc_chuong', {bet: amount})
  ↓
Gọi this.bacay.cuocChuong(amount)
  ↓
Hệ thống trừ tiền, gửi update về phòng
```

### ROUND 2: LẬT BÀI (12 giây)

```
Server gửi: {infoRoom: {round: 2}, game: {chia_bai: [...]}}
  ↓
BacayStrategy.handleRound2() được gọi
  ↓
Bot tính delay random (1-3s)
  ↓
Sau delay → executeFlipAction()
  ↓
client.executeAction('lat_bai', {})
  ↓
Gọi this.bacay.onLat()
  ↓
Gửi bài lật đến phòng
```

### ROUND 3: TÍNH ĐIỂM

```
Server gửi: {infoRoom: {round: 3}, game: {done: [...]}}
  ↓
BacayStrategy.handleRound3() được gọi
  ↓
Ghi nhận kết quả
  ↓
Chờ ván tiếp theo
```

---

## 🔍 KIỂM TRA TRẠNG THÁI BOT

```javascript
const BotGameManager = require('./app/Controllers/bot/botGameManager');

// Lấy debug info
const debugInfo = BotGameManager.getBotDebugInfo(botClient);

console.log(debugInfo);
/*
{
  client: {
    UID: '...',
    name: 'Bot_abc123',
    balance: 4000,
    roomInfo: {time: 10, round: 1, game: 1000},
    hasStrategy: true,
    hasBackay: true
  },
  strategy: {
    difficulty: 'medium',
    aggressiveness: 0.5,
    lastRound: 1,
    actionInProgress: false,
    pendingTimersCount: 0
  },
  bacay: {
    isPlay: true,
    map: 2,
    betChuong: 1000,
    betGa: 0,
    point: 8,
    card: 3
  }
}
*/
```

---

## 🛑 XÓA BOT KHỎI PHÒNG

```javascript
// Loại bỏ bot (dọn dẹp timers, hủy liên kết)
BotGameManager.removeBotFromRoom(botClient);
```

---

## 📊 LUỒNG DỮ LIỆU

### FakeSocketClient.red(data) nhận được gì?

Khi Server gửi thông tin phòng, nó gọi `client.red(data)` với structure:

```javascript
{
  // Thông tin phòng
  infoRoom: {
    game: 1000,           // Mức cược phòng
    isPlay: true,         // Có đang chơi không
    time_start: 5,        // Thời gian bắt đầu
    time: 10,             // Thời gian còn lại của round
    round: 1,             // Round hiện tại (1, 2, 3)
    betGa: 5000           // Tổng cược Gà
  },

  // Thông tin game
  game: {
    listPlayer: [         // Danh sách người được phép cược (round 1)
      {map: 1, progress: 16, round: 1},
      {map: 2, progress: 16, round: 1}
    ],
    chia_bai: [...],      // Thông tin chia bài (round 2)
    btn_lat: true,        // Có nút lật bài không
    lat: {...},           // Thông tin lật bài
    done: [...]           // Kết quả game (round 3)
  },

  // Thông tin vào phòng
  ingame: {
    ghe: 2,               // Ghế ngồi
    data: {               // Thông tin người chơi
      name: 'Bot_123',
      avatar: 'avatar.jpg',
      balans: 3000
    }
  },

  // Thông tin thoát phòng
  outgame: 2,             // Người ở ghế 2 thoát
}
```

### BacayStrategy.onReceiveData(data) xử lý:

1. **Kiểm tra `data.infoRoom.round`** → gọi `handleRound1/2/3()`
2. **Kiểm tra `data.game`** → gọi `handleGameData()`
3. **Kiểm tra `data.ingame`** → gọi `handleInGameData()`

---

## 🎯 ĐIỂM QUAN TRỌNG

### ✅ ĐÚNG CẦN LÀM

- ✅ Load bot từ MongoDB với kiểm tra balance
- ✅ Dùng FakeSocketClient giả mạo client thực
- ✅ Forward data từ client.red() → Strategy
- ✅ Dùng delay random (không hành động ngay lập tức)
- ✅ Gọi client.executeAction() để trigger hành động
- ✅ Dọn dẹp timers khi bot thoát

### ❌ KHÔNG NÊN LÀM

- ❌ Không gọi API socket trực tiếp (vì bot là fake client)
- ❌ Không bypass việc kiểm tra balance
- ❌ Không làm bot hành động ngay lập tức (toàn bộ cầu thủ cùng lúc)
- ❌ Không quên dọn dẹp timers (memory leak)

---

## 🧪 KIỂM TRA NHANH

```javascript
// Trong socketUsers.js hoặc route xử lý Ba Cây, thêm:

const BotGameManager = require('./app/Controllers/bot/botGameManager');

// Spawn bot vào phòng 1000 xu
if (someCondition) {  // Ví dụ: phòng có 1 người, cần bot
  const result = await BotGameManager.spawnBotForBaCay(1000, {
    difficulty: 'medium',
    aggressiveness: 0.6
  });
  
  if (result.success) {
    console.log('✅ Bot joined room:', result.botInfo.name);
  }
}
```

---

## 🔧 KHẮC PHỤC SỰ CỐ

### Bot không vào được phòng
- Check: Bot có đủ tiền không? (red >= roomBet * 4)
- Check: `process.redT.game.bacay` có tồn tại không?
- Check: Có lỗi trong reg() hoặc ingame() không?

### Bot không hành động
- Check: Strategy có được gắn vào client không?
- Check: Server có gửi data về không? (check console log)
- Check: Delay có quá dài không?

### Memory leak
- Check: Timers có được dọn dẹp không?
- Check: BacayStrategy.cleanup() có được gọi không?

---

## 📝 CÔNG THỨC CƯỢC

```
betAmount = roomBet * (1 + Math.random() * aggressiveness)

Ví dụ với roomBet=1000, aggressiveness=0.5:
- Cược tối thiểu: 1000
- Cược tối đa: 1000 * (1 + 0.5) = 1500
- Cược trung bình: ~1250
```

---

**Đã XOÁ:** Không cần viết test code, chỉ cần biết cách sử dụng! 🚀
