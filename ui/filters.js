async function initFilters() {
  const filterBar = document.getElementById('filterBar');
  if (!filterBar) return;

  try {
    const invoke = window.__TAURI__?.core?.invoke;
    if (!invoke) return;

    const config = await invoke('load_filters');
    const categories = [
      { name: 'All', icon: '✦' },
      ...config.categories.map(c => ({ name: c.name, icon: c.icon || '📁' }))
    ];

    filterBar.innerHTML = '';
    categories.forEach((cat, idx) => {
      const btn = document.createElement('button');
      btn.className = `filter-btn ${idx === 0 ? 'active' : ''}`;
      btn.innerHTML = `<span class="filter-icon">${cat.icon}</span><span>${cat.name}</span>`;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      filterBar.appendChild(btn);
    });

    const dragHandle = document.querySelector('.drag-handle');
    if (dragHandle) {
      dragHandle.addEventListener('mousedown', async (e) => {
        if (e.button === 0 && window.__TAURI__?.window?.getCurrentWindow) {
          const appWindow = window.__TAURI__.window.getCurrentWindow();
          await appWindow.startDragging();
        }
      });
    }
  } catch (err) {
    console.error('Failed to load filters:', err);
  }
}

document.addEventListener('DOMContentLoaded', initFilters);