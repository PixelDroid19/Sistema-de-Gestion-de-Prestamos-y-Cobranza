const ONE_HOUR_MS = 60 * 60 * 1000;

const createOverdueAlertScheduler = ({
  syncService,
  intervalMs = ONE_HOUR_MS,
  logger = console,
} = {}) => {
  let timer = null;
  let runningPromise = null;

  const runSync = async () => {
    if (runningPromise) {
      return runningPromise;
    }

    runningPromise = Promise.resolve()
      .then(() => syncService.syncAllOverdueAlerts())
      .catch((error) => {
        logger.error?.('Overdue alert sync failed', error);
        throw error;
      })
      .finally(() => {
        runningPromise = null;
      });

    return runningPromise;
  };

  const start = async () => {
    if (timer) {
      return { started: false, intervalMs };
    }

    await runSync();

    timer = setInterval(() => {
      runSync().catch(() => {});
    }, intervalMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    return { started: true, intervalMs };
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  return {
    start,
    stop,
    runSync,
    isRunning: () => Boolean(timer),
  };
};

module.exports = {
  ONE_HOUR_MS,
  createOverdueAlertScheduler,
};
