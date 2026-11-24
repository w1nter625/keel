export function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    clearTimeout(timer);
  });
}

export function emptyGraph(errors = []) {
  return {
    available: false,
    ari: null,
    goals: [],
    comments: [],
    pullRequests: [],
    deployments: [],
    teams: [],
    errors: errors.filter(Boolean),
  };
}
