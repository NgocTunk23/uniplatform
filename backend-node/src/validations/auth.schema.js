const { z } = require('zod');

const registerSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(30),
    email: z.string().email(),
    password: z.string().min(6),
    fullname: z.string().min(2),
  }),
});

const loginSchema = z.object({
  body: z.object({
    identifier: z.string().min(3),
    password: z.string().min(1),
  }),
});

module.exports = {
  registerSchema,
  loginSchema,
};
