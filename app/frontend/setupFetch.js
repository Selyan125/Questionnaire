// Interceptor for fetch to auto-logout on 401/403 and attach token when missing
const originalFetch = window.fetch.bind(window);

window.fetch = async function(input, init = {}) {
  try {
    // Clone init so we don't mutate caller's object
    const initClone = init ? { ...init } : {};
    const headers = initClone.headers ? { ...initClone.headers } : {};

    // If no Authorization header is present, and a token exists in localStorage, add it
    if (!headers.Authorization && !headers.authorization) {
      const token = localStorage.getItem('authToken');
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    initClone.headers = headers;

    const resp = await originalFetch(input, initClone);

    if (resp.status === 401 || resp.status === 403) {
      // clear auth and redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      // navigate to login (replace current history)
      window.location.href = '/login';
      // throw so caller can handle if needed
      throw new Error('Not authorized');
    }

    return resp;
  } catch (err) {
    // Re-throw to preserve behavior
    throw err;
  }
};
