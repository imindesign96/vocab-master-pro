# Hướng dẫn Setup PWA cho VocabMaster Pro

## Bước 1: Cài đặt plugin

```bash
npm install -D vite-plugin-pwa
```

## Bước 2: Thay thế vite.config.js

```bash
mv vite.config.js vite.config.old.js
mv vite.config.pwa.js vite.config.js
```

## Bước 3: Tạo Icons

Bạn cần 2 file icon:
- `/public/icon-192.png` (192x192px)
- `/public/icon-512.png` (512x512px)

### Option A: Tạo nhanh online
1. Vào: https://realfavicongenerator.net
2. Upload logo bất kỳ
3. Download và copy vào `/public/`

### Option B: Tạo từ emoji (đơn giản)
1. Vào: https://favicon.io/emoji-favicons/brain/
2. Chọn emoji 🧠
3. Download và đổi tên thành `icon-192.png` và `icon-512.png`

## Bước 4: Build và test

```bash
npm run build
npm run preview
```

Mở http://localhost:4173 trên điện thoại.

## Bước 5: Install app

Trên điện thoại (iOS/Android):
1. Mở app bằng Chrome/Safari
2. Menu → "Add to Home Screen"
3. Xong! App giờ như app native

## Bước 6: Deploy lên Vercel

PWA chỉ hoạt động qua HTTPS, nên cần deploy:
1. Push code lên GitHub
2. Deploy lên Vercel
3. Mở link Vercel trên điện thoại
4. Install app

---

## Lưu ý

- PWA cần HTTPS → Chỉ hoạt động khi deploy (Vercel/Netlify)
- Localhost cũng OK để test
- Data lưu trong browser, không đồng bộ giữa các thiết bị
