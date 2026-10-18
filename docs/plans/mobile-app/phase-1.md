# Giai đoạn 1 — MVP app mobile

Mục tiêu: một app React Native (Expo) chạy trên **iPhone và Android**, nói chuyện
được với bot qua 4G, hiện chữ hội thoại để kiểm tra bot nghe đúng hay sai. Chưa
làm đẹp — giao diện kiểu ChatGPT Voice để giai đoạn 2.

Cần xong [giai đoạn 0](phase-0.md) trước: điện thoại đã nói được với bot qua 4G
bằng web app.

## Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Framework | Expo + `expo-dev-client` (không dùng Expo Go — WebRTC là native module) |
| Expo SDK | **55** — xem [Phiên bản](#phiên-bản) |
| Vị trí code | `apps/mobile` trong repo này, `npm` |
| Máy làm việc | **PC Ubuntu**: chạy bot, viết code, chạy Metro, build Android. **Mac**: chỉ build iOS — xem [Làm việc trên hai máy](#làm-việc-trên-hai-máy) |
| Máy thử | iPhone (chính), Android (dự phòng) — máy thật, không dùng simulator |
| Tài khoản Apple | Apple ID miễn phí — app hết hạn sau **7 ngày**, cắm máy build lại |
| Màn hình MVP | Trạng thái + chữ hội thoại + nút mute / kết thúc (lựa chọn B) |
| Transport | SmallWebRTC; registry để sau thêm Daily |
| Code dùng chung với web | Copy, chưa tách package |

## Phiên bản

Đã kiểm tra trên npm (2026-10-17):

| Package | Phiên bản | Ghi chú |
|---|---|---|
| `@pipecat-ai/react-native-small-webrtc-transport` | `1.8.0` | iOS ≥ 15, Android `minSdkVersion` ≥ 24 |
| `@pipecat-ai/react-native-daily-media-manager` | `0.0.2` | Quản lý micro / loa cho transport |
| `@daily-co/react-native-webrtc` | `124.0.6-daily.2` | Bản WebRTC Daily fork — **không** dùng `react-native-webrtc` gốc |
| `@daily-co/react-native-daily-js` | `^0.86.0` | Phụ thuộc của media manager |
| `@daily-co/config-plugin-rn-daily-js` | `0.0.12` | Plugin Expo, bản ví dụ chính thức dùng; **chỉ hỗ trợ Expo ≥ 55 và < 58** (`0.0.13` cũng vậy) |
| `@pipecat-ai/client-js` | `1.14.0` | Lõi client, dùng chung với web |
| `expo` | mới nhất `58` | Chưa dùng được vì plugin trên |

Chọn **Expo SDK 55**: đây là bộ phiên bản ví dụ chính thức của Pipecat
([p2p-webrtc/video-transform/client/react-native](https://github.com/pipecat-ai/pipecat-examples/tree/main/p2p-webrtc/video-transform/client/react-native))
đã chạy (Expo 55, React Native 0.83, React 19.2). Nâng SDK khi plugin hỗ trợ.

Hai điều cần biết:

- **Dù dùng SmallWebRTC vẫn phải cài các gói `@daily-co/*`.** Đây là thư viện mã
  nguồn mở (MIT / BSD-2) do Daily viết, không phải dịch vụ Daily. Transport cần
  một *media manager* để bật micro và chọn loa; bản duy nhất có sẵn
  (`DailyMediaManager`) dùng SDK Daily **chỉ để điều khiển micro/loa trên máy** —
  nó không bao giờ vào phòng Daily (`join`), không cần tài khoản hay API key Daily,
  nên không có gì để tính phí. Âm thanh đi thẳng từ điện thoại tới bot của bạn.
- **Không dùng `@pipecat-ai/client-react`.** Gói này gọi `document` và
  `new Audio` của trình duyệt. App dùng thẳng `@pipecat-ai/client-js` cùng hook
  tự viết. `apps/web/src/hooks/use-pipecat-app.ts` chỉ phụ thuộc `client-js` và
  React nên copy sang được.

## Làm việc trên hai máy

Build iOS cần Xcode, mà Xcode chỉ chạy trên macOS. Với Apple ID miễn phí cũng
không build iOS trên cloud (EAS) để cài lên máy thật được. Mọi việc khác làm trên
PC Ubuntu:

| Việc | Máy |
|---|---|
| Chạy bot, viết code, chạy Metro (dev server JS) | PC Ubuntu |
| Build và cài app Android | PC Ubuntu — cắm điện thoại Android vào PC |
| Build và cài app iOS | Mac — cắm iPhone vào Mac |

Vì dùng `expo-dev-client`, phần native và phần JS tách nhau. Bản dev client đã
cài trên iPhone tải JS từ Metro trên PC, nên ngày thường không cần đụng tới Mac:

1. **Một lần, trên Mac:** `git pull`, rồi `npx expo run:ios --device` (từ
   `apps/mobile`) để cài dev client lên iPhone.
2. **Hằng ngày, trên PC:**

   ```bash
   cd apps/mobile
   npx expo start --dev-client
   ```

   Ở nhà cùng wifi: quét mã QR bằng camera iPhone. Ngoài đường qua Tailscale:

   ```bash
   REACT_NATIVE_PACKAGER_HOSTNAME=$(tailscale ip -4) npx expo start --dev-client
   ```

   Trên iPhone mở app → nhập `http://100.x.y.z:8081`. Lần đầu iOS hỏi quyền
   **Mạng cục bộ (Local Network)** — chọn cho phép.

3. Sửa code trên PC → app tự reload trên cả hai điện thoại.

**Phải quay lại Mac build lại iOS khi:**

- Thêm hoặc nâng thư viện có code native (transport, `@daily-co/*`, và các thư
  viện của giai đoạn 2: Skia, Reanimated, `expo-haptics`, `expo-audio`,
  `expo-keep-awake`). Thư viện chỉ có JS, hay patch file JS, thì không cần.
- Sửa `app.json` (quyền, plugin, bundle id, background mode).
- App hết hạn sau 7 ngày (Apple ID miễn phí).

Android cũng phải build lại trong các trường hợp trên (trừ hạn 7 ngày), nhưng làm
ngay trên PC: `npx expo run:android --device`.

Thư mục `ios/` và `android/` không commit — mỗi máy tự sinh khi chạy lệnh build,
nên chỉ cần đồng bộ code qua git.

## Các bước

| # | Việc | Ai làm | Xong khi |
|---|---|---|---|
| 1.1 | Cài công cụ: PC Ubuntu (Node, Android Studio), Mac (Node, Xcode, CocoaPods) | Bạn | Các lệnh kiểm tra chạy được |
| 1.2 | Chuẩn bị điện thoại (Developer Mode, USB debugging) | Bạn | PC thấy Android, Mac thấy iPhone |
| 1.3 | Mở bot ra Tailscale bằng HTTPS cho app | Bạn (trên PC) | Gọi được `https://<pc>.ts.net:8443/start` từ điện thoại |
| 1.4 | Tạo `apps/mobile`, cài package, cấu hình quyền | Repo | App trắng mở được trên cả hai máy |
| 1.5 | Bản thử kết nối: một nút Connect | Repo | ✅ Nói được với bot từ app, cả hai máy |
| 1.6 | Port hook và registry transport từ web | Repo | Kết nối qua `usePipecatApp`, đổi transport bằng config |
| 1.7 | Màn hình MVP: trạng thái, chữ hội thoại, mute, kết thúc | Repo | Thấy chữ bạn nói và bot trả lời |
| 1.8 | Cấu hình bằng `.env` | Repo | Đổi máy bot không phải sửa code |

Bước 1.5 là chốt quan trọng: nếu bộ phiên bản trên không chạy thì biết ngay, trước
khi viết giao diện.

### 1.1 Cài công cụ

**Node.js** trên cả hai máy — 20 trở lên (web app đang dùng 22):

```bash
node -v
```

#### Trên PC Ubuntu

**Android Studio** (build Android):

1. Cài Android Studio:

   ```bash
   sudo snap install android-studio --classic
   ```

   Lần mở đầu chọn *Standard* để cài Android SDK và platform-tools.
2. Thêm vào `~/.bashrc`:

   ```bash
   export ANDROID_HOME="$HOME/Android/Sdk"
   export PATH="$PATH:$ANDROID_HOME/platform-tools"
   export JAVA_HOME="/snap/android-studio/current/jbr"
   ```

   (Cài bằng file tarball thay vì snap thì `JAVA_HOME` là `<thư mục cài>/jbr`.)
3. Cho `adb` nhận điện thoại qua USB:

   ```bash
   sudo apt install android-sdk-platform-tools-common   # udev rule cho điện thoại Android
   sudo usermod -aG plugdev $USER                        # đăng xuất / đăng nhập lại
   ```

4. Mở terminal mới, kiểm tra:

   ```bash
   adb version
   java -version     # JDK 17 đi kèm Android Studio
   ```

**Giới hạn file watcher** — Metro trên Linux hay báo `ENOSPC` / hết watcher:

```bash
echo fs.inotify.max_user_watches=524288 | sudo tee /etc/sysctl.d/60-inotify.conf
sudo sysctl --system
```

Nếu bật `ufw`: iPhone ở cùng wifi cần tới được Metro (`sudo ufw allow 8081/tcp`);
qua Tailscale thì đã mở `tailscale0` ở giai đoạn 0.

#### Trên Mac

Chỉ cần cho iOS — không cài Android Studio.

**Xcode** (build iOS, chỉ có trên Mac):

1. Cài **Xcode** từ App Store (khoảng 10–15 GB, cài lâu).
2. Mở Xcode một lần, đồng ý license, cài **iOS platform** khi được hỏi.
3. Chọn đúng bộ công cụ dòng lệnh:

   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   xcodebuild -version
   ```

4. Xcode → **Settings → Accounts → +** → đăng nhập **Apple ID** (miễn phí). Xcode
   tạo một *Personal Team* để ký app.

**CocoaPods** (Expo dùng để cài thư viện native iOS):

```bash
brew install cocoapods
pod --version
```

### 1.2 Chuẩn bị điện thoại

**iPhone:**

1. Cắm vào Mac bằng cáp, chọn **Tin cậy (Trust)** trên iPhone.
2. Cài app lần đầu (bước 1.4) thì mới hiện mục **Developer Mode**: Cài đặt →
   Quyền riêng tư & Bảo mật → **Chế độ nhà phát triển** → bật, khởi động lại.
3. Lần đầu mở app sẽ bị chặn: Cài đặt → Cài đặt chung → **Quản lý VPN & Thiết
   bị** → chọn Apple ID của bạn → **Tin cậy**.

Giới hạn của Apple ID miễn phí: app hết hạn sau 7 ngày (cắm máy, chạy lại lệnh
build), tối đa 3 app tự ký cùng lúc trên một máy.

**Android:**

1. Cài đặt → Thông tin điện thoại → chạm **Số hiệu bản tạo** 7 lần để bật tuỳ
   chọn nhà phát triển.
2. Tuỳ chọn nhà phát triển → bật **Gỡ lỗi USB**.
3. Cắm vào **PC Ubuntu**, chấp nhận khoá RSA trên máy, kiểm tra:

   ```bash
   adb devices     # máy phải ở trạng thái "device"
   ```

Cả hai máy đều cài sẵn và đăng nhập Tailscale từ giai đoạn 0.

### 1.3 Mở bot ra Tailscale bằng HTTPS

Ở giai đoạn 0, điện thoại mở web qua Vite (`:5173`), Vite proxy sang bot. App thì
gọi thẳng bot, không cần Vite. Phải dùng **HTTPS**: iOS (ATS) và Android
(từ API 28) mặc định chặn `http://`.

Trên PC, khi bot đang chạy (`make run-local`, hoặc `make dev-all` nếu muốn dùng
cả web app — đừng chạy cả hai cùng lúc, chúng tranh cổng 7860):

```bash
tailscale serve --bg --https=8443 http://127.0.0.1:7860
tailscale serve status
```

Web app vẫn ở `https://<pc>.<tailnet>.ts.net` (cổng 443), bot cho app ở
`https://<pc>.<tailnet>.ts.net:8443`.

Kiểm tra từ Safari / Chrome trên điện thoại: mở
`https://<pc>.<tailnet>.ts.net:8443/client` — thấy giao diện thử của runner là
được.

### 1.4 Tạo `apps/mobile`

Cấu trúc (một màn hình nên không dùng Expo Router):

```
apps/mobile/
  app.json                 # tên app, bundle id, quyền, plugin
  .env.example             # EXPO_PUBLIC_BOT_URL, EXPO_PUBLIC_ICE_SERVERS, EXPO_PUBLIC_APP_KEY
  index.ts                 # đăng ký App
  src/
    App.tsx                # màn hình duy nhất
    lib/transports.ts      # copy từ web, đăng ký RNSmallWebRTCTransport
    lib/config.ts          # đọc biến EXPO_PUBLIC_*
    hooks/use-pipecat-app.ts
    hooks/use-conversation.ts
    components/            # status, transcript, controls
```

Cấu hình native (trong `app.json`, theo ví dụ chính thức):

- Plugin `@daily-co/config-plugin-rn-daily-js` và `expo-build-properties`
  (iOS deployment target ≥ 15, Android `minSdkVersion` ≥ 24).
- iOS: `NSMicrophoneUsageDescription` (lời giải thích xin micro, tiếng Việt).
- Android: `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `INTERNET`,
  `ACCESS_NETWORK_STATE`, `BLUETOOTH`, `WAKE_LOCK`. Bỏ các quyền camera / chia
  sẻ màn hình của ví dụ — app chỉ dùng tiếng.
- Bundle id `dev.nlp4everyone.voiceagent`. Với Apple ID miễn phí, bundle id phải
  chưa ai dùng — nếu Xcode báo trùng thì đổi trong `app.json`.
- Quyền camera tắt qua option của plugin (`enableCamera: false`), không chặn bằng
  `blockedPermissions`, để service nền của Daily khai báo đúng kiểu `microphone`.
- **Chưa bật background mode** (`UIBackgroundModes`) dù ví dụ chính thức có
  `voip` — việc giữ kết nối khi app xuống nền thuộc giai đoạn 2 (bước 2.8).

Chạy lên máy (từ `apps/mobile`):

```bash
# Trên PC Ubuntu, Android cắm vào PC
npx expo run:android --device

# Trên Mac (sau khi git pull), iPhone cắm vào Mac
npx expo run:ios --device       # lần đầu Xcode hỏi team ký → Personal Team
```

Hai lệnh này tự sinh thư mục `android/` (trên PC) và `ios/` (trên Mac). Không
commit hai thư mục này — cấu hình nằm hết trong `app.json`. Từ đây trở đi, sửa
code thì làm theo [Làm việc trên hai máy](#làm-việc-trên-hai-máy).

### 1.5 Bản thử kết nối

Một màn hình, một nút. Ghép theo README của transport:

```ts
const client = new PipecatClient({
  transport: new RNSmallWebRTCTransport({ mediaManager: new DailyMediaManager() }),
  enableMic: true,
  enableCam: false,
  callbacks: { /* log trạng thái */ },
});

await client.startBotAndConnect({
  endpoint: `${BOT_URL}/start`,
  requestData: { createDailyRoom: false, enableDefaultIceServers: true, transport: "webrtc" },
});
```

`requestData` giống hệt web app (`apps/web/src/App.tsx`), nên bot không phải sửa
gì.

**Xong khi:** trên cả iPhone và Android, qua 4G — bấm Connect, nghe bot chào, nói
và được trả lời, ngắt lời bot được.

Cần kiểm chứng ở bước này (đã đọc code transport `1.8.0`, còn phải thử trên máy):

- Với URL tuyệt đối, transport có gửi offer tới đúng
  `https://…:8443/sessions/{id}/api/offer` không. *Code:* có — lấy endpoint
  `/start` thay `/start` bằng `/sessions/{id}/api/offer`, gửi kèm cùng headers
  (nên `X-App-Key` cũng tới được offer).
- Tiếng bot mặc định ra loa ngoài hay loa thoại. *Code:* app gọi
  `client.updateMic("SPEAKERPHONE")` khi kết nối, như ví dụ chính thức.
- Có nhận được sự kiện mức âm thanh (`onLocalAudioLevel` / `onRemoteAudioLevel`) —
  giai đoạn 2 cần cho orb. Đã biết transport chỉ gửi 2 lần/giây; giai đoạn 2
  (bước 2.1) sẽ patch lên ~12 lần/giây.
- Transport có dùng `iceConfig` mà `/start` trả về không (xem 1.8). *Code:* có —
  `_connect` đọc `iceConfig.iceServers`; hook cũng gán `transport.iceServers`.

### 1.6 Port hook và registry transport

- Copy `apps/web/src/lib/transports.ts` → `apps/mobile/src/lib/transports.ts`,
  đăng ký `"smallwebrtc"` trỏ tới `RNSmallWebRTCTransport`. Chỗ `"daily"` để
  trống, sau này đăng ký `@pipecat-ai/react-native-daily-transport` vào.
- Copy `use-pipecat-app.ts`, giữ nguyên logic vòng đời client (chặn connect hai
  lần, dọn client cũ).
- Thay `INSTALL_HINTS` bằng tên gói React Native.

### 1.7 Màn hình MVP

```
┌──────────────────────────┐
│ Bạn: Hôm nay trời thế nào?│
│ Bot: Hôm nay Hà Nội nắng… │  ← danh sách cuộn, tự cuộn xuống cuối
│                          │
│           ●              │  ← chấm màu theo trạng thái
│       Đang nghe…         │
│                          │
│     [🎤]        [✕]      │  ← mute / kết thúc
│      [ Bắt đầu ]         │  ← khi chưa kết nối
└──────────────────────────┘
```

- **Trạng thái**: Đang kết nối → Đang nghe → Bot đang nói → Đã ngắt kết nối /
  Lỗi (lấy từ `onTransportStateChanged`, `onBotStartedSpeaking`,
  `onBotStoppedSpeaking`).
- **Chữ hội thoại**: lời người dùng từ `onUserTranscript` (chỉ lấy bản `final`),
  lời bot từ `onBotOutput` / `onBotTranscript`. Lưu trong state của màn hình, mất
  khi tắt app.
- **Mute**: `client.enableMic(false/true)`. **Kết thúc**: `client.disconnect()`.
- Lỗi hiện thành một dòng chữ đỏ kèm nút thử lại.

Không làm ở giai đoạn này: orb, animation, haptics, âm báo, dark mode, xử lý app
xuống nền.

### 1.8 Cấu hình bằng `.env`

`apps/mobile/.env` (không commit), mẫu ở `.env.example`:

```bash
EXPO_PUBLIC_BOT_URL=https://<pc>.<tailnet>.ts.net:8443
EXPO_PUBLIC_APP_KEY=              # trống khi dùng Tailscale
EXPO_PUBLIC_TRANSPORT=smallwebrtc
EXPO_PUBLIC_ICE_SERVERS=          # dự phòng, xem dưới; bình thường để trống
```

**ICE servers — một nguồn duy nhất là bot.** Bot đọc `PIPECAT_ICE_SERVERS` (giai
đoạn 0, bước 0.6) và trả về trong `iceConfig` của `/start`; app dùng danh sách đó.
Như vậy đổi TURN chỉ sửa `.env` của bot, không phải build lại app.
`EXPO_PUBLIC_ICE_SERVERS` chỉ dùng nếu bước 1.5 cho thấy transport React Native
không nhận `iceConfig` từ `/start`.

**API key:** nếu `EXPO_PUBLIC_APP_KEY` có giá trị, app gửi header `X-App-Key` kèm
request `/start` (tham số `headers` của `startBotAndConnect`). Trống thì không gửi.
Viết sẵn từ bây giờ để khi lên VPS chỉ cần điền giá trị.

Biến `EXPO_PUBLIC_*` được **nhúng thẳng vào app**, ai có file app đều đọc được.
`APP_KEY` vì vậy chỉ chặn người lạ gọi bot, không phải bí mật thật — đủ cho dùng
cá nhân. Khi chia sẻ app cho người khác cần cơ chế cấp token từ server.

Khi chuyển sang VPS: đổi `EXPO_PUBLIC_BOT_URL`, điền `EXPO_PUBLIC_APP_KEY`, build
lại. TURN cấu hình phía bot.

## Xong giai đoạn 1 khi

- [ ] App cài được và mở được trên iPhone và Android.
- [ ] Qua 4G: kết nối, nghe bot chào, nói chuyện, ngắt lời bot được.
- [ ] Màn hình hiện đúng chữ bạn nói và chữ bot trả lời.
- [ ] Mute và kết thúc hoạt động; kết nối lại sau khi kết thúc được.
- [ ] Đổi `EXPO_PUBLIC_BOT_URL` sang máy khác không phải sửa code.

## Rủi ro

| Rủi ro | Dấu hiệu | Cách xử lý |
|---|---|---|
| Bộ phiên bản Expo 55 / plugin Daily không build được | Lỗi `pod install` hoặc Gradle ở bước 1.4 | So từng phiên bản với ví dụ chính thức; thử plugin `0.0.13` với Expo 57 |
| Offer gửi sai địa chỉ | `/start` thành công nhưng kết nối treo | Xem log bot; truyền URL offer tường minh trong `requestData` / tham số transport |
| iPhone không tải được JS từ Metro trên PC | Dev client báo không kết nối được `…:8081` | Kiểm tra quyền Mạng cục bộ trên iPhone, `ufw`, và `REACT_NATIVE_PACKAGER_HOSTNAME` khi dùng Tailscale |
| Xcode báo lỗi ký app | `No profiles for '<bundle id>'` | Đổi bundle id khác; chọn Personal Team trong tab *Signing & Capabilities* |
| Tiếng bot ra loa thoại, nhỏ | Phải áp tai mới nghe | Chỉnh qua media manager; nếu không được thì để giai đoạn 2 (audio session) |
| Vang tiếng khi mở loa ngoài | Bot tự ngắt lời chính nó | Kiểm tra echo cancellation của WebRTC đang bật; thử với tai nghe để khoanh vùng |

## Ngoài phạm vi giai đoạn 1

- Orb, animation, phụ đề vuốt lên, haptics, âm báo — giai đoạn 2.
- Audio session (loa ngoài / tai nghe / Bluetooth), gián đoạn cuộc gọi,
  reconnect — giai đoạn 2.
- Chạy nền, CallKit, Daily transport — giai đoạn 3.
- Phát hành qua TestFlight / Play Store.
