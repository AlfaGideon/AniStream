export function youtubeEmbed(raw) {
  let id='';
  try {
    const value=String(raw||'').trim();
    if(/^[A-Za-z0-9_-]{11}$/.test(value)) id=value;
    else {
      const url=new URL(value);
      const host=url.hostname.toLowerCase();
      if(host==='youtu.be'||host==='www.youtu.be') id=url.pathname.split('/').filter(Boolean)[0]||'';
      else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)) {
        id=url.searchParams.get('v')||url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1]||'';
      }
    }
  } catch { return ''; }
  return /^[A-Za-z0-9_-]{11}$/.test(id)?`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`:'';
}

export function rutubeEmbed(raw) {
  try {
    const url=new URL(String(raw||''));
    const host=url.hostname.toLowerCase();
    if(host!=='rutube.ru'&&host!=='www.rutube.ru')return '';
    const match=url.pathname.match(/^\/(?:video|play\/embed)\/([a-z0-9-]+)\/?$/i);
    if(!match)return '';
    return `https://rutube.ru/play/embed/${encodeURIComponent(match[1])}`;
  } catch { return ''; }
}

function trustedPlayerUrl(raw, hostPattern) {
  try {
    const url=new URL(String(raw||''));
    if(url.protocol!=='https:'||url.username||url.password||!hostPattern.test(url.hostname.toLowerCase()))return '';
    return url.toString();
  } catch { return ''; }
}

export function kodikEmbed(raw) {
  return trustedPlayerUrl(raw,/(^|\.)kodik\.(info|biz|cc|tv|club|site)$/);
}

export function amediaEmbed(raw) {
  return trustedPlayerUrl(raw,/(^|\.)amediateka\.ru$/);
}

export function vkEmbed(raw) {
  try {
    const url=new URL(String(raw||''));
    const host=url.hostname.toLowerCase();
    if(!/(^|\.)(vk\.com|vkvideo\.ru)$/.test(host))return '';
    if(url.pathname==='/video_ext.php'&&url.searchParams.has('oid')&&url.searchParams.has('id'))return url.toString();
    const combined=`${url.pathname}${url.searchParams.get('z')||''}`;
    const match=combined.match(/video(-?\d+)_(\d+)/);
    return match?`https://vk.com/video_ext.php?oid=${match[1]}&id=${match[2]}`:'';
  } catch { return ''; }
}
