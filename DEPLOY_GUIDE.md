# 📱 Hướng dẫn chạy VocabMaster Pro trên điện thoại

## 🎯 3 Cách - Chọn cách phù hợp với bạn

---

## ⚡ CÁCH 1: Local Network (Nhanh nhất - 30 giây)

**Khi nào dùng:** Test nhanh, không muốn deploy

**Bước 1:** Chạy dev server
```bash
cd "/Users/nvdesign96/App English/my-app"
npm run dev
```

**Bước 2:** Trên điện thoại (cùng WiFi), mở browser gõ:
```
http://192.168.2.119:5173
```

✅ **XONG!**

**Nhược điểm:**
- Phải giữ máy Mac bật
- Phải cùng WiFi
- Tắt terminal = app mất

---

## 🌟 CÁCH 2: Deploy Vercel (KHUYÊN DÙNG - 5 phút)

**Ưu điểm:**
- ✅ Truy cập mọi lúc mọi nơi
- ✅ Miễn phí mãi mãi
- ✅ Domain đẹp: vocab-master-pro.vercel.app
- ✅ HTTPS bảo mật
- ✅ Auto deploy khi update code

### Bước 1: Push code lên GitHub

1. Tạo repo mới: https://github.com/new
   - Tên: `vocab-master-pro`
   - Public hoặc Private
   - Không tick "Add README"

2. Push code:
```bash
cd "/Users/nvdesign96/App English/my-app"

# Thay YOUR_USERNAME bằng username GitHub của bạn
git remote add origin https://github.com/YOUR_USERNAME/vocab-master-pro.git
git branch -M main
git push -u origin main
```

### Bước 2: Deploy lên Vercel

1. Vào: https://vercel.com/signup
2. Đăng nhập bằng GitHub
3. Click "Add New..." → "Project"
4. Chọn repo `vocab-master-pro`
5. Click "Import"
6. Cấu hình:
   - Framework: **Vite** (auto detect)
   - Build Command: `npm run build`
   - Output Directory: `dist`
7. Click **Deploy**

### Bước 3: Chờ 1-2 phút → XONG!

Link app: `https://vocab-master-pro.vercel.app`

---

## 🚀 CÁCH 3: PWA - Install như App thật (PRO - 10 phút)

**Ưu điểm:**
- ✅ Install lên home screen như app native
- ✅ Offline support
- ✅ Full screen (không có thanh address bar)
- ✅ Nhanh hơn (cache resources)

**Cần làm:** Deploy lên Vercel trước (Cách 2), sau đó:

### Setup PWA

Xem hướng dẫn chi tiết trong file: [PWA_SETUP.md](./PWA_SETUP.md)

**Tóm tắt:**
1. Cài plugin: `npm install -D vite-plugin-pwa`
2. Cập nhật config
3. Tạo icons (192x192 và 512x512)
4. Build và deploy
5. Mở link Vercel trên điện thoại
6. Menu → "Add to Home Screen"

---

## 🎯 Khuyến nghị

**Nếu bạn:**
- Muốn test nhanh → **Cách 1**
- Muốn dùng lâu dài → **Cách 2** (Vercel)
- Muốn trải nghiệm app native → **Cách 2 + 3** (Vercel + PWA)

**Lộ trình đề xuất:**
1. Test bằng Cách 1 ngay (30s)
2. Nếu ưng → Deploy lên Vercel (5 phút)
3. Sau đó setup PWA để install như app (10 phút)

---

## 📞 Cần giúp?

- Vercel docs: https://vercel.com/docs
- Vite PWA plugin: https://vite-pwa-org.netlify.app

---

## 🔄 Update app sau này

### Nếu dùng Vercel:
```bash
# Sửa code
git add .
git commit -m "Update features"
git push

# Vercel tự động deploy! Chờ 1-2 phút là có bản mới
```

### Nếu dùng Local:
```bash
# Chỉ cần save file, Vite tự reload
```
