FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

# Dòng này copy toàn bộ code của bạn vào container
COPY . .

EXPOSE 5001
CMD ["npm", "start"]
