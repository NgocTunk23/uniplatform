const prisma = require('../config/prisma');

/**
 * Middleware to log system actions
 */
const logAction = (targetResource) => {
  return async (req, res, next) => {
    const oldResJson = res.json;
    
    // Override res.json to capture response and log after action
    res.json = function (data) {
      const actor = req.user ? req.user.username : 'system_or_unauth';
      
      // Log after the response is sent
      if (req.method !== 'GET') {
        const targetId = data.id || data._id || 'N/A';
        
        prisma.systemLog.create({
          data: {
            actorusername: actor,
            targetresource: targetResource,
            targetid: targetId.toString(),
            changes: {
              set: [{
                field: 'action',
                new: req.method,
                old: null
              }]
            }
          }
        }).catch(err => console.error('❌ Logging error:', err.message));
      }
      
      return oldResJson.apply(res, arguments);
    };
    
    next();
  };
};

module.exports = {
  logAction
};
