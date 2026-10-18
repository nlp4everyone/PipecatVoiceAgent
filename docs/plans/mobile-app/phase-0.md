# Giai đoạn 0 — Hạ tầng cho app mobile

Mục tiêu: điện thoại (iOS/Android) nói chuyện được với bot chạy trên PC ở nhà,
**kể cả khi đang dùng 4G**. Chưa viết app ở giai đoạn này — dùng luôn web app
(`apps/web`) trên trình duyệt điện thoại để kiểm chứng hạ tầng. Hạ tầng đã chạy
thì lỗi ở các giai đoạn sau chắc chắn nằm ở app, không phải ở mạng.

## Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Máy chạy bot | PC Ubuntu, bật liên tục. Đây cũng là máy làm việc chính từ giai đoạn 1 (viết code, Metro, build Android); Mac chỉ build iOS |
| Kết nối từ điện thoại | [Tailscale](https://tailscale.com) — gói Personal, miễn phí, không cần thẻ |
| Transport | SmallWebRTC (Daily để dành, chưa dùng) |
| TURN | Chưa cần. Khi có VPS sẽ tự host [coturn](https://github.com/coturn/coturn) |
| Xác thực `/start` | Chưa cần — chỉ thiết bị trong tailnet mới truy cập được |

## Vì sao là Tailscale

Âm thanh WebRTC đi bằng UDP. Cloudflare Tunnel chỉ chuyển HTTP nên tín hiệu
(`/start`, `/api/offer`) qua được nhưng âm thanh thì không — trên 4G sẽ kết nối
xong mà không nghe thấy gì, trừ khi có thêm TURN server.

Tailscale đặt PC và điện thoại vào cùng một mạng riêng (WireGuard). Bot và điện
thoại thấy nhau qua IP `100.x.y.z`, nên cả tín hiệu lẫn âm thanh đều đi được mà
không cần TURN, không cần mở port trên router, không bị ảnh hưởng bởi CGNAT. Khi
hai đầu không đi thẳng được, Tailscale tự chuyển qua relay DERP của họ.

```
Điện thoại (4G, Tailscale bật)
   │  HTTPS  https://<pc>.<tailnet>.ts.net  ──▶ tailscale serve ──▶ Vite :5173 ──▶ bot :7860
   │                                                              (proxy /start, /sessions, /api/offer)
   └─ WebRTC audio (UDP qua tailscale0) ◀──────────────────────────────────────▶ bot
```

Đánh đổi: điện thoại phải cài và bật Tailscale (hiện như một VPN; iOS chỉ chạy
được một VPN mỗi lúc). Chỉ thiết bị của bạn dùng được.

## Các bước

| # | Việc | Ai làm | Xong khi |
|---|---|---|---|
| 0.1 | Chạy bot trên PC | Bạn | Nói được với bot tại `localhost` |
| 0.2 | Cài Tailscale trên PC và điện thoại | Bạn | `tailscale status` thấy cả hai |
| 0.3 | Cho Vite nhận tên miền `*.ts.net` | Repo | Mở được web qua `*.ts.net` |
| 0.4 | Kiểm tra qua 4G | Bạn | ✅ Nói chuyện trơn tru, ngắt lời được |
| 0.5 | *(Tuỳ chọn)* Tự chạy khi khởi động máy | Repo + bạn | Reboot xong vẫn dùng được |
| 0.6 | *(Tuỳ chọn)* Chuẩn bị chuyển sang VPS | Repo | Có sẵn cấu hình ICE |

Làm theo thứ tự 0.1 → 0.4. Qua được 0.4 là sang giai đoạn 1.

### 0.1 Chạy bot trên PC

Theo [getting-started.md](../getting-started.md): `make env`, điền `.env`, rồi

```bash
make run-local
```

Mở <http://localhost:7860/client> trên PC, cho phép micro và nói thử.

Dùng `make run-local` (chạy thẳng bằng `uv`), **không** dùng `make dev`: trong
Docker, bot quảng bá IP của container — điện thoại không tới được IP đó. Nếu sau
này muốn chạy bot trong Docker thì phải dùng `network_mode: host`.

### 0.2 Cài Tailscale

Đăng ký tại <https://login.tailscale.com> bằng Google / GitHub / Microsoft / Apple.

Trên PC:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up                         # mở link in ra để đăng nhập
sudo tailscale set --operator=$USER       # để chạy `tailscale serve` không cần sudo
```

Nếu đang bật `ufw`:

```bash
sudo ufw allow in on tailscale0
```

Trên điện thoại: cài app Tailscale (App Store / Google Play), đăng nhập **cùng
tài khoản**.

Kiểm tra trên PC:

```bash
tailscale status      # phải thấy cả PC lẫn điện thoại
tailscale ip -4       # IP 100.x.y.z của PC
```

Trong trang quản trị Tailscale → **DNS**: bật **MagicDNS** và **HTTPS
Certificates** (cần cho bước 0.4 — micro trên trình duyệt điện thoại chỉ chạy
qua HTTPS).

### 0.3 Cho Vite nhận tên miền `*.ts.net`

Vite chặn request có `Host` lạ. `apps/web/vite.config.ts` hiện chỉ cho phép
`.trycloudflare.com`; thêm `.ts.net`:

```ts
allowedHosts: ['.trycloudflare.com', '.ts.net'],
```

Proxy `/start`, `/sessions`, `/api/offer` đã có sẵn, nên với web app chỉ cần
expose một cổng (5173) ra Tailscale. App mobile ở giai đoạn 1 gọi thẳng bot qua
một cổng HTTPS thứ hai (`8443`) — xem [phase-1.md](phase-1.md#13-mở-bot-ra-tailscale-bằng-https).

### 0.4 Kiểm tra qua 4G

Trên PC:

```bash
make dev-all                  # bot :7860 + web :5173
tailscale serve --bg 5173     # https://<pc>.<tailnet>.ts.net → http://127.0.0.1:5173
tailscale serve status        # xem URL đầy đủ
```

Trên điện thoại:

1. **Tắt wifi**, chỉ dùng 4G. Bật Tailscale.
2. Mở `https://<pc>.<tailnet>.ts.net`, bấm **Bắt đầu trò chuyện**, cho phép micro.
3. Nói chuyện vài phút, thử ngắt lời bot giữa câu.

Xem đường đi của kết nối (trên PC):

```bash
tailscale ping <tên-điện-thoại>
```

- `via <ip>:<port>` — **direct**, tốt nhất.
- `via DERP(...)` — đang đi qua relay của Tailscale. Vẫn dùng được, nhưng relay
  chạy trên TCP nên mạng 4G yếu có thể giật hoặc trễ hơn.

**Xong khi:** qua 4G nói chuyện trơn tru, nghe rõ hai chiều, ngắt lời bot được.

Tắt khi không dùng: `tailscale serve --https=443 off`.

### 0.5 *(Tuỳ chọn)* Tự chạy khi khởi động máy

PC bật liên tục nên nên để bot, web và `tailscale serve` tự chạy lại sau khi
reboot:

- Tạo `systemd --user` service cho bot (`uv run bot.py -t webrtc`) và web
  (`npm run dev` trong `apps/web`), rồi `loginctl enable-linger $USER` để chúng
  chạy cả khi chưa đăng nhập.
- `tailscale serve --bg` đã tự nhớ cấu hình qua các lần khởi động.
- Tắt Suspend: Settings → Power, hoặc
  `sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target`.

### 0.6 *(Tuỳ chọn)* Chuẩn bị chuyển sang VPS

Không cần sửa code: Pipecat runner đã đọc biến `PIPECAT_ICE_SERVERS` (hoặc cờ
`--ice-servers`) và trả về cho client trong `iceConfig` của `POST /start`. Bot
nạp `.env` trước khi runner đọc biến, nên chỉ cần thêm vào `.env`.

Định dạng nhận được:

```bash
# Danh sách URL, cách nhau bằng dấu phẩy
PIPECAT_ICE_SERVERS=stun:stun.l.google.com:19302

# Hoặc mảng JSON khi có TURN cần mật khẩu
PIPECAT_ICE_SERVERS='[{"urls":"turn:turn.example.com:3478","username":"user","credential":"pass"},{"urls":"turns:turn.example.com:443?transport=tcp","username":"user","credential":"pass"}]'
```

Dùng Tailscale thì để trống biến này.

## Khi chuyển sang VPS + coturn

Chỉ đổi cấu hình, app không phải sửa code (app đã sẵn sàng gửi API key và nhận
ICE servers từ bot — xem [phase-1.md](phase-1.md#18-cấu-hình-bằng-env)):

1. Thuê VPS Linux có IP public (nên ở Singapore cho độ trễ thấp).
2. Cài coturn: mở `3478` UDP/TCP, `443` TLS (cho mạng chặn UDP), và một dải
   relay UDP hẹp (vài trăm cổng là đủ). Dùng chứng chỉ Let's Encrypt cho TLS.
3. Chạy bot trên VPS (cùng `make run-local` hoặc Docker với `network_mode: host`).
4. Điền `PIPECAT_ICE_SERVERS` trỏ tới coturn.
5. Thêm xác thực cho `/start` và `/sessions/*` — runner không có sẵn, phải tự
   thêm (middleware hoặc reverse proxy kiểm tra header `X-App-Key`), vì endpoint
   giờ đã ra Internet.
6. Trong app: đổi `EXPO_PUBLIC_BOT_URL`, điền `EXPO_PUBLIC_APP_KEY`, build lại.
7. Bỏ Tailscale khỏi điện thoại.

Runner chỉ nhận credential TURN **tĩnh**. Muốn credential ngắn hạn (chế độ
`use-auth-secret` của coturn) thì cần một bước nhỏ tự viết để sinh credential
mỗi phiên.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách sửa |
|---|---|---|
| Trình duyệt báo `Blocked request. This host is not allowed` | Vite chưa nhận `*.ts.net` | Làm bước 0.3 |
| Không xin được quyền micro | Truy cập bằng `http://` | Dùng URL `https://…ts.net` từ `tailscale serve` |
| `tailscale serve` báo chưa bật HTTPS | Chưa bật HTTPS Certificates | Trang quản trị → DNS → bật **HTTPS Certificates** |
| Kết nối xong nhưng không nghe thấy gì | Bot chạy trong Docker, hoặc `ufw` chặn `tailscale0` | Dùng `make run-local`; `sudo ufw allow in on tailscale0` |
| Kết nối được ở nhà, không được qua 4G | Tailscale trên điện thoại đang tắt | Bật Tailscale, kiểm tra `tailscale status` |
| Âm thanh giật, trễ trên 4G | Đang đi qua DERP relay | Xem `tailscale ping`; chấp nhận được cho giai đoạn này, hoặc chuyển sang VPS + coturn |

## Ngoài phạm vi giai đoạn 0

- TURN / coturn — để khi có VPS.
- Xác thực API key — chưa cần với Tailscale.
- Daily transport — giữ lối mở trong thiết kế transport của app.
- App mobile (Expo) — bắt đầu từ giai đoạn 1.
