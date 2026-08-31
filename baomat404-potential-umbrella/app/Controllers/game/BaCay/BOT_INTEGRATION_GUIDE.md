/**
 * BOT_INTEGRATION_GUIDE.md
 * 
 * Hướng dẫn tích hợp Bot tự động vào hệ thống Ba Cây
 */

# 🤖 HƯỚNG DẪN TÍCH HỢP BOT TỰ ĐỘNG BA CÂY

## ✅ ĐÃ THỰC HIỆN

### 1️⃣ Tệp `app/Controllers/game/BaCay/ingame.js` - ĐÃ CHÈN

**Vị trí:** Dòng 5-7 (import) + Dòng 30-51 (logic spawn)

```javascript
// ==================== BOT INTEGRATION ====================
let BotGameManager = require('../../bot/botGameManager');

// ... trong function ingame() ...

// Khi người chơi tạo phòng mới (newRoom được tạo)
if (newRoom.online === 1 && !newRoom.isPlay) {
    setTimeout(async function() {
        const botResult = await BotGameManager.spawnBotForBaCay(bacay.game, {
            difficulty: 'medium',
            aggressiveness: 0.5
        });
        
        if (botResult.success) {
            console.log(`✅ Bot auto-spawned: ${botResult.botInfo.name}`);
        }
    }, 1000);
}
```

**Logic:**
- ✅ Phòng mới được tạo (`newRoom = new Room(...)`)
- ✅ Chỉ có 1 người chơi thật (`online === 1`)
- ✅ Game chưa bắt đầu (`!isPlay`)
- ✅ Spawn bot sau 1 giây (để sync player info)

---

### 2️⃣ Tệp `app/Controllers/game/BaCay/reg.js` - ĐÃ CHÈN

**Vị trí:** Dòng 6-7 (import)

```javascript
let BotGameManager = require('../../bot/botGameManager');
```

**Tác dụng:** Import BotGameManager (dùng cho config tương lai)

---

## 🔄 LUỒNG CHẠY KHI NGƯỜI CHƠI VÀO PHÒNG

```
1. Người chơi bấm vào phòng Ba Cây (ví dụ: 1000 xu)
   ↓
2. Socket gửi: {reg: 1000}
   ↓
3. reg(client, 1000) được gọi
   ├─ Check: Người chơi đang chơi?
   ├─ Check: Người chơi có đủ tiền? (>= 4000 R)
   └─ Tạo: client.bacay = new Player(client, 1000)
   ↓
4. Socket gửi: {ingame: true}
   ↓
5. ingame(client) được gọi
   ├─ Tìm phòng trống
   ├─ Nếu có phòng trống: PhongCho.inroom(bacay)
   └─ Nếu không có phòng mới: 
       ├─ Tạo phòng: newRoom = new Room(...)
       ├─ Người chơi vào: newRoom.inroom(bacay)
       ├─ **✨ CHECK ĐIỀU KIỆN SPAWN BOT** (LỚP MỚI)
       │   └─ Nếu online === 1 && !isPlay:
       │       └─ setTimeout 1s → spawnBotForBaCay()
       └─ ✅ BOT TỰ ĐỘNG VÀO PHÒNG
   ↓
6. Bot FakeSocketClient được khởi tạo
   ├─ Tìm bot từ DB (type=true, red >= 4000)
   ├─ Tạo FakeSocketClient(botData)
   ├─ Gắn BacayStrategy
   ├─ Gọi reg() → Tạo Player bot
   └─ Gọi ingame() → Bot vào phòng
   ↓
7. Server broadcast: Phòng có 2 người chơi
   ├─ Người chơi thật: nhận được thông tin bot
   └─ Bot: nhận được thông tin phòng
   ↓
8. Khi có 2 người, room.checkGame() sẽ bắt đầu game sau 5-8s
```

---

## ⚙️ CẤU HÌNH BOT SPAWN

### Trong `ingame.js` (dòng 37-40):

```javascript
const botResult = await BotGameManager.spawnBotForBaCay(bacay.game, {
    difficulty: 'medium',      // 'easy' | 'medium' | 'hard'
    aggressiveness: 0.5        // 0-1 (mức độ tham lam)
});
```

#### Tuỳ chỉnh theo mức phòng:

```javascript
// Option 1: Difficulty tăng theo mức cược
let difficulty = 'easy';
if (bacay.game >= 5000) difficulty = 'medium';
if (bacay.game >= 20000) difficulty = 'hard';

const botResult = await BotGameManager.spawnBotForBaCay(bacay.game, {
    difficulty: difficulty,
    aggressiveness: 0.6
});
```

```javascript
// Option 2: Random khác nhau mỗi game
const difficulties = ['easy', 'medium', 'hard'];
const randomDiff = difficulties[Math.floor(Math.random() * difficulties.length)];

const botResult = await BotGameManager.spawnBotForBaCay(bacay.game, {
    difficulty: randomDiff,
    aggressiveness: Math.random() * 0.8 + 0.2  // 0.2 - 1.0
});
```

---

## 🛡️ ĐIỀU KIỆN SPAWN BOT

Bot **SẼ** spawn nếu:
- ✅ Phòng vừa được tạo (không có phòng trống)
- ✅ Chỉ có 1 người chơi thật (online === 1)
- ✅ Game chưa bắt đầu (!isPlay)
- ✅ Có bot đủ tiền trong DB
- ✅ Sau 1 giây delay (để sync data)

Bot **KHÔNG** spawn nếu:
- ❌ Người chơi tìm được phòng trống rồi
- ❌ Phòng đã có 2+ người
- ❌ Game đã bắt đầu
- ❌ Không có bot đủ tiền
- ❌ Bot spawn fail (log error)

---

## 📊 KIỂM TRA LOG

Khi bot auto-spawn, bạn sẽ thấy log:

```
[BaCay] ✅ Bot auto-spawned: Bot_abc123 (Room: 1000)

hoặc

[BaCay] ⚠️ Bot spawn failed: No available bot with sufficient balance
[BaCay] Error spawning bot: Network error...
```

---

## 🔍 DEBUG CHI TIẾT

Thêm debug log trong `ingame.js` để theo dõi:

```javascript
// Sau dòng 28: newRoom.inroom(bacay);
console.log(`[BaCay Debug] Room created: online=${newRoom.online}, isPlay=${newRoom.isPlay}`);

// Sau dòng 33:
if (newRoom.online === 1 && !newRoom.isPlay) {
    console.log(`[BaCay Debug] Condition met! Will spawn bot after 1s`);
    
    setTimeout(async function() {
        console.log(`[BaCay Debug] Spawning bot...`);
        // ... spawn bot code ...
    }, 1000);
}
```

---

## ⚖️ CÂN BẰNG GAME

### Problem: Bot quá yếu → Người chơi thắng luôn

**Solution:** Tăng difficulty

```javascript
const botResult = await BotGameManager.spawnBotForBaCay(bacay.game, {
    difficulty: 'hard',          // ← Đổi thành hard
    aggressiveness: 0.7
});
```

### Problem: Bot quá mạnh → Người chơi luôn thua

**Solution:** Giảm difficulty

```javascript
const botResult = await BotGameManager.spawnBotForBaCay(bacay.game, {
    difficulty: 'easy',          // ← Đổi thành easy
    aggressiveness: 0.3
});
```

---

## 🔧 NÂNG CAO: TỤ TIỂU CHỈNH

### 1. Spawn bot cho phòng có người chơi thứ 2

Thay vì chỉ spawn cho phòng mới, có thể spawn khi người chơi thứ 2 vào:

```javascript
// Tìm trong ingame.js, dòng 21: PhongCho.inroom(bacay);

// Thêm sau dòng này:
setTimeout(async function() {
    // Nếu phòng vừa có 2 người → spawn bot gây nhiễu
    if (PhongCho.online === 2 && Math.random() < 0.3) {  // 30% xác suất
        await BotGameManager.spawnBotForBaCay(bacay.game, {...});
    }
}, 2000);
```

### 2. Giới hạn số bot trong phòng

Chỉ cho phép tối đa 2 bot / phòng:

```javascript
if (newRoom.online === 1 && !newRoom.isPlay) {
    // Đếm số bot trong phòng
    let botCount = Object.values(newRoom.player)
        .filter(p => p && p.client && p.client.UID.includes('_bot')).length;
    
    if (botCount < 2) {  // Chỉ spawn nếu < 2 bot
        await BotGameManager.spawnBotForBaCay(...);
    }
}
```

### 3. Spawn bot động dựa vào thời gian chờ

Nếu phòng chỉ có 1 người chơi trong 30s → spawn bot:

```javascript
if (newRoom.online === 1 && !newRoom.isPlay) {
    newRoom.botSpawnTimer = setTimeout(async function() {
        // Kiểm tra lại: vẫn chỉ có 1 người?
        if (newRoom.online === 1) {
            await BotGameManager.spawnBotForBaCay(...);
        }
    }, 30000);  // 30 giây
}

// Khi có người chơi thứ 2 vào, hủy timer
// (thêm vào room.inroom() sau line newRoom.inroom(bacay)):
if (newRoom.botSpawnTimer) clearTimeout(newRoom.botSpawnTimer);
```

---

## ❌ ĐIỀU CẦN TRÁNH

| Sai ❌ | Đúng ✅ |
|-------|--------|
| `if (newRoom.online > 0)` → spawn bot ngay | `if (newRoom.online === 1)` → chỉ spawn khi 1 người |
| Không check `!isPlay` → spawn bot khi game đã bắt đầu | Check `!isPlay` → đảm bảo game chưa bắt đầu |
| `setTimeout(() => {...}, 0)` → race condition | `setTimeout(() => {...}, 1000)` → đủ thời gian sync |
| Gọi sync `BotGameManager.spawnBotForBaCay()` → block event loop | `await` async function → không block |
| Không log/debug → khó biết vấn đề gì | Có console.log() → dễ debug |

---

## 🚀 KHI NÀO ĐÃ READY PRODUCTION

Checklist:

- ✅ `ingame.js` có logic spawn bot
- ✅ `reg.js` import BotGameManager
- ✅ Bot tự động spawn khi người chơi tạo phòng
- ✅ Console log hiển thị bot name
- ✅ Người chơi thấy bot vào phòng
- ✅ Bot tham gia game (cược, lật bài)
- ✅ Không có error/timeout
- ✅ Database balance update đúng
- ✅ Test với nhiều mức cược (100, 1000, 10000, ...)
- ✅ Test với nhiều người chơi cùng lúc

---

## 🧪 KIỂM TRA NHANH

### Test 1: Bot auto-spawn

```bash
1. Mở game Ba Cây
2. Chọn phòng 1000 xu → Tạo phòng mới
3. Check console:
   ✅ "[BaCay] ✅ Bot auto-spawned: Bot_xxx (Room: 1000)"
```

### Test 2: Bot không spawn khi phòng có 2+ người

```bash
1. Người A vào phòng 1000 → Bot spawn ✅
2. Người B vào phòng → Không spawn bot mới (đã đủ 2 người)
```

### Test 3: Bot tham gia game

```bash
1. Bot vào phòng
2. Sau 5-8s game bắt đầu
3. Round 1: Bot cược sau 2-5s
4. Round 2: Bot lật bài sau 1-3s
5. Round 3: Hiển thị kết quả
```

---

## 🔗 FILE LIÊN QUAN

- ✅ `app/Controllers/bot/FakeSocketClient.js` - Fake socket
- ✅ `app/Controllers/bot/strategies/BacayStrategy.js` - Bot AI
- ✅ `app/Controllers/bot/botGameManager.js` - Bot manager
- ✅ `app/Controllers/game/BaCay/ingame.js` - **ĐÃ CHÈN** (import + spawn logic)
- ✅ `app/Controllers/game/BaCay/reg.js` - **ĐÃ CHÈN** (import)
- 📖 `app/Controllers/game/BaCay/lib/room.js` - Game logic (giữ nguyên)
- 📖 `app/Controllers/game/BaCay/lib/player.js` - Player logic (giữ nguyên)

---

**✨ Tích hợp hoàn tất! Bot sẽ tự động vào phòng khi phát hiện người chơi thật.** 🎯
