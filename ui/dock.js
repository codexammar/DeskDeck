let allShortcuts = [];
let currentCategory = 'All';
let currentKeywords = [];
let currentZone = 'bottom'; // Options: 'bottom', 'top', 'left', 'right', 'center'

async function updateWindowBounds(cols, rows) {
  if (!window.__TAURI__?.window?.getCurrentWindow) return;
  const appWindow = window.__TAURI__.window.getCurrentWindow();

  // Exact component dimensions from CSS: card + gaps + container padding
  const cardWidth = 76;
  const cardHeight = 70;
  const gap = 8;
  const padding = 20; // 10px left/right and top/bottom

  let targetWidth, targetHeight;

  if (currentZone === 'left' || currentZone === 'right') {
    targetWidth = cardWidth + padding;
    targetHeight = (rows * cardHeight) + ((rows - 1) * gap) + padding;
  } else {
    targetWidth = (cols * cardWidth) + ((cols - 1) * gap) + padding;
    // Account for multiple rows and vertical gaps if items wrap past maxCols
    targetHeight = (rows * cardHeight) + ((rows - 1) * gap) + padding;
  }

  const LogicalSize = window.__TAURI__?.window?.LogicalSize;
  if (LogicalSize) {
    await appWindow.setSize(new LogicalSize(targetWidth, targetHeight));
  }
}

function renderShortcuts() {
  const gridContainer = document.getElementById('gridContainer');
  if (!gridContainer) return;

  const filtered = allShortcuts.filter((item) => {
    if (currentCategory === 'All' || currentKeywords.length === 0) return true;
    const lowerName = item.name.toLowerCase();
    const lowerPath = item.path.toLowerCase();

    return currentKeywords.some((kw) => {
      const lowerKw = kw.toLowerCase();
      if (lowerKw === 'folder') return item.is_dir;
      return lowerName.includes(lowerKw) || lowerPath.endsWith(`.${lowerKw}`);
    });
  });

  const count = Math.max(filtered.length, 1);
  let cols = count;
  let rows = 1;

  if (currentZone === 'left' || currentZone === 'right') {
    cols = 1;
    rows = count;
    gridContainer.className = 'grid-container grid-vertical';
  } else {
    cols = Math.min(count, 8); // Max 8 columns per row before wrapping or capping
    rows = Math.ceil(count / cols);
    gridContainer.className = 'grid-container grid-horizontal';
  }

  // Pass dynamic column count to CSS variable safely
  gridContainer.style.setProperty('--dock-cols', cols);

  gridContainer.innerHTML = '';
  filtered.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'shortcut-card';

    const iconSrc = item.icon_base64 || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="%23ffffff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>';

    card.innerHTML = `
      <img class="shortcut-icon-img" src="${iconSrc}" alt="${item.name}" />
      <span class="shortcut-title" title="${item.name}">${item.name}</span>
    `;

    card.addEventListener('mousedown', (e) => e.stopPropagation());

    card.addEventListener('dblclick', async (e) => {
      e.stopPropagation();
      try {
        const invoke = window.__TAURI__?.core?.invoke;
        if (invoke) await invoke('launch_item', { path: item.path });
      } catch (err) {
        console.error('Failed to launch item:', err);
      }
    });

    gridContainer.appendChild(card);
  });

  updateWindowBounds(cols, rows);
}

async function initDock() {
  const mainContainer = document.getElementById('mainContainer');

  try {
    const invoke = window.__TAURI__?.core?.invoke;
    const listen = window.__TAURI__?.event?.listen;

    if (invoke) {
      allShortcuts = await invoke('scan_shortcuts');
      renderShortcuts();
    }

    if (listen) {
      await listen('filter-changed', (event) => {
        currentCategory = event.payload.category;
        currentKeywords = event.payload.keywords;
        renderShortcuts();
      });
    }

    if (mainContainer) {
      mainContainer.addEventListener('mousedown', async (e) => {
        if (e.button === 0 && (e.target.classList.contains('glass-container') || e.target.classList.contains('grid-container'))) {
          if (window.__TAURI__?.window?.getCurrentWindow) {
            const appWindow = window.__TAURI__.window.getCurrentWindow();
            await appWindow.startDragging();
          }
        }
      });
    }
  } catch (err) {
    console.error('Failed to initialize dock:', err);
  }
}

document.addEventListener('DOMContentLoaded', initDock);