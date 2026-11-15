// 가상 데모 데이터 (시설 토마토·방울토마토·딸기). 모든 값은 가상이며 demo: true 로 표시된다.
// 효신이 11/22까지 준비하는 실제 데모 농가 데이터가 오면 이 파일을 교체한다.

import { todayStr } from './records.js';

export const DEMO_PROFILE = {
  name: '김데모',
  farmName: '가상농장',
  location: '경상남도 가상군 가상면',
  houses: [
    { id: 'h1', name: '1동', lot: '가상리 123', crop: '토마토' },
    { id: 'h2', name: '2동', lot: '가상리 124', crop: '방울토마토' },
    { id: 'h3', name: '3동', lot: '가상리 130-2', crop: '딸기' },
  ],
  demo: true,
};

const SKIES = ['맑음', '맑음', '구름많음', '흐림', '맑음', '구름많음', '비'];

// [며칠 전, 동, 작목, 단계, 작업, 자재[], 메모]
const PLAN = [
  [1, ['h1'], '토마토', '작물관리', '병해충 방제', [{ kind: '농약', action: '사용', type: '살균제', name: '가상곰팡이 액상', qty: '100', unit: 'mL', dilution: '1000', pest: '잿빛곰팡이병' }], '아랫잎 위주'],
  [2, ['h3'], '딸기', '작물관리', '적엽·런너 제거', [], ''],
  [3, ['h1', 'h2'], '토마토', '작물관리', '웃거름(추비)', [{ kind: '비료', action: '사용', type: '화학(복합·단비)', name: '가상 복합비료 21-17-17', qty: '', unit: 'kg', dilution: '', pest: '' }], ''],
  [4, ['h2'], '방울토마토', '수확·출하', '수확', [], '약 120kg'],
  [5, ['h3'], '딸기', '작물관리', '꿀벌 투입', [], ''],
  [7, ['h1'], '토마토', '작물관리', '유인·곁순 제거', [], ''],
  [9, ['h3'], '딸기', '', '', [{ kind: '농약', action: '구입', type: '살충제', name: '가상충 유제', qty: '2', unit: '병', dilution: '', pest: '' }], ''],
  [11, ['h1', 'h2'], '토마토', '작물관리', '관수·양액', [{ kind: '비료', action: '사용', type: '양액 비료', name: '가상 양액 A', qty: '20', unit: 'kg', dilution: '', pest: '' }], ''],
  [13, ['h3'], '딸기', '작물관리', '보온(커튼·난방)', [], ''],
  [15, ['h1'], '토마토', '작물관리', '적엽(잎 따기)', [], ''],
  [17, ['h3'], '딸기', '작물관리', '병해충 방제', [{ kind: '농약', action: '사용', type: '살충제', name: '가상충 유제', qty: '20', unit: 'mL', dilution: '2000', pest: '응애' }], ''],
  [20, ['h2'], '방울토마토', '작물관리', '수정(수정벌·착과제)', [], ''],
  [23, ['h1', 'h2'], '토마토', '작물관리', '환기·온도관리', [], ''],
  [26, ['h3'], '딸기', '육묘·정식', '정식', [{ kind: '비료', action: '구입', type: '유기질(퇴비·유박)', name: '가상 유박', qty: '10', unit: '포대', dilution: '', pest: '' }], '정식 4,000주'],
  [30, ['h3'], '딸기', '경운·토양관리', '두둑·멀칭', [], ''],
  [34, ['h3'], '딸기', '경운·토양관리', '밑거름·퇴비', [{ kind: '비료', action: '사용', type: '유기질(퇴비·유박)', name: '가상 유박', qty: '8', unit: '포대', dilution: '', pest: '' }], ''],
  [38, ['h1'], '토마토', '수확·출하', '출하', [], '공판장'],
  [42, ['h2'], '방울토마토', '작물관리', '병해충 방제', [{ kind: '농약', action: '사용', type: '살충제', name: '가상가루이 수화제', qty: '50', unit: 'g', dilution: '1000', pest: '담배가루이' }], ''],
  [47, ['h3'], '딸기', '사전준비', '육묘(런너 받기)', [], ''],
  [52, ['h1', 'h2'], '토마토', '사전준비', '하우스 정비', [], ''],
];

function shift(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export function buildDemoRecords(profile = DEMO_PROFILE, author = '김데모', email = 'demo@nongsa.example') {
  return PLAN.map(([ago, houseIds, crop, stage, task, mats, memo], i) => {
    const d = shift(ago);
    const workDate = todayStr(d);
    const created = new Date(d);
    created.setHours(19, 10 + (i % 40), 0, 0);
    // 2건은 다음 날 사후입력
    if (i === 4 || i === 12) created.setDate(created.getDate() + 1);
    const tmin = 2 + ((i * 3) % 7);
    const weather = i === 6
      ? { status: 'missing', sky: '', tmin: null, tmax: null, rain: null, source: '', reason: '미수집 (가상)', fetchedAt: created.toISOString() }
      : { status: 'ok', sky: SKIES[i % SKIES.length], tmin, tmax: tmin + 9 + (i % 3), rain: SKIES[i % SKIES.length] === '비' ? 4.5 : 0, source: 'mock', reason: '', fetchedAt: created.toISOString() };
    // 내 농장 동에 맞춰 붙인다: 같은 id -> 같은 작목 -> (토마토류끼리) -> 첫 동
    const hs = profile.houses || [];
    const pick = (hid) => {
      const want = DEMO_PROFILE.houses.find((h) => h.id === hid)?.crop || crop;
      return hs.find((h) => h.id === hid && h.crop === want) || hs.find((h) => h.crop === want)
        || (want !== '딸기' && hs.find((h) => h.crop !== '딸기')) || hs[0];
    };
    const mapped = [...new Set(houseIds.map(pick).filter(Boolean).map((h) => h.id))];
    const firstCrop = hs.find((h) => h.id === mapped[0])?.crop || crop;
    return {
      workDate,
      houseIds: mapped,
      crop: crop === firstCrop || (crop !== '딸기' && firstCrop !== '딸기') ? crop : firstCrop,
      cropManual: false,
      weather,
      stage,
      task,
      materials: mats.map((m) => ({ ...m })),
      area: { value: '', unit: '㎡' },
      detail: '',
      detailEdited: false,
      memo,
      author,
      authorEmail: email,
      createdAt: created.toISOString(),
      updatedAt: null,
      demo: true,
    };
  });
}
