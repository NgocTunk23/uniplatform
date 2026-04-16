const prisma = require('../config/prisma');

/**
 * Utility to calculate differences between two objects and log to SystemLog
 * @param {string} actorusername - The user performing the action
 * @param {string} targetresource - The table/resource being modified
 * @param {string} targetid - The ID of the modified record
 * @param {Object} oldData - Data before modification
 * @param {Object} newData - Data after modification
 */
const logChange = async (actorusername, targetresource, targetid, oldData, newData) => {
  try {
    const changes = [];
    const ignoreFields = ['password', 'updatedAt', 'tokenVersion'];

    // Collect all unique keys from both objects
    const keys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);

    for (const key of keys) {
      if (ignoreFields.includes(key)) continue;

      const oldValue = oldData ? oldData[key] : null;
      const newValue = newData ? newData[key] : null;

      // Handle Date objects comparison
      const isDate = oldValue instanceof Date || newValue instanceof Date;
      const areDifferent = isDate 
        ? (new Date(oldValue).getTime() !== new Date(newValue).getTime())
        : (JSON.stringify(oldValue) !== JSON.stringify(newValue));

      if (areDifferent) {
        changes.push({
          field: key,
          old: oldValue,
          new: newValue
        });
      }
    }

    if (changes.length > 0) {
      await prisma.systemLog.create({
        data: {
          actorusername,
          targetresource,
          targetid,
          changes: {
            set: changes
          }
        }
      });
    }
  } catch (error) {
    console.error('Audit Log Error:', error);
    // We don't throw here to avoid breaking the main business flow
  }
};

module.exports = { logChange };
