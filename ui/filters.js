async function updateWindowBounds() {
  if (!window.__TAURI__?.window?.getCurrentWindow) return;
  const appWindow = window.__TAURI__.window.getCurrentWindow();
  const mainContainer = document.getElementById('mainContainer');
  if (!mainContainer) return;

  requestAnimationFrame(async () => {
    // Force layout engine to flush so scrollWidth reads correctly
    void mainContainer.offsetWidth;

    // Container padding is 10px left + 10px right = 20px total
    const targetWidth = mainContainer.scrollWidth;
    const targetHeight = mainContainer.scrollHeight;

    const LogicalSize = window.__TAURI__?.window?.LogicalSize;
    if (LogicalSize) {
      await appWindow.setSize(new LogicalSize(targetWidth, targetHeight));
    }
  });
}

async function initFilters() {
  const filterBar = document.getElementById('filterBar');
  const mainContainer = document.getElementById('mainContainer');
  if (!filterBar) return;

  try {
    const invoke = window.__TAURI__?.core?.invoke;
    const emit = window.__TAURI__?.event?.emit;
    if (!invoke) return;

    const config = await invoke('load_filters');
    const categories = [
      { name: 'All', icon: '✦', keywords: [] },
      ...config.categories
    ];

    filterBar.innerHTML = '';
    categories.forEach((cat, idx) => {
      const btn = document.createElement('button');
      btn.className = `filter-btn ${idx === 0 ? 'active' : ''}`;
      btn.innerHTML = `<span class="filter-icon">${cat.icon}</span><span>${cat.name}</span>`;

      // Prevent dragging when clicking buttons
      btn.addEventListener('mousedown', (e) => e.stopPropagation());

      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (emit) {
          await emit('filter-changed', {
            category: cat.name,
            keywords: cat.keywords || []
          });
        }
      });

      filterBar.appendChild(btn);
    });

    if (mainContainer) {
      mainContainer.addEventListener('mousedown', async (e) => {
        if (e.button === 0 && (e.target.classList.contains('glass-container') || e.target.classList.contains('filter-bar'))) {
          if (window.__TAURI__?.window?.getCurrentWindow) {
            const appWindow = window.__TAURI__.window.getCurrentWindow();
            await appWindow.startDragging();
          }
        }
      });
    }

    updateWindowBounds();
  } catch (err) {
    console.error('Failed to load filters:', err);
  }
}

document.addEventListener('DOMContentLoaded', initFilters);