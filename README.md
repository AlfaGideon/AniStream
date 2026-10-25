# AniStream

AniStream — адаптивный каталог аниме, манги и ранобэ с Android-оболочкой Capacitor.

## Запуск

```bash
npm ci
npm run dev
```

Проверка web-сборки: `npm run build`.

## Подключённые каталоги

- **AniList GraphQL** — каталог аниме/манги/ранобэ, рейтинги, обложки и связи между форматами: `https://graphql.anilist.co`.
- **MyAnimeList через Jikan REST API** — дополнительные публичные карточки и поиск по каталогу: `https://api.jikan.moe/v4`. API ограничивает частоту запросов; AniStream показывает предупреждение и продолжает работу, если один из источников временно недоступен.
- **YouTube** — встроенный официальный трейлер, если в каталоге есть ID; иначе открывается поиск трейлера.

Результаты объединяются по MAL ID, где он есть. Категория 18+ запрашивается только после явного возрастного подтверждения; карточки можно оставить размытыми. AniStream не загружает и не раздаёт видео или главы. Кнопки просмотра/чтения ведут к поиску у легальных провайдеров; в собственный HTML5-плеер можно вставить прямой URL потока/файла, на использование которого есть права. Для интеграции дополнительных каталогов добавляйте адаптер в `src/catalog.js`.

## APK

Нативный проект находится в `android/`. Иконка 1024×1024: `public/anistream-icon-1024.png`. GitHub Actions автоматически собирает APK при push в рабочую ветку и публикует его в `releases/AniStream-debug.apk`.

[Скачать последнюю debug-сборку AniStream](https://raw.githubusercontent.com/AlfaGideon/AniStream/arena/a53fe3b3-anistream/releases/AniStream-debug.apk)

Локальная сборка требует Java 21 и Android SDK API 35:

```bash
npm ci
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

APK появится в `android/app/build/outputs/apk/debug/app-debug.apk`.
