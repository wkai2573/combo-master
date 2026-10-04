// 由 vite.config.ts 在建置時注入
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILT_AT__: string;

export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;
export const APP_BUILT_AT = __APP_BUILT_AT__;

/** 例：v0.2.0 */
export const VERSION_SHORT = `v${APP_VERSION}`;
/** 例：v0.2.0・cbb8cac */
export const VERSION_LABEL = `v${APP_VERSION}・${APP_COMMIT}`;
/** 滑鼠移上去顯示的完整資訊 */
export const VERSION_TITLE = `版本 ${APP_VERSION}\nCommit ${APP_COMMIT}\n建置時間 ${APP_BUILT_AT}`;
