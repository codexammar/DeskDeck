let allShortcuts = [];
let currentCategory = 'All';
let currentKeywords = [];
let currentZone = 'bottom'; // Options: 'bottom', 'top', 'left', 'right', 'center'

async function updateWindowBounds(visibleCount) {
  if (!window.__TAURI__?.window?.getCurrentWindow) return;
  const appWindow = window.__TAURI__.window.getCurrentWindow();

  const count = Math.max(visibleCount, 1);
  const cardWidth = 76;
  const cardHeight = 70;
  const padding = 24;

  let newWidth = 600;
  let newHeight = 220;

  if (currentZone === 'left' || currentZone === 'right') {
    // 3:18 Ratio Vertical Stack
    newWidth = 140;
    newHeight = Math.min(Math.max(count * cardHeight + padding, 180), 720);
  } else if (currentZone === 'top' || currentZone === 'bottom') {
    // 18:3 Ratio Horizontal Strip
    newWidth = Math.min(Math.max(count * cardWidth + padding, 200), 1080);
    newHeight = 110;
  } else {
    // Middle / Center Square ratio
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    newWidth = Math.min(Math.max(cols * cardWidth + padding, 220), 800);
    newHeight = Math.min(Math.max(rows * cardHeight + padding, 180), 800);
  }

  const LogicalSize = window.__TAURI__?.window?.LogicalSize;
  if (LogicalSize) {
    await appWindow.setSize(new LogicalSize(newWidth, newHeight));
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

  // Adjust grid layout style
  if (currentZone === 'left' || currentZone === 'right') {
    gridContainer.className = 'grid-container grid-vertical';
  } else {
    gridContainer.className = 'grid-container grid-horizontal';
  }

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

  updateWindowBounds(filtered.length);
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