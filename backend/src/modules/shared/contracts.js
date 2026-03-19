/**
 * Create a normalized module registration consumed by the backend app registry.
 * @param {{ name: string, basePath: string, router: object }} definition
 * @returns {{ name: string, basePath: string, router: object }}
 */
const createModule = ({ name, basePath, router }) => {
  if (!name || !basePath || !router) {
    throw new Error('Module registration requires name, basePath, and router');
  }

  return { name, basePath, router };
};

module.exports = {
  createModule,
};
