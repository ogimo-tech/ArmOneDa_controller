# アームワンダAIR ファームウェア設計マニュアル

---

## 1. ハードウェア構成

アームワンダAIRは **2モジュール構成** です。

| モジュール | ボード | 役割 |
|-----------|--------|------|
| メインコントローラ | Arduino Nano | サーボ・スイッチ・LED制御、EEPROM管理 |
| BLEモジュール | M5Stamp Pico (ESP32) | BLE通信、NVS管理、コマンドルーティング |

### ピン配置（Nano）

| ピン | 用途 |
|-----|------|
| D2 | 物理スイッチ SW1（INPUT_PULLUP） |
| D3 | 物理スイッチ SW2（INPUT_PULLUP） |
| D4 | SoftwareSerial TX → M5Stamp RX |
| D5 | SoftwareSerial RX ← M5Stamp TX |
| D6 | NeoPixel LED |
| D10 | サーボ1 (SERVO1) |
| D11 | サーボ2 (SERVO2) |
| D12 | サーボ3 (SERVO3) |
| A0 | ボリューム2（サーボ移動量） |
| A1 | ボリューム1（サーボセンター） |

### モジュール間接続

```
Arduino Nano (SoftwareSerial 9600bps)
  D4 (TX) ────→ M5Stamp UART0 RX (GPIO 3)
  D5 (RX) ←──── M5Stamp UART0 TX (GPIO 1 または 0)
```

> **注意:** M5Stamp側はHardware UART0（Serial）を使用。SoftwareSerialはNano側のみ。

---

## 2. モジュール間UART通信プロトコル

### 2-1. BLEアプリ → Nano（通常コマンド転送）

BLEモジュールがアプリから `#...!` コマンドを受信した場合:

- **BLEモジュール内部コマンド**（`#AMOBLEMODE:`, `#AMOFSCMD:`, `#AMOFSCMDGET`, `#AMOBLERSTSET`）はM5Stamp内で処理し、Nanoへは転送しない
- **それ以外の `#...!` コマンド**はそのまま `Serial.println()` でNanoへ転送する

```
BLEアプリ  →[BLE RX Write]→  M5Stamp  →[UART println]→  Nano
```

### 2-2. Nano → BLEアプリ（レスポンス転送）

NanoからUART経由で `#` 始まりの行を受信した場合、M5StampはBLE TX Notifyでアプリへ転送する。

```
Nano  →[UART println]→  M5Stamp  →[BLE TX Notify]→  BLEアプリ
```

### 2-3. ハードリセット時のNVSリセット（ACKハンドシェイク）

Nanoがハードリセットを検出した際、M5StampのNVSもリセットするためのハンドシェイクプロトコル。

```
Nano                          M5Stamp
  │                              │
  │── #AMOBLERSTSET!\n ─────────→│  NVSリセット要求
  │                              │
  │←─ #AMOBLERSTSETOK!\n ────────│  ACK（受信確認）
  │                              │  ↓ NVS reset
  │                              │  ↓ ESP.restart()
```

**Nanoのリトライ仕様:**
- 最大8回リトライ
- 1回あたりのタイムアウト: 2000ms
- ACK受信で即時終了

**M5StampのACK仕様:**
- `#AMOBLERSTSET` を含む行を受信したら即座に `#AMOBLERSTSETOK!` を送信
- その後 100ms 待機（ACK送信完了を保証）してからNVSリセット・再起動

---

## 3. NVS（フラッシュ）設計（M5Stamp）

ESP32のPreferencesライブラリを使用してフラッシュに設定を永続化する。

| Namespace | キー | 型 | デフォルト | 内容 |
|-----------|-----|-----|-----------|------|
| `armoneda` | `ble_mode` | int | `0` | BLE動作モード（0=ArmOneDa, 1=FaceSwitch） |
| `armoneda` | `fs_cmd` | String | `"AMOS1ON"` | FaceSwitch ONコマンド本体（`#`と`!`を除く） |

### NVSリセット（工場出荷値）

以下のいずれかでNVSを工場出荷値に戻す:

1. NanoがUART経由で `#AMOBLERSTSET!` を送信（ハードリセット時）
2. M5Stamp側で `resetPrefs()` を直接呼び出す

リセット後のデフォルト値: `ble_mode=0`, `fs_cmd="AMOS1ON"`

---

## 4. EEPROM設計（Nano）

Arduino EEPROMライブラリを使用してスイッチ設定を永続化する。

| アドレス | 内容 |
|---------|------|
| 0 | マジックバイト（`0xAE`）: 初期化済みかの判定に使用 |
| 1 | 未使用（アライメント） |
| 2〜13 | SW1設定（`SwConfig` 構造体、6×int = 12バイト） |
| 14〜25 | SW2設定（`SwConfig` 構造体、6×int = 12バイト） |

### SwConfig 構造体

```cpp
struct SwConfig {
  int arm;      // 1=アーム1, 2=アーム2, 3=両方
  int mode;     // 1=単打, 2=連打
  int dir;      // 0=正転, 1=逆転
  int op;       // 0=ダイレクト, 1=ラッチ, 2=タイマー
  int timer_ms; // タイマー時間（op=2のとき有効、単位ms）
  int speed_ms; // 連打速度（mode=2のとき有効、0=最速、単位ms）
};
```

### 工場出荷値

| | arm | mode | dir | op | timer_ms | speed_ms |
|-|-----|------|-----|----|----------|---------|
| SW1 | 3（両方） | 1（単打） | 0（正転） | 0（ダイレクト） | 1000 | 0（最速） |
| SW2 | 3（両方） | 2（連打） | 0（正転） | 0（ダイレクト） | 0 | 0（最速） |

---

## 5. ハードリセットシーケンス

起動時にいずれかの物理スイッチを押しながら電源ONすることでリセットが実行される。

```
1. 電源ON（スイッチ押下状態）
2. Nano setup(): SW1またはSW2がLOWを検出
3. 3秒間押し続けたことを確認
4. setDefaultConfigs() → saveSettings() : NanoのEEPROMを工場出荷値に書き戻す
5. SoftwareSerial初期化（起動から約2秒後）
6. flashWhiteLED(2): 白LED2回点滅でリセット完了を通知
7. #AMOBLERSTSET! をUART送信（ACK確認付き最大8回リトライ）
8. M5StampからACK受信 → M5StampがNVSリセット後に再起動
```

> **注意:** SoftwareSerialは起動から約2秒後に初期化される（ピン変化割り込みのタイミング依存）。ステップ5〜8の順序は重要。

---

## 6. BLE動作モード切り替えシーケンス

BLE設定アプリ（settings.html）からモードを変更する場合のシーケンス。

### ArmOneDaモード → FaceSwitchモード

```
1. WebApp: #AMOFSCMD:AMOS1ON! を送信（ONコマンドを先に保存）
2. WebApp: 300ms待機
3. WebApp: #AMOBLEMODE:1! を送信
4. M5Stamp: NVS に ble_mode=1 を保存
5. M5Stamp: 300ms後に ESP.restart()
6. 再起動後: FaceSwitchモードで "BT Relay board" としてアドバタイズ開始
```

### FaceSwitchモード → ArmOneDaモード

```
1. FaceSwitchデバイスまたはWebApp経由: #AMOBLEMODE:0! を送信（NUS RXへ書き込み）
2. M5Stamp: NVS に ble_mode=0 を保存
3. M5Stamp: 300ms後に ESP.restart()
4. 再起動後: ArmOneDaモードで "ArmOneDa-BLE-XXXX" としてアドバタイズ開始
```

---

## 7. BLEコマンドルーティング（M5Stamp）

M5Stampが受信したコマンドの処理先を決定するルール。

### ArmOneDaモード

```
受信コマンド
  ├─ #AMOBLEMODE:... → M5Stamp内部処理（NVS保存→再起動）
  ├─ #AMOFSCMD:...  → M5Stamp内部処理（NVS保存→#AMOFSCMDOK!返却）
  ├─ #AMOFSCMDGET   → M5Stamp内部処理（#AMOFSCMDRES:...!返却）
  └─ その他 #...!   → そのままNanoへUART転送
```

### FaceSwitchモード

```
受信コマンド（NUS RX）
  ├─ "1"            → "#" + fsOnCmd + "!" をNanoへUART転送
  ├─ "0"            → "#" + deriveOffCmd() + "!" をNanoへUART転送
  ├─ #AMOBLEMODE:... → M5Stamp内部処理（モード切り替え）
  ├─ #AMOFSCMD:...  → M5Stamp内部処理（ONコマンド保存）
  ├─ #AMOFSCMDGET   → M5Stamp内部処理（ONコマンド返却）
  ├─ #AMOVERGET     → loop()でフラグ立て → 次ループで #AMOVERRES: + #AMOFSCMDRES: 返却
  └─ その他 #...!   → NanoへUART転送（SW設定コマンド等）
```

---

## 8. FaceSwitchモードのONコマンド設計

FaceSwitchモードでは「1」を受信したときに送出するコマンドをNVSに保存する。

### ONコマンドの形式

NVSには `#` と `!` を除いたコマンド本体のみを保存する。

例: `AMOS1ON`（送出時は `#AMOS1ON!` として転送）

### OFFコマンドの自動導出

```cpp
String deriveOffCmd(const String& onCmd) {
    if (onCmd.startsWith("AMOS1")) return "AMOS1OFF";
    if (onCmd.startsWith("AMOR1")) return "AMOR1OFF";
    return "AMOS1OFF";  // フォールバック
}
```

### 対応するONコマンドと動作

| ONコマンド | 動作 | OFFコマンド |
|-----------|------|------------|
| `AMOS1ON` | 単打 正転 ON | `AMOS1OFF` |
| `AMOS1REV` | 単打 逆転 ON | `AMOS1OFF` |
| `AMOR1ON` | 連打 正転 ON | `AMOR1OFF` |
| `AMOR1REV` | 連打 逆転 ON | `AMOR1OFF` |

---

## 9. BLEデバイス名の決定ロジック

### ArmOneDaモード

デバイス固有のBluetooth MACアドレス（下位2バイト）を末尾に付加する。

```cpp
String getBLEDeviceName() {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_BT);
    char suffix[5];
    snprintf(suffix, sizeof(suffix), "%02X%02X", mac[4], mac[5]);
    return String("ArmOneDa-BLE-") + suffix;
}
```

例: `ArmOneDa-BLE-C59A`

### FaceSwitchモード

`"BT Relay board"` で固定（atacLab FaceSwitch互換のため）。

---

## 10. バージョン履歴

| バージョン | 日付 | 主な変更内容 |
|-----------|------|-------------|
| 1.0.0 | 2026-04-28 | 初回リリース。BLE基本操作・スイッチ設定変更・EEPROM保持 |
| 1.2.0 | 2026-04-28 | TX Characteristicによる設定レスポンス受信対応 |
| 1.3.0 | 2026-04-28 | FaceSwitchモード（NUS）追加、NVSリセットACKハンドシェイク対応 |

---

## 11. 参考

- BLE通信仕様: `ArmOneDa_AIR_BLE_SPEC.md`
- アームワンダAIR 紹介: https://protopedia.net/prototype/4204
- ソースコード: https://github.com/ogimo-tech/ArmOneDa_controller
