const { AuditLog } = require('@/models');
const { logTechnical } = require('@/utils/logger');

const DEFAULT_RETENTION_DAYS = 365;
const BATCH_SIZE = 1000;

/**
 * Purge audit log records older than the configured retention period.
 * Runs in batches to avoid long-running transactions.
 *
 * @param {{ retentionDays?: number }} [options]
 * @returns {Promise<{ deletedCount: number }>}
 */
const purgeExpiredAuditLogs = async ({ retentionDays = DEFAULT_RETENTION_DAYS } = {}) => {
  const { Op } = require('@/models').sequelize.Sequelize;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  let totalDeleted = 0;
  let batchDeleted;

  do {
    const expiredIds = await AuditLog.findAll({
      attributes: ['id'],
      where: { timestamp: { [Op.lt]: cutoff } },
      limit: BATCH_SIZE,
      order: [['timestamp', 'ASC']],
      raw: true,
    });

    if (expiredIds.length === 0) break;

    batchDeleted = await AuditLog.destroy({
      where: { id: expiredIds.map((r) => r.id) },
    });

    totalDeleted += batchDeleted;
  } while (batchDeleted === BATCH_SIZE);

  if (totalDeleted > 0) {
    logTechnical('audit.retention.purged', {
      deletedCount: totalDeleted,
      retentionDays,
      cutoffDate: cutoff.toISOString(),
    });
  }

  return { deletedCount: totalDeleted };
};

/**
 * Create a periodic audit retention worker.
 * @param {{ intervalMs?: number, retentionDays?: number }} [options]
 */
const createAuditRetentionWorker = ({ intervalMs = 24 * 60 * 60 * 1000, retentionDays = DEFAULT_RETENTION_DAYS } = {}) => {
  let timer = null;

  const start = () => {
    if (timer) return;
    timer = setInterval(async () => {
      try {
        await purgeExpiredAuditLogs({ retentionDays });
      } catch (err) {
        const { logger } = require('@/utils/logger');
        logger.error('Audit retention worker failed', { error: err?.message || String(err) });
      }
    }, intervalMs);
    timer.unref();
    logTechnical('audit.retention.started', { intervalMs, retentionDays });
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  return { start, stop, purgeExpiredAuditLogs };
};

module.exports = { createAuditRetentionWorker, purgeExpiredAuditLogs };
