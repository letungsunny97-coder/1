# OmniSnap - Tải Video Không Logo Đa Nền Tảng

Ứng dụng web tải video chất lượng cao không logo (Douyin, TikTok, Facebook, X, Instagram, Bilibili).

---

## 1. Dùng trực tiếp trên web (Cloud Run)
Ứng dụng đã được dựng sẵn và chạy trực tuyến tại đường dẫn:
- **Link chia sẻ công khai**: `https://ais-pre-lik52oeecbgd3xe5a37z5w-802759431752.asia-northeast1.run.app`
- **Link môi trường dev**: `https://ais-dev-lik52oeecbgd3xe5a37z5w-802759431752.asia-northeast1.run.app`

Bạn có thể gửi link này cho bạn bè hoặc người dùng để sử dụng ngay mà không cần cài đặt thêm gì.

---

## 2. Cài đặt như một App di động / máy tính (PWA / Add to Home Screen)
- **Trên điện thoại iPhone (Safari)**: Mở link trên -> Nhấn nút **Chia sẻ (Share)** -> Chọn **"Thêm vào màn hình chính" (Add to Home Screen)**.
- **Trên điện thoại Android (Chrome)**: Mở link -> Bấm menu 3 chấm ở góc trên -> Chọn **"Cài đặt ứng dụng"** hoặc **"Thêm vào Màn hình chính"**.
- App sẽ xuất hiện trên màn hình như 1 ứng dụng di động độc lập.

---

## 3. Xuất mã nguồn để chạy trên máy cá nhân (Localhost)
1. Tải toàn bộ thư mục mã nguồn về máy tính.
2. Mở Terminal / Command Prompt tại thư mục dự án và chạy:
   ```bash
   npm install
   ```
3. Chạy môi trường phát triển:
   ```bash
   npm run dev
   ```
   Mở trình duyệt truy cập: `http://localhost:3000`

---

## 4. Triển khai lên Hosting riêng (Render, Railway, VPS, Docker, Vercel)

### Cách A: Triển khai Production đầy đủ Backend (Khuyên dùng)
Vì ứng dụng có máy chủ proxy tải video chống chặn CORS (`/api/proxy-download`), cấu hình chuẩn chạy bằng:
```bash
# 1. Build giao diện frontend
npm run build

# 2. Khởi chạy máy chủ production Express phục vụ cả API và Frontend
npm start
```

### Cách B: Chạy bằng Docker
Tạo file `Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```
Build và chạy:
```bash
docker build -t omnisnap .
docker run -p 3000:3000 omnisnap
```
