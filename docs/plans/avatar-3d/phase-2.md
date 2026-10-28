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

VieNeu và Cartesia có trả mốc thời gian theo từ hay không: chưa kiểm tra. Nếu
không có thì bỏ 2.5, biên độ là lựa chọn thực tế.

**Xong khi:** nói chuyện vài phút với bot, miệng khớp giọng và không giật.
