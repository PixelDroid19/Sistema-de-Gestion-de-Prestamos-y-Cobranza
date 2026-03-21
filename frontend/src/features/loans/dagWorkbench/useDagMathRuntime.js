import { useEffect, useState } from 'react';

const createInitialState = () => ({
  ready: false,
  loading: false,
  error: '',
  evaluateExpression: null,
  renderFormula: null,
});

export function useDagMathRuntime(enabled) {
  const [runtime, setRuntime] = useState(createInitialState);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let active = true;
    setRuntime((current) => ({
      ...current,
      loading: true,
      error: '',
    }));

    Promise.all([
      import('mathjs'),
      import('katex'),
      import('katex/dist/katex.min.css').catch(() => null),
    ])
      .then(([mathjsModule, katexModule]) => {
        if (!active) {
          return;
        }

        const math = mathjsModule.create(mathjsModule.all);
        const katex = katexModule.default || katexModule;

        setRuntime({
          ready: true,
          loading: false,
          error: '',
          evaluateExpression: (expression, scope = {}) => math.evaluate(expression, scope),
          renderFormula: (expression) => {
            const tex = math.parse(expression).toTex({ parenthesis: 'keep', implicit: 'hide' });
            return katex.renderToString(tex, {
              throwOnError: false,
              displayMode: true,
              strict: 'ignore',
            });
          },
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setRuntime({
          ...createInitialState(),
          error: error.message || 'Unable to load math runtime',
        });
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  return runtime;
}

export default useDagMathRuntime;
