# Cẩm Nang Triển Khai Hệ Thống VIGH (DevOps Guide)

Tài liệu này lưu lại toàn bộ quy trình cấu hình để chạy hệ thống VIGH trên bất kỳ một máy chủ Linux/Ubuntu hoặc NAS nào. Khi chuyển nhà sang một máy chủ vật lý mới, bạn chỉ cần làm tuần tự các bước dưới đây.

---

## KIẾN TRÚC HỆ THỐNG
1. **Frontend (Giao diện):** Đặt trên GitHub Pages (`https://vigh-system.sonnm.site`).
2. **Backend (Node.js API):** Chạy trên máy chủ vật lý qua cổng `5000` (được đưa ra mạng ngoài qua Cloudflare Tunnel `api.sonnm.site`).
3. **Database (PostgreSQL):** Chạy trên máy chủ vật lý qua cổng `5432` (được đưa ra mạng ngoài qua Cloudflare Tunnel `db-vigh.sonnm.site`).

---

## PHẦN 1: CÀI ĐẶT DATABASE (POSTGRESQL)

1. Cài đặt PostgreSQL trên máy Ubuntu:
   ```bash
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   ```

2. Cấu hình để PostgreSQL chấp nhận kết nối từ mọi nơi (cần thiết cho đường hầm TCP):
   - Mở file cấu hình (thay số `16` bằng phiên bản bạn cài):
     ```bash
     sudo nano /etc/postgresql/16/main/postgresql.conf
     ```
   - Sửa dòng `listen_addresses`:
     ```text
     listen_addresses = '*'
     ```

   - Mở file HBA:
     ```bash
     sudo nano /etc/postgresql/16/main/pg_hba.conf
     ```
   - Thêm dòng này vào cuối file (bên dưới các dòng IPv4 khác):
     ```text
     host    all             all             0.0.0.0/0               md5
     ```

3. Khởi động lại PostgreSQL để nhận cấu hình:
   ```bash
   sudo systemctl restart postgresql
   ```

4. Tạo Database và Tài khoản Admin:
   ```bash
   sudo -u postgres psql
   ```
   Bên trong dấu nhắc `postgres=#`, gõ các lệnh sau:
   ```sql
   CREATE DATABASE vigh_db;
   CREATE USER vigh_admin WITH ENCRYPTED PASSWORD 'vigh2026';
   GRANT ALL PRIVILEGES ON DATABASE vigh_db TO vigh_admin;
   ALTER DATABASE vigh_db OWNER TO vigh_admin;
   \q
   ```

---

## PHẦN 2: CÀI ĐẶT BACKEND (NODE.JS & PM2)

1. Cài đặt Node.js và công cụ chạy ngầm PM2:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo npm install -g pm2
   ```

2. Tải mã nguồn Backend và cài đặt thư viện:
   ```bash
   git clone https://github.com/sonmanhng/vigh-backend.git
   cd vigh-backend
   npm install
   ```

3. Tạo file cấu hình môi trường `.env`:
   ```bash
   echo 'DATABASE_URL="postgresql://vigh_admin:vigh2026@127.0.0.1:5432/vigh_db"' > .env
   echo 'JWT_SECRET="supersecretkey"' >> .env
   echo 'PORT="5000"' >> .env
   ```

4. Build code và chạy ngầm Backend (tự động chạy lại khi khởi động máy):
   ```bash
   npm run build
   pm2 start dist/index.js --name "vigh-api"
   pm2 save
   pm2 startup
   ```
   *(Nhớ copy và chạy dòng lệnh màu đỏ hiện ra ở cuối để kích hoạt chế độ tự chạy khi máy khởi động).*

---

## PHẦN 3: CÀI ĐẶT ĐƯỜNG HẦM (CLOUDFLARE TUNNEL)

1. Mở trang quản trị **Cloudflare Zero Trust** -> **Networks** -> **Tunnels** -> **Create a tunnel**.
2. Chọn môi trường `Cloudflared`, đặt tên hầm (VD: `VIGH-Server`).
3. Copy đoạn mã cài đặt hệ điều hành Linux (Debian) trên màn hình Cloudflare, dán vào Terminal của máy Ubuntu và chạy.
4. Khi hầm báo "Connected", chuyển sang tab **Public Hostname** và tạo 2 đường nối:

   **Đường hầm cho Database:**
   - Subdomain: `db-vigh`
   - Domain: `sonnm.site`
   - Type: `TCP`
   - URL: `127.0.0.1:5432`

   **Đường hầm cho Backend API:**
   - Subdomain: `api`
   - Domain: `sonnm.site`
   - Type: `HTTP`
   - URL: `127.0.0.1:5000`

---

## PHẦN 4: ĐỒNG BỘ FRONTEND VÀ QUẢN LÝ DỮ LIỆU CŨ

1. Cập nhật mã nguồn Frontend: 
   - Đảm bảo biến `VITE_API_URL` trong file `.github/workflows/deploy-frontend.yml` đang trỏ về `https://api.sonnm.site/api`.

2. Đẩy cấu trúc Database lên máy chủ mới (từ máy tính Mac của bạn):
   - Mở Terminal ở folder chứa mã nguồn, chạy:
     ```bash
     npx prisma db push
     ```

3. Ghi chú quan trọng về sao lưu (Backup) dữ liệu:
   Dữ liệu được lưu thẳng vào thư mục của hệ điều hành Ubuntu. Bạn có thể sử dụng câu lệnh `pg_dump` để xuất dữ liệu ra file `.sql` nhằm mục đích sao lưu.
   ```bash
   pg_dump -U vigh_admin -h 127.0.0.1 -d vigh_db -F c -f vigh_backup.dump
   ```
