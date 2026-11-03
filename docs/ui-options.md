# Các cách nối UI (kiểu ChatGPT Voice)

> Ghi chú tạm, 2026-10-16. Để xem lại sau, chưa chốt.

## Hiện trạng

- Bot chạy trên Pipecat với 2 transport: `webrtc` (SmallWebRTC) và `daily`
  (`TRANSPORT_PARAMS` trong `voice_agent/main.py`).
- **RTVI đã bật**: `ctx.worker.rtvi` được dùng trong `voice_agent/events/rtvi.py`
  (`on_client_ready` để bot tự chào). Phía server gần như sẵn sàng, phần còn lại
  chủ yếu là frontend.
- `/client` hiện tại chỉ là UI dựng sẵn của Pipecat runner, đơn giản và khó tuỳ biến.

## Các cách, xếp theo độ phức tạp tăng dần

| # | Cách | Phải làm gì | Độ phức tạp |
|---|---|---|---|
| 1 | **Daily Prebuilt** | Nhúng iframe, chạy `-t daily`. Gần như không viết code | ★☆☆☆☆ |
| 2 | **Voice UI Kit** (`@pipecat-ai/voice-ui-kit`) | Ghép component có sẵn, chỉnh theme | ★★☆☆☆ |
| 3 | **Client SDK + React tự viết** | Tự dựng UI và animation từ event RTVI, SDK lo hết phần audio/WebRTC | ★★★☆☆ |
| 4 | **App di động** (iOS/Android/RN/Flutter) | Như cách 3 nhưng native: quyền mic, audio session, chạy nền | ★★★★☆ |
| 5 | **LiveKit** | Thêm transport mới ở server, chạy và vận hành LiveKit server, dùng SDK của LiveKit | ★★★★☆ |
| 6 | **WebSocket tự viết hoàn toàn** | Tự thu PCM, tự phát audio, xử lý jitter, xoá buffer khi bị ngắt lời, tự đảm bảo khử vọng, tự viết serializer | ★★★★★ |

Thứ tự 4 và 5 có thể đổi chỗ: nếu đã quen làm native thì cách 4 dễ hơn, nếu đã
quen vận hành hạ tầng thì cách 5 dễ hơn.

### 1. Daily Prebuilt

- Nhúng iframe là chạy được.
- Giao diện kiểu họp video, **không** giống ChatGPT Voice.

### 2. Pipecat Voice UI Kit

- Bộ component React có sẵn: visualizer, khung transcript, nút điều khiển, chạy
  trên nền Client SDK (cách 3).
- Nhanh nhất để có bản demo đẹp (khoảng 1–2 ngày), sau đó thay dần bằng component
  tự viết.

### 3. Pipecat Client SDK (RTVI) + React tự viết

- Các package: `@pipecat-ai/client-js`, `@pipecat-ai/client-react`, cộng thêm transport:
  - `@pipecat-ai/small-webrtc-transport`: khớp với `-t webrtc`, không cần dịch vụ ngoài.
  - `@pipecat-ai/daily-transport`: khớp với `-t daily`.
- Event RTVI tương ứng với từng phần UI kiểu ChatGPT Voice:

| Hiệu ứng UI | Event / API của RTVI |
|---|---|
| Quả cầu "thở" theo giọng | `onLocalAudioLevel` / `onRemoteAudioLevel` |
| Trạng thái đang nghe / đang nghĩ / đang nói | `onUserStartedSpeaking`, `onUserStoppedSpeaking`, `onBotStartedSpeaking`, `onBotStoppedSpeaking` |
| Phụ đề trực tiếp | `onUserTranscript`, `onBotTranscript` / bot TTS text |
| Nút mute, kết thúc cuộc gọi | `enableMic(false)`, `disconnect()` |
| Gõ chữ trong lúc đang gọi | gửi text qua RTVI (`sendText` / client message) |
| Ngắt lời bot | đã có sẵn ở server (turn strategies) |

- **Ưu điểm:** tuỳ biến hoàn toàn, độ trễ thấp (WebRTC dùng UDP, có sẵn khử vọng),
  không phải sửa pipeline.
- **Server cần thêm:** cấu hình CORS, STUN/TURN để chạy ngoài localhost (đã có trong roadmap).

### 4. App di động

- Pipecat có client SDK cho iOS, Android, React Native và Flutter, cùng giao thức
  RTVI. Backend giữ nguyên, chỉ viết lại UI native.

### 5. LiveKit

- Pipecat có `LiveKitTransport`, LiveKit có sẵn agent UI.
- Phải thêm transport mới vào `TRANSPORT_PARAMS` và tự chạy LiveKit server.
- Chỉ đáng làm nếu đã dùng LiveKit sẵn hoặc bắt buộc phải tự host toàn bộ.

### 6. WebSocket transport + frontend tự viết

- Server đổi sang `FastAPIWebsocketTransport` với serializer (protobuf), client tự
  đẩy PCM từ mic qua WebSocket.
- **Ưu điểm:** không phụ thuộc WebRTC, dễ đi qua proxy hoặc firewall.
- **Nhược điểm:** TCP bị head-of-line blocking nên độ trễ và jitter kém hơn, phải tự
  xử lý phát audio và khử vọng. Không nên dùng cho trải nghiệm kiểu ChatGPT Voice.

## Hợp với production nhất: Client SDK (cách 3) + Daily transport

- **Hạ tầng WebRTC có người lo:** Daily có sẵn TURN, SFU nhiều vùng, tự chịu được
  mạng 4G hay mạng công ty chặn UDP. Đây là phần khó nhất khi đưa voice lên production.
- **Khớp sẵn với stack:** base image `dailyco/pipecat-base` và Pipecat Cloud chạy
  được ngay, mỗi phiên tách riêng, scale theo số phiên.
- **Không khoá UI:** UI vẫn tự viết hoàn toàn. Nếu đổi transport thì phía client
  chỉ đổi một dòng (`DailyTransport` ↔ `SmallWebRTCTransport`).

Hai lựa chọn còn lại khi lên production:

- **SmallWebRTC (P2P):** chạy được production nhưng phải tự dựng TURN (coturn), và
  mỗi phiên gắn chặt với một process bot. Hợp khi lượng người dùng nhỏ hoặc muốn
  tránh chi phí Daily.
- **LiveKit:** hợp nếu cần tự host toàn bộ (dữ liệu không được ra ngoài, không phụ
  thuộc vendor). Đổi lại phải tự vận hành thêm một server.

## Custom mạnh nhất

Tuỳ muốn custom ở tầng nào:

- **Giao diện và trải nghiệm** (quả cầu, animation, phụ đề, gõ chữ khi đang gọi,
  các trạng thái): **cách 3** đã custom được 100%, ngang với tự viết WebSocket, mà
  không phải tự lo phần audio.
- **Giao thức và đường truyền audio** (định dạng frame, codec, chạy qua proxy riêng):
  chỉ **cách 6** mới cho kiểm soát toàn bộ. Cái giá là độ trễ kém hơn và rất nhiều
  việc xử lý audio phải tự làm. Trường hợp kiểu ChatGPT Voice hiếm khi cần mức này.

## Kết luận

Chọn **cách 3**: điểm cân bằng tốt nhất giữa khả năng custom và độ ổn định khi lên
production. Lúc dev dùng SmallWebRTC, khi lên production chuyển sang Daily (hoặc
LiveKit nếu bắt buộc tự host).

### Các bước gợi ý

1. Tạo thư mục `client/` (Vite + React + `@pipecat-ai/client-react` +
   `small-webrtc-transport`), trỏ tới endpoint offer của runner (cổng 7860).
   Có thể bắt đầu từ Voice UI Kit cho nhanh.
2. Dựng 4 trạng thái của quả cầu: idle, listening, thinking, speaking, lấy từ các
   event RTVI ở bảng trên.
3. Kiểm tra STT tự host (`voice_agent/services/stt/vllm.py`, `vllm_realtime.py`) có
   phát ra transcription frame, interim lẫn final, để phụ đề hiện đúng.
4. Khi deploy: bật TURN server và CORS.