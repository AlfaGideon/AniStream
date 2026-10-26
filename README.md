# AniStream

Персональное Android/PWA-приложение-каталог аниме, манги и ранобэ.

## Каталог и воспроизведение

- Метаданные объединяются из AniList, MyAnimeList/Jikan и Kitsu. Kitsu отдаёт ссылки на страницы платформ, если они есть; их доступность зависит от региона.
- Встроенный плеер поддерживает публичные YouTube embed-ссылки/ID, VK `video_ext.php` и прямые MP4/WebM/HLS URL. Он не ищет и не скачивает чужие копии; пользователь вставляет ссылку на ролик, который можно показывать/встраивать.
- Встроенная локальная читалка открывает изображения и CBZ/ZIP главы с устройства. Каталоги/платформы чтения открываются внешней ссылкой; веб-скрейпинг Remanga не реализован.

## OTA и подпись APK

В настройках Android есть проверка `releases/latest.json`, загрузка APK с GitHub, сверка SHA-256 и запуск системного установщика. GitHub Actions увеличивает `versionCode` на каждом запуске и обновляет APK-манифест.

Чтобы Android разрешил обновлять APK **поверх установленного**, подпись должна оставаться одной и той же. Для этого workflow использует Actions secrets:

- `ANISTREAM_KEYSTORE_BASE64`
- `ANISTREAM_KEYSTORE_PASSWORD`
- `ANISTREAM_KEY_ALIAS`
- `ANISTREAM_KEY_PASSWORD`

Без них Android-сборка остаётся временно подписанной debug-ключом и OTA установщик будет намеренно заблокирован. Уже установленные APK ранее подписывались разными временными ключами: первый переход на постоянный ключ потребует один раз удалить старую сборку и поставить новую. После настройки постоянной подписи следующие обновления устанавливаются поверх неё.

Сейчас загрузка latest-манифеста рассчитана на публичную GitHub-ветку. Если сделать репозиторий приватным, для OTA потребуется OAuth-вход в GitHub; токен нельзя безопасно вшивать в APK.

## Разработка и APK

```bash
npm ci
npm run dev
npm test
npm run build
```

Для локальной сборки Android нужны Java 21 и SDK API 35:

```bash
npx cap sync android
cd android && ./gradlew assembleDebug
```

Актуальная debug-сборка: [AniStream-debug.apk](https://raw.githubusercontent.com/AlfaGideon/AniStream/arena/a53fe3b3-anistream/releases/AniStream-debug.apk).
