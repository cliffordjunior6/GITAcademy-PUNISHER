/**
 * GITAcademy — tabs.js
 * Reusable tab component — URL hash support, animation, lazy loading
 */

export class Tabs {
  /**
   * @param {Object} options
   * @param {string} options.tabSelector    CSS selector for tab buttons
   * @param {string} options.panelSelector  CSS selector for tab panels
   * @param {string} options.activeClass    Class to add to active tab
   * @param {boolean} options.useHash       Sync with URL hash
   * @param {Function} options.onChange     Callback(tabId) on change
   */
  constructor(options = {}) {
    this.tabSelector   = options.tabSelector   || '.tab-btn';
    this.panelSelector = options.panelSelector || '.tab-panel';
    this.activeClass   = options.activeClass   || 'active';
    this.useHash       = options.useHash       !== false;
    this.onChange      = options.onChange      || null;
    this.tabs          = document.querySelectorAll(this.tabSelector);
    this.panels        = document.querySelectorAll(this.panelSelector);

    this._init();
  }

  _init() {
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => this.activate(tab.dataset.tab || tab.dataset.target));
    });

    // Activate from URL hash on load
    if (this.useHash && window.location.hash) {
      const hash = window.location.hash.replace('#', '');
      if (hash) this.activate(hash);
    } else {
      // Activate first tab that has active class, or first tab
      const activeTab = [...this.tabs].find(t => t.classList.contains(this.activeClass));
      if (activeTab) this.activate(activeTab.dataset.tab || activeTab.dataset.target);
      else if (this.tabs[0]) this.activate(this.tabs[0].dataset.tab || this.tabs[0].dataset.target);
    }

    // Listen for hash changes
    if (this.useHash) {
      window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '');
        if (hash) this.activate(hash);
      });
    }
  }

  activate(tabId) {
    if (!tabId) return;

    // Update tab buttons
    this.tabs.forEach(tab => {
      const id = tab.dataset.tab || tab.dataset.target;
      tab.classList.toggle(this.activeClass, id === tabId);
    });

    // Update panels
    this.panels.forEach(panel => {
      const id = panel.id?.replace('tab-', '');
      panel.classList.toggle(this.activeClass, id === tabId);
    });

    // Update hash
    if (this.useHash) {
      history.replaceState(null, '', '#' + tabId);
    }

    this.onChange?.(tabId);
  }

  /** Programmatically switch to a tab */
  go(tabId) { this.activate(tabId); }

  /** Get the current active tab ID */
  current() {
    return [...this.tabs].find(t => t.classList.contains(this.activeClass))?.dataset.tab;
  }
}

/** Quick initialiser — call on page load for standard tab patterns */
export function initTabs(containerSelector = '.tabs-wrap') {
  document.querySelectorAll(containerSelector).forEach(container => {
    new Tabs({
      tabSelector:   container.querySelectorAll('.tab-btn').length ? '.tab-btn' : '[role="tab"]',
      panelSelector: container.querySelectorAll('.tab-panel').length ? '.tab-panel' : '[role="tabpanel"]',
    });
  });
}

// Auto-init if data-tabs attribute present
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-tabs]').forEach(container => {
    new Tabs({ useHash: container.dataset.hash !== 'false' });
  });
});


/* ============================================================
   dropdown.js — Reusable dropdown / select component
   ============================================================ */

export class Dropdown {
  /**
   * @param {HTMLElement} trigger  Button that opens dropdown
   * @param {HTMLElement} menu     The dropdown menu element
   * @param {Object}      options
   */
  constructor(trigger, menu, options = {}) {
    this.trigger   = trigger;
    this.menu      = menu;
    this.isOpen    = false;
    this.placement = options.placement || 'bottom-end'; // 'bottom-start' | 'bottom-end'
    this.onOpen    = options.onOpen  || null;
    this.onClose   = options.onClose || null;
    this.onSelect  = options.onSelect || null;

    this._init();
  }

  _init() {
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isOpen ? this.close() : this.open();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.menu.contains(e.target) && !this.trigger.contains(e.target)) {
        this.close();
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      const items = [...this.menu.querySelectorAll('[role="menuitem"], .dropdown-item')];
      const focused = document.activeElement;
      const idx = items.indexOf(focused);

      if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(idx+1, items.length-1)]?.focus(); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); items[Math.max(idx-1, 0)]?.focus(); }
      if (e.key === 'Escape')    { this.close(); this.trigger.focus(); }
      if (e.key === 'Tab')       { this.close(); }
    });

    // Handle menu item selection
    this.menu.addEventListener('click', (e) => {
      const item = e.target.closest('[role="menuitem"], .dropdown-item');
      if (item) {
        this.onSelect?.(item.dataset.value || item.textContent.trim(), item);
        if (!item.dataset.keepOpen) this.close();
      }
    });
  }

  open() {
    this.isOpen = true;
    this.menu.classList.add('open');
    this.trigger.setAttribute('aria-expanded', 'true');
    this._position();
    this.onOpen?.();
    // Focus first item
    this.menu.querySelector('[role="menuitem"], .dropdown-item')?.focus();
  }

  close() {
    this.isOpen = false;
    this.menu.classList.remove('open');
    this.trigger.setAttribute('aria-expanded', 'false');
    this.onClose?.();
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  _position() {
    const triggerRect = this.trigger.getBoundingClientRect();
    const menuRect    = this.menu.getBoundingClientRect();
    const viewport    = { w: window.innerWidth, h: window.innerHeight };

    // Flip if overflows bottom
    const flipped = triggerRect.bottom + menuRect.height > viewport.h;
    this.menu.style.marginTop  = flipped ? 'auto' : '8px';
    this.menu.style.marginBottom = flipped ? '8px' : 'auto';
  }
}

/** Auto-init dropdowns with data-dropdown-trigger attribute */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-dropdown-trigger]').forEach(trigger => {
    const menuId = trigger.dataset.dropdownTrigger;
    const menu   = document.getElementById(menuId);
    if (menu) new Dropdown(trigger, menu);
  });

  // Standard nav dropdowns (user menu, notification dropdown)
  const standardDropdowns = [
    { triggerId: 'userMenuBtn',    menuId: 'userDropdown'    },
    { triggerId: 'notifBtn',       menuId: 'notifDropdown'   },
    { triggerId: 'adminUserBtn',   menuId: 'adminDropdown'   },
  ];

  standardDropdowns.forEach(({ triggerId, menuId }) => {
    const trigger = document.getElementById(triggerId);
    const menu    = document.getElementById(menuId);
    if (trigger && menu) new Dropdown(trigger, menu);
  });
});
