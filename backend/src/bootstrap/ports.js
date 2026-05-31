const TCP_PORT_MAX = 65535;

const parseTcpPort = (key, value, { allowZero = false } = {}) => {
  const raw = String(value ?? '').trim();
  const minimumPort = allowZero ? 0 : 1;

  if (!/^(0|[1-9]\d*)$/.test(raw)) {
    throw new Error(`${key} must be a valid TCP port between ${minimumPort} and ${TCP_PORT_MAX}.`);
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimumPort || parsed > TCP_PORT_MAX) {
    throw new Error(`${key} must be a valid TCP port between ${minimumPort} and ${TCP_PORT_MAX}.`);
  }

  return parsed;
};

module.exports = { parseTcpPort };
