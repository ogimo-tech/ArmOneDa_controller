# アームワンダAIR BLE通信仕様 / ArmOneDa AIR BLE Communication Spec

アームワンダAIR (ArmOneDa AIR) は、重度肢体不自由のある子どもが楽器演奏を楽しめるよう開発されたアーム型演奏補助ロボットです。
スイッチ操作でアームを動かし、鍵盤やシンバルなどを叩いて演奏します。
BLE GATT を使ってスマートフォン・タブレットからアームの操作やスイッチ設定の変更が行えます。

---

## 1. BLE 接続情報

### 1-1. ArmOneDaモード（デフォルト）

| 項目 | 値 |
|------|-----|
| デバイス名プレフィックス | `ArmOneDa-BLE-XXXX` ※末尾4文字はデバイス固有の識別子 |
| Service UUID | `A6B00001-0EDA-4B52-8E2D-9B1C3D4E5F60` |
| RX Characteristic UUID | `A6B00002-0EDA-4B52-8E2D-9B1C3D4E5F60` |
| TX Characteristic UUID | `A6B00003-0EDA-4B52-8E2D-9B1C3D4E5F60` |
| RX プロパティ | Write / Write Without Response（アプリ → デバイス） |
| TX プロパティ | Notify（デバイス → アプリ） |

> **注意:** TX Characteristic はファームウェア v1.2.0 以降で追加されました。旧バージョンでは RX のみ利用可能です。

### 1-2. FaceSwitchモード（v1.3.0以降）

atacLab 顔スイッチなど Nordic UART Service (NUS) 互換デバイスとの接続に使用します。

| 項目 | 値 |
|------|-----|
| デバイス名 | `BT Relay board`（固定） |
| Service UUID | `6E400001-B5A3-F393-E0A9-E50E24DCCA9E` |
| RX Characteristic UUID | `6E400002-B5A3-F393-E0A9-E50E24DCCA9E` |
| TX Characteristic UUID | `6E400003-B5A3-F393-E0A9-E50E24DCCA9E` |
| RX プロパティ | Write / Write Without Response（スイッチデバイス → アームワンダ） |
| TX プロパティ | Notify（アームワンダ → スイッチデバイス） |

> **モード切り替え:** BLE設定アプリ（settings.html）からモードを変更できます。設定はNVS（フラッシュ）に保存され、次回起動から有効になります。

---

## 2. コマンド仕様

### 基本フォーマット

```
# + <命令コード> + !
```

| フィールド | 内容 |
|-----------|------|
| `#` | スタートマーカー（固定） |
| `<命令コード>` | 命令の種別とパラメータ（下記参照） |
| `!` | エンドマーカー（固定） |

**エンコード: UTF-8 テキスト**

---

### コマンド一覧（アプリ → デバイス、ArmOneDaモード）

| コマンド | 処理場所 | 内容 |
|---------|---------|------|
| `#AMOS1ON!` | Nano | アーム1：単打 正転 ON |
| `#AMOS1REV!` | Nano | アーム1：単打 逆転 ON |
| `#AMOS1OFF!` | Nano | アーム1：単打 OFF |
| `#AMOS1SW!` | Nano | アーム1：単打 ラッチ切替（ON↔OFF トグル） |
| `#AMOR1ON!` | Nano | アーム1：連打 正転 ON |
| `#AMOR1REV!` | Nano | アーム1：連打 逆転 ON |
| `#AMOR1OFF!` | Nano | アーム1：連打 OFF |
| `#AMOR1SW!` | Nano | アーム1：連打 ラッチ切替（ON↔OFF トグル） |
| `#AMOH1AD<value>!` | Nano | アーム1：角度指定モード 角度設定（value = 整数、センターからの相対角度） |
| `#AMOH1OFF!` | Nano | アーム1：角度指定モード 解除 |
| `#AMOA1OFF!` | Nano | アーム1：全入力リセット（AMOS1/AMOR1/AMOH1 すべて停止） |
| `#AMOSW1CFG:<params>!` | Nano | スイッチ1 設定変更（詳細は §4） |
| `#AMOSW2CFG:<params>!` | Nano | スイッチ2 設定変更（詳細は §4） |
| `#AMOCFGGET!` | Nano | 現在のスイッチ設定を取得要求 |
| `#AMOVERGET!` | Nano | ファームウェアバージョン取得要求 |
| `#AMOCFGRESET!` | Nano | スイッチ設定を工場出荷値にリセット |
| `#AMOBLEMODE:0!` | BLEモジュール | BLE動作モードをArmOneDaモードに設定・再起動（v1.3.0以降） |
| `#AMOBLEMODE:1!` | BLEモジュール | BLE動作モードをFaceSwitchモードに設定・再起動（v1.3.0以降） |
| `#AMOFSCMD:<cmd>!` | BLEモジュール | FaceSwitch ONコマンドを設定・保存（v1.3.0以降、詳細は §5） |
| `#AMOFSCMDGET!` | BLEモジュール | FaceSwitch ONコマンドを取得要求（v1.3.0以降） |

> **処理場所について:** 「BLEモジュール」はM5Stamp上で処理され、Nanoには転送されません。「Nano」はBLEモジュールがそのままNanoへ転送します。

---

### レスポンス一覧（デバイス → アプリ、TX Characteristic Notify）

| レスポンス | 内容 |
|-----------|------|
| `#AMOCFGRES:<params>!` | スイッチ設定データ（詳細は §4） |
| `#AMOVERRES:<version>,<caps>!` | ファームウェアバージョンと機能フラグ |
| `#AMOCFGRESOK!` | 設定リセット完了通知 |
| `#AMOFSCMDRES:<cmd>!` | FaceSwitch ONコマンド（`#AMOFSCMDGET!` または `#AMOVERGET!` への応答、v1.3.0以降） |
| `#AMOFSCMDOK!` | FaceSwitch ONコマンド保存完了（v1.3.0以降） |

---

## 3. アーム操作コマンド

### AMOS1 — 単打操作

アーム1 を **単打モード**（1回打鍵）で動かします。
物理スイッチの設定（SW1/SW2）に関係なく、常に単打動作を行います。

| コマンド | 動作 |
|---------|------|
| `#AMOS1ON!` | 正転方向にアームを動かす（押している間 ON） |
| `#AMOS1REV!` | 逆転方向にアームを動かす（押している間 ON） |
| `#AMOS1OFF!` | アームを停止・戻す |
| `#AMOS1SW!` | ラッチ切替（送るたびに ON / OFF を交互に切り替え） |

> `AMOS1ON` / `AMOS1REV` はダイレクト動作です。`AMOS1OFF` を送信するまで ON 状態が継続します。

---

### AMOR1 — 連打操作

アーム1 を **連打モード**（自動繰り返し打鍵）で動かします。
連打速度は設定された連打 SwConfig の `speed_ms` を参照します。

| コマンド | 動作 |
|---------|------|
| `#AMOR1ON!` | 正転方向に連打開始（送信し続けている間 ON） |
| `#AMOR1REV!` | 逆転方向に連打開始（送信し続けている間 ON） |
| `#AMOR1OFF!` | 連打停止 |
| `#AMOR1SW!` | ラッチ切替（送るたびに ON / OFF を交互に切り替え） |

---

### AMOH1 — 角度指定モード

アーム1 を指定角度で固定します。

```
#AMOH1AD<value>!
```

| フィールド | 内容 |
|-----------|------|
| `<value>` | センター位置からの相対角度（整数、負値＝逆転方向）。例: `-90` 〜 `+90` |

```
#AMOH1OFF!
```
角度指定モードを解除し、通常動作に戻します。

**例**
```
#AMOH1AD45!   → センターから +45° の位置で固定
#AMOH1AD-30!  → センターから -30° の位置で固定
#AMOH1OFF!    → 角度指定モード解除
```

---

### AMOA1OFF — 全入力リセット

```
#AMOA1OFF!
```

AMOS1 / AMOR1 / AMOH1 のすべての BLE 制御入力をリセットし、アームを停止します。

---

## 4. 設定変更コマンド

### AMOSW1CFG / AMOSW2CFG — スイッチ設定変更

物理スイッチ SW1 / SW2 の動作設定を変更し、EEPROM に保存します。

```
#AMOSW1CFG:<arm>,<mode>,<dir>,<op>,<timer_ms>,<speed_ms>!
#AMOSW2CFG:<arm>,<mode>,<dir>,<op>,<timer_ms>,<speed_ms>!
```

#### パラメータ

| パラメータ | 型 | 値 | 内容 |
|-----------|----|----|------|
| `arm` | int | `1` / `2` / `3` | 動かすアーム（1=アーム1のみ, 2=アーム2のみ, 3=両方） |
| `mode` | int | `1` / `2` | 動作モード（1=単打, 2=連打） |
| `dir` | int | `0` / `1` | 方向（0=正転, 1=逆転） |
| `op` | int | `0` / `1` / `2` | 操作方式（0=Hold, 1=ラッチ, 2=タイマー） |
| `timer_ms` | int | `100` 〜 `10000` | タイマー時間（`op=2` のとき有効, 単位 ms） |
| `speed_ms` | int | `0` / `150` 〜 `1000` | 連打速度（`mode=2` のとき有効, 0=最速, 単位 ms） |

**例**
```
#AMOSW1CFG:3,1,0,0,1000,0!   → SW1: 両アーム/単打/正転/Hold/タイマー1000ms/最速
#AMOSW2CFG:3,2,0,2,0,300!    → SW2: 両アーム/連打/正転/タイマー/timer未使用/300ms周期
```

---

### AMOCFGGET — 設定取得

```
#AMOCFGGET!
```

現在の SW1 / SW2 設定をデバイスから取得します。
デバイスは TX Characteristic で `#AMOCFGRES:` レスポンスを返します。

#### レスポンスフォーマット

```
#AMOCFGRES:<sw1_arm>,<sw1_mode>,<sw1_dir>,<sw1_op>,<sw1_timer_ms>,<sw1_speed_ms>,<sw2_arm>,<sw2_mode>,<sw2_dir>,<sw2_op>,<sw2_timer_ms>,<sw2_speed_ms>!
```

SW1 の 6 パラメータ、続いて SW2 の 6 パラメータ、カンマ区切りで計 12 個。
各パラメータの定義は AMOSW1CFG の表と同じ。

---

### AMOVERGET — バージョン取得

```
#AMOVERGET!
```

ファームウェアバージョンと機能フラグを取得します。

#### レスポンスフォーマット

```
#AMOVERRES:<version>,<caps>!
```

| フィールド | 内容 |
|-----------|------|
| `<version>` | バージョン文字列（例: `1.2.1`） |
| `<caps>` | 機能フラグ（整数、ビットフィールド） |

#### caps ビット定義

| ビット | 値 | 機能 |
|--------|-----|------|
| bit0 | `0x01` | 連打速度可変ボリューム搭載（`ENABLE_RENDA_SPEED_ADJUST`） |
| bit1 | `0x02` | EyeMoT 入力対応（`ENABLE_EYEMOT_INPUT`） |

---

### AMOCFGRESET — 設定リセット

```
#AMOCFGRESET!
```

SW1 / SW2 の設定を工場出荷値に戻し、EEPROM に保存します。
完了後、LED が 2 回点滅し、`#AMOCFGRESOK!` を返します。

#### 工場出荷値

| | arm | mode | dir | op | timer_ms | speed_ms |
|-|-----|------|-----|----|----------|---------|
| SW1 | 3（両方） | 1（単打） | 0（正転） | 0（Hold） | 1000 | 0（最速） |
| SW2 | 3（両方） | 2（連打） | 0（正転） | 0（Hold） | 0 | 0（最速） |

---

## 5. BLEモジュール設定コマンド（v1.3.0以降）

BLEモジュール（M5Stamp）自身が処理するコマンドです。Nanoへは転送されません。

### AMOBLEMODE — BLE動作モード切り替え

```
#AMOBLEMODE:0!   → ArmOneDaモードに設定（デフォルト）
#AMOBLEMODE:1!   → FaceSwitchモードに設定
```

- 設定はNVS（内部フラッシュ）に保存される
- コマンド受信後、BLEモジュールは約300ms後に自動再起動
- 再起動後は新しいモードでアドバタイズを開始する

---

### AMOFSCMD — FaceSwitch ONコマンド設定

```
#AMOFSCMD:<cmd>!
```

| フィールド | 内容 |
|-----------|------|
| `<cmd>` | FaceSwitch ON時に送出するコマンド本体（`#`と`!`を除いた部分）。例: `AMOS1ON`, `AMOR1ON` |

- 設定はNVSに保存される
- OFF コマンドはONコマンドのプレフィックスから自動導出（`AMOS1` → `AMOS1OFF`、`AMOR1` → `AMOR1OFF`）
- 保存成功時、`#AMOFSCMDOK!` を返す

**例**
```
#AMOFSCMD:AMOS1ON!   → スイッチONで単打正転
#AMOFSCMD:AMOR1ON!   → スイッチONで連打正転
```

---

### AMOFSCMDGET — FaceSwitch ONコマンド取得

```
#AMOFSCMDGET!
```

現在保存されているFaceSwitch ONコマンドを取得します。  
レスポンス: `#AMOFSCMDRES:<cmd>!`

---

## 6. FaceSwitchモード（v1.3.0以降）

FaceSwitchモードでは、デバイス名 `BT Relay board` でアドバタイズし、NUS (Nordic UART Service) プロトコルで動作します。atacLabの顔スイッチなど、NUS互換の1ボタンスイッチデバイスと接続して使用します。

### 受信コマンド（スイッチデバイス → アームワンダ）

| コマンド | 動作 |
|---------|------|
| `1` | FaceSwitch ON：設定されたONコマンドをNanoへ送出 |
| `0` | FaceSwitch OFF：ONコマンドから導出したOFFコマンドをNanoへ送出 |
| `#AMOBLEMODE:0!` | ArmOneDaモードへ切り替え・再起動 |
| `#AMOFSCMD:<cmd>!` | FaceSwitch ONコマンドを変更・保存 |
| `#AMOFSCMDGET!` | 現在のFaceSwitch ONコマンドを取得 |
| `#AMOVERGET!` | バージョンとFaceSwitch設定を取得（下記参照） |

### `#AMOVERGET!` への応答（FaceSwitchモード）

FaceSwitchモードで `#AMOVERGET!` を受信した場合、2つのNotifyを連続して返します。

```
#AMOVERRES:<version>,0!
#AMOFSCMDRES:<cmd>!
```

### FaceSwitchモードでのOFF コマンド導出ルール

| ONコマンドプレフィックス | 送出されるOFFコマンド |
|------------------------|---------------------|
| `AMOS1` で始まる | `#AMOS1OFF!` |
| `AMOR1` で始まる | `#AMOR1OFF!` |
| それ以外 | `#AMOS1OFF!`（フォールバック） |

---

## 7. 実装サンプル (Web Bluetooth API / JavaScript)

```javascript
const SERVICE_UUID = 'a6b00001-0eda-4b52-8e2d-9b1c3d4e5f60';
const RX_CHAR_UUID = 'a6b00002-0eda-4b52-8e2d-9b1c3d4e5f60';
const TX_CHAR_UUID = 'a6b00003-0eda-4b52-8e2d-9b1c3d4e5f60';
const DEVICE_NAME_PREFIX = 'ArmOneDa-BLE-';

let rxChar, txChar;

// BLE 接続
async function connect() {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: DEVICE_NAME_PREFIX }],
    optionalServices: [SERVICE_UUID]
  });
  const server  = await device.gatt.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);
  const chars   = await service.getCharacteristics();

  rxChar = chars.find(c => c.properties.write || c.properties.writeWithoutResponse);

  // TX（Notify）は旧ファームウェアでは存在しない場合がある
  try {
    txChar = await service.getCharacteristic(TX_CHAR_UUID);
    await txChar.startNotifications();
    txChar.addEventListener('characteristicvaluechanged', onNotify);
  } catch (e) {
    console.warn('TX Characteristic not found (old firmware):', e);
    txChar = null;
  }
}

// コマンド送信
async function sendCommand(cmd) {
  if (!rxChar) return;
  await rxChar.writeValue(new TextEncoder().encode(cmd));
}

// Notify 受信
function onNotify(event) {
  const line = new TextDecoder().decode(event.target.value);
  if (line.startsWith('#AMOVERRES:')) {
    const [version, caps] = line.slice(11, -1).split(',');
    console.log('Version:', version, 'Caps:', parseInt(caps));
    sendCommand('#AMOCFGGET!');   // バージョン取得後に設定を読み込む
  } else if (line.startsWith('#AMOCFGRES:')) {
    const params = line.slice(11, -1).split(',').map(Number);
    // params[0..5] = SW1 設定, params[6..11] = SW2 設定
    console.log('SW1:', params.slice(0, 6));
    console.log('SW2:', params.slice(6, 12));
  } else if (line === '#AMOCFGRESOK!') {
    console.log('Config reset complete');
    sendCommand('#AMOCFGGET!');   // リセット後に設定を再取得
  }
}

// 使用例
await connect();
await sendCommand('#AMOS1ON!');          // 単打 正転 ON
await sendCommand('#AMOS1OFF!');         // 単打 OFF
await sendCommand('#AMOR1SW!');          // 連打 ラッチ切替
await sendCommand('#AMOH1AD45!');        // 角度指定 +45°
await sendCommand('#AMOH1OFF!');         // 角度指定解除
await sendCommand('#AMOVERGET!');        // バージョン取得（レスポンスは onNotify で受信）
```

---

## 8. 注意事項

- **iOS / iPadOS**: Safari は Web Bluetooth API 非対応。**[Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492912960)** アプリ（App Store）を使用してください。
- **Android / Windows**: Chrome ブラウザで Web Bluetooth API が使用できます。
- デバイス名末尾4文字（MACアドレス下位2バイト）で個体を識別できます。
- TX Characteristic（Notify）はファームウェア v1.2.0 以降が必要です。旧バージョンでは設定変更機能は使用できません。
- 物理スイッチが操作された場合、BLE からの AMOS1 / AMOR1 入力はリセットされます（物理スイッチ優先）。
- AMOS1 / AMOR1 の操作は、物理スイッチ SW1 / SW2 の設定（arm / dir / op / speed_ms 等）とは独立して動作します。

---

## 9. 参考

- アームワンダAIR 紹介: https://protopedia.net/prototype/4204 
- コントローラ WebApp: https://ogimo-tech.github.io/ArmOneDa_controller/
- スイッチ設定 WebApp: https://ogimo-tech.github.io/ArmOneDa_controller/settings.html
- ソースコード: https://github.com/ogimo-tech/ArmOneDa_controller
