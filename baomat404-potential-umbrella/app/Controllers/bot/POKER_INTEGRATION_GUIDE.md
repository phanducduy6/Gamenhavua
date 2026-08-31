## Poker Bot Integration Guide

### Quick Summary

Poker bot support has been successfully integrated into the bot system. The bot framework now supports both **Ba Cây** and **Poker** games using the same modular architecture.

---

## Architecture Overview

### 📁 File Structure
```
app/Controllers/
  ├── bot/
  │   ├── FakeSocketClient.js              (Shared: Mock WebSocket client)
  │   ├── botGameManager.js                (UPDATED: Now supports both Ba Cây & Poker)
  │   └── strategies/
  │       ├── BacayStrategy.js             (Ba Cày AI)
  │       └── PokerStrategy.js             (NEW: Poker AI) ✨
  │
  └── game/
      ├── BaCay/
      │   ├── ingame.js                    (Modified: Bot auto-spawn integration)
      │   └── reg.js                       (Modified: Bot import)
      │
      └── Poker/
          ├── ingame.js                    (MODIFIED: Bot auto-spawn integration) ✨
          ├── reg.js                       (MODIFIED: Bot import) ✨
          └── lib/
              ├── room.js                  (Unchanged)
              ├── player.js                (Unchanged)
              └── Controller.js            (Unchanged)
```

---

## Modified Files - Change Details

### 1. `app/Controllers/bot/botGameManager.js`

**Lines 1-27:** Updated header and imports
```javascript
// Added imports for Poker:
const PokerStrategy = require('./strategies/PokerStrategy');
const regPoker = require('../game/Poker/reg');
const ingamePoker = require('../game/Poker/ingame');
```

**Lines 238-303:** Added new method `spawnBotForPoker(roomBet, config)`
- Similar flow to `spawnBotForBaCay()` but tailored for Poker mechanics
- Uses PokerStrategy instead of BacayStrategy
- Parameters: `roomBet` (100-500000), `config` with difficulty/aggressiveness
- Returns: `{success, botClient, message}`

---

### 2. `app/Controllers/game/Poker/ingame.js`

**Line 3:** Added import
```javascript
const BotGameManager = require('../../bot/botGameManager');
```

**Lines 17-26:** Auto-spawn trigger when joining existing room with 1 player
```javascript
if (PhongCho.online === 1 && !PhongCho.isPlay) {
  setTimeout(async () => {
    await BotGameManager.spawnBotForPoker(poker.game, {
      difficulty: 'medium',
      aggressiveness: 0.5
    });
  }, 1000);
}
```

**Lines 36-44:** Auto-spawn trigger when creating new room as first player
```javascript
if (newRoom.online === 1 && !newRoom.isPlay) {
  setTimeout(async () => {
    await BotGameManager.spawnBotForPoker(poker.game, {
      difficulty: 'medium',
      aggressiveness: 0.5
    });
  }, 1000);
}
```

---

### 3. `app/Controllers/game/Poker/reg.js`

**Line 4:** Added import
```javascript
const BotGameManager = require('../../bot/botGameManager');
```

*(The import is prepared for future use if needed; currently the main triggering happens in ingame.js)*

---

### 4. `app/Controllers/bot/strategies/PokerStrategy.js` (NEW FILE)

**Key Methods:**
- `onReceiveData(data)` - Main entry point, processes {game, infoRoom}
- `handlePlayerTurn(turnData)` - Detects when it's bot's turn
- `makeDecision()` - AI logic based on difficulty level
- `executeTheo()` - Follow action (60% default)
- `executeTo()` - Raise action (20% default)
- `executeHuy()` - Fold action (20% default)
- `cleanup()` - Dorn dẹp timers when game ends

**AI Decision Logic:**
```
Easy Mode:
  - Theo: 70% (conservative)
  - Tố: 10%
  - Huy: 20%

Medium Mode (default):
  - Theo: 60%
  - Tố: 20%
  - Huy: 20%

Hard Mode:
  - Theo: 50% (aggressive)
  - Tố: 30% (raises more often)
  - Huy: 20%
```

---

## How It Works: Poker Bot Lifecycle

### Step 1: Player Creates/Joins Room
```
Real Player → ingame.js:5 → Check online === 1 && !isPlay
```

### Step 2: Auto-Spawn Trigger
```
Auto-Spawn Logic (1s delay)
  └─> BotGameManager.spawnBotForPoker(roomBet, config)
```

### Step 3: Bot Instantiation
```
spawnBotForPoker()
  1. Find available bot from MongoDB
  2. Create FakeSocketClient with bot profile
  3. Attach PokerStrategy to client
  4. Call reg() → Player instance created
  5. Call ingame() → Bot enters game room
```

### Step 4: Game Starts
```
Server sends: {game: {chia_bai: [...]}}
  └─> FakeSocketClient.red() receives it
      └─> PokerStrategy.onReceiveData()
          └─> handleReceiveCards() stores bot's 2 cards
```

### Step 5: Bot's Turn
```
Server sends: {game: {turn: {ghe: botMap, select: [actions]}}}
  └─> FakeSocketClient.red() receives it
      └─> PokerStrategy.onReceiveData()
          └─> handlePlayerTurn() detects it's bot's turn
              └─> setTimeout(2-4s) → makeDecision()
                  └─> Executes: theo() OR tố() OR huy()
```

### Step 6: Action Execution
```
Bot calls: client.poker.onTheo() / onTo() / onHuy()
  └─> Server processes action
      └─> Sends updated game state
          └─> Back to Step 5 (next player's turn)
```

---

## Configuration Options

### BotGameManager.spawnBotForPoker(roomBet, config)

**Parameters:**
- `roomBet` (number): Room stake (100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000)
- `config` (object):
  - `difficulty` (string): 'easy' | 'medium' | 'hard' (default: 'medium')
  - `aggressiveness` (number): 0-1 (default: 0.5)

**Example Usage:**
```javascript
// Aggressive bot
await BotGameManager.spawnBotForPoker(1000, {
  difficulty: 'hard',
  aggressiveness: 0.8
});

// Conservative bot
await BotGameManager.spawnBotForPoker(500, {
  difficulty: 'easy',
  aggressiveness: 0.2
});
```

---

## Turn Detection Mechanism

**Poker uses:**
- `game_player` - Current player's data
- `game_player.map` - Seat position of current player
- Server sends `{game: {turn: {ghe: mapValue}}}` when it's a player's turn

**Bot Detection (PokerStrategy.handlePlayerTurn):**
```javascript
if (this.client.poker.map !== turnData.ghe) {
  return; // Not bot's turn
}
// It's bot's turn! Make decision...
```

---

## Action Methods - Poker vs Ba Cày

| Action | Poker Method | Ba Cày Method | Bot Result |
|--------|--------------|---------------|-----------|
| Follow/Call | `player.onTheo()` | N/A | Calls current bet |
| Raise | `player.onTo(amount)` | N/A | Raises by calculated amount |
| Fold | `player.onHuy()` | N/A | Exits round |
| (Ba Cày Only) | N/A | `player.cuocChuong(amount)` | Places traditional bet |
| (Ba Cày Only) | N/A | `player.cuocGa(amount)` | Places chicken bet |
| (Ba Cày Only) | N/A | `player.onLat()` | Flips cards |

---

## Debugging

### Check Bot Status
```javascript
const botInfo = BotGameManager.getBotDebugInfo(botClient);
console.log('Bot State:', botInfo);
// Returns:
// {
//   client: {uid, name, avatar, red},
//   strategy: {difficulty, lastAction, myCardCount, ...},
//   bacay: {...}  // (if ba cay game)
// }
```

### Enable Console Logs
All bot actions are logged with `[BotGameManager]`, `[PokerStrategy]`, `[FakeSocketClient]` prefixes:
```
[BotGameManager] Spawning bot for Poker room (bet: 1000)
[BotGameManager] Found bot for Poker: BotName123 (UID: 12345, balance: 50000)
[PokerStrategy] Received 2 cards: 2 cards
[PokerStrategy] It's my turn! Available actions: [...]
[PokerStrategy] Decision: theo (random: 0.45)
[PokerStrategy] Executing: THEO (call)
```

---

## Testing Checklist

- [ ] Bot auto-spawns when 1 real player creates Poker room
- [ ] Bot appears in correct seat after registration
- [ ] Bot receives cards correctly in Round 1
- [ ] Bot detects its turn and makes decisions within 2-4s
- [ ] Bot can theo (call), tố (raise), huy (fold) correctly
- [ ] Bot's balance decreases properly after betting
- [ ] Bot persists through multiple rounds in same room
- [ ] No game logic errors when bot folded/all-in
- [ ] Bot can be removed cleanly without affecting room state
- [ ] Multiple bots can coexist in same room (if multiple real players)

---

## Troubleshooting

### Bot doesn't spawn
**Check:**
1. Is there a real player in the room? (online === 1)
2. Is game not started? (!isPlay)
3. Are there available bots in DB with type=true and sufficient balance?
4. Check console logs for `[BotGameManager] No available bot found`

### Bot doesn't make decisions
**Check:**
1. Is PokerStrategy attached? (`botClient.strategy instanceof PokerStrategy`)
2. Is FakeSocketClient receiving data? (`client.red()` being called)
3. Check `[PokerStrategy]` logs - should see "It's my turn!"
4. Verify setTimeout isn't being blocked

### Bot doesn't complete actions
**Check:**
1. Are player methods (`onTheo`, `onTo`, `onHuy`) accessible? (not undefined)
2. Is bot's balance sufficient for action? (balans >= required amount)
3. Check `[PokerStrategy]` logs for error messages in catch blocks

### Game crashes when bot joins
**Check:**
1. FakeSocketClient initialization (uid, name, avatar, red properties)
2. Player registration success (check if `client.poker` is created)
3. Game logic doesn't expect human-specific properties (timeout handlers, etc.)
4. Console for unhandled Promise rejections

---

## Architecture Decisions Explained

### Why PokerStrategy.js is separate from BacayStrategy.js
- **Different game flow:** Poker has continuous turns vs Ba Cay's fixed 3 rounds
- **Different actions:** Theo/Tố/Huy vs Cuoc/Lat
- **Different state tracking:** game_player vs round numbers
- **Easy to maintain:** Changes to Poker AI don't affect Ba Cay bot

### Why spawnBotForPoker() is in botGameManager
- **Centralized lifecycle:** All bot spawning goes through one class
- **Shared utilities:** findAvailableBot() works for both games
- **Easy to add more games:** Just add spawnBotForXGame() method

### Why FakeSocketClient is reused
- **server calls client.red(data) for both games**
- **No game-specific logic in FakeSocketClient** - just forwards data to Strategy
- **Minimal maintenance:** New games just need new Strategy classes

---

## Next Steps for Other Games

To add bot support for a new game (e.g., Tiến Lên, Liêng):

1. **Create GameStrategy.js**
   ```javascript
   const YourGameStrategy = require('./strategies/YourGameStrategy');
   ```

2. **Add spawnBotForYourGame() in botGameManager.js**
   ```javascript
   static async spawnBotForYourGame(roomBet, config = {}) {
     // Copy spawnBotForPoker pattern
     // Attach YourGameStrategy instead
   }
   ```

3. **Integrate in game/YourGame/ingame.js**
   ```javascript
   if (newRoom.online === 1 && !newRoom.isPlay) {
     await BotGameManager.spawnBotForYourGame(roomBet, config);
   }
   ```

4. **Create YourGameStrategy.js**
   - Implement `onReceiveData()` to handle game updates
   - Implement decision logic for game actions
   - Define AI difficulty/aggressiveness

---

## Support & Questions

For issues or enhancements:
1. Check console logs for error messages (search for `[BotGameManager]`, `[PokerStrategy]`)
2. Review this guide's "Troubleshooting" section
3. Enable DEBUG mode in strategy if needed
4. Check MongoDB for bot user records

---

**Last Updated:** [Current Date]
**Poker Bot Status:** ✅ Active & Fully Integrated
