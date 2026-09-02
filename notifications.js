/**
 * GITAcademy — notifications.js
 * Handles notification bell, dropdown and real-time updates
 */

import { userApi } from './api.js';
import { timeAgo, showToast } from './utils.js';

let notifications = [];
let unreadCount   = 0;
let pollInterval  = null;

export async function initNotifications() {
  await loadNotifications();
  renderBell();
  renderDropdown();
  startPolling(60_000); // poll every 60s
}

async function loadNotifications() {
  try {
    const data = await userApi.notifications();
    notifications = data?.notifications || data || [];
    unreadCount   = notifications.filter(n => !n.read_at).length;
  } catch (_) {
    notifications = getDemoNotifications();
    unreadCount   = 3;
  }
}

function renderBell() {
  const badge = document.querySelector('.nav-badge, .nav-dot');
  if (!badge) return;
  badge.style.display = unreadCount > 0 ? 'block' : 'none';
  if (badge.tagName !== 'SPAN') {
    badge.setAttribute('data-count', unreadCount);
  }
}

function renderDropdown() {
  const list = document.getElementById('notificationList');
  if (!list) return;

  if (!notifications.length) {
    list.innerHTML = `<div style="text-align:center;padding:2rem;font-size:.85rem;color:rgba(13,13,15,.4)">No notifications yet</div>`;
    return;
  }

  list.innerHTML = notifications.slice(0, 8).map(n => `
    <div class="notif-item ${n.read_at ? '' : 'unread'}" data-id="${n.id}" onclick="markRead(${n.id}, this)">
      <div class="notif-icon">${getNotifIcon(n.type)}</div>
      <div class="notif-content">
        <div class="notif-text">${n.message || n.data?.message || ''}</div>
        <div class="notif-time">${timeAgo(n.created_at)}</div>
      </div>
      ${!n.read_at ? '<span class="notif-dot"></span>' : ''}
    </div>`).join('');
}

function getNotifIcon(type) {
  const icons = {
    course_update: '📚', enrollment: '🎉', certificate: '🏆',
    review_reply: '💬', payment: '💳', announcement: '📢',
  };
  return icons[type] || '🔔';
}

export async function markRead(id, el) {
  try {
    await userApi.markNotificationRead(id);
    el?.classList.remove('unread');
    el?.querySelector('.notif-dot')?.remove();
    unreadCount = Math.max(0, unreadCount - 1);
    renderBell();
  } catch (_) {}
}

export async function markAllRead() {
  notifications.forEach(n => n.read_at = new Date().toISOString());
  unreadCount = 0;
  renderBell();
  renderDropdown();
}

function startPolling(ms) {
  pollInterval = setInterval(async () => {
    await loadNotifications();
    renderBell();
    renderDropdown();
  }, ms);
}

export function stopPolling() {
  clearInterval(pollInterval);
}

function getDemoNotifications() {
  return [
    { id:1, type:'course_update', message:'New lesson added to Python Fundamentals', created_at: new Date(Date.now()-120000).toISOString(), read_at:null },
    { id:2, type:'certificate',   message:'Your certificate for JavaScript Basics is ready!', created_at: new Date(Date.now()-3600000).toISOString(), read_at:null },
    { id:3, type:'review_reply',  message:'Dr. James Chen replied to your Q&A question', created_at: new Date(Date.now()-86400000).toISOString(), read_at:null },
    { id:4, type:'enrollment',    message:'Successfully enrolled in Data Analysis with Pandas', created_at: new Date(Date.now()-172800000).toISOString(), read_at: new Date().toISOString() },
  ];
}

window.markRead = markRead;
