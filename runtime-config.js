const isPublicSite = window.location.hostname === 'four-4444z.github.io';
window.SYSTEM_CORE_API_URL = isPublicSite
  ? 'https://core-search-4444z-api.onrender.com'
  : '';
window.SYSTEM_CORE_SCRAMJET_URL = isPublicSite
  ? 'https://core-search-4444z-scramjet.onrender.com'
  : '';
