const { z } = require('zod');
const ROLES = require('../constants/roles');

const createWorkspaceSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    admin: z.string().min(3),
  }),
});

const addMemberSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Workspace ID'),
  }),
  body: z.object({
    username: z.string().min(3),
    workspacerole: z.enum(Object.values(ROLES.WORKSPACE)).optional(),
  }),
});

module.exports = {
  createWorkspaceSchema,
  addMemberSchema,
};
