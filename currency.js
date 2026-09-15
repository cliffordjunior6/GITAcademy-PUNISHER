(function () {
  const CURRENCY_SYMBOL = '₵';
  const CURRENCY_CODE = 'GHS';

  function formatGhsValue(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);

    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    const formatted = abs.toLocaleString('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return `${sign}${CURRENCY_SYMBOL}${formatted}`;
  }

  function convertUsdAmount(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return value;
    return num.toFixed(2);
  }

  function replaceCurrencyText(text) {
    if (!text || !(text.includes('$') || /USD/i.test(text))) return text;

    let next = text
      .replace(/-?\$\s*(\d+(?:\.\d+)?)/g, (match, raw) => {
        const value = Number(raw);
        if (Number.isNaN(value)) return match;
        const sign = match.startsWith('-') ? '-' : '';
        return `${sign}${CURRENCY_SYMBOL}${convertUsdAmount(value)}`;
      })
      .replace(/\$\s*(\d+(?:\.\d+)?)/g, (_m, raw) => `${CURRENCY_SYMBOL}${convertUsdAmount(raw)}`)
      .replace(/USD/gi, CURRENCY_CODE);

    return next;
  }

  function convertTextNode(node) {
    if (!node || !node.nodeValue) return;
    const original = node.nodeValue;
    const next = replaceCurrencyText(original);
    if (next !== original) {
      node.nodeValue = next;
    }
  }

  function processElementText(el) {
    if (!el || !(el instanceof Element)) return;
    if (el.closest('script, style, textarea')) return;

    const text = el.textContent || '';
    const next = replaceCurrencyText(text);
    if (next !== text) {
      el.textContent = next;
    }
  }

  function updatePriceBadges() {
    document.querySelectorAll('[data-price], .course-price, .course-price-old, .enroll-price, .mini-price, .summary-val, .receipt-val, .or-val, .mobile-price, .cart-price, .cart-price-old, .total-price, .receipt-total-val, .receipt-total-row').forEach((el) => {
      processElementText(el);
    });
  }

  function applyCurrencyConversion() {
    if (!document.body) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || parent.closest('script, style, textarea')) continue;
      convertTextNode(node);
    }

    updatePriceBadges();
  }

  window.applyCurrencyConversion = applyCurrencyConversion;
  window.formatGhs = formatGhsValue;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCurrencyConversion, { once: true });
  } else {
    applyCurrencyConversion();
  }

  if (document.body) {
    const observer = new MutationObserver(() => {
      applyCurrencyConversion();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.__ghsObserver = observer;
  }
})();
