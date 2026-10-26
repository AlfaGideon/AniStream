import './style.css';
import { searchCatalog, findKitsuStreaming, SOURCE_DETAILS } from './catalog.js';
import { APP_VERSION, APP_BUILD, checkForUpdate, installUpdate } from './app-update.js';
import { youtubeEmbed, vkEmbed, rutubeEmbed } from './media-links.js';

const state = {
  page: 'home', query: '', filter: 'Аниме', adult: false, pendingFilter: null,
  items: [], saved: new Map(), modal: null, loading: true, searchPending: false,
  error: '', warning: '', hasNext: false, pageNum: 1, sources: [], sourceHealth: [], requestId: 0,
  providerLinks: [], providerStatus: 'idle', providerError: '', providerEmbed: null, updateCheck: null,
  reader: { itemId: '', pages: [], index: 0, loading: false, error: '' },
  settings: { autoplay: false, quality: 'Авто', theme: 'Тёмная', blur: true, notifications: true },
};
const app = document.querySelector('#app');
const STORE = { saved: 'anistream-saved-v2', adult: 'anistream-adult-enabled', settings: 'anistream-settings-v2' };
try {
  for (const item of JSON.parse(localStorage.getItem(STORE.saved) || '[]')) state.saved.set(item.id, item);
  state.adult = localStorage.getItem(STORE.adult) === 'true';
  state.settings = { ...state.settings, ...JSON.parse(localStorage.getItem(STORE.settings) || '{}') };
} catch { /* Use defaults when local storage is unavailable or malformed. */ }
let controller;
let searchTimer;

const icon = (name, size=20) => {
  const paths = {
    search:'<circle cx="11" cy="11" r="7.5"/><path d="m16.5 16.5 4 4"/>', bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2z"/>',
    play:'<path d="m8 5 12 7-12 7z"/>', plus:'<path d="M12 5v14M5 12h14"/>', check:'<path d="m5 12 4 4L19 6"/>', close:'<path d="m18 6-12 12M6 6l12 12"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>', book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5zM4 16h16"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>', bookmark:'<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z"/>',
    star:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>', sliders:'<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4m4-6h4m4 8h4"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const safeUrl = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const labelFor = item => item.type === '18+' ? '18+' : item.type.toUpperCase();
const countLabel = item => item.type === 'Аниме' ? item.episodes : item.type === 'Ранобэ' ? item.episodes : item.episodes;

function persistSaved() {
  try { localStorage.setItem(STORE.saved, JSON.stringify([...state.saved.values()])); } catch { /* storage is optional */ }
}
function card(item, i=0) {
  const hidden = item.isAdult && state.settings.blur;
  const saved = state.saved.has(item.id);
  const image = safeUrl(item.cover);
  return `<article class="poster-card ${hidden?'adult-blur':''}" data-open="${esc(item.id)}" style="--order:${i}">
    <div class="poster-art ${item.isAdult?'adult-poster':''}">${image?`<img class="cover-image" src="${esc(image)}" alt="Обложка: ${esc(item.title)}" loading="lazy" referrerpolicy="no-referrer">`:`<span class="cover-placeholder">${icon(item.type==='Аниме'?'play':'book',34)}</span>`}
      <span class="card-label ${item.isAdult?'adult-tag':''}">${labelFor(item)}</span>
      <button class="save-btn ${saved?'is-saved':''}" data-save="${esc(item.id)}" aria-label="${saved?'Убрать из закладок':'В закладки'}">${icon(saved?'check':'plus',17)}</button>
      <div class="poster-bottom"><span>${esc(item.year)} <i>·</i> ${esc(countLabel(item))}</span><span class="mini-rating">${icon('star',13)} ${esc(item.rating)}</span></div>
      <button class="quick-play" data-open="${esc(item.id)}" aria-label="Подробнее">${icon('chevron',20)}</button>
    </div>
    <div class="card-info"><h3>${esc(item.title)}</h3><div>${esc((item.genres||[]).slice(0,2).join(' · '))} <span>·</span> ${esc(item.source)}</div></div>
  </article>`;
}
function cards(items) { return items.map((item,i)=>card(item,i)).join(''); }
function section(title, subtitle, items, action='Смотреть всё') {
  if (!items.length) return '';
  return `<section class="content-section"><div class="section-heading"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="text-link" data-page="catalog">${action} ${icon('chevron',16)}</button></div><div class="card-row">${cards(items)}</div></section>`;
}
function visibleItems() {
  const all = state.page === 'saved' ? [...state.saved.values()] : state.items;
  if (state.page === 'manga') return all.filter(item => ['Манга','Ранобэ'].includes(item.type));
  if (state.page === 'saved') return all;
  if (state.filter === 'Аниме') return all.filter(item => item.type === 'Аниме' || (item.type === '18+' && item.mediaType === 'ANIME'));
  if (state.filter === 'Манга') return all.filter(item => item.type === 'Манга' || (item.type === '18+' && item.mediaType === 'MANGA'));
  if (state.filter === 'Ранобэ') return all.filter(item => item.type === 'Ранобэ' || (item.type === '18+' && item.format === 'NOVEL'));
  if (state.filter === '18+') return all.filter(item => item.isAdult);
  return all;
}

function hero(item) {
  if (!item) return `<section class="hero hero-empty"><div class="hero-content"><div class="eyebrow"><span class="live-dot"></span> ANISTREAM · КАТАЛОГ</div><div class="hero-kicker">${state.loading?'ЗАГРУЖАЕМ КАТАЛОГ':'КАТАЛОГ ИСТОРИЙ'}</div><h1>${state.loading?'Находим вашу':'Аниме, манга'}<br><em>${state.loading?'следующую историю':'и ранобэ — вместе'}</em></h1><p class="hero-description">Данные рейтингов и карточек загружаются напрямую из каталогов AniList и MyAnimeList.</p><div class="hero-actions"><button class="primary-btn" data-page="catalog">Открыть каталог ${icon('chevron',16)}</button></div></div></section>`;
  const backdrop = safeUrl(item.banner) || safeUrl(item.cover);
  const yt = trailerUrl(item);
  return `<section class="hero" ${backdrop?`style="--hero-image:url('${esc(backdrop)}')"`:''}><div class="hero-shade"></div><div class="hero-content"><div class="eyebrow"><span class="live-dot"></span> ПОПУЛЯРНОЕ В ANILIST <span class="eyebrow-line"></span> ${esc(item.year)}</div><div class="hero-kicker">${esc(item.type)} · ${esc(item.format||'')}</div><h1>${esc(item.title)}</h1><p class="hero-description">${esc(item.description).slice(0,180)}${item.description.length>180?'…':''}</p><div class="hero-meta"><span class="rating-pill">${icon('star',14)} ${esc(item.rating)}</span><span>${esc(item.year)}</span><i></i><span>${esc(countLabel(item))}</span><i></i><span class="genre-text">${esc((item.genres||[]).slice(0,2).join(' · '))}</span></div><div class="hero-actions"><button class="primary-btn" data-watch="${esc(item.id)}">${icon('play',17)} Где смотреть</button><button class="secondary-btn" data-open="${esc(item.id)}">Подробнее ${icon('chevron',16)}</button><button class="round-btn" data-save="${esc(item.id)}" aria-label="В список">${icon(state.saved.has(item.id)?'check':'plus',20)}</button></div><div class="hero-footnote"><span>METADATA BY <b>${esc(item.source)}</b></span><div class="hero-progress"><span></span></div><button class="sound-toggle" data-trailer="${esc(item.id)}">${yt?'Официальный трейлер':'Найти трейлер'} ${icon('play',13)}</button></div></div><div class="hero-side-label">ANISTREAM · ОТКРЫТЫЕ КАТАЛОГИ <span>✦</span></div></section>`;
}
function toolbar() {
  const title = state.query ? 'Результаты поиска' : state.page==='saved'?'Мой список':state.page==='manga'?'Манга и ранобэ':state.page==='home'?'Популярное сейчас':'Каталог';
  const filters = ['Все','Аниме','Манга','Ранобэ',...(state.adult?['18+']:[])];
  return `<div class="catalog-toolbar"><div><h1>${title}</h1>${state.query?`<p>Поиск «${esc(state.query)}» · данные из подключённых каталогов</p>`:`<p>${state.page==='saved'?'Сохранённые карточки':state.loading?'Подключаем каталоги…':`${visibleItems().length} карточек · ${esc(state.sources.join(' + ')||'AniList')}`}</p>`}</div><button class="filter-btn" data-filter-toggle>${icon('sliders',17)} Фильтры</button></div>
    <div class="filter-chips">${filters.map(f=>`<button class="chip ${state.filter===f?'selected':''}" data-filter="${f}">${f==='18+'?'18+ · Только для взрослых':f}</button>`).join('')}<span class="chip-divider"></span><button class="chip chip-quiet" data-settings>${icon('settings',15)} Настройки</button></div>`;
}
function statusBlock() {
  if (state.error) return `<div class="empty-state"><span>⌁</span><h2>Не удалось получить каталог</h2><p>${esc(state.error)} Проверьте подключение и попробуйте ещё раз.</p><button class="primary-btn" data-retry>Повторить запрос</button></div>`;
  if ((state.loading || state.searchPending) && !visibleItems().length) return `<div class="loading-state"><span class="loader"></span><b>Загружаем свежие данные из AniList и MyAnimeList…</b><small>Названия, рейтинги и обложки приходят из открытых каталогов</small></div>`;
  if (!visibleItems().length) return `<div class="empty-state"><span>⌕</span><h2>${state.page==='saved'?'Список пока пуст':'Ничего не найдено'}</h2><p>${state.page==='saved'?'Нажимайте на значок закладки в карточке, чтобы сохранить историю.':'Измените запрос или категорию. Поиск обновляется по выбранным каталогам.'}</p>${state.page!=='saved'?'<button class="primary-btn" data-reset-search>Сбросить фильтры</button>':''}</div>`;
  return '';
}
function render() {
  const keepFocus = document.activeElement?.id === 'search';
  const cursor = keepFocus ? document.activeElement.selectionStart : null;
  const home = state.page === 'home' && !state.query;
  const items = visibleItems();
  const primary = items[0];
  const gridItems = home ? items.slice(1) : items;
  const canLoadMore = state.page !== 'saved' && state.hasNext && !state.error;
  app.innerHTML = `<div class="app-shell">
    <aside class="sidebar"><a class="brand" href="#" data-page="home"><span class="brand-mark">${icon('play',19)}</span><span>Ani<span>Stream</span></span></a>
      <div class="side-label">МЕНЮ</div><nav class="side-nav"><button class="nav-item ${state.page==='home'?'active':''}" data-page="home">${icon('home')}<span>Главная</span></button><button class="nav-item ${state.page==='catalog'?'active':''}" data-page="catalog">${icon('grid')}<span>Каталог</span></button><button class="nav-item ${state.page==='manga'?'active':''}" data-page="manga">${icon('book')}<span>Манга и ранобэ</span></button><button class="nav-item ${state.page==='saved'?'active':''}" data-page="saved">${icon('bookmark')}<span>Мой список</span><span class="nav-count">${state.saved.size||''}</span></button></nav>
      <div class="side-label collection-label">ИСТОЧНИКИ</div><div class="collection source-collection" data-info="sources"><div class="collection-icon">◎</div><div><b>AniList + MyAnimeList</b><span>Живые данные каталога</span></div><span class="collection-dot"></span></div><div class="side-spacer"></div>
      <div class="side-promo"><span class="promo-spark">✦</span><b>Одна история.<br>Целая вселенная.</b><p>Открытые связи аниме, манги и ранобэ из каталога.</p><button data-page="catalog">Исследовать ${icon('chevron',15)}</button></div>
      <button class="profile" data-settings><span class="avatar">AS</span><span><b>Мой профиль</b><small>Настройки на устройстве</small></span><span class="profile-dots">···</span></button>
    </aside>
    <main class="main-area"><header class="topbar"><div class="mobile-brand"><span class="brand-mark">${icon('play',17)}</span>Ani<span>Stream</span></div><div class="breadcrumb"><span>Главная</span><span class="crumb-divider">/</span><b>${state.page==='home'?'Для вас':state.page==='saved'?'Мой список':state.page==='manga'?'Манга и ранобэ':'Каталог'}</b></div>
      <label class="search-box">${icon('search',18)}<input id="search" placeholder="Название, жанр, персонаж…" value="${esc(state.query)}"><kbd>⌘ K</kbd><button class="clear-search ${state.query?'visible':''}" data-clear aria-label="Очистить">${icon('close',14)}</button></label><button class="icon-btn notification" aria-label="Источники" data-info="sources">${icon('bell')}<i></i></button><button class="top-avatar" data-settings>AS</button>
    </header><div class="mobile-nav"><button data-page="home" class="${state.page==='home'?'active':''}">${icon('home',18)}<span>Главная</span></button><button data-page="catalog" class="${state.page==='catalog'?'active':''}">${icon('grid',18)}<span>Каталог</span></button><button data-page="manga" class="${state.page==='manga'?'active':''}">${icon('book',18)}<span>Манга</span></button><button data-page="saved" class="${state.page==='saved'?'active':''}">${icon('bookmark',18)}<span>Список</span></button></div>
      <div class="page-content">${home?hero(primary):''}${toolbar()}${state.warning?`<div class="source-warning">${esc(state.warning)}</div>`:''}<div class="catalog-grid">${cards(gridItems)}</div>${statusBlock()}${canLoadMore?`<div class="load-more-wrap"><button class="secondary-btn" data-load-more ${state.loading?'disabled':''}>${state.loading?'Загружаем…':'Загрузить ещё'}</button></div>`:''}
      ${home?section('Следующая глава или серия','Продолжайте открывать миры из связанных каталогов',items.slice(1,5),'Каталог'):''}
      ${home?adultSection():''}
      <footer class="footer"><span>© AniStream</span><span>Каталог обновляется из подключённых источников <b>✦</b></span><span><a href="#" data-info="sources">Источники и данные</a><a href="#" data-info="privacy">Конфиденциальность</a></span></footer>
      </div></main>${state.modal?renderModal():''}</div>`;
  bind();
  if (keepFocus) { const input=document.querySelector('#search'); input?.focus(); input?.setSelectionRange(cursor,cursor); }
}
function adultSection() {
  return `<section class="adult-banner"><div class="adult-symbol">18<span>+</span></div><div><span class="adult-kicker">КОНТРОЛЬ ДОСТУПА</span><h2>Категория 18+ скрыта по умолчанию</h2><p>Карточки и обложки скрываются блюром; источник отдаёт только метаданные каталога.</p></div><button class="secondary-btn" data-adult>${state.adult?'Отключить доступ':'Подтвердить возраст'} ${icon('chevron',15)}</button><div class="adult-glow"></div></section>`;
}
function trailerUrl(item) {
  if (!item.trailer?.id) return '';
  if (String(item.trailer.site).toLowerCase() === 'youtube') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.trailer.id)}`;
  if (String(item.trailer.site).toLowerCase() === 'dailymotion') return `https://www.dailymotion.com/embed/video/${encodeURIComponent(item.trailer.id)}`;
  return '';
}
function externalSources(item) {
  const q=encodeURIComponent(item.title);
  if (item.type==='Аниме' || item.mediaType==='ANIME') return [
    ['Crunchyroll','https://www.crunchyroll.com/search?q='+q],['Netflix','https://www.netflix.com/search?q='+q],['YouTube','https://www.youtube.com/results?search_query='+encodeURIComponent(item.title+' official trailer')],
  ];
  return [['MANGA Plus','https://mangaplus.shueisha.co.jp/search'],['BOOK☆WALKER','https://global.bookwalker.jp/search/?q='+q],['VIZ','https://www.viz.com/search?search='+q]];
}
function renderModal() {
  const m=state.modal;
  if (!m) return '';
  if (m.type==='settings') return `<div class="modal-backdrop" data-dismiss><section class="modal settings-modal" role="dialog" aria-modal="true"><div class="modal-head"><div><div class="modal-overline">ПЕРСОНАЛИЗАЦИЯ</div><h2>Настройки</h2></div><button class="close-btn" data-close>${icon('close')}</button></div><div class="settings-layout"><nav class="settings-tabs"><button class="selected">${icon('settings',17)} Общие</button><button>${icon('play',17)} Воспроизведение</button><button>${icon('bell',17)} Уведомления</button><button>${icon('bookmark',17)} Приватность</button></nav><div class="settings-body"><div class="setting-group"><h3>Внешний вид</h3><div class="setting-row"><div><b>Тема оформления</b><small>Выберите комфортный режим</small></div><select data-setting="theme"><option ${state.settings.theme==='Тёмная'?'selected':''}>Тёмная</option><option ${state.settings.theme==='Системная'?'selected':''}>Системная</option><option ${state.settings.theme==='Светлая'?'selected':''}>Светлая</option></select></div><div class="setting-row"><div><b>Размывать карточки 18+</b><small>Блюр превью даже после подтверждения возраста</small></div><button class="switch ${state.settings.blur?'on':''}" data-toggle="blur"><i></i></button></div></div><div class="setting-group"><h3>Воспроизведение</h3><div class="setting-row"><div><b>Качество видео</b><small>Применяется на сайте провайдера</small></div><select data-setting="quality"><option>Авто</option><option>1080p</option><option>720p</option><option>480p</option></select></div><div class="setting-row"><div><b>Следующая серия автоматически</b><small>Доступно у выбранного видеосервиса</small></div><button class="switch ${state.settings.autoplay?'on':''}" data-toggle="autoplay"><i></i></button></div></div><div class="setting-group"><h3>Безопасность</h3><div class="setting-row"><div><b>Категория 18+</b><small>${state.adult?'Возраст подтверждён на этом устройстве':'Скрыта до подтверждения возраста'}</small></div><button class="secondary-btn small" data-adult>${state.adult?'Отключить':'Подтвердить 18+'}</button></div></div><div class="setting-group update-group"><h3>Обновление приложения</h3><div class="setting-row"><div><b>AniStream ${esc(APP_VERSION)}</b><small>Сборка ${APP_BUILD} · OTA через GitHub</small></div><button class="secondary-btn small" data-check-updates ${state.updateCheck?.status==='checking'?'disabled':''}>${state.updateCheck?.status==='checking'?'Проверяем…':'Проверить'}</button></div>${state.updateCheck?.status==='checked'?`<div class="update-result ${state.updateCheck.available?'available':''}">${state.updateCheck.available?`Доступна версия ${esc(state.updateCheck.latestVersion)} (сборка ${state.updateCheck.latestBuild}).`:'У вас установлена последняя версия.'}</div>`:''}${state.updateCheck?.status==='error'?`<div class="update-result update-error">${esc(state.updateCheck.message)}</div>`:''}${state.updateCheck?.available&&!state.updateCheck.signedWithPersistentKey?'<div class="update-result update-error">GitHub ещё не настроен на постоянную подпись APK. Для установки поверх текущей версии добавь signing secrets в репозиторий; без них Android потребует удалить старую версию.</div>':''}${state.updateCheck?.notice?`<div class="update-result">${esc(state.updateCheck.notice)}</div>`:''}${state.updateCheck?.available&&state.updateCheck.signedWithPersistentKey?`<button class="primary-btn update-install" data-install-update>Скачать и установить ${esc(state.updateCheck.latestVersion)} ${icon('chevron',15)}</button>`:''}<small class="update-note">Android запросит подтверждение установки. Для обновления поверх текущей версии подпись APK должна совпадать.</small></div><div class="settings-note">Избранное, возраст и настройки хранятся локально на этом устройстве.</div></div></div><div class="modal-footer"><button class="text-link" data-reset>Сбросить настройки</button><button class="primary-btn" data-close>Готово</button></div></section></div>`;
  if (m.type==='age') return `<div class="modal-backdrop"><section class="modal age-modal" role="dialog" aria-modal="true"><button class="close-btn age-close" data-close>${icon('close')}</button><div class="age-icon">18<span>+</span></div><div class="modal-overline">ПОДТВЕРЖДЕНИЕ ВОЗРАСТА</div><h2>Вам уже исполнилось 18 лет?</h2><p>Откроется только метаданный раздел AniList, помеченный как 18+. Видеофайлы и изображения для взрослых AniStream не загружает. Карточки останутся размытыми, если включена соответствующая настройка.</p><div class="age-actions"><button class="secondary-btn" data-close>Нет, вернуться</button><button class="primary-btn" data-confirm-age>Да, мне есть 18</button></div><small>Доступ можно в любой момент отключить в настройках.</small></section></div>`;
  if (m.type==='title') {
    const t=m.item; const backdrop=safeUrl(t.banner)||safeUrl(t.cover);
    const related=t.relations||[];
    return `<div class="modal-backdrop" data-dismiss><section class="modal detail-modal" role="dialog" aria-modal="true"><div class="detail-backdrop" ${backdrop?`style="--detail-image:url('${esc(backdrop)}')"`:''}><button class="close-btn" data-close>${icon('close')}</button></div><div class="detail-content"><div class="eyebrow">${esc(t.source)} <span class="eyebrow-line"></span> ${esc(t.year)}</div><h2>${esc(t.title)}</h2><div class="detail-meta"><span class="rating-pill">${icon('star',14)} ${esc(t.rating)}</span><span>${esc(t.type)}</span><i></i><span>${esc(countLabel(t))}</span><i></i><span>${esc((t.genres||[]).join(' · '))}</span></div><p>${esc(t.description)}</p><div class="detail-actions"><button class="primary-btn" data-watch="${esc(t.id)}">${icon('play',17)} Где смотреть / читать</button><button class="secondary-btn" data-save="${esc(t.id)}">${icon(state.saved.has(t.id)?'check':'plus',17)} ${state.saved.has(t.id)?'В списке':'В мой список'}</button><button class="secondary-btn" data-trailer="${esc(t.id)}">${icon('play',15)} Трейлер</button></div><div class="relation-block"><div class="relation-heading"><div><span class="modal-overline">СВЯЗИ ИЗ ANILIST</span><h3>Другие форматы и части истории</h3></div><a class="relation-note" target="_blank" rel="noreferrer" href="${esc(safeUrl(t.url))}">Карточка источника ↗</a></div>${related.length?`<div class="relation-cards">${related.map(r=>`<a class="relation-card" href="${esc(safeUrl(r.url))}" target="_blank" rel="noreferrer">${r.image?`<img class="relation-cover" src="${esc(safeUrl(r.image))}" alt="" loading="lazy">`:`<span class="relation-icon manga-icon">${icon('book',19)}</span>`}<span><small>${esc(r.relation)} · ${esc(r.kind)}</small><b>${esc(r.title)}</b></span>${icon('chevron',16)}</a>`).join('')}</div>`:`<p class="relation-note">AniList пока не сообщает связанные издания для этой карточки.</p>`}</div><div class="relation-block"><div class="relation-heading"><div><span class="modal-overline">ИСТОЧНИКИ ВОСПРОИЗВЕДЕНИЯ</span><h3>Попробовать найти плеер внутри AniStream</h3></div></div><p class="relation-note">Нажми «Где смотреть / читать»: AniStream проверит официальные записи Kitsu и попробует встроить страницу провайдера, если он разрешает воспроизведение в iframe.</p></div><div class="detail-status"><span class="live-dot"></span>Метаданные: ${esc(t.source)} · контент открывается у правообладателя</div></div></section></div>`;
  }
  if (m.type==='watch') {
    const t=m.item;
    const providers=state.providerLinks;
    const providerState=state.providerStatus==='loading'?'<div class="provider-loading"><span class="loader"></span>Ищем официальные страницы просмотра в Kitsu…</div>':state.providerStatus==='error'?`<div class="provider-error">${esc(state.providerError)}</div>`:providers.length?`<div class="provider-links">${providers.map((link,index)=>`<button class="primary-btn" type="button" data-provider-play="${index}">${esc(link.name)} · открыть внутри AniStream<small>${esc([...link.subs.map(x=>`субтитры: ${x}`),...link.dubs.map(x=>`дубляж: ${x}`)].join(' · ')||'ссылка из каталога Kitsu')}</small></button>`).join('')}</div>`:'<p class="provider-empty">Каталог Kitsu не вернул официальных страниц просмотра для этого тайтла.</p>';
    return `<div class="modal-backdrop" data-dismiss><section class="modal player-modal" role="dialog" aria-modal="true"><div class="player-top"><span class="player-brand">${icon('play',16)} AniStream <i>·</i> ${esc(t.title)}</span><button class="close-btn" data-close>${icon('close')}</button></div><div class="owned-player"><video id="owned-video" controls playsinline preload="metadata" poster="/hero-cinematic.jpg"></video><div id="media-embed" class="media-embed"></div><div class="owned-player-empty"><span>${icon(t.mediaType==='ANIME'?'play':'book',28)}</span><b>Плеер AniStream</b><small>Вставь ссылку на разрешённое видео YouTube, VK или прямой MP4 / WebM / HLS-поток</small></div></div><form class="player-url-form" data-player-form><label for="media-url">Ссылка на YouTube/VK или прямой URL видео</label><div class="player-url-row"><select id="media-source" aria-label="Источник"><option value="auto">Авто</option><option value="youtube">YouTube</option><option value="vk">VK Видео</option><option value="rutube">RuTube</option><option value="direct">Прямой поток</option></select><input id="media-url" type="text" inputmode="url" placeholder="YouTube, VK, RuTube или URL прямого потока" required><button class="primary-btn" type="submit">Открыть ${icon('play',15)}</button></div><div class="media-error" role="status"></div><small>Поддерживаются разрешённые embeds YouTube, VK и RuTube, а также прямые MP4/WebM/HLS-потоки. Автопоиск зависит от официального API каждого сервиса; защищённые потоки не извлекаются.</small></form>${t.mediaType==='ANIME'?'':mangaReader(t)}<div class="provider-panel compact-provider"><span class="modal-overline">ССЫЛКИ ПЛАТФОРМ ИЗ KITSU</span><h2>${t.mediaType==='ANIME'?'Доступность просмотра':'Официальные ссылки и каталоги'}</h2><p>AniStream автоматически ищет официальные ссылки в Kitsu и пытается открыть страницу провайдера во встроенном плеере. Сам поток и доступ к нему контролирует провайдер.</p>${providerState}${state.providerEmbed?`<div class="provider-embed-wrap"><div class="provider-embed-title">${esc(state.providerEmbed.name)} · внутри AniStream</div><iframe class="provider-embed-frame" src="${esc(safeUrl(state.providerEmbed.url))}" title="${esc(state.providerEmbed.name)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><small>Если сервис запрещает встраивание или требует внешнюю авторизацию, его видео не сможет запуститься здесь.</small></div>`:''}</div></section></div>`;
  }
  if (m.type==='trailer') {
    const t=m.item, embed=trailerUrl(t), youtube='https://www.youtube.com/results?search_query='+encodeURIComponent(`${t.title} official trailer`);
    return `<div class="modal-backdrop" data-dismiss><section class="modal trailer-modal"><button class="close-btn trailer-close" data-close>${icon('close')}</button>${embed?`<div class="trailer-frame"><iframe src="${esc(embed)}" title="Трейлер: ${esc(t.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`:`<div class="trailer-art"><div class="trailer-copy"><span class="modal-overline">ОФИЦИАЛЬНЫЙ ТРЕЙЛЕР</span><h2>${esc(t.title)}</h2><p>У этого источника нет прямого ID видео. Ищем трейлер по названию.</p><a class="primary-btn" target="_blank" rel="noreferrer" href="${esc(youtube)}">${icon('play',16)} Найти на YouTube</a></div></div>`}<div class="trailer-bottom"><span>${esc(t.source)} · метаданные карточки</span><a target="_blank" rel="noreferrer" href="${esc(youtube)}">Открыть YouTube ↗</a></div></section></div>`;
  }
  if (m.type==='info') {
    const content=m.key==='sources'?`<p>Здесь проверяются только API-каталоги метаданных, не видеоплееры. AniList/Jikan/Kitsu возвращают карточки; Kitsu иногда находит официальную страницу просмотра, но не сам видеопоток.</p><button class="secondary-btn small source-check-button" data-source-check>Проверить каталоги сейчас</button><div class="source-list">${SOURCE_DETAILS.map(source=>{const health=state.sourceHealth.find(x=>x.name===source.name||x.name.startsWith(source.name));const status=health?.status==='ok'?'Подключён':health?.status==='error'?'Ошибка':health?.status==='skipped'?'Не используется':'Не проверен';return `<div class="source-item"><b>${esc(source.name)} <i class="health-dot ${health?.status||'unknown'}"></i></b><em>${status}</em><span>${esc(health?.message||source.description)}</span>${source.api?`<a target="_blank" rel="noreferrer" href="${esc(source.api)}">API ↗</a>`:''}<a target="_blank" rel="noreferrer" href="${esc(source.url)}">Сайт ↗</a></div>`}).join('')}</div><p class="source-footnote">Kitsu может сообщить официальную страницу провайдера, но не прямой поток. Воспроизведение внутри приложения возможно, только если провайдер разрешает iframe-встраивание; доступность зависит от региона и аккаунта.</p>`:`<p>Избранное, настройки и отметка подтверждения возраста сохраняются в localStorage на вашем устройстве. Поисковый запрос отправляется в выбранные публичные каталоги, чтобы получить результаты.</p>`;
    return `<div class="modal-backdrop"><section class="modal info-modal"><button class="close-btn" data-close>${icon('close')}</button><div class="modal-overline">ANISTREAM · ПРОЗРАЧНО О ДАННЫХ</div><h2>${m.key==='sources'?'Источники и данные':'Конфиденциальность'}</h2>${content}<button class="primary-btn" data-close>Понятно</button></section></div>`;
  }
  return '';
}
function bind() {
  document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',e=>{
    e.preventDefault(); state.page=el.dataset.page; state.query='';
    state.filter=state.page==='manga'?'Манга':state.page==='home'?'Аниме':'Все';
    if (state.page==='saved') { state.loading=false; state.error=''; render(); }
    else loadCatalog(true);
    window.scrollTo({top:0,behavior:'smooth'});
  }));
  document.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();const item=findItem(el.dataset.open);if(item){state.modal={type:'title',item};render();}}));
  document.querySelectorAll('[data-save]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();toggleSaved(el.dataset.save);}));
  document.querySelectorAll('[data-watch]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();const item=findItem(el.dataset.watch);if(item){state.modal={type:'watch',item};state.providerLinks=[];state.providerStatus='loading';state.providerError='';state.providerEmbed=null;render();loadProviderLinks(item);}}));
  document.querySelectorAll('[data-provider-play]').forEach(el=>el.addEventListener('click',()=>{const link=state.providerLinks[Number(el.dataset.providerPlay)];if(link){state.providerEmbed=link;render();}}));
  document.querySelectorAll('[data-trailer]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();const item=findItem(el.dataset.trailer);if(item){state.modal={type:'trailer',item};render();}}));
  document.querySelectorAll('[data-settings]').forEach(el=>el.addEventListener('click',()=>{state.modal={type:'settings'};render();}));
  document.querySelectorAll('[data-filter]').forEach(el=>el.addEventListener('click',()=>{
    const filter=el.dataset.filter;
    if(filter==='18+'&&!state.adult){state.pendingFilter='18+';state.modal={type:'age'};render();return;}
    state.page='catalog';state.filter=filter;loadCatalog(true);
  }));
  document.querySelector('[data-filter-toggle]')?.addEventListener('click',()=>{state.page='catalog';state.filter=state.filter==='Все'?'Аниме':'Все';loadCatalog(true);});
  document.querySelectorAll('[data-adult]').forEach(el=>el.addEventListener('click',()=>{if(state.adult){state.adult=false;localStorage.setItem(STORE.adult,'false');if(state.filter==='18+')state.filter='Все';state.modal=null;loadCatalog(true);}else{state.pendingFilter='18+';state.modal={type:'age'};render();}}));
  document.querySelector('[data-confirm-age]')?.addEventListener('click',()=>{state.adult=true;localStorage.setItem(STORE.adult,'true');state.filter=state.pendingFilter||'18+';state.page='catalog';state.modal=null;loadCatalog(true);});
  document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',()=>{state.modal=null;render();}));
  document.querySelectorAll('[data-dismiss]').forEach(el=>el.addEventListener('click',e=>{if(e.target===el){state.modal=null;render();}}));
  document.querySelectorAll('[data-toggle]').forEach(el=>el.addEventListener('click',()=>{const key=el.dataset.toggle;state.settings[key]=!state.settings[key];saveSettings();render();}));
  document.querySelectorAll('[data-setting]').forEach(el=>el.addEventListener('change',()=>{state.settings[el.dataset.setting]=el.value;saveSettings();if(el.dataset.setting==='theme')document.documentElement.dataset.theme=el.value==='Светлая'?'light':'dark';render();}));
  document.querySelector('[data-reset]')?.addEventListener('click',()=>{state.settings={autoplay:false,quality:'Авто',theme:'Тёмная',blur:true,notifications:true};state.adult=false;localStorage.setItem(STORE.adult,'false');saveSettings();state.filter='Все';loadCatalog(true);});
  document.querySelectorAll('[data-clear]').forEach(el=>el.addEventListener('click',()=>{state.query='';loadCatalog(true);}));
  document.querySelector('[data-reset-search]')?.addEventListener('click',()=>{state.query='';state.filter='Все';loadCatalog(true);});
  document.querySelector('[data-retry]')?.addEventListener('click',()=>loadCatalog(true));
  document.querySelector('[data-load-more]')?.addEventListener('click',()=>loadCatalog(false));
  document.querySelector('[data-source-check]')?.addEventListener('click',()=>loadCatalog(true));
  document.querySelector('[data-check-updates]')?.addEventListener('click',runUpdateCheck);
  document.querySelector('[data-install-update]')?.addEventListener('click',installLatestUpdate);
  document.querySelector('[data-player-form]')?.addEventListener('submit',e=>{
    e.preventDefault(); playProvidedMedia();
  });
  document.querySelector('[data-reader-files]')?.addEventListener('change',loadLocalManga);
  document.querySelectorAll('[data-reader-step]').forEach(el=>el.addEventListener('click',()=>{
    const total=state.reader.pages.length;
    state.reader.index=Math.max(0,Math.min(total-1,state.reader.index+Number(el.dataset.readerStep)));
    render();
  }));
  document.querySelectorAll('[data-info]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();state.modal={type:'info',key:el.dataset.info};render();}));
  const input=document.querySelector('#search');
  input?.addEventListener('input',e=>{state.query=e.target.value;state.page='catalog';state.filter='Все';state.searchPending=true;state.error='';render();clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadCatalog(true),450);});
}
function mangaReader(item) {
  const active=state.reader.itemId===item.id?state.reader:{itemId:'',pages:[],index:0,loading:false,error:''};
  const page=active.pages[active.index];
  return `<section class="local-reader"><span class="modal-overline">ЛОКАЛЬНАЯ ЧИТАЛКА</span><h3>Свои страницы / CBZ-архив</h3><p>Открой изображения или CBZ/ZIP-файл, полученный законно. Страницы обрабатываются только на устройстве.</p><label class="secondary-btn small reader-pick">Выбрать страницы или архив<input type="file" accept="image/*,.cbz,.zip" multiple data-reader-files></label>${active.loading?'<div class="provider-loading"><span class="loader"></span>Открываем главы…</div>':''}${active.error?`<div class="provider-error">${esc(active.error)}</div>`:''}${page?`<div class="manga-reader-view"><button class="secondary-btn small" data-reader-step="-1" ${active.index===0?'disabled':''}>${icon('back',17)}</button><img src="${esc(page.url)}" alt="Страница ${active.index+1}"/><button class="secondary-btn small" data-reader-step="1" ${active.index===active.pages.length-1?'disabled':''}>${icon('chevron',17)}</button></div><div class="reader-page-count">Страница ${active.index+1} из ${active.pages.length} · ${esc(page.name)}</div>`:''}</section>`;
}
async function loadLocalManga(event) {
  const files=Array.from(event.target.files||[]);
  if(!files.length)return;
  for(const page of state.reader.pages)URL.revokeObjectURL(page.url);
  state.reader={itemId:state.modal?.item?.id||'',pages:[],index:0,loading:true,error:''};render();
  try {
    const pages=[];
    for(const file of files){
      if(/\.(cbz|zip)$/i.test(file.name)){
        const JSZip=(await import('jszip')).default;const archive=await JSZip.loadAsync(file);
        const images=Object.values(archive.files).filter(entry=>!entry.dir&&/\.(jpe?g|png|webp|gif|avif)$/i.test(entry.name)).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
        for(const entry of images){const blob=await entry.async('blob');pages.push({name:entry.name,url:URL.createObjectURL(blob)});}
      } else if(file.type.startsWith('image/')) pages.push({name:file.name,url:URL.createObjectURL(file)});
    }
    state.reader={itemId:state.modal?.item?.id||'',pages,index:0,loading:false,error:pages.length?'':'В файле не найдено поддерживаемых изображений.'};
  } catch(error) { state.reader={itemId:state.modal?.item?.id||'',pages:[],index:0,loading:false,error:`Не удалось открыть файл: ${error.message||'ошибка архива'}`}; }
  render();
}
async function playProvidedMedia() {
  const input=document.querySelector('#media-url'),selector=document.querySelector('#media-source');
  const message=document.querySelector('.media-error'); const raw=input?.value.trim()||''; const mode=selector?.value||'auto';
  const video=document.querySelector('#owned-video'),embed=document.querySelector('#media-embed');
  if(!raw||!video||!embed)return;
  if(activeHls){activeHls.destroy();activeHls=null;}
  video.pause();video.removeAttribute('src');video.load();video.style.display='none';embed.replaceChildren();
  let iframeUrl='';
  if(mode==='youtube'||mode==='auto')iframeUrl=youtubeEmbed(raw);
  if(!iframeUrl&&(mode==='vk'||mode==='auto'))iframeUrl=vkEmbed(raw);
  if(!iframeUrl&&(mode==='rutube'||mode==='auto'))iframeUrl=rutubeEmbed(raw);
  if(iframeUrl){
    const frame=document.createElement('iframe');frame.src=iframeUrl;frame.title='Встроенный видеоплеер';frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';embed.append(frame);embed.style.display='block';
  } else {
    const url=safeUrl(raw);
    if(!url){if(message)message.textContent='Вставь корректную HTTPS-ссылку или ID YouTube-видео.';return;}
    if(['youtube','vk','rutube'].includes(mode)){if(message)message.textContent=mode==='youtube'?'Не удалось распознать YouTube ID/ссылку.':mode==='vk'?'Для VK вставь публичную ссылку на видео или video_ext.php.':'Не удалось распознать публичную ссылку RuTube.';return;}
    embed.style.display='none';video.style.display='block';
    if(/\.m3u8(?:$|[?#])/i.test(url)){
      try { const Hls=(await import('hls.js')).default;if(Hls.isSupported()){activeHls=new Hls();activeHls.loadSource(url);activeHls.attachMedia(video);activeHls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal&&message)message.textContent='HLS-поток не удалось воспроизвести. Проверь CORS и прямую ссылку.';});}else{video.src=url;video.load();} } catch {video.src=url;video.load();}
    } else {video.src=url;video.load();}
    video.play().catch(()=>{});
  }
  document.querySelector('.owned-player-empty')?.classList.add('is-hidden');
  if(message)message.textContent='';
}
let activeHls=null;

async function loadProviderLinks(item) {
  try {
    const links=await findKitsuStreaming(item);
    if(state.modal?.type!=='watch'||state.modal.item.id!==item.id)return;
    state.providerLinks=links;state.providerStatus='done';state.providerError='';render();
  } catch(error) {
    if(state.modal?.type!=='watch'||state.modal.item.id!==item.id)return;
    state.providerLinks=[];state.providerStatus='error';state.providerError=`Kitsu недоступен: ${error.message||'ошибка сети'}`;render();
  }
}
function findItem(id) { return state.items.find(item=>item.id===id)||state.saved.get(id)||null; }
function toggleSaved(id) {
  const item=findItem(id); if(!item)return;
  if(state.saved.has(id))state.saved.delete(id);else state.saved.set(id,item);
  persistSaved();render();
}
function saveSettings() { try { localStorage.setItem(STORE.settings,JSON.stringify(state.settings)); } catch { /* optional */ } }
async function loadCatalog(reset=true) {
  if(state.page==='saved') { state.loading=false;render();return; }
  clearTimeout(searchTimer);
  if(controller)controller.abort();
  controller=new AbortController();
  const request=++state.requestId;
  if(reset){state.pageNum=1;state.items=[];state.hasNext=false;state.warning='';}
  state.loading=true;state.searchPending=false;state.error='';render();
  const page=reset?1:state.pageNum+1;
  try {
    const result=await searchCatalog({query:state.query.trim(),filter:state.filter,adult:state.adult,page,signal:controller.signal});
    if(request!==state.requestId)return;
    state.items=reset?result.items:[...state.items,...result.items.filter(item=>!state.items.some(old=>old.id===item.id))];
    state.pageNum=page;state.hasNext=result.hasNext;state.sources=result.sources;state.sourceHealth=result.health;state.warning=result.warning;
  } catch(error) {
    if(error.name==='AbortError')return;
    state.error=error.message||'Не удалось связаться с источниками.';
  } finally {
    if(request===state.requestId){state.loading=false;render();}
  }
}
async function runUpdateCheck() {
  state.updateCheck={status:'checking'};render();
  try { state.updateCheck={status:'checked',...await checkForUpdate()}; }
  catch(error) { state.updateCheck={status:'error',message:error.message||'Не удалось проверить GitHub.'}; }
  render();
}
async function installLatestUpdate() {
  const update=state.updateCheck;
  if(!update?.available)return;
  state.updateCheck={...update,notice:'Подготовка APK…'};render();
  try {
    const result=await installUpdate({apkUrl:update.apkUrl,sha256:update.sha256});
    state.updateCheck={...update,notice:result.permissionRequired?'Разреши AniStream устанавливать неизвестные приложения в настройках Android, вернись сюда и снова нажми «Скачать и установить».':'Установщик Android открыт. Подтверди обновление в системном окне.'};
  } catch(error) { state.updateCheck={...update,notice:`Не удалось установить APK: ${error.message||'ошибка'}`}; }
  render();
}

function keyShortcuts(e) {
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.querySelector('#search')?.focus();}
  if(e.key==='Escape'&&state.modal){state.modal=null;render();}
}
render();
loadCatalog(true);
document.addEventListener('keydown',keyShortcuts);
if('serviceWorker' in navigator&&import.meta.env.PROD)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
