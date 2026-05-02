FROM node:20-alpine
WORKDIR /app
COPY package*.json ./


RUN npm install

# Copy thư mục chứa schema của Prisma vào container
COPY prisma ./prisma/

# Chạy lệnh generate client để Prisma nhận diện cấu trúc database
RUN npx prisma generate


COPY . .
EXPOSE 5001
CMD ["npm", "start"]