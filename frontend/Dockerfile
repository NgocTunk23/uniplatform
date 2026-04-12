FROM node:20-alpine

WORKDIR /app

# Copy trước các file quản lý thư viện để tận dụng Layer Cache
COPY package*.json ./

# SỬ DỤNG BUILDKIT CACHE:
# Dòng này sẽ báo Docker lưu lại thư mục ~/.npm. 
# Lần tới nếu package.json có thay đổi, nó chỉ tải thêm thư viện mới thay vì tải lại từ đầu.
RUN --mount=type=cache,target=/root/.npm \
    npm install

# Copy toàn bộ source code còn lại
COPY . .

# Expose port (nên đổi thành 5173 vì Vite mặc định dùng 5173, trừ khi bạn config lại trong vite.config.js)
EXPOSE 5173

# Chạy project
CMD ["npm", "run", "dev"]