import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Trang thử avatar (phase 0): mở bằng /?avatar-test. Nạp lazy để three.js không vào bundle chính.
const AvatarTest = lazy(() =>
  import('./components/avatar/avatar-test.tsx').then((m) => ({ default: m.AvatarTest })),
)
const isAvatarTest = new URLSearchParams(location.search).has('avatar-test')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAvatarTest ? (
      <Suspense fallback={<div className="h-dvh bg-background" />}>
        <AvatarTest />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
