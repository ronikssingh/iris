import type { AppInfo } from '../shared/ipc';

export const appInfo: AppInfo = { version: '1.0.0', platform: 'darwin', dataFolder: '', snapshotsFolder: '', isPackaged: false };

export function setAppInfo(i: AppInfo) {
  Object.assign(appInfo, i);
}
