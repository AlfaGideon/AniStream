export function vkVideoSearchUrl(title) {
  const query=String(title||'').trim();
  if(!query)return '';
  return `https://vk.com/video?q=${encodeURIComponent(query)}`;
}
