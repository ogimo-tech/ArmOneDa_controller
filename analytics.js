// ArmOneDa WebApp 利用ログ送信（fire-and-forget）
// 送信失敗・未設定はアプリ動作に一切影響させない。
// デバッグ表示: localStorage.setItem('amoDebug','1')
const AMO_GAS_ENDPOINT = '';   // GAS WebアプリURL（未設定時は送信しない）

function amoLog(eventType, fields) {
    try {
        if (!AMO_GAS_ENDPOINT) return;
        const payload = Object.assign({
            page: (location.pathname.split('/').pop() || 'index.html').replace('.html', ''),
            event: eventType,
        }, fields || {});
        // text/plain + no-cors でCORSプリフライトを回避（GAS向け定番手法）
        fetch(AMO_GAS_ENDPOINT, {
            method: 'POST',
            mode: 'no-cors',
            keepalive: true,
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
        }).catch(function () {});
        if (localStorage.getItem('amoDebug') === '1') console.log('[amoLog]', payload);
    } catch (e) { /* 何もしない */ }
}

try {
    amoLog('page_view', { ua: navigator.userAgent });
} catch (e) { /* 何もしない */ }
