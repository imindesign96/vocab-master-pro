# 🚨 Hướng dẫn khắc phục lỗi bảo mật API Key

## ✅ Đã hoàn thành tự động:
1. ✓ Tạo file `.env` chứa Firebase config
2. ✓ Tạo file `.env.example` làm template
3. ✓ Thêm `.env` vào `.gitignore`
4. ✓ Cập nhật `config.js` sử dụng environment variables

## 🔥 CẦN LÀM NGAY (Quan trọng nhất):

### Bước 1: Hạn chế hoặc Tạo lại API Key

**Chọn 1 trong 2 cách:**

#### Cách 1: Hạn chế API Key hiện tại (Nhanh hơn)
1. Mở Firebase Console đã được mở tự động
2. Vào **Project Settings** → **General**
3. Kéo xuống phần **Your apps** → Web app
4. Click vào **Settings** (biểu tượng bánh răng)
5. Trong phần **API restrictions**, thêm các restrictions:
   - **Application restrictions**: HTTP referrers
   - Thêm domain của bạn (ví dụ: `localhost:5176/*`, `your-domain.com/*`)
   - Hoặc chọn **IP address** nếu chỉ cho phép từ IP cụ thể

#### Cách 2: Tạo API Key mới (An toàn hơn)
1. Vào Google Cloud Console: https://console.cloud.google.com/apis/credentials?project=vocab-master-pro-2b556
2. Tìm API key hiện tại: `AIzaSyBxT7DPFMD6q-cTYMgk_RPBTEVy0NYcBTo`
3. **Delete** hoặc **Restrict** key này
4. Tạo API key mới với restrictions ngay từ đầu
5. Copy API key mới và cập nhật vào file `.env`:
   ```
   VITE_FIREBASE_API_KEY=your_new_api_key_here
   ```

### Bước 2: Xóa API Key khỏi Git History

⚠️ **QUAN TRỌNG**: Chỉ xóa API key khỏi commit history không đủ vì nó vẫn tồn tại trong lịch sử git.

```bash
# Di chuyển vào thư mục project
cd "/Users/nvdesign96/App English/my-app"

# Xem API key đã bị commit ở đâu
git log --all --full-history --source --pretty=format:'%C(yellow)%H%Creset %C(green)%ad%Creset %C(bold blue)%an%Creset %s' --date=short -- src/firebase/config.js

# Nếu chưa push lên GitHub, có thể dùng lệnh này để xóa khỏi local history:
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch src/firebase/config.js" \
  --prune-empty --tag-name-filter cat -- --all

# Nếu đã push lên GitHub, cần dùng BFG Repo-Cleaner (an toàn hơn):
# 1. Cài đặt BFG: brew install bfg
# 2. Backup repo trước
# 3. Chạy: bfg --replace-text passwords.txt
```

**⚠️ CẢNH BÁO**: Xóa git history là thao tác nguy hiểm. Nếu không chắc chắn, tốt nhất là:
- Tạo API key mới (Cách 2 ở trên)
- Xóa/restrict API key cũ
- Commit code mới với environment variables

### Bước 3: Commit các thay đổi mới

```bash
cd "/Users/nvdesign96/App English/my-app"

# Kiểm tra các file đã thay đổi
git status

# Add các file mới
git add .env.example .gitignore src/firebase/config.js SECURITY_FIX.md

# Commit
git commit -m "Security: Move Firebase config to environment variables

- Add .env for sensitive config
- Add .env.example as template
- Update .gitignore to exclude .env files
- Update config.js to use import.meta.env
- Remove hardcoded API keys

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Push lên GitHub (sau khi đã secure API key!)
git push
```

### Bước 4: Xác nhận với GitHub

1. Vào repository settings trên GitHub
2. Vào **Security** → **Secret scanning**
3. Đánh dấu alert là đã resolved sau khi bạn đã:
   - Restrict hoặc delete API key cũ
   - Push code mới không còn hardcode API key

## 📝 Lưu ý quan trọng:

1. **File `.env` không bao giờ được commit vào git**
2. Khi deploy lên production, cần set environment variables trên hosting platform
3. Firebase API keys có thể restrict bằng:
   - HTTP referrers (cho web apps)
   - Bundle IDs (cho iOS)
   - Package names (cho Android)
4. Nếu dùng Vercel/Netlify để deploy:
   - Vào dashboard → Settings → Environment Variables
   - Thêm tất cả các biến từ file `.env`

## 🔍 Kiểm tra app vẫn hoạt động:

```bash
# Restart dev server để load environment variables
# Server sẽ tự động restart, kiểm tra xem app vẫn đăng nhập được không
```

## 📚 Tài liệu tham khảo:

- [Firebase Security Best Practices](https://firebase.google.com/docs/projects/api-keys)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)
