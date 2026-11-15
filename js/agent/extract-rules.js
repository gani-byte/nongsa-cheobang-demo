// 규칙 기반 한국어 추출기 (LLM 없이 동작하는 대체 모드)
// 발화 한두 문장에서 영농일지 항목(입력 항목표 v0.1 3장)을 뽑는다.
//   날짜(오늘/어제/그제/N일 전/11월 14일/11/14), 하우스 동(1동, 1동이랑 2동, 1,2동, 전체 동),
//   작목, 작업단계·세부작업(사전), 농약/비료 구분, 구입/사용, 종류, 제품명(사전 + 접미사 + "~를/을" 앞 명사),
//   양·단위(숫자+L/mL/kg/g/포대/병/봉지/톤, "두 병", "천배" 같은 한글 숫자), 희석배수, 대상 병해충, 처리 면적
// 한계는 README "규칙 추출 한계" 참고. 추측으로 채운 값은 guessed 목록에 넣어 확인 카드에 "확인 필요"로 표시한다.
//
// 브라우저 콘솔 테스트: (홈 화면에서) await ncAgentTests()  또는  import('./js/agent/extract-rules.js').then(m => m.runExtractTests())

import { STAGES, PESTICIDE_TYPES, FERTILIZER_TYPES, tasksFor } from '../constants.js';

// ---------- 숫자 정규화 ----------
const NATIVE = { 열한: 11, 열두: 12, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9, 하나: 1, 스무: 20, 스물: 20, 서른: 30, 마흔: 40, 한: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 석: 3, 네: 4, 넷: 4, 넉: 4, 열: 10, 쉰: 50, 반: 0.5 };
const NATIVE_KEYS = Object.keys(NATIVE).sort((a, b) => b.length - a.length).join('|');
const K_UNITS = '병|포대|포|봉지|봉|리터|키로|킬로그램|킬로|그램|톤|시시|미리|밀리';
const SINO_D = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };

function sino(w) {
  let total = 0, section = 0, num = 0;
  for (const ch of w) {
    if (SINO_D[ch]) num = SINO_D[ch];
    else if (ch === '십' || ch === '백' || ch === '천') {
      section += (num || 1) * { 십: 10, 백: 100, 천: 1000 }[ch];
      num = 0;
    } else if (ch === '만') {
      total += (section + num || 1) * 10000;
      section = 0; num = 0;
    }
  }
  return total + section + num;
}

export function normalizeText(text) {
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/(\d),(\d{3})/g, '$1$2');
  // 한글 고유어 수 + 단위: "두 병" -> "2병"
  t = t.replace(new RegExp(`(^|[^가-힣])(${NATIVE_KEYS})\\s*(${K_UNITS})`, 'g'), (m, p, w, u) => `${p}${NATIVE[w]}${u}`);
  // 한자어 수 + 단위/배: "천배" -> "1000배", "오백 배" -> "500배", "이십 리터" -> "20리터"
  t = t.replace(/([일이삼사오육칠팔구]?[십백천만][일이삼사오육칠팔구십백천만]*)\s*(배|리터|그램|미리|밀리|키로|킬로|시시|톤|포대|포|병|봉지)/g, (m, w, u) => `${sino(w)}${u}`);
  return t;
}

// ---------- 날짜 ----------
function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
function addDays(today, n) {
  const d = parseYmd(today);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function parseDate(text, today) {
  const t = text;
  if (/엊그제|엊그저께|그저께|그제/.test(t)) return addDays(today, -2);
  if (/어제|어저께|전날/.test(t)) return addDays(today, -1);
  let m = t.match(/(\d{1,2})\s*일\s*전/);
  if (m) return addDays(today, -Number(m[1]));
  const ty = Number(today.slice(0, 4));
  const tm = Number(today.slice(5, 7));
  const mk = (mo, da) => {
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    let s = ymd(new Date(ty, mo - 1, da, 12));
    if (s > today) s = ymd(new Date(ty - 1, mo - 1, da, 12)); // 미래 날짜면 작년
    return s;
  };
  m = t.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (m) return mk(Number(m[1]), Number(m[2]));
  m = t.match(/(?:^|[^\d.])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d.]|\s*(?:동|배|리터|L|l|kg|g|ml|mL|병|포))/);
  if (m) return mk(Number(m[1]), Number(m[2]));
  m = t.match(/(?:^|[^\d])(\d{1,2})\s*일(?:에|날|날에)?(?=\s|$|,)/);
  if (m) return mk(tm, Number(m[1]));
  if (/오늘|금일|방금|아까|지금/.test(t)) return today;
  return null;
}

// ---------- 하우스 동, 작목 ----------
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function parseHouses(text, profile) {
  const hs = profile?.houses || [];
  if (!hs.length) return [];
  if (/전체\s*동|모든\s*동|동\s*전체|전\s*동에|하우스\s*전부|모든\s*하우스|전체\s*하우스/.test(text)) return hs.map((h) => h.id);
  const names = new Map();
  // "1,2동" "1·2동" "1~3동" 확장 (이름 -> 말한 위치)
  text.replace(/(\d+)\s*[,·~\-]\s*(\d+)\s*동/g, (m, a, b, off) => {
    const A = Number(a), B = Number(b);
    if (m.includes('~') || m.includes('-')) for (let i = Math.min(A, B); i <= Math.max(A, B) && i - A < 20; i++) names.set(`${i}동`, off + (i - Math.min(A, B)) / 100);
    else { names.set(`${A}동`, off); names.set(`${B}동`, off + 0.5); }
    return m;
  });
  const found = [];
  for (const h of hs) {
    if (!h.name) continue;
    const re = new RegExp(`(?<![0-9])${esc(h.name).replace(/(\d)동$/, '$1\\s*(?:번\\s*)?동')}`);
    if (names.has(h.name)) found.push({ id: h.id, at: names.get(h.name) });
    else if (re.test(text)) found.push({ id: h.id, at: text.search(re) });
  }
  found.sort((a, b) => (a.at < 0 ? 999 : a.at) - (b.at < 0 ? 999 : b.at));
  return found.map((f) => f.id);
}

export function parseCrop(text) {
  if (/방울\s*토마토|방토|대추\s*토마토|체리\s*토마토|미니\s*토마토/.test(text)) return '방울토마토';
  if (/토마토|완숙/.test(text)) return '토마토';
  if (/딸기/.test(text)) return '딸기';
  return '';
}

// ---------- 작업단계·세부작업 사전 ----------
// t: 토마토·방울토마토 세부작업, s: 딸기 세부작업, st: 세부작업이 없을 때 작업단계, kind: 자재 힌트
const TASK_RULES = [
  { re: /곁순|유인/, t: '유인·곁순 제거', s: '적엽·런너 제거' },
  { re: /런너\s*(받|유인|키우)/, t: null, s: '육묘(런너 받기)', st: '사전준비' },
  { re: /런너/, t: null, s: '적엽·런너 제거', st: '작물관리' },
  { re: /적엽|잎\s*(을|를)?\s*(따|땄|정리|제거|솎|떼)|아랫잎|하엽/, t: '적엽(잎 따기)', s: '적엽·런너 제거' },
  { re: /적화|적과|꽃\s*(을|를)?\s*(따|땄|솎|정리)|열매\s*(을|를)?\s*솎|과\s*솎/, t: '적화·적과', s: '적화·적과' },
  { re: /수정벌|착과제|토마토톤|호르몬\s*처리|착과\s*처리/, t: '수정(수정벌·착과제)', s: '꿀벌 투입' },
  { re: /꿀벌|벌통|벌\s*(을|를)?\s*(넣|투입|놓)/, t: '수정(수정벌·착과제)', s: '꿀벌 투입' },
  { re: /토양\s*소독/, t: '토양소독', s: null, st: '경운·토양관리' },
  { re: /방제|농약\s*(을|를|도)?\s*(쳤|치|뿌|줬|했|살포|탔)|약\s*(을|를|도)?\s*(쳤|치고|친|뿌|줬|했|살포|탔)|살균제|살충제|소독\s*했/, t: '병해충 방제', s: '병해충 방제', kind: '농약' },
  { re: /엽면\s*시비|엽면\s*살포|웃거름|추비|덧거름/, t: '웃거름(추비)', s: '웃거름(추비)', kind: '비료' },
  { re: /밑거름|퇴비|유박|계분/, t: '밑거름·퇴비', s: '밑거름·퇴비', kind: '비료', weak: true },
  { re: /양액|관수|점적|물\s*(을|를)?\s*(줬|주|댔|대|뿌)/, t: '관수·양액', s: '관수·양액' },
  { re: /보온|커튼|난방|온풍기/, t: '환기·온도관리', s: '보온(커튼·난방)' },
  { re: /환기|온도\s*관리|측창|천창|창\s*(을|를)?\s*(열|닫)/, t: '환기·온도관리', s: '보온(커튼·난방)' },
  { re: /정식|아주심기|모종\s*(을|를)?\s*(심|옮)/, t: '정식', s: '정식' },
  { re: /경운|로터리|밭\s*(을|를)?\s*갈|땅\s*(을|를)?\s*갈/, t: '경운·로터리', s: '경운·로터리' },
  { re: /이랑|멀칭|두둑|비닐\s*(을|를)?\s*(깔|덮)/, t: '이랑·멀칭', s: '두둑·멀칭' },
  { re: /하우스\s*(정비|수리|보수)|비닐\s*(을|를)?\s*교체|파이프\s*(수리|교체)/, t: '하우스 정비', s: null, st: '사전준비' },
  { re: /육묘/, t: null, s: '육묘(런너 받기)', st: '육묘·정식' },
  { re: /수확|땄|따\s*(냈|왔)|거뒀/, t: '수확', s: '수확' },
  { re: /출하|공판장|납품|경매|택배\s*보냈/, t: '출하', s: '출하' },
  { re: /철거|폐기물|줄기\s*(정리|제거)|뽑았|작물\s*정리/, t: '작물 철거·폐기물 처리', s: '작물 철거' },
];

export function stageOfTask(task, crop) {
  if (!task) return '';
  const T = tasksFor(crop || '토마토');
  for (const st of STAGES) if ((T[st] || []).includes(task)) return st;
  return '';
}

function matchTaskRule(text, skipKindRules) {
  for (const r of TASK_RULES) {
    if (skipKindRules && r.kind) continue;
    if (r.re.test(text)) return r;
  }
  return null;
}

function resolveTask(rule, crop) {
  if (!rule) return { stage: '', task: '' };
  const task = (crop === '딸기' ? rule.s : rule.t) || '';
  const stage = stageOfTask(task, crop) || rule.st || '';
  return { stage, task };
}

// ---------- 병해충 ----------
const PESTS = [
  ['잿빛곰팡이', '잿빛곰팡이병', 'd'], ['잎곰팡이', '잎곰팡이병', 'd'], ['흰가루', '흰가루병', 'd'], ['탄저', '탄저병', 'd'], ['역병', '역병', 'd'],
  ['담배가루이', '담배가루이', 'i'], ['온실가루이', '담배가루이', 'i'], ['가루이', '담배가루이', 'i'], ['진딧물', '진딧물', 'i'],
  ['뿔나방', '토마토뿔나방', 'i'], ['응애', '응애', 'i'], ['총채', '총채벌레', 'i'],
  ['곰팡이', '기타', 'd'], ['노균', '기타', 'd'], ['풋마름', '기타', 'd'], ['나방', '기타', 'i'], ['벌레', '기타', 'i'], ['해충', '기타', 'i'],
];
export function parsePest(text) {
  for (const [k, v, c] of PESTS) if (text.includes(k)) return { pest: v, cls: c, said: k };
  return null;
}

// ---------- 양·단위, 희석배수 ----------
const UNIT_RE = /(\d+(?:\.\d+)?)\s*(밀리리터|미리리터|밀리|미리|ml|mL|ML|㎖|cc|CC|시시|리터|ℓ|L|l|킬로그램|킬로|키로|kg|KG|Kg|그램|g|G|포대|포(?!기|도)|봉지|봉|병|톤)(?![A-Za-z])/g;

export function normUnit(u) {
  const s = String(u || '').trim();
  if (/^(밀리리터|미리리터|밀리|미리|ml|mL|ML|㎖|cc|CC|시시)$/.test(s)) return 'mL';
  if (/^(리터|ℓ|L|l)$/.test(s)) return 'L';
  if (/^(킬로그램|킬로|키로|kg|KG|Kg)$/.test(s)) return 'kg';
  if (/^(그램|g|G)$/.test(s)) return 'g';
  if (/^(포대|포)$/.test(s)) return '포대';
  if (/^(봉지|봉)$/.test(s)) return '봉지';
  if (s === '병') return '병';
  if (s === '톤') return '톤';
  return '';
}

export function parseQtys(t) {
  const out = [];
  let m;
  UNIT_RE.lastIndex = 0;
  while ((m = UNIT_RE.exec(t))) {
    const before = t.slice(Math.max(0, m.index - 5), m.index);
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 3);
    const water = /물\s*(을|를|은|는)?\s*$/.test(before) || /^\s*(에|씩\s*물)/.test(after);
    out.push({ qty: m[1], unit: normUnit(m[2]), water, index: m.index, raw: m[0] });
  }
  return out;
}

export function parseDilution(t) {
  const m = t.match(/(\d+)\s*배(?!추|나무|꽃|낭|달)/);
  return m ? m[1] : '';
}

function toMl(q) {
  const v = Number(q.qty);
  if (q.unit === 'L') return v * 1000;
  if (q.unit === 'mL' || q.unit === 'g') return v;
  if (q.unit === 'kg') return v * 1000;
  return null;
}
function fmtNum(n) {
  return String(Math.round(n * 10) / 10);
}

// ---------- 제품명 ----------
const NAME_SUFFIX = '액상수화제|수화제|유제|액제|입제|분제|미탁제|훈연제|액상|과립|복합비료|비료|칼슘제|영양제|퇴비|유박|액비';
const NAME_RE = new RegExp(`([가-힣A-Za-z0-9\\-]{1,12}\\s?(?:${NAME_SUFFIX}))(?=\\s|을|를|이|가|도|은|는|으로|로|,|\\.|$|\\d)`);
const GENERIC_NAMES = ['칼슘제', '칼슘', '붕소', '요소비료', '요소', '석회', '규산', '영양제', '액비'];
const STOP = new Set(['약', '농약', '비료', '물', '잎', '곁순', '순', '거', '것', '작업', '하우스', '토마토', '딸기', '방울토마토', '방토', '런너', '꽃', '열매', '모종', '날씨', '코딩', '기록', '일지', '엑셀', '창', '비닐', '밭', '땅', '벌', '꿀벌', '수정벌', '이랑', '두둑', '줄기', '아랫잎', '하엽', '방제', '소독', '정식', '수확', '출하', '환기', '관수', '양액', '추비', '웃거름', '밑거름', '엽면시비', '오늘', '어제', '그제', '내일', '그거', '이거', '저거', '뭐', '무엇', '살균제', '살충제', '제초제', '파이프', '측창', '천창', '커튼', '멀칭']);

function cleanName(s) {
  return String(s || '').replace(/\s+/g, ' ').replace(/(을|를|이|가|은|는|도|으로|로)$/, '').trim();
}

export function parseName(t, knownNames = []) {
  const flat = t.replace(/\s+/g, '');
  for (const n of knownNames) {
    if (!n) continue;
    if (t.includes(n) || flat.includes(n.replace(/\s+/g, ''))) return { name: n, guessed: false };
  }
  const m = t.match(NAME_RE);
  if (m) {
    let name = cleanName(m[1]);
    const parts = name.split(' ');
    // 앞말이 조사로 끝나거나(토마토에) 일반어면 접미사 단어만 쓴다
    if (parts.length > 1 && (STOP.has(parts[0]) || /(에|에서|에다|에게|하고|랑|이랑|은|는|도)$/.test(parts[0]) || /동$/.test(parts[0]) || parseCrop(parts[0]))) name = parts.slice(1).join(' ');
    const prefix = name.split(' ')[0];
    if (!STOP.has(name) && !STOP.has(prefix) && !/^\d/.test(name)) {
      const generic = /^(비료|퇴비|유박|영양제|액비|액상|과립|칼슘제)$/.test(name);
      return { name, guessed: generic };
    }
  }
  for (const g of GENERIC_NAMES) if (t.includes(g)) return { name: g, guessed: true };
  const re = /([가-힣A-Za-z0-9\-]{2,15})\s?(?:을|를)(?=\s|$|,)/g;
  let x;
  while ((x = re.exec(t))) {
    const w = x[1];
    if (STOP.has(w) || /동$/.test(w) || /^\d/.test(w) || parsePest(w) || TASK_RULES.some((r) => r.re.test(w))) continue;
    return { name: w, guessed: false };
  }
  return null;
}

// ---------- 자재 종류 ----------
export function pesticideTypeOf(t) {
  if (/살균\s*살충/.test(t)) return '살균살충제';
  if (/살균/.test(t)) return '살균제';
  if (/살충/.test(t)) return '살충제';
  if (/제초/.test(t)) return '제초제';
  if (/생장\s*조정|착과제|토마토톤/.test(t)) return '생장조정제';
  return '';
}
export function fertilizerTypeOf(t) {
  if (/칼슘|엽면|미량|붕소|아미노|영양제/.test(t)) return '엽면시비·미량요소';
  if (/퇴비|유박|계분|유기질/.test(t)) return '유기질(퇴비·유박)';
  if (/양액/.test(t)) return '양액 비료';
  if (/복합|요소|화학|단비|NPK|NK|\d+-\d+-\d+/.test(t)) return '화학(복합·단비)';
  if (/석회|규산|고토|토양\s*개량/.test(t)) return '토양개량제';
  return '';
}

const PEST_STRONG = /농약|살균|살충|제초|방제|수화제|유제|액제|입제|분제|미탁|훈연|훈증|약\s*(을|를|도)?\s*(쳤|치|친|뿌|줬|했|살포|탔|샀|사)/;
const FERT_SIG = /비료|칼슘|엽면|퇴비|유박|양액|복합|요소|붕소|미량|웃거름|추비|밑거름|액비|석회|규산|고토|영양제|계분/;
const BUY = /샀|사\s*왔|사\s*옴|구입|구매|주문|들여\s*왔/;
const SPRAY = /뿌|살포|분무|줬|쳤|관주|살포|흘려/;

// ---------- 의도 분류 ----------
const OFFTOPIC = /코딩|코드|파이썬|python|자바스크립트|javascript|자바|프로그래밍|프로그램\s*(짜|만들|좀)|html|sql|알고리즘|숙제|과제|번역|영어로|주식|코인|비트코인|로또|게임|노래|가사|영화|드라마|연예인|아이돌|정치|대통령|선거|축구|야구|연애|소개팅|시\s*(써|지어)|소설|농담|웃긴|심심|놀자|챗\s*gpt|gpt|레시피|맛집|여행|운세|사주|타로|해킹|비밀번호/i;
const WEATHER_Q = /날씨|기온|몇\s*도|예보|비\s*(와|오|올)|눈\s*(와|오|올)|추워|더워|춥|덥/;
const QUESTIONISH = /어때|어떄|알려|\?|나요|니\b|야\?|예요\?|인가|할까|돼\?|되나|줘$|래\?/;
const EXPORT_Q = /엑셀|내보내|다운로드|파일로/;
const LIST_Q = /(기록|일지).*(보여|목록|조회|확인|몇)|몇\s*번\s*했|보여\s*줘/;
const GREET = /^(안녕|하이|hi|hello|반가|여보세요)|고마워|고맙|감사/i;

export function classifyIntent(text, ext) {
  const t = String(text || '');
  if (OFFTOPIC.test(t)) return 'offtopic';
  const strong = !!(ext && (ext.task || ext.stage || ext.materials.length || ext.pest));
  if (strong) return 'record';
  if (WEATHER_Q.test(t) && (QUESTIONISH.test(t) || t.length < 15)) return 'weather';
  if (EXPORT_Q.test(t)) return 'export';
  if (LIST_Q.test(t)) return 'list';
  if (GREET.test(t.trim())) return 'greet';
  if (ext && (ext.houseIds.length || ext.crop)) return 'record';
  return 'unknown';
}

// ---------- 메인 추출 ----------
// ctx: { profile, today: 'YYYY-MM-DD', knownNames: [] }
export function extractRules(text, ctx = {}) {
  const today = ctx.today || ymd(new Date());
  const profile = ctx.profile || { houses: [] };
  const raw = String(text || '').slice(0, 500);
  const t = normalizeText(raw);
  const guessed = [];
  const warnings = [];
  const memo = [];

  // 날짜
  const said = parseDate(t, today);
  const workDate = said || today;

  // 동·작목
  let houseIds = parseHouses(t, profile);
  let crop = parseCrop(t);
  const hs = profile.houses || [];
  const houseCrop = houseIds.length ? (hs.find((h) => h.id === houseIds[0])?.crop || '') : '';
  if (houseIds.length && !crop) crop = houseCrop;
  else if (houseIds.length && crop && houseCrop && crop !== houseCrop) {
    if (crop === '토마토' && houseCrop === '방울토마토') crop = houseCrop; // "토마토"를 넓게 말한 경우
    else {
      warnings.push(`${hs.find((h) => h.id === houseIds[0])?.name}은 ${houseCrop}로 등록돼 있어요`);
      guessed.push('crop');
    }
  } else if (!houseIds.length && crop) {
    const same = hs.filter((h) => h.crop === crop);
    if (same.length === 1) { houseIds = [same[0].id]; guessed.push('houseIds'); }
  }
  if (!houseIds.length && hs.length === 1) { houseIds = [hs[0].id]; if (!crop) crop = hs[0].crop; }

  // 제품명 먼저 (제품명 안의 "가루이" 같은 글자를 병해충으로 잘못 잡지 않게)
  const nm = parseName(t, ctx.knownNames || []);
  const tNoName = nm ? t.replace(nm.name, ' ') : t;
  const pestHit = parsePest(tNoName);

  const buy = BUY.test(t);
  const qtys = parseQtys(t);
  let dilution = parseDilution(t);

  // 작업 (구입 기록이면 자재 힌트 규칙은 건너뜀: "유박 10포대 샀어" 는 밑거름 작업이 아님)
  let rule = matchTaskRule(tNoName, buy);
  if (!rule && pestHit && !buy) rule = TASK_RULES.find((r) => r.t === '병해충 방제');

  // 수확·출하 양은 자재가 아니라 메모로
  const harvest = rule && (rule.t === '수확' || rule.t === '출하');
  let nonWater = qtys.filter((q) => !q.water);
  let water = qtys.find((q) => q.water);
  if (harvest && nonWater.length) {
    memo.push(`${rule.t === '수확' ? '수확량' : '출하량'} ${nonWater.map((q) => q.qty + q.unit).join(', ')}`);
    nonWater = [];
  }

  const pestStrong = !!pestHit || PEST_STRONG.test(tNoName) || (nm && /수화제|유제|액제|입제|분제|미탁제|훈연제/.test(nm.name));
  const fertSig = FERT_SIG.test(t);
  // 희석배수 + "20리터 뿌렸어" 처럼 L 하나만 있으면 살포 물량으로 본다
  if (!water && dilution && nonWater.length === 1 && nonWater[0].unit === 'L' && Number(nonWater[0].qty) >= 5 && SPRAY.test(t)) {
    water = nonWater[0];
    nonWater = [];
  }

  const materials = [];
  const hasMat = !harvest && (pestStrong || fertSig || nonWater.length > 0 || !!nm || (buy && !rule));
  if (hasMat) {
    let kind = '';
    if (pestStrong && !fertSig) kind = '농약';
    else if (fertSig && !pestStrong) kind = '비료';
    else if (pestStrong && fertSig) kind = nm && new RegExp(`(${'복합비료|비료|칼슘제|영양제|퇴비|유박|액비'})$`).test(nm.name) ? '비료' : '농약';
    else if (rule?.kind) kind = rule.kind;
    else if ((dilution || nm) && SPRAY.test(t)) { kind = '농약'; guessed.push('m0.kind'); }
    const m = { kind, action: buy ? '구입' : '사용', type: '', name: '', qty: '', unit: '', dilution: '', pest: '' };
    if (kind === '농약') {
      m.type = pesticideTypeOf(t);
      if (!m.type && pestHit && pestHit.pest !== '기타') { m.type = pestHit.cls === 'd' ? '살균제' : '살충제'; guessed.push('m0.type'); }
      else if (!m.type && pestHit) { m.type = pestHit.cls === 'd' ? '살균제' : '살충제'; guessed.push('m0.type'); }
    } else if (kind === '비료') {
      m.type = fertilizerTypeOf(t);
    }
    if (nm) { m.name = nm.name; if (nm.guessed) guessed.push('m0.name'); }
    if (nonWater.length) { m.qty = nonWater[0].qty; m.unit = nonWater[0].unit; }
    if (m.action === '사용') {
      if (dilution) m.dilution = dilution;
      if (pestHit && kind !== '비료') m.pest = pestHit.pest;
      // 계산: 물량 + 희석배수 -> 사용량 / 물량 + 사용량 -> 희석배수
      if (water) {
        const w = toMl(water);
        if (!m.qty && dilution && w) {
          const ml = w / Number(dilution);
          if (ml >= 1000) { m.qty = fmtNum(ml / 1000); m.unit = 'L'; } else { m.qty = fmtNum(ml); m.unit = 'mL'; }
          guessed.push('m0.qty');
          memo.push(`살포 물량 ${water.qty}${water.unit}, 사용량은 ${dilution}배로 계산`);
        } else if (m.qty && !dilution && w) {
          const p = toMl({ qty: m.qty, unit: m.unit });
          if (p) {
            let d = w / p;
            const near = [250, 500, 1000, 1500, 2000, 3000, 4000].find((c) => Math.abs(d - c) / c < 0.06);
            d = near || Math.round(d);
            m.dilution = String(d);
            guessed.push('m0.dilution');
            memo.push(`물 ${water.qty}${water.unit}에 희석`);
          }
        } else {
          memo.push(`물 ${water.qty}${water.unit}`);
        }
      }
    }
    if (m.kind === '비료' && m.pest) m.pest = '';
    materials.push(m);
  } else if (water) {
    memo.push(`물 ${water.qty}${water.unit}`);
  }

  // 작업단계 결정 (작목이 정해진 뒤)
  let { stage, task } = resolveTask(rule, crop);
  if (!rule && materials.length && materials[0].kind === '농약' && materials[0].action === '사용' && (dilution || SPRAY.test(t))) {
    ({ stage, task } = resolveTask(TASK_RULES.find((r) => r.t === '병해충 방제'), crop));
    guessed.push('stage');
  }

  // 처리 면적
  const area = { value: '', unit: '㎡' };
  const am = t.match(/(\d+(?:\.\d+)?)\s*(평|㎡|제곱미터|m2|m²)/);
  if (am) { area.value = am[1]; area.unit = am[2] === '평' ? '평' : '㎡'; }
  else if (/동\s*전체|전체\s*(에|다)|전면/.test(t)) area.unit = '동 전체';

  const ext = {
    workDate, dateSaid: !!said, houseIds, crop, stage, task, materials, area,
    pest: pestHit ? pestHit.pest : '', memo: memo.join(', '), guessed, warnings, text: raw,
  };
  ext.intent = classifyIntent(raw, ext);
  return ext;
}

// ---------- 되묻기 답 해석 ----------
// key: 'houseIds' | 'crop' | 'stage' | 'mN.kind' | 'mN.type' | 'mN.name' | 'mN.qty' | 'mN.unit'
export function parseAnswer(key, text, ctx = {}, draft = {}) {
  const raw = String(text || '').trim();
  const t = normalizeText(raw);
  const flat = t.replace(/[\s·]/g, '');
  if (key === 'houseIds') {
    let ids = parseHouses(t, ctx.profile);
    if (!ids.length) {
      const n = t.match(/^(\d+)\s*(번)?\s*(이요|요|이에요|입니다)?\.?$/);
      if (n) ids = parseHouses(`${n[1]}동`, ctx.profile);
    }
    return ids.length ? { ok: true, value: ids } : { ok: false };
  }
  if (key === 'crop') {
    const c = parseCrop(t);
    return c ? { ok: true, value: c } : { ok: false };
  }
  if (key === 'stage') {
    const st = STAGES.find((s) => flat.includes(s.replace(/·/g, '')) || flat === s.replace(/·/g, ''));
    const rule = matchTaskRule(t, false);
    if (rule) {
      const r = resolveTask(rule, draft.crop);
      if (r.stage && (!st || st === r.stage)) return { ok: true, value: r };
    }
    if (st) return { ok: true, value: { stage: st, task: '' } };
    const loose = [['경운', '경운·토양관리'], ['토양', '경운·토양관리'], ['육묘', '육묘·정식'], ['정식', '육묘·정식'], ['관리', '작물관리'], ['수확', '수확·출하'], ['출하', '수확·출하'], ['정리', '정리'], ['준비', '사전준비']].find(([k]) => flat.includes(k));
    return loose ? { ok: true, value: { stage: loose[1], task: '' } } : { ok: false };
  }
  const mk = key.match(/^m(\d+)\.(\w+)$/);
  if (!mk) return { ok: false };
  const f = mk[2];
  const m = (draft.materials || [])[Number(mk[1])] || {};
  if (f === 'kind') {
    if (/비료|거름|퇴비|양액/.test(t)) return { ok: true, value: '비료' };
    if (/농약|약|살균|살충/.test(t)) return { ok: true, value: '농약' };
    return { ok: false };
  }
  if (f === 'type') {
    const list = m.kind === '비료' ? FERTILIZER_TYPES : PESTICIDE_TYPES;
    const exact = list.find((x) => flat === x.replace(/[\s·]/g, '') || raw === x);
    if (exact) return { ok: true, value: exact };
    const v = m.kind === '비료' ? fertilizerTypeOf(t) : pesticideTypeOf(t);
    if (v) return { ok: true, value: v };
    if (/기타|그\s*외/.test(t)) return { ok: true, value: '기타' };
    return { ok: false };
  }
  if (f === 'name') {
    const known = (ctx.knownNames || []).find((n) => raw === n || flat === n.replace(/\s+/g, ''));
    if (known) return { ok: true, value: known };
    let s = t.replace(UNIT_RE, ' ').replace(/\d+\s*배\S*/g, ' ');
    UNIT_RE.lastIndex = 0;
    s = s.replace(/(이요|이에요|예요|입니다|이야|이고|이랑|요|야)\s*[.!]?$/, '').replace(/(썼어요?|사용했어요?|뿌렸어요?|줬어요?|샀어요?|이라는\s*거)$/, '').trim();
    s = cleanName(s);
    if (s.length >= 1 && s.length <= 30 && !/^\d+$/.test(s) && !STOP.has(s)) return { ok: true, value: s };
    return { ok: false };
  }
  if (f === 'qty') {
    const q = parseQtys(t).filter((x) => !x.water);
    if (q.length) return { ok: true, value: { qty: q[0].qty, unit: q[0].unit } };
    const n = t.match(/^(\d+(?:\.\d+)?)\s*(개|정도|쯤)?\s*(이요|요)?\.?$/);
    if (n) return { ok: true, value: { qty: n[1], unit: '' } };
    return { ok: false };
  }
  if (f === 'unit') {
    const u = normUnit(raw) || normUnit((raw.match(/[A-Za-z가-힣㎖ℓ]+/) || [''])[0]);
    return u ? { ok: true, value: u } : { ok: false };
  }
  return { ok: false };
}

// ---------- 단위 테스트 (브라우저 콘솔에서 실행) ----------
const TEST_PROFILE = {
  houses: [
    { id: 'h1', name: '1동', lot: '가상리 123', crop: '토마토' },
    { id: 'h2', name: '2동', lot: '가상리 124', crop: '방울토마토' },
    { id: 'h3', name: '3동', lot: '가상리 130-2', crop: '딸기' },
  ],
};
const TEST_NAMES = ['가상곰팡이 액상', '가상충 유제', '가상 복합비료 21-17-17', '가상 양액 A', '가상 유박', '가상가루이 수화제'];

// 기대값: 적힌 키만 비교. houses 는 동 이름 배열, mats 는 자재 개수, m0.* 는 첫 자재, memoHas 는 메모에 들어갈 글자
export const TEST_CASES = [
  { text: '어제 1동 토마토에 칼슘제 엽면시비 500배로 20리터 뿌렸어', expect: { intent: 'record', workDate: '2026-11-14', houses: ['1동'], crop: '토마토', stage: '작물관리', task: '웃거름(추비)', mats: 1, 'm0.kind': '비료', 'm0.action': '사용', 'm0.type': '엽면시비·미량요소', 'm0.name': '칼슘제', 'm0.qty': '40', 'm0.unit': 'mL', 'm0.dilution': '500' } },
  { text: '3동 딸기 잿빛곰팡이 약 쳤어', expect: { intent: 'record', workDate: '2026-11-15', houses: ['3동'], crop: '딸기', stage: '작물관리', task: '병해충 방제', 'm0.kind': '농약', 'm0.type': '살균제', 'm0.name': '', 'm0.qty': '', 'm0.pest': '잿빛곰팡이병' } },
  { text: '오늘 날씨 어때?', expect: { intent: 'weather' } },
  { text: '파이썬 코딩 알려줘', expect: { intent: 'offtopic' } },
  { text: '1동 토마토 곁순 제거했어요', expect: { intent: 'record', houses: ['1동'], crop: '토마토', stage: '작물관리', task: '유인·곁순 제거', mats: 0 } },
  { text: '2동 방울토마토 담배가루이 방제, 가상가루이 수화제 50그램 물 50리터', expect: { houses: ['2동'], crop: '방울토마토', task: '병해충 방제', 'm0.kind': '농약', 'm0.type': '살충제', 'm0.name': '가상가루이 수화제', 'm0.qty': '50', 'm0.unit': 'g', 'm0.dilution': '1000', 'm0.pest': '담배가루이' } },
  { text: '11월 12일 3동 딸기 가상 유박 10포대 샀어', expect: { workDate: '2026-11-12', houses: ['3동'], crop: '딸기', stage: '', 'm0.kind': '비료', 'm0.action': '구입', 'm0.type': '유기질(퇴비·유박)', 'm0.name': '가상 유박', 'm0.qty': '10', 'm0.unit': '포대' } },
  { text: '그제 1동이랑 2동 환기했어', expect: { workDate: '2026-11-13', houses: ['1동', '2동'], crop: '토마토', task: '환기·온도관리', mats: 0 } },
  { text: '3동 꿀벌 넣었어요', expect: { houses: ['3동'], crop: '딸기', stage: '작물관리', task: '꿀벌 투입', mats: 0 } },
  { text: '딸기 수확했어요 30kg', expect: { houses: ['3동'], crop: '딸기', stage: '수확·출하', task: '수확', mats: 0, memoHas: '30kg' } },
  { text: '1동 토마토 가상곰팡이 액상 100ml 1000배 잿빛곰팡이 방제', expect: { houses: ['1동'], task: '병해충 방제', 'm0.name': '가상곰팡이 액상', 'm0.qty': '100', 'm0.unit': 'mL', 'm0.dilution': '1000', 'm0.pest': '잿빛곰팡이병', 'm0.type': '살균제' } },
  { text: '2동 토마토 다코닐을 천배로 뿌렸어', expect: { houses: ['2동'], crop: '방울토마토', task: '병해충 방제', 'm0.kind': '농약', 'm0.name': '다코닐', 'm0.dilution': '1000' } },
  { text: '가상충 유제 두 병 샀어', expect: { houses: [], 'm0.kind': '농약', 'm0.action': '구입', 'm0.name': '가상충 유제', 'm0.qty': '2', 'm0.unit': '병', 'm0.type': '' } },
  { text: '오늘 1동 토마토 웃거름 가상 복합비료 21-17-17 20kg 줬어', expect: { workDate: '2026-11-15', task: '웃거름(추비)', 'm0.kind': '비료', 'm0.type': '화학(복합·단비)', 'm0.name': '가상 복합비료 21-17-17', 'm0.qty': '20', 'm0.unit': 'kg' } },
  { text: '안녕하세요', expect: { intent: 'greet' } },
  { text: '음 그러니까 그거', expect: { intent: 'unknown' } },
  { text: '11월 일지 엑셀로 줘', expect: { intent: 'export' } },
  { text: '3동 딸기 런너 제거했어요', expect: { houses: ['3동'], task: '적엽·런너 제거', mats: 0 } },
  { text: '어제 2동 정식했어', expect: { workDate: '2026-11-14', houses: ['2동'], crop: '방울토마토', stage: '육묘·정식', task: '정식' } },
  { text: '주식 추천해줘', expect: { intent: 'offtopic' } },
  { text: '1동 토마토 흰가루병 살균제 가상곰팡이 액상 물 20리터에 20ml', expect: { 'm0.type': '살균제', 'm0.name': '가상곰팡이 액상', 'm0.qty': '20', 'm0.unit': 'mL', 'm0.dilution': '1000', 'm0.pest': '흰가루병' } },
  { text: '3일 전에 3동 딸기 진딧물 살충제 가상충 유제 20ml 2000배', expect: { workDate: '2026-11-12', 'm0.type': '살충제', 'm0.pest': '진딧물', 'm0.dilution': '2000', 'm0.qty': '20' } },
];

function getVal(ext, key) {
  if (key === 'houses') return ext.houseIds.map((id) => TEST_PROFILE.houses.find((h) => h.id === id)?.name);
  if (key === 'mats') return ext.materials.length;
  if (key === 'memoHas') return ext.memo;
  if (key.startsWith('m0.')) return ext.materials[0] ? ext.materials[0][key.slice(3)] : undefined;
  return ext[key];
}

export function runExtractTests({ quiet = false } = {}) {
  const ctx = { profile: TEST_PROFILE, today: '2026-11-15', knownNames: TEST_NAMES };
  const results = TEST_CASES.map((c) => {
    const ext = extractRules(c.text, ctx);
    const fails = [];
    for (const [k, want] of Object.entries(c.expect)) {
      const got = getVal(ext, k);
      const ok = k === 'memoHas' ? String(got || '').includes(want) : JSON.stringify(got ?? '') === JSON.stringify(want);
      if (!ok) fails.push(`${k}: 기대 ${JSON.stringify(want)} / 실제 ${JSON.stringify(got)}`);
    }
    return { text: c.text, pass: !fails.length, fails: fails.join(' | ') };
  });
  const pass = results.filter((r) => r.pass).length;
  const out = { total: results.length, pass, fail: results.length - pass, results };
  if (!quiet && typeof console !== 'undefined') {
    console.table(results);
    console.log(`규칙 추출 테스트: ${pass}/${results.length} 통과`);
  }
  return out;
}
