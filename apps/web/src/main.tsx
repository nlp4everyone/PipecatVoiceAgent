import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Trang thử avatar (phase 0): mở bằng /?avatar-test. Nạp lazy để three.js không vào bundle chính.
const AvatarTest = lazy(() =>
  import('./components/avatar/avatar-test.tsx').then((m) => ({ default: m.AvatarTest })),
)
// Trang thử biểu cảm (phase 3): mở bằng /?avatar-expression.
const ExpressionTest = lazy(() =>
  import('./components/avatar/expression-test.tsx').then((m) => ({ default: m.ExpressionTest })),
)
const params = new URLSearchParams(location.search)
const isAvatarTest = params.has('avatar-test')
const isExpressionTest = params.has('avatar-expression')

// Trên iPhone không có console: hiện lỗi JS ngay trên màn hình để biết vì sao trang trống.
function showFatal(message: string) {
  const el = document.getElementById('fatal') ?? document.body.appendChild(document.createElement('pre'))
  el.id = 'fatal'
  el.style.cssText =
    'position:fixed;inset:auto 0 0 0;z-index:9999;margin:0;padding:12px;max-height:50vh;overflow:auto;' +
    'background:#300;color:#fdd;font:12px/1.4 monospace;white-space:pre-wrap'
  el.textContent += message + '\n'
}
if (isAvatarTest) {
  window.addEventListener('error', (e) => showFatal(`error: ${e.message} @ ${e.filename}:${e.lineno}`))
  window.addEventListener('unhandledrejection', (e) => showFatal(`rejection: ${String(e.reason?.stack ?? e.reason)}`))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAvatarTest || isExpressionTest ? (
      <Suspense fallback={<div className="h-dvh bg-background p-4 text-foreground">Đang tải trang thử…</div>}>
        {isAvatarTest ? <AvatarTest /> : <ExpressionTest />}
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
