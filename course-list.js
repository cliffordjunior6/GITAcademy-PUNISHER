import { getDemoCourses, formatPrice } from './utils.js';

export async function initCourseList() {
  const container = document.getElementById('courseGrid');
  const searchInput = document.getElementById('courseSearch');
  const categoryFilter = document.getElementById('categoryFilter');

  const courses = await getDemoCourses();

  const render = (list) => {
    if (!container) return;
    if (!list.length) {
      container.innerHTML = '<div class="empty-state">No courses match your filters.</div>';
      return;
    }

    container.innerHTML = list.map(course => `
      <a href="course-details.html?id=${course.id}" class="course-card">
        <div class="course-thumb" style="background:${course.thumbnail_bg || '#f5f0e8'}">${course.emoji || '📚'}</div>
        <div class="course-body">
          <div class="course-tag">${course.category || 'Featured'}</div>
          <h3>${course.title}</h3>
          <div class="course-meta">
            <span>⭐ ${course.rating || 4.8}</span>
            <span>${course.lessons || 12} lessons</span>
          </div>
          <div class="course-footer">
            <span class="author">${course.instructor || 'GITAcademy'}</span>
            <span class="price">${course.price === 0 ? 'Free' : formatPrice(course.price)}</span>
          </div>
        </div>
      </a>
    `).join('');
  };

  const query = new URLSearchParams(window.location.search).get('q') || '';
  if (searchInput && query) searchInput.value = query;

  const applyFilters = () => {
    const term = (searchInput?.value || '').trim().toLowerCase();
    const selected = categoryFilter?.value || 'all';
    const filtered = courses.filter(course => {
      const matchesText = !term || `${course.title} ${course.category} ${course.instructor}`.toLowerCase().includes(term);
      const matchesCategory = selected === 'all' || course.category === selected;
      return matchesText && matchesCategory;
    });
    render(filtered);
  };

  searchInput?.addEventListener('input', applyFilters);
  categoryFilter?.addEventListener('change', applyFilters);
  render(courses);
}
