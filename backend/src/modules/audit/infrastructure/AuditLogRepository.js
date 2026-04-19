const { AuditLog } = require('@/models');

const serializeAuditLog = (auditLog) => {
  if (!auditLog) return null;
  return typeof auditLog.toJSON === 'function' ? auditLog.toJSON() : auditLog;
};

const auditLogRepository = {
  async create({ userId, userName, action, module, entityId, entityType, previousData, newData, metadata, ip, userAgent }) {
    const auditLog = await AuditLog.create({
      userId,
      userName,
      action,
      module,
      entityId,
      entityType,
      previousData,
      newData,
      metadata,
      ip,
      userAgent,
    });
    return serializeAuditLog(auditLog);
  },

  async findById(id) {
    const auditLog = await AuditLog.findByPk(id);
    return serializeAuditLog(auditLog);
  },

  async findAll({ where = {}, order = [['timestamp', 'DESC']], limit = 100, offset = 0 }) {
    const auditLogs = await AuditLog.findAll({
      where,
      order,
      limit,
      offset,
    });
    return auditLogs.map(serializeAuditLog);
  },

  async count({ where = {} }) {
    return AuditLog.count({ where });
  },

  async findWithFilters({ userId, action, module, entityId, entityType, dateFrom, dateTo, limit = 100, offset = 0 }) {
    const { Op } = require('@/models').sequelize.Sequelize;
    const where = {};

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = action;
    }

    if (module) {
      where.module = module;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) {
        where.timestamp[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        where.timestamp[Op.lte] = new Date(dateTo);
      }
    }

    const auditLogs = await AuditLog.findAll({
      where,
      order: [['timestamp', 'DESC']],
      limit,
      offset,
    });

    const totalItems = await AuditLog.count({ where });

    return {
      items: auditLogs.map(serializeAuditLog),
      totalItems,
    };
  },

  async getStatsByModule({ dateFrom, dateTo }) {
    const { Op } = require('@/models').sequelize.Sequelize;
    const where = {};

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) {
        where.timestamp[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        where.timestamp[Op.lte] = new Date(dateTo);
      }
    }

    const stats = await AuditLog.findAll({
      attributes: [
        'module',
        'action',
        [AuditLog.sequelize.fn('COUNT', AuditLog.sequelize.col('id')), 'count'],
      ],
      where,
      group: ['module', 'action'],
      raw: true,
    });

    return stats;
  },
};

module.exports = {
  auditLogRepository,
};
