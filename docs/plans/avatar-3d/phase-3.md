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

## Kết quả

### 3.1 Prompt

`voice_agent/config/prompts.py`: thêm `EXPRESSION_TAGS` và
`EXPRESSION_INSTRUCTION`, nối vào `DEFAULT_SYSTEM_INSTRUCTION` nên LLM chính và
LLM dự phòng dùng chung. Ai tự đặt `LLM_SYSTEM_INSTRUCTION` thì phải tự thêm
đoạn này.

Thử với Groq `openai/gpt-oss-120b` (nhiệt độ 0.2), 10 câu hỏi tiếng Việt gồm
vui, buồn, thông tin và một câu tiếng Anh: 14/14 câu có thẻ ở đầu, 0 thẻ lạ,
10/10 câu trả lời bắt đầu bằng thẻ, câu hỏi tiếng Anh vẫn trả lời tiếng Việt.
Cảm xúc chọn hợp lý (tin buồn → `sad` rồi `neutral`, trúng số → `happy`).

Chưa thấy `surprised` và `thinking` được dùng trong 10 câu này. Mới thử một lần
trên một LLM; chưa thử LLM dự phòng.

Prompt mới phải đi cùng 3.2; thiếu processor tách thẻ thì TTS đọc ra thẻ.

### 3.2 Processor tách thẻ

`voice_agent/pipeline/processors/expression_tags.py`:

- `ExpressionTagParser`: bộ tách thuần, nhận chữ theo từng đoạn. Gặp `[` thì giữ
  lại cho đến khi biết có phải thẻ không, nên thẻ vắt qua ranh giới đoạn
  (`"["`, `"hap"`, `"py]"`) vẫn đúng. Mọi chữ ngắn trong ngoặc vuông đều bị bỏ
  khỏi lời nói, kể cả thẻ lạ (`[excited]`) hay thẻ bị dịch (`[vui vẻ]`); chỉ thẻ
  trong `EXPRESSION_TAGS` mới được báo. `[1]`, `[2.5]`, `[]` giữ nguyên là chữ.
  Dấu cách ngay sau thẻ bị bỏ để câu không có hai dấu cách. Hết phản hồi mà còn
  `[hap` dở thì trả lại như chữ thường.
- `ExpressionTagProcessor`: bản đầu bọc bộ tách trong `FrameProcessor` đặt sau LLM,
  trước TTS. **Đã xoá (2026-11-20)** vì tin gửi từ chỗ đó tới sai thứ tự; xem mục
  "Độ lệch giữa mặt và giọng". `split_tags` (bộ tách dạng cả chuỗi) và
  `attach_expression_tags` thay thế nó.

Kiểm thử: `tests/test_expression_tags.py`, 23 ca (bộ tách, kể cả cắt giữa từng
ký tự; `split_tags`; `attach_expression_tags` trên TTS giả và trên một
`TTSService` thật qua `pipecat.tests.utils.run_test`). Chạy bằng
`.venv/bin/python -m unittest discover -s tests`. Dùng `unittest` vì dự án chưa
có pytest.

**Chưa kiểm tra trong cuộc gọi thật** (có TTS thật) xem TTS có đọc ra thẻ không.

Điều cần xem ở 3.4: lịch sử hội thoại do aggregator ghi sau TTS nên **không có
thẻ**; nếu LLM thấy các câu trả lời cũ không thẻ, nó có thể bắt đầu bỏ thẻ ở
các lượt sau. Cần thử hội thoại dài.

### 3.3 Gửi sự kiện biểu cảm qua RTVI

Mỗi thẻ hợp lệ thành một tin RTVI `server-message`:

```json
{"label": "rtvi-ai", "type": "server-message",
 "data": {"type": "avatar-expression", "expression": "sad"}}
```

Client nghe bằng `RTVIEvent.ServerMessage` và lọc `data.type === "avatar-expression"`.
Hằng số `EXPRESSION_MESSAGE_TYPE` nằm trong `expression_tags.py`.

**Vì sao không dùng `RTVIServerMessageFrame`:** đó là khung hệ thống, đi ngay lập
tức, nên tin tới client lúc LLM vừa viết chữ, sớm hơn giọng nói vài trăm ms đến
vài giây (TTS còn đang tạo âm thanh, câu trước còn đang phát). Thay vào đó gửi
`OutputTransportMessageFrame`, một khung dữ liệu: `TTSService` đưa khung dữ liệu
đi qua hàng đợi tuần tự cùng thứ tự với các đợt âm thanh, nên tin tới sau âm thanh
câu trước và gần lúc câu sau bắt đầu phát. Đọc từ mã Pipecat 1.8.1
(`services/tts_service.py`, nhánh `else` của `process_frame`), **chưa đo bằng
cuộc gọi thật**.

Độ trễ tin so với giọng nói **chưa đo**; xem ghi chú ở 3.4.

### 3.4 Client đặt biểu cảm

- `voice-screen.tsx` nghe `RTVIEvent.ServerMessage`, giữ biểu cảm mới nhất trong
  state và truyền xuống `AvatarStage`. Thẻ lạ bị bỏ qua, giữ biểu cảm trước đó.
  Biểu cảm bị xoá khi `orbState` về `listening` (hết lượt bot); thẻ của lượt sau
  tới trong lúc "suy nghĩ", sau mốc đó.
- `use-avatar-state.ts`: bảng `EXPRESSIONS` (thẻ → phần đè lên tư thế) và
  `useAvatarPose(state, muted, expression)`. Biểu cảm chỉ có hiệu lực khi
  `state === "speaking"`; hết nói thì tư thế quay về của trạng thái, nên "tự về
  trung tính" đến từ chính việc chuyển trạng thái, không cần bộ đếm giờ.
- Chuyển mượt nhờ `damp` sẵn có trong `avatar-stage.tsx` (cảm xúc, nghiêng, cúi,
  điểm nhìn).
- Model mặc định (VRM 0.x) có `joy / sorrow / fun / angry`, **không có `surprised`**.
  Ánh xạ: `happy` → joy 0.5; `sad` → sorrow 0.45 và cúi đầu; `surprised` → ngẩng
  đầu và một chút joy (model có `surprised` thì dùng luôn); `thinking` → nghiêng
  đầu, nhìn lên như trạng thái suy nghĩ; `neutral` → mặt trung tính, thay cho
  nụ cười nhẹ nền của trạng thái nói.
- Các giá trị biên độ chỉnh qua `/?avatar-expression` và cuộc gọi thật.
- **Cảm xúc và lip-sync tranh nhau vùng miệng.** Đo trên file model: `joy` làm
  dịch 824/826 đỉnh thuộc vùng miệng của `a/i/u/e/o` (mức dịch trung bình 0.055,
  gần bằng miệng "a" 0.063, cùng chiều, cos +0.67); `sorrow` dịch 807/826 đỉnh,
  mạnh hơn (0.098) và ngược chiều (cos −0.50). Hai thứ cộng dồn nên bản đầu
  (joy 0.8, sorrow 0.7) cho miệng quá lố khi vui và gần như không mở khi buồn.
  Sửa: hạ cường độ như trên và bù trong `avatar-stage.tsx` bằng hệ số nhân độ mở
  của miệng nói (`MOUTH_JOY_OVERLAP = 0.6` giảm, `MOUTH_SORROW_OVERLAP = 0.8`
  tăng, kẹp 0.3–1.8). Sau khi sửa, người thử thấy miệng đã được điều chỉnh.
  Đây là giải pháp bù chứ không triệt để: model chỉ có hình cảm xúc dính vào
  miệng. Cách sạch hơn là model có morph cảm xúc ở mắt/mày tách khỏi miệng.

## Kiểm tra

**Mô phỏng hội thoại dài** (Groq `openai/gpt-oss-120b`, nhiệt độ 0.2, 13 lượt gồm
vui, buồn, ngạc nhiên, hỏi thông tin; lịch sử gửi lại với câu trả lời **đã bỏ
thẻ**, đúng như aggregator ghi): 13/13 lượt có thẻ, 13/13 lượt mở đầu bằng thẻ,
0 thẻ lọt vào lời nói sau khi tách. Thẻ dùng: happy 10, thinking 7, neutral 4,
sad 2, surprised 1. Rủi ro "LLM bỏ thẻ vì lịch sử không có thẻ" **không xảy ra**
trong lần thử này. Chỉ một cuộc, một mô hình, một lần chạy.

Nhận xét chất lượng: bản prompt đầu dùng `thinking` quá nhiều (6–7 lần mỗi
cuộc 13 lượt, ổn định qua 3 lần chạy), cả cho câu hỏi gợi mở và khi liệt kê lời
khuyên (ba câu liên tiếp), nên avatar nghiêng đầu nhìn lên liên tục.

Siết lại: `EXPRESSION_INSTRUCTION` nay mô tả khi nào dùng từng thẻ, `neutral` là
mặc định cho thông tin, giải thích, lời khuyên và câu hỏi thông thường, còn
`thinking` chỉ khi thật sự ngập ngừng, hiếm khi dùng. Chạy lại cùng kịch bản
(Groq `openai/gpt-oss-120b`, 2 lần thành công, lần thứ ba bị giới hạn tốc độ 429):

| | neutral | happy | sad | surprised | thinking |
|---|---|---|---|---|---|
| Trước (3 lần) | 3–6 | 8 | 2 | 0–2 | 6–7 |
| Sau (2 lần) | 10–12 | 6–7 | 2 | 0–1 | 0 |

`thinking` hết, thẻ vẫn ở đầu mọi lượt, không lọt vào lời nói. Đổi lại `neutral`
tăng (mặt đơn điệu hơn), `happy` giảm nhẹ, `surprised` vẫn hiếm. Mới 2 lần chạy
nên số liệu chỉ để tham khảo. Chưa thử trong cuộc gọi thật.

**Cuộc gọi thật** (người thử): TTS không đọc ra thẻ; mặt đổi theo câu nói; miệng
khi vui/buồn đã ổn hơn sau khi chỉnh.

**Chưa kiểm tra**
- Độ lệch giữa lúc mặt đổi và lúc giọng nói phát: đã đo trên Linux Chrome, xem
  mục dưới. Lỗi thứ tự đã sửa bằng hướng A và nghe thử ổn trên iPhone; chưa đo số
  trên iPhone.
- LLM dự phòng (chưa cấu hình trên máy này).
- Lúc đầu có lần người thử không thấy biểu cảm, sau đó thấy; chưa có log để biết
  nguyên nhân.
- Hội thoại dài thật (mới mô phỏng bằng API).

## Độ lệch giữa mặt và giọng (đo 2026-11-20)

**Cách đo:** Chrome chạy tự động trên Linux (micro giả phát giọng VieNeu tiếng
Việt), gọi bot thật với STT và TTS chạy trên máy. Log tạm trong `voice-screen.tsx`
ghi `performance.now()` khi nhận tin `avatar-expression`, `BotStartedSpeaking` và
`BotStoppedSpeaking`; log đã gỡ sau khi đo. Chỉ đo thứ tự thời gian phía trình
duyệt, không nghe được giọng, không đo iPhone hay tai nghe Bluetooth.

| Lượt | Tin biểu cảm | `bot-start` | `bot-stop` |
|---|---|---|---|
| Lời chào | `neutral` @ 4,44 s | 4,77 s | 7,42 s |
| Trả lời 1 câu | `happy` @ 14,12 s | 14,44 s | 17,17 s |
| Trả lời 3 câu (buồn, vui, ngạc nhiên) | `sad` @ 18,90 s, `happy` @ 18,94 s | 19,26 s | 29,82 s |
| Cùng lượt 3 câu | `surprised` @ 29,82 s | | |

- **Thẻ đầu của lượt:** tin tới sớm hơn `bot-start` khoảng 0,3 s. Nhỏ.
- **Từ thẻ thứ hai:** sai. `sad` và `happy` tới cách nhau 41 ms, cùng trước khi giọng
  bắt đầu, nên mặt nhảy ngay sang `happy` và câu buồn được nói với mặt vui.
  `surprised` tới sát `bot-stop`, tức cuối lượt. Chỉ một lượt 3 câu, một lần chạy.
- **Doc 3.3 nói chưa đúng:** "tin tới sau âm thanh câu trước và gần lúc câu sau
  bắt đầu phát" chỉ đúng với thẻ đầu. Phần "đọc từ mã Pipecat" đã bỏ sót hai điều
  dưới đây.

### Nguyên nhân (đọc `pipecat/services/tts_service.py`, Pipecat 1.8.1)

1. **Mọi câu của một lượt dùng chung một audio context** (`_turn_context_id`).
   Khung không phải hệ thống đi qua `_serialization_queue`, và hàng đợi này chỉ nhả
   khung kế tiếp khi cả context trước đã phát hết. Nên tin biểu cảm xếp sau
   *câu đầu* phải chờ cả lượt, không chỉ chờ câu trước nó.
2. **Bộ gộp câu cần nhìn trước.** Câu 1 chỉ được đóng khi chữ đầu của câu 2 tới.
   Processor hiện đẩy tin `happy` ngay sau thẻ, tức *trước* chữ đầu của câu 2, nên
   tin được xếp vào hàng đợi trước khi câu 1 kịp vào. Đó là lý do `sad` và `happy`
   tới liền nhau.

### Đã thử và bỏ (2026-11-20)

Hoãn tin tới sau đoạn chữ đầu tiên theo thẻ (để bộ gộp đóng câu trước rồi mới xếp
tin). Chạy lại cùng kịch bản: `sad` tới đúng lúc giọng bắt đầu (19,61 s so với
19,95 s), nhưng `happy` và `surprised` cùng tới lúc `bot-stop` (29,23 s). Nguyên
nhân 1 vẫn còn, nên chỉ sửa được thẻ đầu. Không giữ thay đổi này; bản diff nằm ở
scratchpad của phiên, không trong repo.

### Hướng A: đã thử và chạy được (2026-11-20, chưa commit)

Thẻ đi cùng chữ vào TTS thay vì bị tách ở trước. `attach_expression_tags(tts)` trong
`expression_tags.py`, gọi ở `pipeline/builder.py` thay cho `ExpressionTagProcessor` (đã xoá):

- một text transformer bỏ thẻ khỏi chữ gửi đi tổng hợp giọng;
- `tts.push_frame` được bọc (ở mức đối tượng): khi TTS đẩy `AggregatedTextFrame` của
  một câu (đúng thứ tự với âm thanh, ngay trước âm thanh câu đó), bỏ thẻ khỏi
  khung rồi đẩy tin RTVI ngay sau. `TTSTextFrame` (phụ đề, lịch sử hội thoại) cũng
  được bỏ thẻ nhưng không gửi tin lần hai.

Đo lại cùng kịch bản 3 câu, hai lần chạy (Linux Chrome, giọng VieNeu), thời điểm
tính từ `bot-start`:

| Lần | `sad` | `happy` | `surprised` | `bot-stop` |
|---|---|---|---|---|
| 1 | −0,29 s | +3,5 s | +6,3 s | +9,2 s |
| 2 | −0,30 s | +4,8 s | +8,3 s | +11,4 s |

Tin tới rải theo lượt, khoảng cách giữa các tin gần bằng thời lượng từng câu, thay
vì dồn ở đầu hoặc cuối như trước. Log phía server cho thấy chữ gửi TTS không có
thẻ, và chữ trong phụ đề ở trang không có thẻ. Chưa thấy lỗi nào.

**Nghe thử trên iPhone (2026-11-20, người dùng, Safari, qua `tailscale serve`, bot
thật, bản build có hướng A):** mặt đổi cùng lúc giọng chuyển sang câu mới; câu buồn
hiện mặt buồn; không lần nào đọc ra chữ thẻ; phụ đề không có thẻ hay ngoặc vuông.
Nhận xét bằng mắt và tai, không đo bằng số, không ghi riêng từng lượt.

**Giới hạn:** số đo ở trên chỉ là thứ tự thời gian phía trình duyệt trên Linux,
hai lần chạy, một kịch bản; đánh giá "đúng lúc" trên iPhone là của người nghe.

**Còn phải xem:**
- Lịch sử hội thoại của LLM vẫn không có thẻ (như trước), vì `TTSTextFrame` bị bỏ
  thẻ; rủi ro "LLM bỏ thẻ ở lượt sau" vẫn chỉ được kiểm bằng mô phỏng.
- Câu chỉ gồm thẻ (ví dụ `[happy]` rồi hết phản hồi) sẽ gửi chữ rỗng cho TTS; chưa thử.
- Bọc `tts.push_frame` ở mức đối tượng phụ thuộc việc Pipecat gọi `self.push_frame`.
  Quyết định giữ cách này thay vì lớp con (5 nhà cung cấp TTS ở `factory.py`, mỗi
  nhà một lớp là quá nhiều); thay vào đó `AttachToRealTTSTest` chạy trên một
  `TTSService` thật và **sẽ fail nếu nâng cấp Pipecat làm đổi cách TTS đẩy khung**
  (đã thử bằng cách bỏ dòng gán `tts.push_frame`: test fail). Nếu đổi nhà cung cấp
  TTS thì vẫn phải thử lại, nhất là Cartesia ở chế độ TOKEN, nơi
  `AggregatedTextFrame` được gộp khác (xem `tts_service.py` `_is_streaming_tokens`).

Hướng B (mỗi câu một audio context) và C (chỉ giữ thẻ đầu) không còn cần thiết.
Kịch bản đo nằm ở scratchpad (`run.mjs`, `pad.wav`), không trong repo.
