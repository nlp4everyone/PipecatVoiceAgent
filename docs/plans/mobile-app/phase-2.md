# Giai đoạn 2 — Giao diện kiểu ChatGPT Voice và độ ổn định

Mục tiêu: biến MVP của [giai đoạn 1](phase-1.md) thành app **dùng được hằng
ngày** — quả cầu (orb) phản ứng theo giọng nói như web app, phụ đề, âm báo, rung,
và không rớt cuộc gọi vì những chuyện thường ngày (app xuống nền, có cuộc gọi đến,
đổi wifi sang 4G).

Bản mẫu là web app hiện tại: `apps/web/src/components/voice-screen.tsx` và
`apps/web/src/components/chat-orb.tsx`. App mobile làm giống về hình và hành vi,
chỉ thay phần kỹ thuật cho hợp React Native.

## Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Kiểu orb | Bầu trời xanh có mây trôi như web — port shader sang Skia |
| Mức âm thanh cho orb | Sửa transport bằng `patch-package` để đọc ~80 ms/lần, làm mượt bằng Reanimated |
| Chữ hội thoại | Phụ đề lời bot dưới orb (bật/tắt được) + nút mở toàn bộ hội thoại hai bên |
| App xuống nền / khoá màn hình | Tắt mic, giữ kết nối **30 giây**; quay lại kịp thì bật mic nói tiếp, quá hạn thì kết thúc |
| Có cuộc gọi điện thoại đến | Xử lý như xuống nền: tắt mic, giữ 30 giây |
| Mở app | Orb đứng yên + dòng "Chạm để bắt đầu trò chuyện"; chạm mới kết nối |
| Loa | Loa ngoài; tự chuyển sang tai nghe dây / Bluetooth khi có |
| Âm báo | Hai âm ngắn khi bắt đầu và kết thúc, cùng tông web |
| Rung | Khi kết nối xong, khi bật/tắt mic, khi kết thúc |
| Màn hình | Không tự tắt trong lúc gọi |
| Sáng / tối | Theo hệ thống |
| Nút | Mic, kết thúc, phụ đề, xem hội thoại. Không có ô nhập chữ |

## Thư viện thêm

Cài bằng `npx expo install` để Expo chọn đúng phiên bản cho SDK 55:

```bash
npx expo install @shopify/react-native-skia react-native-reanimated \
  react-native-gesture-handler expo-haptics expo-audio expo-keep-awake
npm i -D patch-package
```

| Thư viện | Dùng cho |
|---|---|
| `@shopify/react-native-skia` | Vẽ orb bằng shader (thay WebGL của web) |
| `react-native-reanimated` | Làm mượt mức âm thanh, co giãn orb trên luồng UI |
| `react-native-gesture-handler` | Vuốt mở / đóng bảng hội thoại |
| `expo-haptics` | Rung |
| `expo-audio` | Phát âm báo |
| `expo-keep-awake` | Giữ màn hình sáng khi gọi |
| `patch-package` | Giữ bản sửa transport sau mỗi lần `npm install` |

Đây đều là thư viện có code native: cài trên PC Ubuntu, commit, rồi build lại
**cả hai** app — Android trên PC (`npx expo run:android --device`), iOS trên Mac
(`git pull` rồi `npx expo run:ios --device`). Gom các thư viện vào một lần cài để
chỉ phải sang Mac build một lần. Patch transport ở bước 2.1 chỉ sửa file JS nên
không cần build lại. Sau đó sửa JS / shader thì chỉ cần Metro trên PC — xem
[Làm việc trên hai máy](phase-1.md#làm-việc-trên-hai-máy).

## Các bước

| # | Việc | Xong khi |
|---|---|---|
| 2.1 | Sửa tần suất đọc mức âm thanh | Log thấy ~12 lần/giây thay vì 2 |
| 2.2 | Máy trạng thái hội thoại (phase) | Trạng thái đổi đúng khi nói, khi bot nói, khi ngắt lời |
| 2.3 | Orb bằng Skia | Orb trôi mây, phình theo giọng, mượt 60 fps |
| 2.4 | Bố cục màn hình gọi | Giống web: orb giữa, gợi ý dưới, hàng nút dưới cùng |
| 2.5 | Phụ đề và bảng hội thoại | Phụ đề bot hiện từng đoạn; vuốt lên xem cả hội thoại |
| 2.6 | Âm báo, rung, giữ màn hình, sáng/tối | Đủ phản hồi khi bắt đầu / kết thúc / bấm nút |
| 2.7 | Đường ra âm thanh | Mặc định loa ngoài; cắm tai nghe / bật AirPods thì tự chuyển |
| 2.8 | Gián đoạn và kết nối lại | Xuống nền, cuộc gọi đến, đổi mạng không làm hỏng phiên |

Nên làm 2.1 → 2.3 trước: orb là phần dễ vướng kỹ thuật nhất.

### 2.1 Sửa tần suất đọc mức âm thanh

**Vấn đề:** transport bản React Native đọc mức âm thanh qua `getStats()` của
WebRTC mỗi **500 ms** (2 lần/giây), viết cứng, không có tuỳ chọn. Web app đọc
bằng WebAudio ~60 lần/giây. Dùng nguyên 500 ms thì orb trễ nửa giây và giật.

**Cách sửa:** truyền khoảng thời gian vào chỗ transport khởi động bộ đo, trong cả
hai bản build của gói:

```
node_modules/@pipecat-ai/react-native-small-webrtc-transport/lib/module/transport.js     (dòng ~590)
node_modules/@pipecat-ai/react-native-small-webrtc-transport/lib/commonjs/transport.js   (dòng ~595)

-    this.audioLevelObserver.start(this.pc);
+    this.audioLevelObserver.start(this.pc, 80);
```

Rồi lưu bản sửa:

```bash
npx patch-package @pipecat-ai/react-native-small-webrtc-transport
```

và thêm `"postinstall": "patch-package"` vào `scripts` của `apps/mobile/package.json`.
File patch nằm ở `apps/mobile/patches/` và được commit.

Mức âm thanh tới app qua callback `onLocalAudioLevel` (mic) và
`onRemoteAudioLevel` (bot), giá trị 0–1.

**Lưu ý:**

- Mỗi lần nâng phiên bản transport, `patch-package` báo lỗi nếu dòng trên đổi —
  khi đó sửa lại patch.
- 80 ms là điểm khởi đầu. Đo pin / nhiệt trên Android đời cũ; nếu tốn thì tăng
  lên 120 ms — Reanimated vẫn làm mượt được.
- Nếu Pipecat sau này thêm tuỳ chọn interval chính thức thì bỏ patch.

### 2.2 Máy trạng thái hội thoại

Port nguyên logic của `voice-screen.tsx` sang hook `use-voice-phase.ts`:

| Sự kiện RTVI | Phase |
|---|---|
| `UserStartedSpeaking` | `userSpeaking` |
| `UserStoppedSpeaking` | `thinking` |
| `BotStartedSpeaking` | `botSpeaking` |
| `BotStoppedSpeaking` | về `listening` **chỉ khi** đang `botSpeaking` (khi bị ngắt lời, `UserStartedSpeaking` có thể tới trước) |
| Transport đổi trạng thái | về `listening` |

Trạng thái của orb suy ra như web:

```
chưa gọi                    → idle
đang kết nối                → connecting
phase = thinking            → thinking
bot nói / người dùng nói    → speaking   (mức âm thanh lấy từ bot hoặc mic tương ứng)
còn lại                     → listening
```

Các trạng thái kết nối (`initializing` … `connected` trước khi bot gửi
`bot-ready`) gom thành "đang kết nối", giống `CONNECTING_STATES` của web.

### 2.3 Orb bằng Skia

Shader của web (GLSL, trong `chat-orb.tsx`) chuyển sang **SkSL** cho
`Skia.RuntimeEffect`. Gần như chép nguyên — `hash`, `noise`, `fbm`, domain warp,
màu trời / mây, viền — chỉ đổi phần khung:

| GLSL (web) | SkSL (mobile) |
|---|---|
| `void main()` + `gl_FragCoord.xy` | `half4 main(float2 fragCoord)` |
| `gl_FragColor = …` | `return …` |
| Trục y từ dưới lên | Trục y từ trên xuống — đảo dấu `p.y` để giữ "trên đậm, dưới sáng" |

Uniform giữ như web: `uRes`, `uTime`, `uLevel`, `uDark`, `uMuted`.

Phần chuyển động (vòng `requestAnimationFrame` của web) chuyển sang Reanimated
(`useFrameCallback`), chạy trên luồng UI:

- **Mức âm thanh:** giá trị mới mỗi ~80 ms đặt làm *đích*; mỗi khung hình tiến dần
  về đích — lên nhanh (hệ số 0.35), xuống chậm (0.08) như web, nên không giật dù
  dữ liệu thưa hơn web. Hệ số tính theo thời gian thực của khung hình, nên màn
  hình 120 Hz chuyển động cùng tốc độ.
- **Đổi mức âm thanh sang độ phình:** `audioLevel` của WebRTC lớn hơn RMS mà web
  đo, nên công thức của web (`(x − 0.008) × 7`) làm orb luôn phình hết cỡ. Đo trên
  Android: giọng bot p25 ≈ 0.14, p50 ≈ 0.19, p90 ≈ 0.33 → dùng
  `(x − 0.02) × 2.6` (ra ~0.3 / 0.45 / 0.8). Nằm ở `src/hooks/use-orb-level.ts`.
- **Tốc độ mây** theo trạng thái (`DRIFT_SPEED`: idle 0.22, connecting 0.4,
  listening 0.3, thinking 1.1, speaking 0.45) cộng thêm theo mức âm thanh.
- **Co giãn:** connecting thở chậm, thinking rung nhẹ, speaking phình tới 16%
  theo âm lượng, còn lại thở rất nhẹ.
- **Mic tắt:** orb nhạt màu dần (`uMuted`) và trôi chậm lại.
- **Giảm chuyển động** (cài đặt trợ năng của máy): giảm biên độ như web.

Mục tiêu 60 fps. Nếu Android đời cũ tụt khung hình: vẽ canvas nhỏ hơn rồi phóng
to, hoặc giảm `fbm` từ 5 xuống 3–4 vòng lặp.

### 2.4 Bố cục màn hình gọi

```
┌──────────────────────────┐
│                          │
│                          │
│          ( orb )         │  ← giữa màn hình
│                          │
│  Hôm nay Hà Nội nắng…    │  ← phụ đề lời bot (2.5)
│                          │
│ Chạm để bắt đầu trò chuyện│  ← chỉ khi chưa gọi / "Micro đang tắt"
│                          │
│  [CC]  [💬]  [🎤]  [✕]   │  ← phụ đề · hội thoại · mic · kết thúc
└──────────────────────────┘
```

- Chưa gọi: chỉ có orb (idle) và dòng gợi ý; chạm vào orb hoặc nút để bắt đầu.
- Trong cuộc gọi: hiện hàng nút; nút kết thúc màu đỏ.
- Dòng gợi ý chỉ có một: "Chạm để bắt đầu trò chuyện" hoặc "Micro đang tắt".
- Lỗi kết nối: một dòng ngắn dưới orb, chạm để thử lại.
- Có nhãn cho VoiceOver / TalkBack giống `PHASE_LABEL` của web ("Đang nghe",
  "Đang suy nghĩ", "Đang nói").
- Chừa vùng an toàn (tai thỏ, thanh điều hướng).

### 2.5 Phụ đề và bảng hội thoại

- **Phụ đề:** lời bot hiện dần dưới orb theo sự kiện `BotOutput`, như
  `TranscriptOverlay` của web. Không hiện lời người dùng ở phụ đề. Nút `CC` bật /
  tắt; nhớ lựa chọn giữa các lần mở app.
- **Bảng hội thoại:** nút 💬 hoặc vuốt lên mở bảng che nửa dưới màn hình, liệt kê
  lời hai bên (danh sách của giai đoạn 1, làm gọn lại). Vuốt xuống để đóng; orb vẫn
  chạy phía trên.
- Hội thoại chỉ giữ trong phiên — tắt app là mất. Lưu lịch sử để giai đoạn 3.

### 2.6 Âm báo, rung, giữ màn hình, sáng/tối

**Âm báo:** web tự tổng hợp bằng WebAudio (`apps/web/src/lib/chimes.ts`). App
dùng hai file âm thanh ngắn tạo sẵn cùng tông (đặt ở `apps/mobile/assets/sounds/`),
phát bằng `expo-audio`:

- Bắt đầu: khi transport chuyển sang `ready`.
- Kết thúc: khi rời `ready` (người dùng bấm kết thúc, hoặc rớt kết nối).

**Rung** (`expo-haptics`):

| Lúc | Kiểu rung |
|---|---|
| Kết nối xong | `notificationAsync(Success)` |
| Bật / tắt mic | `impactAsync(Light)` |
| Kết thúc | `impactAsync(Medium)` |
| Lỗi | `notificationAsync(Error)` |

**Giữ màn hình sáng:** bật `expo-keep-awake` khi đang gọi, tắt khi kết thúc.

**Sáng / tối:** `userInterfaceStyle: "automatic"` trong `app.json`; màu nền và
chữ theo hệ thống; orb nhận `uDark` để chỉnh viền như web.

### 2.7 Đường ra âm thanh

- Mặc định **loa ngoài** (như ChatGPT Voice), không phải loa thoại áp tai.
- Cắm tai nghe dây hoặc kết nối AirPods / Bluetooth → tự chuyển; rút ra → về loa
  ngoài.
- Bật chế độ âm thanh dành cho gọi thoại để có khử tiếng vọng (AEC) — nếu không,
  mở loa ngoài bot sẽ nghe lại chính nó và tự ngắt lời.

Điều khiển qua `DailyMediaManager` (`updateSpeaker`) và API âm thanh native của
thư viện Daily (chế độ gọi thoại, chọn thiết bị ra). **Cần kiểm chứng trên máy
thật:** tên thiết bị ra trên từng nền tảng, và chế độ nào giữ được cả loa ngoài
lẫn AEC. Nếu thư viện không đủ, viết một native module nhỏ cho `AVAudioSession`
(iOS) / `AudioManager` (Android) — chuyển sang giai đoạn 3.

### 2.8 Gián đoạn và kết nối lại

**App xuống nền / khoá màn hình** (theo `AppState`):

1. Tắt mic, bắt đầu đếm 30 giây.
2. Quay lại trong 30 giây → bật lại mic (nếu trước đó đang bật), nói tiếp.
3. Quá 30 giây → kết thúc phiên; lần mở lại hiện màn hình "Chạm để bắt đầu".

**Cuộc gọi điện thoại đến:** cuộc gọi chiếm micro và loa, nên xử lý như xuống
nền — tắt mic, giữ 30 giây. Phát hiện bằng `AppState` (iOS chuyển `inactive` khi
màn hình cuộc gọi hiện) cùng sự kiện gián đoạn âm thanh / mất track micro.

**Đổi mạng** (wifi ↔ 4G) **hoặc mất mạng ngắn:**

- Transport báo mất kết nối → thử kết nối lại **một lần** (phiên mới) và hiện
  "Đang kết nối lại…".
- Không được → kết thúc, hiện lỗi kèm nút thử lại.
- Không tự thử lại liên tục, tránh tốn pin và tạo nhiều phiên bot.

**Cần kiểm chứng trên máy thật — đây là chỗ dễ sai nhất của giai đoạn 2:**

| Câu hỏi | Vì sao |
|---|---|
| iOS có giữ kết nối WebRTC 30 giây khi app ở nền không? | iOS tạm dừng app vài giây sau khi xuống nền. Có thể phải bật background mode `audio` (ví dụ chính thức của Pipecat đang bật `voip`) |
| Android có giữ kết nối khi ở nền không? | Android 14+ chặn micro ở nền nếu không có foreground service. Mic đã tắt nên có thể không sao, nhưng mạng vẫn có thể bị hạn chế |
| Cuộc gọi đến trên Android có làm `AppState` đổi không? | Màn hình cuộc gọi có thể chỉ phủ lên app; khi đó phải dựa vào việc mất micro |
| Kết nối lại sau đổi mạng có cần ICE restart không? | Hiện tạo phiên mới — đơn giản nhưng bot chào lại từ đầu |

Nếu 30 giây không giữ được trên một nền tảng, rút xuống "kết thúc ngay khi xuống
nền" cho nền tảng đó và ghi lại; giữ phiên thật sự ở nền là việc của giai đoạn 3
(CallKit / foreground service).

## Còn phải kiểm tra

Các bước đã viết code nhưng chưa thử hết trên máy. Xong mục nào thì đánh dấu.

- [x] **2.1** Android (máy ảo): log `[audio-level]` ~12 lần/giây.
- [x] **2.1** iPhone: sau khi build lại trên Mac, log `[audio-level]` cũng ~12 lần/giây.
- [x] **2.2** Kết nối và lời chào: `connecting → listening → botSpeaking → listening`.
- [x] **2.2** Bạn nói và ngắt lời bot. Gọi bot, hỏi một câu dài, rồi nói chen vào khi
      bot đang trả lời. Log `[phase]` trong Metro phải lần lượt là:

      ```
      userSpeaking -> orb speaking     ← bạn nói
      thinking     -> orb thinking     ← bạn ngừng, bot đang nghĩ
      botSpeaking  -> orb speaking     ← bot trả lời
      userSpeaking -> orb speaking     ← bạn ngắt lời (không nhảy về listening)
      ```

- [x] **2.3** Android (máy ảo): orb hiện đúng, mây trôi, phình theo giọng bot, nhạt
      khi tắt mic, viền đổi theo chế độ tối.
- [x] **2.3** Orb phình theo giọng **bạn**. Đo trên iPhone: mic p25 ≈ 0.12–0.19,
      p50 ≈ 0.19–0.30, p90 ≈ 0.37–0.51 — hơi to hơn bot nhưng orb không phình hết
      cỡ, nên giữ chung hệ số trong `use-orb-level.ts`.
- [x] **2.3** iPhone: shader chạy đúng (Skia trên iOS dùng Metal), mức âm thanh tương
      tự Android.
- [x] **2.3** fps ≥ 55 trên iPhone: 60 fps (UI và JS), lên 120 khi màn hình ProMotion
      tăng tần số.
- [ ] **2.3** fps ≥ 55 trên máy Android thật (máy ảo không đo được). **Tạm hoãn — chưa
      có máy.** Tụt khung hình thì giảm `fbm` từ 5 xuống 3–4 vòng hoặc vẽ canvas nhỏ
      rồi phóng to.
- [x] **2.4** iPhone (bản Release): chưa gọi chỉ có orb và dòng gợi ý, chạm orb để
      bắt đầu; trong cuộc gọi có hàng nút CC · 💬 · 🎤 · ✕ và dòng "Micro đang tắt".
- [x] **2.5** iPhone (bản Release): CC bật / tắt và nhớ sau khi mở lại app; phụ đề hiện
      từng câu bot đang nói; bảng hội thoại mở bằng nút 💬 hoặc vuốt lên, đóng bằng
      vuốt xuống thanh tiêu đề; cuộn danh sách không làm bảng tự đóng.
- [x] **2.6** iPhone (bản Release): rung khi kết nối / kết thúc / lỗi / bật tắt mic, màn
      hình không tắt khi đang gọi, sáng / tối theo hệ thống. **Không có âm báo:**
      `expo-audio` chiếm audio session của cuộc gọi nên bot im (thử cả `allowsRecording`
      và `mixWithOthers` vẫn im). Muốn có chuông thì phải phát qua native module riêng
      (xem 2.7).

Log tạm `[audio-level]` và `[phase]` đã bỏ khỏi `apps/mobile/src/App.tsx` sau khi
kiểm xong; đo fps Android thì dùng Performance Monitor, không cần log.

## Xong giai đoạn 2 khi

- [x] Orb trôi mây, phình theo giọng bot và giọng bạn, không thấy trễ rõ ràng.
- [ ] Orb mượt (≥ 55 fps) trên cả iPhone và máy Android dự phòng. (iPhone đạt; Android
      chờ có máy.)
- [x] Trạng thái đúng khi bạn nói, khi bot suy nghĩ, khi bot nói, khi ngắt lời bot.
- [x] Phụ đề bot bật / tắt được; bảng hội thoại mở / đóng bằng nút và vuốt.
- [x] Có rung khi bắt đầu, kết thúc, bật / tắt mic. (Âm báo bỏ: xem 2.6.)
- [ ] Mặc định loa ngoài, không vọng tiếng; AirPods / tai nghe tự chuyển.
- [x] Màn hình không tắt trong lúc gọi.
- [ ] Xuống nền < 30 giây rồi quay lại vẫn nói tiếp được (hoặc đã ghi lại nền tảng
      nào không giữ được).
- [ ] Đổi wifi ↔ 4G giữa chừng: tự kết nối lại hoặc báo lỗi rõ ràng.
- [ ] Dùng ngoài đường 15 phút qua 4G không rớt.

## Rủi ro

| Rủi ro | Dấu hiệu | Cách xử lý |
|---|---|---|
| Patch transport hỏng sau khi nâng phiên bản | `patch-package` báo lỗi khi `npm install` | Sửa lại patch theo dòng mới, hoặc giữ phiên bản transport cố định |
| Shader nặng trên Android cũ | Tụt khung hình, máy nóng | Canvas nhỏ hơn rồi phóng to; giảm vòng `fbm` |
| `getStats()` mỗi 80 ms tốn pin | Pin tụt nhanh khi gọi lâu | Tăng lên 120–150 ms |
| Không giữ được loa ngoài cùng AEC | Bot tự ngắt lời khi mở loa | Thử chế độ âm thanh khác của Daily; nếu không được thì native module (giai đoạn 3) |
| iOS / Android ngắt kết nối khi ở nền | Quay lại thì phiên đã chết | Bật background mode phù hợp; hoặc kết thúc ngay khi xuống nền |

## Ngoài phạm vi giai đoạn 2

- Nói chuyện khi đã khoá màn hình lâu, CallKit, foreground service — giai đoạn 3.
- Màn Settings (profile, giọng, transport, xem độ trễ) — giai đoạn 3.
- Lưu lịch sử hội thoại — giai đoạn 3.
- Daily transport — giai đoạn 3.
- Ô nhập chữ, gửi ảnh.
