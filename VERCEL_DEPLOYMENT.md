# 🚀 Hướng dẫn Deploy lên Vercel

## Hiểu về Environment Variables

### Local Development (máy tính của bạn)
- Dùng file `.env`
- Vite đọc file `.env` và inject vào `import.meta.env`
- File `.env` **KHÔNG BAO GIỜ** được commit vào git (đã thêm vào `.gitignore`)

### Production (Vercel, Netlify, etc.)
- **KHÔNG dùng file `.env`**
- Dùng Environment Variables được set trên dashboard của hosting platform
- Platform tự động inject các biến này vào `import.meta.env` khi build

## Cách Deploy lên Vercel

### Bước 1: Push code lên GitHub

⚠️ **QUAN TRỌNG**: Trước khi push, đảm bảo đã:
1. Secure/restrict API key (làm theo hướng dẫn trong SECURITY_FIX.md)
2. File `src/firebase/config.js` đã dùng `import.meta.env` (✅ đã xong)
3. File `.env` đã được thêm vào `.gitignore` (✅ đã xong)

```bash
cd "/Users/nvdesign96/App English/my-app"

# Kiểm tra .env không được track
git status | grep .env
# Nếu thấy ".env" xuất hiện → NGUY HIỂM, KHÔNG ĐƯỢC COMMIT!

# Commit code
git add .
git commit -m "Security: Move Firebase config to environment variables"
git push
```

### Bước 2: Tạo project trên Vercel

1. Vào https://vercel.com/new
2. Import repository từ GitHub
3. Chọn project: `vocab-master-pro` hoặc tên repo của bạn

### Bước 3: **QUAN TRỌNG NHẤT** - Set Environment Variables

Trong quá trình setup Vercel, kéo xuống phần **Environment Variables** và thêm:

```
Name: VITE_FIREBASE_API_KEY
Value: AIzaSyBxT7DPFMD6q-cTYMgk_RPBTEVy0NYcBTo
Environment: Production, Preview, Development (chọn cả 3)

Name: VITE_FIREBASE_AUTH_DOMAIN
Value: vocab-master-pro-2b556.firebaseapp.com
Environment: Production, Preview, Development

Name: VITE_FIREBASE_PROJECT_ID
Value: vocab-master-pro-2b556
Environment: Production, Preview, Development

Name: VITE_FIREBASE_STORAGE_BUCKET
Value: vocab-master-pro-2b556.firebasestorage.app
Environment: Production, Preview, Development

Name: VITE_FIREBASE_MESSAGING_SENDER_ID
Value: 199508173635
Environment: Production, Preview, Development

Name: VITE_FIREBASE_APP_ID
Value: 1:199508173635:web:82f9b1431c5a9e78cac5f6
Environment: Production, Preview, Development
```

**💡 Mẹo:** Copy từng dòng trong file `.env` local của bạn!

### Bước 4: Deploy

1. Click **Deploy**
2. Vercel sẽ:
   - Clone repo từ GitHub
   - Inject environment variables vào build process
   - Build project với `vite build`
   - Deploy lên CDN

### Bước 5: Cập nhật Firebase Console (Firestore Rules)

Sau khi deploy thành công, bạn cần thêm domain của Vercel vào Firebase:

1. Mở Firebase Console → Authentication → Settings → Authorized domains
2. Thêm domain Vercel của bạn (ví dụ: `vocab-master-pro.vercel.app`)

## Cách Environment Variables hoạt động

### Trong development (local):

```javascript
// Vite đọc file .env
VITE_FIREBASE_API_KEY=AIzaSyBxT7DPFMD6q-cTYMgk_RPBTEVy0NYcBTo

// Sau đó inject vào code khi build
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY // → "AIzaSyBxT..."
}
```

### Trong production (Vercel):

```javascript
// Vercel inject environment variables từ dashboard vào build process
// Không cần file .env!

// Kết quả giống hệt:
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY // → "AIzaSyBxT..."
}
```

## Quản lý Environment Variables trên Vercel (sau khi đã deploy)

### Xem/Sửa Environment Variables:

1. Vào project trên Vercel dashboard
2. Settings → Environment Variables
3. Có thể thêm/sửa/xóa variables
4. **QUAN TRỌNG**: Sau khi sửa, phải **Redeploy** để áp dụng changes!

### Redeploy sau khi sửa Environment Variables:

```bash
# Cách 1: Push code mới (recommended)
git commit --allow-empty -m "Trigger redeploy"
git push

# Cách 2: Redeploy từ Vercel dashboard
# Deployments → Click vào deployment mới nhất → ... → Redeploy
```

## Troubleshooting

### ❌ Lỗi: Firebase API key không được định nghĩa

**Nguyên nhân:** Environment variables chưa được set trên Vercel

**Giải pháp:**
1. Vào Vercel dashboard → Settings → Environment Variables
2. Kiểm tra xem tất cả biến đã được thêm chưa
3. Kiểm tra tên biến phải **CHÍNH XÁC** (có `VITE_` prefix)
4. Redeploy

### ❌ Lỗi: Firebase auth domain not authorized

**Nguyên nhân:** Domain Vercel chưa được thêm vào Firebase

**Giải pháp:**
1. Firebase Console → Authentication → Settings → Authorized domains
2. Thêm domain Vercel (ví dụ: `your-app.vercel.app`)

### ❌ Lỗi: API key bị restrict không cho phép domain Vercel

**Nguyên nhân:** Đã restrict API key nhưng chưa thêm domain Vercel

**Giải pháp:**
1. Google Cloud Console → APIs & Services → Credentials
2. Click vào API key
3. Application restrictions → HTTP referrers
4. Thêm: `*.vercel.app/*`

## Best Practices

1. ✅ **Luôn dùng `VITE_` prefix** cho environment variables trong Vite
2. ✅ **Set environment variables cho cả 3 môi trường** (Production, Preview, Development)
3. ✅ **Không bao giờ commit file `.env`** vào git
4. ✅ **Sử dụng `.env.example`** để document các biến cần thiết
5. ✅ **Restrict API keys** theo domain để bảo mật
6. ⚠️ **Redeploy sau khi sửa environment variables** trên Vercel

## Tóm tắt

| Môi trường | Lấy env vars từ đâu? | File `.env` có cần không? |
|------------|---------------------|--------------------------|
| **Local Development** | File `.env` trong project | ✅ Có - đọc từ `.env` |
| **Vercel Production** | Dashboard → Settings → Env Vars | ❌ Không - inject từ dashboard |
| **GitHub Repository** | Không có | ❌ KHÔNG BAO GIỜ commit `.env`! |

**Kết luận:** File `.env` chỉ dùng cho local development. Khi deploy lên Vercel, bạn phải set environment variables qua dashboard của Vercel, không phải upload file `.env` lên!
