const express = require('express');
const router = express.Router();
const workspaceController = require('../controllers/workspace.controller');
const { protect } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { createWorkspaceSchema, addMemberSchema } = require('../validations/workspace.schema');

router.use(protect); // All workspace routes are protected

router.post('/', validate(createWorkspaceSchema), workspaceController.createWorkspace);
router.get('/', workspaceController.getWorkspaces);
router.get('/:id', workspaceController.getWorkspaceById);
router.post('/:id/members', validate(addMemberSchema), workspaceController.addMember);
router.delete('/:id/members/:username', workspaceController.removeMember);
router.patch('/:id/members/:username', workspaceController.updateMemberRole);

module.exports = router;
