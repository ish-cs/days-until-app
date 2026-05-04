import { useEffect } from 'react';

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function buildFaviconSvg(date) {
  const day = date.getDate();
  const month = MONTH_ABBR[date.getMonth()];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <rect width="32" height="32" rx="4" fill="#ffffff"/>
  <rect width="32" height="9" fill="#e03131"/>
  <text x="16" y="8.5" font-family="system-ui,sans-serif" font-size="6" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${month}</text>
  <text x="16" y="22" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#1a1a1a" text-anchor="middle" dominant-baseline="middle">${day}</text>
</svg>`;
}

function setFavicon(svgString) {
  const encoded = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = encoded;
}

function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return midnight - now;
}

export function useDynamicFavicon() {
  useEffect(() => {
    function update() {
      setFavicon(buildFaviconSvg(new Date()));
    }

    update();

    const msToMidnight = msUntilMidnight();
    let timer = setTimeout(function tick() {
      update();
      timer = setTimeout(tick, msUntilMidnight());
    }, msToMidnight);

    return () => clearTimeout(timer);
  }, []);
}
