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
- `ExpressionTagProcessor`: bọc bộ tách trong `FrameProcessor`. Đặt sau LLM, trước
  TTS trong `pipeline/builder.py`. Gọi `on_expression(tag)` cho mỗi thẻ hợp lệ
  theo thứ tự LLM viết; hiện chưa có ai nghe (nối ở 3.3). Reset khi bắt đầu phản
  hồi mới hoặc khi bị ngắt lời.

Kiểm thử: `tests/test_expression_tags.py`, 21 ca (bộ tách, kể cả cắt giữa từng
ký tự; processor qua `pipecat.tests.utils.run_test`). Chạy bằng
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
- Độ lệch giữa lúc mặt đổi và lúc giọng nói phát (chưa đo; người thử không nêu
  độ lệch rõ rệt).
- LLM dự phòng (chưa cấu hình trên máy này).
- Lúc đầu có lần người thử không thấy biểu cảm, sau đó thấy; chưa có log để biết
  nguyên nhân.
- Hội thoại dài thật (mới mô phỏng bằng API).
