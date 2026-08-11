// ArmOneDa WebApp 利用ログ受信 (GAS Webアプリ)
// デプロイ: ウェブアプリ / 実行ユーザー=自分 / アクセス=全員
const SHEET_LOG = 'Log';
const SHEET_DASH = 'Dashboard';
const MAX_PAYLOAD = 2048;
const ALLOWED_EVENTS = [
  'page_view', 'ble_connect',
  'settings_load', 'settings_load_ao',
  'settings_save', 'settings_save_ao', 'settings_save_btrelay',
  'settings_reset',
];

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > MAX_PAYLOAD) return ok_();
    const d = JSON.parse(raw);
    if (ALLOWED_EVENTS.indexOf(d.event) < 0) return ok_();
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LOG);
    toRows_(d, raw).forEach(function (r) { sheet.appendRow(r); });
  } catch (err) {
    // クライアントは応答を見ないため、常に200を返して握りつぶす
  }
  return ok_();
}

function ok_() {
  return ContentService.createTextOutput('ok');
}

function num_(v) {
  return (v === undefined || v === null || v === '') ? '' : Number(v);
}

function str_(v) {
  return (v === undefined || v === null) ? '' : String(v).slice(0, 300);
}

// 1受信 → Log行の配列。settings_load(12値)のみSW1/SW2の2行に分割する。
function toRows_(d, raw) {
  const base = [new Date(), str_(d.page), str_(d.event), str_(d.device), str_(d.fw), num_(d.bleMode)];
  const tail = [str_(d.ua), raw];
  if (d.event === 'settings_load' && Array.isArray(d.cfg) && d.cfg.length >= 12) {
    return [1, 2].map(function (sw) {
      const o = (sw - 1) * 6;
      return base.concat([
        sw,
        num_(d.cfg[o]), num_(d.cfg[o + 1]), num_(d.cfg[o + 2]),
        num_(d.cfg[o + 3]), num_(d.cfg[o + 4]), num_(d.cfg[o + 5]),
        '', '',
      ], tail);
    });
  }
  return [base.concat([
    num_(d.sw),
    num_(d.arm), num_(d.mode), num_(d.dir), num_(d.op),
    num_(d.timer_ms), num_(d.speed_ms),
    num_(d.ao_sec),
    str_(d.fs_mode) + str_(d.fs_dir),
  ], tail)];
}

// 初回セットアップ: Log/Dashboardシートとヘッダー・集計式を生成（再実行可）
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = ss.getSheetByName(SHEET_LOG) || ss.insertSheet(SHEET_LOG);
  log.getRange(1, 1, 1, 17).setValues([[
    '受信日時', 'page', 'event', 'device', 'fw', 'bleMode', 'sw',
    'arm', 'mode', 'dir', 'op', 'timer_ms', 'speed_ms', 'ao_sec', 'fs', 'ua', 'raw',
  ]]).setFontWeight('bold');
  log.setFrozenRows(1);

  const db = ss.getSheetByName(SHEET_DASH) || ss.insertSheet(SHEET_DASH);
  db.clear();
  db.getRange('A1').setValue('ArmOneDa WebApp 利用状況ダッシュボード').setFontWeight('bold').setFontSize(14);

  db.getRange('A3').setValue('■ 日別アクセス数 (page_view, ページ別)').setFontWeight('bold');
  db.getRange('A4').setFormula(
    '=IFERROR(QUERY(Log!A:C,"select toDate(A), count(C) where C=\'page_view\' group by toDate(A) pivot B order by toDate(A) desc label toDate(A) \'日付\'",1),"データなし")');

  db.getRange('E3').setValue('■ デバイス別利用状況').setFontWeight('bold');
  db.getRange('E4').setFormula(
    '=IFERROR(QUERY(Log!A:D,"select D, count(C), max(A) where D<>\'\' group by D order by count(C) desc label D \'デバイス\', count(C) \'件数\', max(A) \'最終利用\'",1),"データなし")');

  db.getRange('I3').setValue('■ イベント件数').setFontWeight('bold');
  db.getRange('I4').setFormula(
    '=IFERROR(QUERY(Log!A:C,"select C, count(B) where C is not null group by C order by count(B) desc label C \'イベント\', count(B) \'件数\'",1),"データなし")');

  db.getRange('L3').setValue('■ 動作モード分布 (settings_save)').setFontWeight('bold');
  db.getRange('L4').setFormula(
    '=IFERROR(QUERY(Log!A:Q,"select I, count(C) where C=\'settings_save\' group by I label I \'mode(1=1回振り,2=連打)\', count(C) \'件数\'",1),"データなし")');

  db.getRange('L9').setValue('■ 動作方式分布 (settings_save)').setFontWeight('bold');
  db.getRange('L10').setFormula(
    '=IFERROR(QUERY(Log!A:Q,"select K, count(C) where C=\'settings_save\' group by K label K \'op(0=ﾀﾞｲﾚｸﾄ,1=ﾗｯﾁ,2=ﾀｲﾏｰ)\', count(C) \'件数\'",1),"データなし")');

  db.getRange('O3').setValue('■ 自動OFF設定の人気値').setFontWeight('bold');
  db.getRange('O4').setFormula(
    '=IFERROR(QUERY(Log!A:Q,"select N, count(C) where C=\'settings_save_ao\' group by N order by count(C) desc label N \'秒\', count(C) \'件数\'",1),"データなし")');

  db.getRange('O9').setValue('■ 連打速度分布 (mode=連打時)').setFontWeight('bold');
  db.getRange('O10').setFormula(
    '=IFERROR(QUERY(Log!A:Q,"select M, count(C) where C=\'settings_save\' and I=2 group by M order by M label M \'speed_ms(0=最速)\', count(C) \'件数\'",1),"データなし")');

  // QUERY結果の日付がシリアル値表示になるため表示書式を設定
  db.getRange('A4:A400').setNumberFormat('yyyy/mm/dd');
  db.getRange('G4:G400').setNumberFormat('yyyy/mm/dd hh:mm');
}

// GASエディタ上で実行する動作確認。全イベント種+不正イベントを doPost に流す。
function testDoPost() {
  const samples = [
    { page: 'settings', event: 'page_view', ua: 'test-ua' },
    { page: 'index', event: 'page_view', ua: 'test-ua' },
    { page: 'settings', event: 'ble_connect', device: 'ArmOneDa-BLE-TEST', fw: '2.0.0', bleMode: 0 },
    { page: 'settings', event: 'settings_load', device: 'ArmOneDa-BLE-TEST', fw: '2.0.0', bleMode: 0, cfg: [0, 1, 0, 0, 1000, 0, 0, 2, 1, 2, 2000, 500] },
    { page: 'settings', event: 'settings_load_ao', device: 'ArmOneDa-BLE-TEST', fw: '2.0.0', bleMode: 0, ao_sec: 600 },
    { page: 'settings', event: 'settings_save', device: 'ArmOneDa-BLE-TEST', fw: '2.0.0', bleMode: 0, sw: 1, arm: 0, mode: 2, dir: 0, op: 2, timer_ms: 1500, speed_ms: 300 },
    { page: 'settings', event: 'settings_save_ao', device: 'ArmOneDa-BLE-TEST', fw: '2.0.0', bleMode: 0, ao_sec: 600 },
    { page: 'settings', event: 'settings_save_btrelay', device: 'ArmOneDa-BLE-TEST', fw: '2.0.0', bleMode: 1, fs_mode: 'AMOR1', fs_dir: 'REV' },
    { page: 'settings', event: 'settings_reset', device: 'ArmOneDa-BLE-TEST', fw: '2.0.0', bleMode: 0 },
    { page: 'settings', event: 'bad_event' },          // 破棄されること
  ];
  samples.forEach(function (s) { doPost({ postData: { contents: JSON.stringify(s) } }); });
  doPost({ postData: { contents: 'not-json{{{' } });    // 破棄されること
  doPost({ postData: { contents: JSON.stringify({ event: 'page_view', pad: 'x'.repeat(3000) }) } }); // サイズ超過→破棄
}
