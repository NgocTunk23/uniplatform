const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "UniPlatform API",
      version: "1.0.0",
      description: `
## 🚀 UniPlatform Communication & Access API
Tài liệu cung cấp đầy đủ thông tin về các Endpoint REST và các sự kiện Real-time của hệ thống.

### 📡 Socket.io Events (Real-time)
Dưới đây là các sự kiện quan trọng cần tích hợp tại Frontend:
- **join_workspace**: (Emit) Tham gia phòng chat. Payload: \`workspaceId\` (string).
- **send_message**: (Emit) Gửi tin nhắn. Payload: \`{ workspaceId, content, reply, fileIds }\`.
- **receive_message**: (Listen) Nhận tin nhắn snappy.
- **ask_ai**: (Emit) Hỏi UniBot. Payload: \`{ workspaceId, prompt }\`.
- **app_error**: (Listen) Nhận lỗi nghiệp vụ (e.g. Quyền Viewer bị giới hạn).
      `,
      contact: {
        name: "UniPlatform Team",
      },
    },
    tags: [
      { name: "Auth", description: "Quản lý xác thực và tài khoản người dùng" },
      {
        name: "Workspace",
        description: "Quản lý không gian làm việc và thành viên",
      },
      { name: "Message", description: "Quản lý tin nhắn và lịch sử hội thoại" },
      {
        name: "File",
        description: "Quản lý tệp tin và lưu trữ đám mây (Google Drive)",
      },
      { name: "User", description: "Quản lý hồ sơ cá nhân và mật khẩu" },
      { name: "Admin", description: "Quản trị hệ thống (System Admin only)" },
      {
        name: "Real-time (Socket.io)",
        description: "Tài liệu về các sự kiện WebSockets",
      },
    ],
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5001}`,
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            username: { type: "string" },
            email: { type: "string" },
            fullname: { type: "string" },
            role: { type: "string", enum: ["Member", "Admin"] },
            status: { type: "string", enum: ["active", "locked"] },
            tokenVersion: { type: "integer" },
          },
        },
        Workspace: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            admin: { type: "string" },
            members: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  username: { type: "string" },
                  workspacerole: {
                    type: "string",
                    enum: ["Leader", "Member", "Viewer"],
                  },
                  joinedat: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        Message: {
          type: "object",
          properties: {
            id: { type: "string" },
            workspaceid: { type: "string" },
            senderusername: { type: "string" },
            content: { type: "string" },
            reply: { type: "string", nullable: true },
            createat: { type: "string", format: "date-time" },
          },
        },
        File: {
          type: "object",
          properties: {
            id: { type: "string" },
            uploader: { type: "string" },
            filename: { type: "string" },
            ggid: { type: "string" },
            typefile: { type: "string" },
            sizefile: { type: "string" },
            createat: { type: "string", format: "date-time" },
          },
        },
        SystemLog: {
          type: "object",
          properties: {
            id: { type: "string" },
            actorusername: { type: "string" },
            targetresource: { type: "string" },
            targetid: { type: "string" },
            changes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  old: { type: "object", nullable: true },
                  new: { type: "object", nullable: true },
                },
              },
            },
            createat: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            errorCode: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.js", "./src/controllers/*.js"], // Files containing annotations
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs,
};
