async function updateWindowBounds() {
  if (!window.__TAURI__?.window?.getCurrentWindow) return;
  const appWindow = window.__TAURI__.window.getCurrentWindow();
  const mainContainer = document.getElementById('mainContainer');
  if (!mainContainer) return;

  requestAnimationFrame(async () => {
    void mainContainer.offsetWidth;

    // Force layout recalculation to account for button dimensions and gaps
    const targetWidth = mainContainer.scrollWidth + 2;
    const targetHeight = mainContainer.scrollHeight + 2;

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
      { name: 'All', icon: '🧩', keywords: [] },
      ...config.categories
    ];

    filterBar.innerHTML = '';
    categories.forEach((cat, idx) => {
      const btn = document.createElement('button');
      btn.className = `filter-btn ${idx === 0 ? 'active' : ''}`;
      
      const iconSymbol = cat.icon || '•';

      btn.innerHTML = `<span class="filter-icon">${iconSymbol}</span><span class="filter-text">${cat.name}</span>`;

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

    // Ensure bounds update happens after DOM paint and reflow completes
    setTimeout(updateWindowBounds, 50);
  } catch (err) {
    console.error('Failed to load filters:', err);
  }
}

document.addEventListener('DOMContentLoaded', initFilters);