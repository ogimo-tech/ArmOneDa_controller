# 利用ログ収集のセットアップ手順（1回のみ・約5分）

## 1. スプレッドシート作成

1. <https://sheets.new> を開き、新規スプレッドシートを作成
2. 名前を `ArmOneDa_WebApp_Log` に変更

## 2. GAS 設置

1. メニュー「拡張機能」→「Apps Script」
2. エディタに `Code.gs` の内容を全て貼り付け（既定の myFunction は削除）
3. 保存（Ctrl+S）

## 3. 初期化

1. エディタ上部の関数選択で `setupSheets` を選び「実行」
2. 初回は権限承認ダイアログが出るので許可
3. スプレッドシートに Log / Dashboard シートができていることを確認

## 4. 動作確認（任意）

1. 関数選択で `testDoPost` を選び「実行」
2. Log シートにテスト行（device=ArmOneDa-BLE-TEST）が11行追加され、
   bad_event / 不正JSON / サイズ超過 の3件は記録されないことを確認
3. 確認後、テスト行は削除してよい

## 5. Webアプリとしてデプロイ

1. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
2. 実行ユーザー: 自分 / アクセスできるユーザー: 全員
3. 「デプロイ」→ 表示された WebアプリURL（`https://script.google.com/macros/s/xxx/exec`）をコピー
4. この URL を Claude に渡す（`analytics.js` の `AMO_GAS_ENDPOINT` に設定される）

## 補足

- Code.gs を更新した場合は「デプロイ」→「デプロイを管理」→ 編集(鉛筆)→
  バージョン「新バージョン」→「デプロイ」で反映（URLは変わらない）
