# Giai đoạn 3 — Biểu cảm theo ngữ cảnh

Mục tiêu: avatar cười, buồn, ngạc nhiên… đúng ngữ cảnh câu trả lời. Đây là giai
đoạn **duy nhất đụng backend** (`voice_agent/`).

## Cách làm

```
LLM ──► "[happy] Chào bạn!" ──► processor tách thẻ ──┬─► TTS đọc "Chào bạn!"
                                                    └─► RTVI server message ──► client đổi biểu cảm
```

1. Sửa prompt (`voice_agent/config/prompts.py`) để LLM chèn thẻ biểu cảm ở đầu
   câu, từ một danh sách cố định.
2. Thêm một processor Pipecat đứng giữa LLM và TTS: tách thẻ khỏi văn bản và gửi
   sự kiện biểu cảm qua RTVI. Sự kiện RTVI hiện đã đăng ký trong
   `voice_agent/events/rtvi.py`.
3. Client nhận sự kiện, đặt expression VRM (`happy`, `sad`, `angry`,
   `surprised`, `relaxed`…) và trả về trung tính sau một khoảng thời gian.

Danh sách thẻ ban đầu (đủ nhỏ để LLM tuân thủ): `neutral`, `happy`, `sad`,
`surprised`, `thinking`. Thêm khi cần.

## Các bước

| # | Việc | Xong khi |
|---|---|---|
| 3.1 | Sửa prompt, thử với LLM đang dùng | LLM chèn thẻ nhất quán, bằng tiếng Việt vẫn đúng định dạng |
| 3.2 | Processor tách thẻ, đặt đúng vị trí trong `pipeline/builder.py` | TTS không đọc ra thẻ |
| 3.3 | Gửi sự kiện biểu cảm qua RTVI | Client nhận được sự kiện |
| 3.4 | Client: đặt expression, mượt khi chuyển, tự về trung tính | Biểu cảm đổi tự nhiên |

### Điều cần chú ý

- Thẻ có thể bị chia giữa hai đoạn văn bản khi LLM stream. Processor phải xử lý
  thẻ nằm vắt qua ranh giới đoạn.
- LLM đôi khi quên thẻ hoặc bịa thẻ lạ: bỏ qua và giữ biểu cảm trước đó.
- Bot dự phòng (LLM thứ hai) cũng phải tuân thủ cùng định dạng.
- Thêm kiểm thử cho processor tách thẻ.

**Xong khi:** bot biểu cảm đúng ngữ cảnh trong hội thoại thật, và TTS không bao
giờ đọc ra thẻ.
