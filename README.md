# 4ANG — web nghe nhạc (bản full-stack)

Web nghe nhạc có tài khoản thật (mật khẩu mã hoá bcrypt, lưu trong database), luồng đăng bài → admin duyệt → hiện công khai cho mọi người ở đâu cũng xem/nghe được, mỗi bài có tên, mô tả, người sáng tác, ngày sản xuất, lời bài hát, tym, bình luận, chia sẻ, lưu bài.

> Đang trong quá trình redesign sang hướng dark + liquid glass + điện ảnh (xem `song-app-brief-v3` cho lộ trình đầy đủ). Backend/API/auth hiện tại giữ nguyên.

```
song-app/
  client/   — React (Vite), giao diện + player
  server/   — Node.js/Express + SQLite, API + database + lưu file nhạc
```

Đây là 1 ứng dụng **có server thật** (khác bản demo trước chỉ chạy trong trình duyệt) — cần 1 máy chủ Node.js chạy liên tục, không phải site tĩnh nữa.

## Chạy thử ở máy

Mở 2 terminal:

**Terminal 1 — server:**
```bash
cd server
npm install
npm run dev
```
Server chạy ở `http://localhost:3001`. Lần đầu chạy sẽ tự tạo file database SQLite tại `server/data/app.sqlite`.

**Terminal 2 — client:**
```bash
cd client
npm install
npm run dev
```
Mở địa chỉ terminal in ra (thường `http://localhost:5173`). Client tự động chuyển tiếp mọi request `/api/...` sang server ở cổng 3001 (cấu hình sẵn trong `client/vite.config.js`), nên không cần chỉnh gì thêm.

**Tài khoản đầu tiên đăng ký sẽ tự động là admin.** Từ tài khoản thứ 2 trở đi là người dùng thường.

## Build & chạy bản production

Bản deploy này tách frontend và backend:

- **Frontend:** Vercel → thư mục `client/` (React + Vite)
- **Backend:** Render/Railway/VPS → thư mục `server/` (Express + SQLite + upload)
- Frontend gọi backend qua biến môi trường `VITE_API_URL`.
- Backend cho phép CORS qua `CORS_ORIGINS`.

### 1. Chạy local

Mở 2 terminal:

**Terminal 1 — backend:**
```bash
cd server
npm install
npm run dev
```

Server chạy ở `http://localhost:3001`.

**Terminal 2 — frontend:**
```bash
cd client
npm install
npm run dev
```

Frontend vẫn gọi `/api/...`; Vite proxy trong `client/vite.config.js` chuyển request sang `http://localhost:3001`.

### 2. Deploy backend riêng

Có thể dùng Render, Railway hoặc VPS. Với project này, **backend phải có persistent disk/volume** vì SQLite và file nhạc được lưu trên ổ đĩa.

Nếu dùng Render, file `render.yaml` ở thư mục gốc đã có sẵn cấu hình:

- Root directory: `server`
- Build: `npm ci`
- Start: `npm start`
- Health check: `/api/health`
- `JWT_SECRET` tự tạo
- SQLite: `/var/data/app.sqlite`
- Uploads: `/var/data/uploads`
- Persistent disk: `/var/data`

Sau khi backend deploy xong, lấy URL public của backend, ví dụ:

```text
https://song-backend.example.com
```

Health check phải trả JSON kiểu:

```json
{"ok":true,"service":"song-backend"}
```

### 3. Deploy frontend lên Vercel

Có 2 cách.

**Cách A — import cả repository (khuyên dùng):**

Project đã có `vercel.json`, nên Vercel sẽ tự:

```text
npm install --prefix client
npm run build --prefix client
```

và publish:

```text
client/dist
```

**Cách B — đặt Root Directory = `client`:**

Nếu Vercel hỏi Root Directory, chọn `client`. Khi đó có thể dùng mặc định:

```text
Build Command: npm run build
Output Directory: dist
```

### 4. Thêm Environment Variable trên Vercel

Vào **Project → Settings → Environment Variables** và thêm:

```text
VITE_API_URL=https://URL-BACKEND-CUA-BAN
```

Ví dụ:

```text
VITE_API_URL=https://song-backend.example.com
```

Sau khi thêm biến môi trường, **redeploy Vercel** để Vite build lại frontend với URL backend mới.

### 5. Cấu hình CORS ở backend

Trên backend, đặt:

```text
CORS_ORIGINS=https://song.vercel.app
```

Nếu muốn cho nhiều domain:

```text
CORS_ORIGINS=https://song.vercel.app,https://song-git-main.example.vercel.app
```

Trong lúc test có thể dùng:

```text
CORS_ORIGINS=*
```

Sau khi chạy ổn nên đổi thành domain frontend thật.

### 6. Luồng deploy cuối cùng

```text
                    ┌──────────────────────┐
                    │       Vercel         │
                    │   React + Vite       │
                    │   song.vercel.app    │
                    └──────────┬───────────┘
                               │ HTTPS API
                               ▼
                    ┌──────────────────────┐
                    │ Render / Railway /   │
                    │ VPS                  │
                    │ Node + Express       │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┴─────────────┐
                 ▼                           ▼
          SQLite database              Music uploads
          /var/data/app.sqlite         /var/data/uploads
```

### 7. Lưu ý quan trọng về dữ liệu

Không deploy backend vào môi trường serverless/ephemeral nếu không có persistent storage. `app.sqlite` và các file nhạc trong `uploads/` phải nằm trên disk/volume lâu dài.

Nếu host backend restart/redeploy và không giữ volume, tài khoản, bài hát, lượt thích, bình luận và file nhạc có thể mất.

## Cách hoạt động (tóm tắt)

1. Người dùng đăng ký/đăng nhập thật (mật khẩu hash bằng bcrypt, lưu trong database).
2. Frontend Vercel gọi Express API bằng `VITE_API_URL`.
3. Đăng bài hát → file được upload lên backend và trạng thái là `pending`.
4. Admin duyệt/từ chối trên backend.
5. Bài `approved` xuất hiện công khai.
6. Audio preview được lấy trực tiếp từ backend; JWT được truyền qua query parameter cho audio preview của bài chưa duyệt.

## Cấu trúc thư mục quan trọng

```text
song-app/
  vercel.json       — cấu hình build frontend cho Vercel
  render.yaml       — blueprint deploy backend + persistent disk trên Render
  client/
    src/
      api.js        — gọi API bằng VITE_API_URL
    .env.example    — mẫu VITE_API_URL
  server/
    src/
      index.js      — Express API + CORS + health check
      db.js         — SQLite
      auth.js       — JWT
      routes/
        auth.js
        tracks.js
        admin.js
    data/            — database local (không commit)
    uploads/         — file nhạc local (không commit)
```

## Bảo mật

- **Phải đặt `JWT_SECRET` riêng trên backend production.** Không dùng secret mặc định.
- `CORS_ORIGINS` nên giới hạn về domain frontend thật sau khi test.
- Mật khẩu được hash bằng bcrypt trước khi lưu.
- Token đăng nhập hiện được lưu ở `localStorage` phía client.
- File nhạc giới hạn 30MB mỗi bài trong `server/src/routes/tracks.js`.

## Vercel frontend setting

For the Vercel project, set **Root Directory** to `client`. The Vercel configuration is intentionally relative to that directory, so Vercel should run `npm ci` and `npm run build` from `client/`.

Set this environment variable in Vercel:

`VITE_API_URL=https://YOUR-BACKEND.onrender.com`
