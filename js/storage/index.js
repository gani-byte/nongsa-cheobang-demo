// 저장소 선택. config.js 의 storage 값으로 어댑터를 고른다.
import { CONFIG } from '../config.js';

let store = null;

export async function getStore() {
  if (store) return store;
  if (CONFIG.storage === 'firebase') {
    store = (await import('./firebase.js')).firebaseStore;
  } else {
    store = (await import('./local.js')).localStore;
  }
  return store;
}
