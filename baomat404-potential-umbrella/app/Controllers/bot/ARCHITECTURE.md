# 🏗️ BOT BA CÂY - KIẾN TRÚC CHI TIẾT

## 📁 CẤU TRÚC THƯ MỤC

```
app/Controllers/bot/
├── FakeSocketClient.js          (Giả mạo socket của người chơi)
├── botGameManager.js            (Quản lý vòng đời bot)
├── strategies/
│   └── BacayStrategy.js         (AI logic cho Ba Cây)
├── HOW_TO_USE.md                (Hướng dẫn sử dụng)
└── ARCHITECTURE.md              (File này)
```

---

## 🔄 KIẾN TRÚC 3 LỚP

### TẦNG 1: FAKE SOCKET CLIENT
**File:** `FakeSocketClient.js`

```javascript
FakeSocketClient {
  // Thông tin bot
  UID, profile, red (balance)
  
  // Lắng nghe từ server
  red(data) → gọi strategy.onReceiveData()
  
  // Thực thi hành động
  executeAction(type, payload) → gọi bacay.cuocChuong/cuocGa/onLat()
  
  // Điều khiển strategy
  attachStrategy(strategy)
}
```

**Nhiệm vụ:**
- Giả mạo kết nối WebSocket thực
- Nhận dữ liệu từ server (server gọi `client.red(data)`)
- Chuyển tiếp data sang Strategy
- Thực thi hành động khi Strategy yêu cầu

---

### TẦNG 2: BACAY STRATEGY
**File:** `strategies/BacayStrategy.js`

```javascript
BacayStrategy {
  // Cấu hình AI
  difficulty: 'easy'|'medium'|'hard'
  aggressiveness: 0-1
  
  // Xử lý dữ liệu
  onReceiveData(data)
    ├─ handleRound1() → Đặt cược (delay 2-5s)
    ├─ handleRound2() → Lật bài (delay 1-3s)
    └─ handleRound3() → Kết thúc ván
  
  // Thực thi hành động
  executeBettingAction()
  executeFlipAction()
  
  // Dọn dẹp
  cleanup()
}
```

**Nhiệm vụ:**
- Nhận data từ FakeSocketClient
- Phân tích Round/Phase của game
- Quyết định hành động (cược bao nhiêu, khi nào lật bài)
- Gọi `client.executeAction()` để thực thi

---

### TẦNG 3: BOT GAME MANAGER
**File:** `botGameManager.js`

```javascript
BotGameManager {
  static spawnBotForBaCay(roomBet, config)
    ├─ findAvailableBot() → Tìm bot đủ tiền
    ├─ new FakeSocketClient()
    ├─ new BacayStrategy()
    ├─ attachStrategy()
    ├─ reg(client, roomBet) → Đăng ký
    └─ ingame(client) → Vào phòng
  
  static removeBotFromRoom(botClient)
  static getBotDebugInfo(botClient)
  static findAvailableBot(roomBet)
}
```

**Nhiệm vụ:**
- Quản lý vòng đời bot (spawn, remove)
- Tìm bot khả dụng từ MongoDB
- Khởi tạo FakeSocketClient + Strategy
- Gọi hàm reg/ingame từ Ba Cây

---

## 🔀 LUỒNG DATA

### 1️⃣ SPAWN BOT

```
spawnBotForBaCay(roomBet)
  ↓ [1] Tìm bot
findAvailableBot()
  → Query: UserInfo.findOne({type:true, red >= roomBet*4})
  ↓ [2] Tạo FakeSocketClient
new FakeSocketClient(botUserData)
  {UID, profile, red, bacay=null, strategy=null}
  ↓ [3] Tạo Strategy
new BacayStrategy({difficulty, aggressiveness})
  ↓ [4] Gắn Strategy
fakeClient.attachStrategy(strategy)
  → strategy.setClient(fakeClient)
  ↓ [5] Đăng ký vào phòng
reg(fakeClient, roomBet)
  → UserInfo.findOne({id}) → Kiểm tra tiền
  → new Player(fakeClient, roomBet)
  → fakeClient.bacay = player
  → process.redT.game.bacay.player[uid] = player
  ↓ [6] Vào phòng chơi
ingame(fakeClient)
  → room.inroom(player)
  → Chọn ghế ngẫu nhiên
  → room.sendToAll({ingame}) → Broadcast
  ↓
✅ Bot ready để chơi
```

---

### 2️⃣ NHẬN DỮ LIỆU VÀ HÀNH ĐỘNG

```
Server có người chơi/thay đổi trạng thái
  ↓
room.sendToAll({infoRoom, game, ...})
  ↓
Gọi player.client.red(data)
  ↓
FakeSocketClient.red(data)
  ├─ Lưu currentRoomInfo
  ├─ Gọi strategy.onReceiveData(data)
  └─ Gọi event handlers
  ↓
BacayStrategy.onReceiveData(data)
  ├─ Kiểm tra data.infoRoom.round
  ├─ Round 1?
  │   → handleRound1()
  │   → setTimeout(randomDelay 2-5s)
  │   → executeBettingAction()
  │       → calculateBetAmount()
  │       → client.executeAction('cuoc_chuong', {bet})
  │           → bacay.cuocChuong(bet)
  │               → UserInfo.findOne()
  │               → Trừ tiền, lưu DB
  │               → room.sendToAll({game:{player}})
  │
  ├─ Round 2?
  │   → handleRound2()
  │   → setTimeout(randomDelay 1-3s)
  │   → executeFlipAction()
  │       → client.executeAction('lat_bai', {})
  │           → bacay.onLat()
  │               → room.sendToAll({game:{lat}})
  │
  └─ Round 3?
      → handleRound3()
      → Ghi nhận kết quả
```

---

## 🎯 ĐIỂM THIẾT KẾ CHÍNH

### ✅ Tại sao dùng FakeSocketClient?

1. **Giả mạo client thực** - Không cần mở real WebSocket
2. **Nhận được data từ server** - Vì server gọi `client.red(data)`
3. **Forward sang Strategy** - Tách biệt logic AI khỏi communication
4. **Thực thi hành động** - Gọi trực tiếp vào `bacay.cuocChuong()` v.v.

### ✅ Tại sao delay random?

1. **Tự nhiên hơn** - Không như bot bấm ngay lập tức
2. **Tránh xung đột** - Không tất cả bot cùng lúc cược
3. **Tuân thủ game** - Mô phỏng người chơi thực tế

### ✅ Tại sao dùng setTimeout?

1. **Không chặn event loop** - Async, không blocking
2. **Dễ quản lý** - Có thể cancel khi bot thoát
3. **Tuân thủ kiến trúc gốc** - Game dùng setInterval/setTimeout

---

## 🔌 INTEGRATION POINTS

### Import trong file khác:

```javascript
// app/Controllers/game/BaCay/reg.js (giữ nguyên)
// app/Controllers/game/BaCay/ingame.js (giữ nguyên)

// Để sử dụng bot:
const BotGameManager = require('./bot/botGameManager');

// Trong route/socketUsers.js:
const result = await BotGameManager.spawnBotForBaCay(1000, {
  difficulty: 'medium',
  aggressiveness: 0.6
});
```

### Không thay đổi file gốc:

- ✅ Ba Cây Controller, room, player → **GIỮ NGUYÊN**
- ✅ reg/ingame functions → **GIỮ NGUYÊN**
- ✅ Server broadcast logic → **GIỮ NGUYÊN**
- ✅ Chỉ **ADD MỚI** folder `bot/` và files bên trong

---

## 📊 BẢNG SO SÁNH

| Thành phần | Bot TaiXiu (cũ) | Bot BaCay (mới) |
|-----------|----------|---------|
| **Mục đích** | Tạo tài khoản, init DB | Điều khiển bot chơi game |
| **File** | `bot.js` | `bot/botGameManager.js` |
| **Cơ chế** | Sync, 1 lần | Async, loop liên tục |
| **Socket** | N/A | FakeSocketClient |
| **Strategy** | N/A | BacayStrategy |
| **Game** | Tất cả | Ba Cây (có thể extend) |
| **Conflict** | ❌ KHÔNG | ✅ SEPARATE FOLDER |

---

## 🚀 EXPAND TỚI GAME KHÁC

Để thêm bot cho game Tiến Lên/Liêng:

```
app/Controllers/bot/
├── FakeSocketClient.js          (DÙNG CHUNG)
├── botGameManager.js            (EXTEND THÊM METHOD)
└── strategies/
    ├── BacayStrategy.js         (BaCay)
    ├── TienLenStrategy.js       (NEW - Tiến Lên)
    └── LiengStrategy.js         (NEW - Liêng)
```

**Bước:**
1. Tạo `strategies/TienLenStrategy.js` - Copy từ BacayStrategy, đổi logic
2. Thêm method `spawnBotForTienLen()` trong botGameManager.js
3. Import `reg/ingame` từ TienLen controller

---

## 🧹 MEMORY MANAGEMENT

### Cleanup khi bot thoát:

```javascript
BotGameManager.removeBotFromRoom(botClient)
  ├─ botClient.strategy.cleanup() → Clear timers
  ├─ botClient.bacay.outGame(true) → Thoát phòng
  ├─ botClient.bacay = null
  └─ botClient = null
```

### Tránh memory leak:

- ✅ Lưu tất cả setTimeout IDs trong `pendingTimers[]`
- ✅ Gọi `clearTimeout()` khi cleanup
- ✅ Gán tham chiếu thành `null`

---

## 🐛 DEBUG MODE

```javascript
// Kiểm tra trạng thái bot
const debugInfo = BotGameManager.getBotDebugInfo(botClient);
console.log(debugInfo);

// Kiểm tra FakeSocketClient
console.log(botClient.debug());

// Kiểm tra Strategy
console.log(botClient.strategy.debug());
```

---

**Tóm lại:** Hệ thống Bot BA CÂY được thiết kế **MODULAR**, **SEPARATE** từ bot.js cũ, với 3 tầng rõ ràng: Communication → AI Logic → Management. 🎯
