/**
 * @swagger
 * /socket.io/events/join_workspace:
 *   post:
 *     summary: "[EMIT] Tham gia vào Workspace"
 *     description: Người dùng gửi sự kiện này ngay sau khi kết nối để bắt đầu nhận tin nhắn của một Workspace cụ thể.
 *     tags: [Real-time (Socket.io)]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: string
 *             description: workspaceId
 *     responses:
 *       200:
 *         description: Trạng thái Joined thành công (Internal Room)
 */

/**
 * @swagger
 * /socket.io/events/send_message:
 *   post:
 *     summary: "[EMIT] Gửi tin nhắn mới"
 *     tags: [Real-time (Socket.io)]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workspaceId: { type: string }
 *               content: { type: string }
 *               reply: { type: string, description: "ID của tin nhắn gốc nếu là trả lời" }
 *               fileIds: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Tin nhắn được phát đi qua receive_message
 */

/**
 * @swagger
 * /socket.io/events/ask_ai:
 *   post:
 *     summary: "[EMIT] Hỏi UniBot (AI)"
 *     tags: [Real-time (Socket.io)]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workspaceId: { type: string }
 *               prompt: { type: string }
 *     responses:
 *       200:
 *         description: AI sẽ bắt đầu xử lý và trả về qua ai_status và receive_message
 */

/**
 * @swagger
 * /socket.io/events/receive_message:
 *   get:
 *     summary: "[LISTEN] Nhận tin nhắn tức thì"
 *     description: "Client lắng nghe sự kiện này để cập nhật UI ngay lập tức khi có tin nhắn mới (Scappy UI)."
 *     tags: [Real-time (Socket.io)]
 *     responses:
 *       200:
 *         description: "Trả về MessageObject"
 */

/**
 * @swagger
 * /socket.io/events/app_error:
 *   get:
 *     summary: "[LISTEN] Nhận lỗi nghiệp vụ"
 *     description: "Lắng nghe khi hành động bị từ chối (e.g. Viewer cố găng Chat)."
 *     tags: [Real-time (Socket.io)]
 *     responses:
 *       200:
 *         description: "Trả về { message: string }"
 */
