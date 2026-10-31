# Giai đoạn 2 — Mấp máy môi theo giọng bot

Mục tiêu: miệng avatar khớp với giọng bot, không giật, hợp với tiếng Việt.

## Cách làm

Dùng `AnalyserNode` trên `MediaStreamTrack` của bot (đã có hạ tầng tương tự ở
`lib/visualizer.ts`) để lấy biên độ và dải tần, làm mượt, rồi ánh xạ sang các
expression `aa / ih / ou / ee / oh`.

- Biên độ quyết định mức mở miệng.
- Dải tần chính (thấp / giữa / cao) gợi ý hình miệng gần đúng.
- Giới hạn cường độ tối đa cho chibi: đầu to nên miệng mở quá lố sẽ lộ ngay.
- Tiếng Việt có nhiều nguyên âm hơn 5 hình miệng của VRM; một số âm sẽ gộp
  chung một hình. Với avatar cách điệu, chênh lệch này thường khó thấy, nhưng
  phải xem bằng mắt với giọng VieNeu thật.
- Thanh điệu đổi cao độ chứ không đổi hình miệng nên không xử lý riêng.

## Các bước

| # | Việc | Xong khi |
|---|---|---|
| 2.1 | `use-avatar-lipsync`: lấy biên độ và dải tần từ track của bot | Có tín hiệu 0–1 theo thời gian |
| 2.2 | Làm mượt (tấn công nhanh, thả chậm) và giới hạn cường độ | Miệng không giật |
| 2.3 | Ánh xạ sang expression VRM | Miệng đổi hình theo giọng |
| 2.4 | Tinh chỉnh với giọng VieNeu và model đã chọn | Nhìn tự nhiên khi bot nói vài câu dài |
| 2.5 | *(Tuỳ chọn)* Hướng nhẹ theo chữ: ánh xạ nguyên âm sang viseme | Chỉ làm nếu 2.4 chưa đủ đẹp **và** TTS có mốc thời gian theo từ |

### Điều chưa biết

VieNeu và Cartesia có trả mốc thời gian theo từ hay không: đã kiểm tra ở 2.5
bên dưới.

**Xong khi:** nói chuyện vài phút với bot, miệng khớp giọng và không giật.

## Kết quả

### 2.1–2.3 Lip-sync theo biên độ

`components/avatar/use-avatar-lipsync.ts`: `AnalyserNode` trên track của bot,
năng lượng trung bình quyết định độ mở, ba dải tần (200–700, 700–1800,
1800–4000 Hz) chia tỉ lệ cho `aa / oh+ou / ee+ih`. Làm mượt bằng `damp`
(`ATTACK` nhanh, `RELEASE` chậm), giới hạn `MAX_OPEN = 0.7`.

### 2.4 Tinh chỉnh với giọng VieNeu thật

Gọi bot thật với giọng "Mai Anh" (`vieneu-v3-turbo`). Nhận xét: miệng ổn, khớp
nhịp ngắt nghỉ; đôi lúc thấy hơi nhanh. Hằng số hiện tại `ATTACK = 35`,
`RELEASE = 12`, `NOISE_FLOOR = 0.12`, `FULL_LEVEL = 0.5`, `MAX_OPEN = 0.7`.

**Chưa chốt.** Chưa rõ "hơi nhanh" là miệng đóng mở dồn dập hay miệng đi trước
tiếng. Hướng thử: giảm làm mượt (gợi ý `ATTACK = 20`, `RELEASE = 7`, chưa
kiểm chứng); nếu miệng đi trước tiếng thì thêm độ trễ nhỏ cho miệng.

### 2.5 Viseme theo chữ: bỏ

Điều kiện làm 2.5 là TTS có mốc thời gian theo từ. Đã kiểm tra:

- **VieNeu**: không có. `/v1/audio/speech` không nhận tham số timestamp; gọi
  thật ở chế độ `sse` chỉ trả `speech.audio.delta` và `speech.audio.done`, với
  các khoá `type`, `audio`, `usage`.
- **Cartesia**: có, đọc từ tài liệu (chưa gọi thật vì chưa có khoá). Tham số
  `add_timestamps` (mặc định `false`) làm server gửi thông điệp
  `type: "timestamps"` với `word_timestamps.{words,start,end}` tính bằng giây.
  Pipecat đã xử lý sẵn (`pipecat/services/cartesia/tts.py`). Docs không nói
  model hay ngôn ngữ nào hỗ trợ; tiếng Việt (`vi`) có trong danh sách ngôn ngữ
  nhưng chưa xác nhận có timestamp. Changelog Sonic 3.5 ghi thời điểm bắt đầu
  từ có thể đổi.

Bot đang dùng VieNeu nên bỏ 2.5; biên độ là lựa chọn thực tế.

## Hướng cải thiện sau

Chỉ đáng làm nếu hình miệng sai rõ (ví dụ "u" ra hình "a") hoặc avatar trở
thành điểm nhấn chính. Muốn mô phỏng đúng cần ba thứ:

1. **Dữ liệu âm vị có thời gian**: mốc âm vị từ TTS (Cartesia có
   `add_phoneme_timestamps`, chưa kiểm tra với tiếng Việt), hoặc forced
   alignment trên văn bản và âm thanh đã sinh, hoặc mô hình âm thanh → khuôn
   mặt (kiểu Audio2Face).
2. **Model đủ hình miệng**: VRM chỉ có 5 hình, không đủ cho môi khép (b, m, p),
   răng cắn môi (f, v), môi chu (u, ô, ơ). Cần viseme (kiểu 15 viseme Oculus)
   hoặc ARKit 52 blendshape. Chưa kiểm tra model Mocking Spit có đủ không.
3. **Động học và đồng bộ**: coarticulation (hình miệng phụ thuộc âm trước và
   sau), nhìn trước (môi chuyển trước tiếng một chút), bù độ trễ đệm và phát
   cho mốc thời gian từ TTS.

Riêng tiếng Việt: thanh điệu không đổi hình miệng; nhiều nguyên âm đôi và ba
(ia, ua, ươ, uyê) đổi hình trong một âm tiết; phụ âm cuối p, m khép môi còn
t, c, ng, nh thì không. Chữ viết gần với âm đọc nên từ chữ ra âm vị khá dễ.

| Mức | Cần gì | Độ chính xác |
|---|---|---|
| Hiện tại | Biên độ + phổ | Ổn cho avatar cách điệu |
| Trung bình | Mốc từ + chữ + biên độ (đổi sang Cartesia) | Hình miệng đúng hơn, nhịp vẫn theo biên độ |
| Cao | Mốc âm vị + model có viseme + coarticulation | Khớp sát |

Mức trung bình: chữ chọn hình (a, i, u, e, o), biên độ thật quyết định lúc mở
và mức mở. Mốc theo từ không cho biết nguyên âm nằm ở đâu trong từ.
