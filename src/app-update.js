import { Capacitor, registerPlugin } from '@capacitor/core';

const OWNER='AlfaGideon';
const REPO='AniStream';
const BRANCH='arena/a53fe3b3-anistream';
const MANIFEST_URL=`https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/releases/latest.json`;
const NativeUpdater=registerPlugin('AppUpdater');
export const APP_VERSION=import.meta.env.VITE_APP_VERSION_NAME||'0.1.0-dev';
export const APP_BUILD=Number(import.meta.env.VITE_APP_VERSION_CODE||1);

export async function checkForUpdate() {
  const response=await fetch(`${MANIFEST_URL}?t=${Date.now()}`,{cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`GitHub вернул ${response.status}. Если репозиторий стал приватным, приложению понадобится авторизация GitHub.`);
  const latest=await response.json();
  if(!Number.isInteger(Number(latest.versionCode))||!latest.apkUrl||!latest.sha256)throw new Error('Некорректный манифест обновления GitHub.');
  return {currentVersion:APP_VERSION,currentBuild:APP_BUILD,latestVersion:latest.versionName,latestBuild:Number(latest.versionCode),apkUrl:latest.apkUrl,sha256:latest.sha256,signedWithPersistentKey:latest.signedWithPersistentKey===true,available:Number(latest.versionCode)>APP_BUILD};
}

export async function installUpdate({apkUrl,sha256}) {
  if(!/^https:\/\/raw\.githubusercontent\.com\//.test(apkUrl))throw new Error('APK должен загружаться с доверенного GitHub-адреса.');
  if(!Capacitor.isNativePlatform()){
    window.open(apkUrl,'_blank','noopener,noreferrer');
    return {openedInBrowser:true};
  }
  return NativeUpdater.downloadAndInstall({url:apkUrl,sha256});
}
