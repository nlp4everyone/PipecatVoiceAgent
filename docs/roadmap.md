# Lộ trình

## Đã có

- Hội thoại giọng nói tiếng Việt qua WebRTC và Daily
- Đổi STT / LLM / TTS bằng biến môi trường
- STT tự host bằng vLLM (theo câu và streaming)
- TTS tự host bằng VieNeu-TTS
- LLM dự phòng
- Các chế độ hội thoại: `webrtc`, `telephony`, `kiosk`, `intake`
- Chạy bằng Docker (dev và server)

## Dự định

**Tính năng hội thoại**

- Kết thúc phiên đúng cách
- Lọc tiếng ồn đầu vào
- Phát hiện người dùng im lặng lâu
- Tóm tắt hội thoại dài
- Chuẩn hoá chữ trước khi đọc (số, ngày tháng, viết tắt)
- Phản hồi ngắn khi đang nghe ("ừm", "vâng")
- Bộ nhớ dài hạn

**Theo dõi**

- Lưu transcript
- Ghi âm cuộc hội thoại
- Đo độ trễ, phân tích (OpenTelemetry, Finchvox)
- Hỗ trợ mạng phức tạp cho WebRTC (STUN / TURN)

**Cấu hình và giao diện**

- Chuyển nhà cung cấp trong lúc đang chạy
- Giao diện web riêng (RTVI client)
- Avatar: mấp máy môi sát hơn theo âm vị (cần TTS có mốc âm vị và model có viseme), xem `plans/avatar-3d/phase-2.md`
- Sửa cấu hình cổng trong docker compose

Danh sách chi tiết kèm link tài liệu Pipecat: `note.txt`.
