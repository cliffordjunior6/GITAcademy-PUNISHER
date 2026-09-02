/**
 * GITAcademy — api.js
 * Central fetch helper for all Laravel API calls.
 * Base URL is read from .env or defaults to /api
 */

const BASE_URL = window.GITAcademy_API_URL || '/api';

// ─── Token helpers ─────────────────────────────────────────────
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

// ─── Core fetch wrapper ────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const config = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    config.body = typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  // Handle 401 — token expired
  if (response.status === 401) {
    clearToken();
    window.location.href = '/login.html';
    return;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.message || `HTTP ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ─── HTTP convenience methods ──────────────────────────────────
const api = {
  get:    (endpoint, opts = {}) => apiFetch(endpoint, { ...opts, method: 'GET' }),
  post:   (endpoint, body, opts = {}) => apiFetch(endpoint, { ...opts, method: 'POST', body }),
  put:    (endpoint, body, opts = {}) => apiFetch(endpoint, { ...opts, method: 'PUT', body }),
  patch:  (endpoint, body, opts = {}) => apiFetch(endpoint, { ...opts, method: 'PATCH', body }),
  delete: (endpoint, opts = {}) => apiFetch(endpoint, { ...opts, method: 'DELETE' }),
};

// ─── AUTH ──────────────────────────────────────────────────────
export const authApi = {
  login:          (email, password) => api.post('/auth/login', { email, password }),
  register:       (data) => api.post('/auth/register', data),
  logout:         () => api.post('/auth/logout'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword:  (data) => api.post('/auth/reset-password', data),
  me:             () => api.get('/auth/me'),
};

// ─── COURSES ───────────────────────────────────────────────────
export const coursesApi = {
  list:       (params = {}) => api.get('/courses?' + new URLSearchParams(params)),
  featured:   () => api.get('/courses/featured'),
  trending:   () => api.get('/courses/trending'),
  search:     (q, filters = {}) => api.get('/courses/search?' + new URLSearchParams({ q, ...filters })),
  get:        (id) => api.get(`/courses/${id}`),
  enroll:     (id) => api.post(`/courses/${id}/enroll`),
  progress:   (id) => api.get(`/courses/${id}/progress`),
  updateProgress: (id, lessonId, data) => api.patch(`/courses/${id}/progress/${lessonId}`, data),
  reviews:    (id) => api.get(`/courses/${id}/reviews`),
  addReview:  (id, data) => api.post(`/courses/${id}/reviews`, data),
};

// ─── CATEGORIES ────────────────────────────────────────────────
export const categoriesApi = {
  list: () => api.get('/categories'),
  get:  (slug) => api.get(`/categories/${slug}`),
};

// ─── USER ──────────────────────────────────────────────────────
export const userApi = {
  profile:          () => api.get('/user/profile'),
  updateProfile:    (data) => api.put('/user/profile', data),
  updatePassword:   (data) => api.put('/user/password', data),
  myCourses:        () => api.get('/user/courses'),
  certificates:     () => api.get('/user/certificates'),
  achievements:     () => api.get('/user/achievements'),
  notifications:    () => api.get('/user/notifications'),
  markNotificationRead: (id) => api.patch(`/user/notifications/${id}/read`),
  wishlist:         () => api.get('/user/wishlist'),
  addToWishlist:    (courseId) => api.post('/user/wishlist', { course_id: courseId }),
  removeFromWishlist:(courseId) => api.delete(`/user/wishlist/${courseId}`),
};

// ─── CART ──────────────────────────────────────────────────────
export const cartApi = {
  get:     () => api.get('/cart'),
  add:     (courseId) => api.post('/cart', { course_id: courseId }),
  remove:  (courseId) => api.delete(`/cart/${courseId}`),
  clear:   () => api.delete('/cart'),
  applyCoupon: (code) => api.post('/cart/coupon', { code }),
};

// ─── CHECKOUT / PAYMENTS ───────────────────────────────────────
export const paymentsApi = {
  initiateCheckout: (data) => api.post('/payments/checkout', data),
  verify:           (ref) => api.get(`/payments/verify/${ref}`),
  history:          () => api.get('/payments/history'),
  requestRefund:    (orderId, reason) => api.post(`/payments/${orderId}/refund`, { reason }),
};

// ─── INSTRUCTOR ────────────────────────────────────────────────
export const instructorApi = {
  dashboard:      () => api.get('/instructor/dashboard'),
  courses:        () => api.get('/instructor/courses'),
  createCourse:   (data) => api.post('/instructor/courses', data),
  updateCourse:   (id, data) => api.put(`/instructor/courses/${id}`, data),
  deleteCourse:   (id) => api.delete(`/instructor/courses/${id}`),
  uploadVideo:    (courseId, formData) => apiFetch(`/instructor/courses/${courseId}/videos`, {
    method: 'POST',
    body: formData,
    headers: { 'Authorization': `Bearer ${getToken()}` }, // no Content-Type — let browser set multipart
  }),
  analytics:      (courseId) => api.get(`/instructor/courses/${courseId}/analytics`),
  students:       (courseId) => api.get(`/instructor/courses/${courseId}/students`),
  revenue:        () => api.get('/instructor/revenue'),
};

// ─── ADMIN ─────────────────────────────────────────────────────
export const adminApi = {
  stats:          () => api.get('/admin/stats'),
  users:          (params) => api.get('/admin/users?' + new URLSearchParams(params)),
  getUser:        (id) => api.get(`/admin/users/${id}`),
  updateUser:     (id, data) => api.patch(`/admin/users/${id}`, data),
  suspendUser:    (id) => api.patch(`/admin/users/${id}/suspend`),
  deleteUser:     (id) => api.delete(`/admin/users/${id}`),
  courses:        (params) => api.get('/admin/courses?' + new URLSearchParams(params)),
  approveCourse:  (id) => api.patch(`/admin/courses/${id}/approve`),
  rejectCourse:   (id, reason) => api.patch(`/admin/courses/${id}/reject`, { reason }),
  payments:       (params) => api.get('/admin/payments?' + new URLSearchParams(params)),
  refundPayment:  (id) => api.post(`/admin/payments/${id}/refund`),
  activity:       () => api.get('/admin/activity'),
};

// ─── SEARCH ────────────────────────────────────────────────────
export const searchApi = {
  global: (q) => api.get('/search?' + new URLSearchParams({ q })),
};

// ─── Q&A ───────────────────────────────────────────────────────
export const qaApi = {
  list:     (courseId, lessonId) => api.get(`/courses/${courseId}/lessons/${lessonId}/qa`),
  ask:      (courseId, lessonId, question) => api.post(`/courses/${courseId}/lessons/${lessonId}/qa`, { question }),
  reply:    (qaId, answer) => api.post(`/qa/${qaId}/reply`, { answer }),
  upvote:   (qaId) => api.post(`/qa/${qaId}/upvote`),
};

// ─── NOTES ─────────────────────────────────────────────────────
export const notesApi = {
  list:   (courseId) => api.get(`/courses/${courseId}/notes`),
  save:   (courseId, lessonId, content, timestamp) =>
            api.post(`/courses/${courseId}/notes`, { lesson_id: lessonId, content, timestamp }),
  delete: (noteId) => api.delete(`/notes/${noteId}`),
};

export default api;
export { getToken, setToken, clearToken };
