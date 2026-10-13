# Lượt nói

Trong hội thoại thật, ai cũng tự biết lúc nào đến lượt mình. Bot thì phải được
dạy. Phần này trả lời ba câu hỏi:

1. **Khi nào người dùng bắt đầu nói?** → bot im, bắt đầu nghe.
2. **Khi nào người dùng nói xong?** → bot gửi câu cho LLM và trả lời.
3. **Khi nào bỏ qua tiếng người dùng?** → ví dụ khi bot đang nói, không cho ngắt lời.

Ba luật này được gom thành một **chế độ hội thoại**, chọn bằng `TURN_PROFILE`.

## Các chế độ có sẵn

| `TURN_PROFILE` | Dùng cho | Hành vi |
|---|---|---|
| `webrtc` *(mặc định)* | Trình duyệt | Không ngắt lời được khi bot đang nói |
| `telephony` | Điện thoại | Tiếng ồn nhiều: cần vài từ mới tính là bắt đầu nói; nói xong là khi im một khoảng cố định |
| `kiosk` | Thiết bị công cộng | Chỉ phản ứng sau câu đánh thức *"xin chào bot"* |
| `intake` | Điền form, hỏi thông tin | Chờ người dùng nói hết ý — LLM có thể bảo "chưa xong, chờ tiếp" |

Định nghĩa các chế độ: `voice_agent/config/profiles.py`.

## Ba luật, chi tiết

### Bắt đầu nói (`start`)

| Giá trị | Ý nghĩa |
|---|---|
| `vad` | Có tiếng nói là tính — nhanh nhất |
| `min_words` | Khi bot đang nói, phải nghe đủ vài từ mới tính — lọc tiếng ho, tiếng ồn |
| `wake_phrase` | Chờ câu đánh thức trước |

### Nói xong (`stop`)

| Giá trị | Ý nghĩa |
|---|---|
| `smart_turn` | Một model nhỏ chạy local đoán người dùng đã nói xong chưa — xử lý tốt lúc ngập ngừng giữa câu |
| `speech_timeout` | Im lặng đủ một khoảng (mặc định 0.6 giây) là xong — đơn giản, nhưng dễ cắt lời người nói chậm |

Dù chọn gì, nếu một lượt kéo dài quá 5 giây mà chưa kết thúc, bot sẽ tự đóng lượt.

### Bỏ qua tiếng người dùng (`mute`)

| Giá trị | Ý nghĩa |
|---|---|
| `none` | Không bao giờ bỏ qua — luôn ngắt lời được |
| `always` | Bỏ qua mỗi khi bot đang nói — không ngắt lời được |
| `first_speech` | Chỉ bỏ qua trong câu đầu tiên của bot |
| `until_first_complete` | Bỏ qua từ đầu đến khi bot nói xong câu đầu tiên |

## Đánh đổi chính

Kết thúc lượt **sớm** → bot trả lời nhanh nhưng dễ cắt ngang người dùng.
Kết thúc lượt **muộn** → ít cắt ngang nhưng bot có vẻ chậm.

Thử chế độ mặc định trước; nếu bot hay cắt lời thì đổi sang `smart_turn` hoặc
tăng `speech_timeout`.

Code: `voice_agent/turns/` (luật) và `voice_agent/events/turns.py` (log sự kiện).
