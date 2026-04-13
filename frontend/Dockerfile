# Sử dụng bản Alpine để dung lượng nhẹ nhất (~5MB base)
FROM node:20-alpine

# Cài đặt pnpm và dọn dẹp cache của npm ngay lập tức
RUN npm install -g pnpm && npm cache clean --force

WORKDIR /app

# Chỉ copy những file thực sự cần thiết để cài đặt thư viện
COPY package.json pnpm-lock.yaml* ./

# Cấu hình pnpm store và cài đặt
# Sử dụng --prod nếu bạn chỉ muốn chạy production, nhưng ở đây dùng cho dev
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source code (Lúc này .dockerignore sẽ loại bỏ các file rác)
COPY . .

# Loại bỏ các file source không cần thiết cho việc chạy ứng dụng (Ví dụ: tài liệu, test)
RUN rm -rf .github tests docs
# Expose port (nên đổi thành 5173 vì Vite mặc định dùng 5173, trừ khi bạn config lại trong vite.config.js)
EXPOSE 5173

# Chạy với quyền non-root để bảo mật (tùy chọn)
# USER node

CMD ["pnpm", "dev", "--host", "0.0.0.0"]