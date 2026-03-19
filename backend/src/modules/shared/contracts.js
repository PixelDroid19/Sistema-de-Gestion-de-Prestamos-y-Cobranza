const createModule = ({ name, basePath, router }) => {
  if (!name || !basePath || !router) {
    throw new Error('Module registration requires name, basePath, and router');
  }

  return { name, basePath, router };
};

module.exports = {
  createModule,
};
