package ru.anistream.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final long MAX_APK_BYTES = 150L * 1024L * 1024L;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String rawUrl = call.getString("url", "");
        String expectedSha = call.getString("sha256", "").toLowerCase();
        if (rawUrl.isEmpty() || expectedSha.isEmpty()) {
            call.reject("Не задан URL или контрольная сумма APK.");
            return;
        }
        try {
            URL parsed = new URL(rawUrl);
            if (!"https".equals(parsed.getProtocol()) || !"raw.githubusercontent.com".equals(parsed.getHost())) {
                call.reject("Разрешена загрузка только с raw.githubusercontent.com.");
                return;
            }
        } catch (Exception error) {
            call.reject("Некорректный URL APK.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(settings);
            JSObject result = new JSObject();
            result.put("permissionRequired", true);
            call.resolve(result);
            return;
        }

        EXECUTOR.execute(() -> downloadThenLaunch(call, rawUrl, expectedSha));
    }

    private void downloadThenLaunch(PluginCall call, String rawUrl, String expectedSha) {
        HttpURLConnection connection = null;
        File apk = new File(getContext().getCacheDir(), "anistream-update.apk");
        try {
            connection = (HttpURLConnection) new URL(rawUrl).openConnection();
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("User-Agent", "AniStream-Android-Updater");
            connection.setRequestProperty("Accept", "application/vnd.android.package-archive, application/octet-stream");
            int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) throw new Exception("GitHub не отдал APK (HTTP " + status + ").");
            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_APK_BYTES) throw new Exception("APK превышает допустимый размер.");

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long total = 0;
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(apk)) {
                byte[] buffer = new byte[32768];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    if (total > MAX_APK_BYTES) throw new Exception("APK превышает допустимый размер.");
                    digest.update(buffer, 0, count);
                    output.write(buffer, 0, count);
                }
                output.flush();
            }
            StringBuilder actual = new StringBuilder();
            for (byte b : digest.digest()) actual.append(String.format("%02x", b));
            if (!actual.toString().equals(expectedSha)) throw new Exception("Контрольная сумма APK не совпала; установка отменена.");

            Uri apkUri = FileProvider.getUriForFile(getContext(),
                    getContext().getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().startActivity(intent);
                    JSObject result = new JSObject();
                    result.put("downloaded", true);
                    result.put("installerOpened", true);
                    call.resolve(result);
                } catch (Exception error) {
                    call.reject("Не удалось открыть установщик Android: " + error.getMessage());
                }
            });
        } catch (Exception error) {
            if (apk.exists()) apk.delete();
            call.reject(error.getMessage() == null ? "Не удалось загрузить обновление." : error.getMessage());
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
