/**
 * GITAcademy — api.js
 * Central fetch helper for the demo LMS API.
 */

const BASE_URL = (window.GITAcademy_API_URL || 'api.php').replace(/\/$/, '');

function getToken() {
  return localStorage.getItem('lh_token') || null;
}

function setToken(token) {
  localStorage.setItem('lh_token', token);
}

function clearToken() {
  localStorage.removeItem('lh_token');
  localStorage.removeItem('lh_user');
}

function buildUrl(endpoint) {
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const separator = BASE_URL.includes('?') ? '&' : '?';
  return `${BASE_URL}${separator}route=${encodeURIComponent(normalized)}`;
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const config = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    config.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const response = await fetch(buildUrl(endpoint), config);
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    clearToken();
    window.location.href = 'login.html';
    return;
  }

  if (!response.ok) {
    const err = new Error(data.message || `HTTP ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

const api = {
  get: (endpoint, opts = {}) => apiFetch(endpoint, { ...opts, method: 'GET' }),
  post: (endpoint, body, opts = {}) => apiFetch(endpoint, { ...opts, method: 'POST', body }),
  put: (endpoint, body, opts = {}) => apiFetch(endpoint, { ...opts, method: 'PUT', body }),
  patch: (endpoint, body, opts = {}) => apiFetch(endpoint, { ...opts, method: 'PATCH', body }),
  delete: (endpoint, opts = {}) => apiFetch(endpoint, { ...opts, method: 'DELETE' }),
};

export const authApi = {
  login: (email, password, role = 'student', adminCode = '') => api.post('/auth/login', { email, password, role, admin_code: adminCode || undefined }),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  me: () => api.get('/auth/me'),
};

export const coursesApi = {
  list: (params = {}) => api.get('/courses?' + new URLSearchParams(params)),
  featured: () => api.get('/courses/featured'),
  trending: () => api.get('/courses/trending'),
  search: (q, filters = {}) => api.get('/courses?' + new URLSearchParams({ q, ...filters })),
  get: (id) => api.get(`/courses/${id}`),
  enroll: (id) => api.post(`/courses/${id}/enroll`, {}),
  progress: (id) => api.get(`/courses/${id}/progress`),
  reviews: (id) => api.get(`/courses/${id}/reviews`),
  addReview: (id, data) => api.post(`/courses/${id}/reviews`, data),
};

export const categoriesApi = {
  list: () => api.get('/categories'),
  get: (slug) => api.get(`/categories/${slug}`),
};

export const userApi = {
  profile: () => api.get('/user/profile'),
  updateProfile: (data) => api.put('/user/profile', data),
  updatePassword: (data) => api.put('/user/password', data),
  myCourses: () => api.get('/user/courses'),
  certificates: () => api.get('/user/certificates'),
  achievements: () => api.get('/user/achievements'),
  notifications: () => api.get('/user/notifications'),
  markNotificationRead: (id) => api.patch(`/user/notifications/${id}/read`),
  wishlist: () => api.get('/user/wishlist'),
  addToWishlist: (courseId) => api.post('/user/wishlist', { course_id: courseId }),
  removeFromWishlist: (courseId) => api.delete(`/user/wishlist/${courseId}`),
};

export const cartApi = {
  get: () => api.get('/cart'),
  add: (courseId) => api.post('/cart', { course_id: courseId }),
  remove: (courseId) => api.delete(`/cart/${courseId}`),
  clear: () => api.delete('/cart'),
  applyCoupon: (code) => api.post('/cart/coupon', { code }),
};

export const paymentsApi = {
  initiateCheckout: (data) => api.post('/payments/checkout', data),
  verify: (ref) => api.get(`/payments/verify/${ref}`),
  history: () => api.get('/payments/history'),
  requestRefund: (orderId, reason) => api.post(`/payments/${orderId}/refund`, { reason }),
};

export const instructorApi = {
  dashboard: () => api.get('/instructor/dashboard'),
  courses: () => api.get('/instructor/courses'),
  createCourse: (data) => api.post('/instructor/courses', data),
  updateCourse: (id, data) => api.put(`/instructor/courses/${id}`, data),
  deleteCourse: (id) => api.delete(`/instructor/courses/${id}`),
  analytics: (courseId) => api.get(`/instructor/courses/${courseId}/analytics`),
  students: (courseId) => api.get(`/instructor/courses/${courseId}/students`),
  revenue: () => api.get('/instructor/revenue'),
};

export const adminApi = {
  stats: () => api.get('/admin/stats'),
  users: (params) => api.get('/admin/users?' + new URLSearchParams(params)),
  courses: (params) => api.get('/admin/courses?' + new URLSearchParams(params)),
  payments: (params) => api.get('/admin/payments?' + new URLSearchParams(params)),
};

export default api;
export { getToken, setToken, clearToken };
