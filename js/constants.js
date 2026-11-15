// 선택지 목록. 출처: 영농일지 입력 항목표 v0.1 3장 (효신 검토 전, "확인 필요" 항목 포함)
// 효신 검토 결과가 나오면 이 파일만 고치면 된다.

export const APP_VERSION = '0.2.0';

export const CROPS = ['토마토', '방울토마토', '딸기'];

export const STAGES = ['사전준비', '경운·토양관리', '육묘·정식', '작물관리', '수확·출하', '정리'];

// 토마토·방울토마토 세부 작업
export const TASKS_TOMATO = {
  '사전준비': ['하우스 정비'],
  '경운·토양관리': ['경운·로터리', '밑거름·퇴비', '토양소독', '이랑·멀칭'],
  '육묘·정식': ['정식'],
  '작물관리': ['관수·양액', '환기·온도관리', '유인·곁순 제거', '적엽(잎 따기)', '적화·적과', '수정(수정벌·착과제)', '병해충 방제', '웃거름(추비)'],
  '수확·출하': ['수확', '출하'],
  '정리': ['작물 철거·폐기물 처리'],
};

// 딸기 세부 작업
export const TASKS_STRAWBERRY = {
  '사전준비': ['육묘(런너 받기)'],
  '경운·토양관리': ['경운·로터리', '밑거름·퇴비', '두둑·멀칭'],
  '육묘·정식': ['정식'],
  '작물관리': ['보온(커튼·난방)', '꿀벌 투입', '관수·양액', '적엽·런너 제거', '적화·적과', '병해충 방제', '웃거름(추비)'],
  '수확·출하': ['수확', '출하'],
  '정리': ['작물 철거'],
};

export const PESTS_TOMATO = ['잿빛곰팡이병', '잎곰팡이병', '흰가루병', '역병', '담배가루이', '진딧물', '토마토뿔나방', '기타'];
export const PESTS_STRAWBERRY = ['잿빛곰팡이병', '흰가루병', '탄저병', '응애', '진딧물', '총채벌레', '기타'];

export const PESTICIDE_TYPES = ['살충제', '살균제', '살균살충제', '제초제', '생장조정제', '기타'];
export const FERTILIZER_TYPES = ['유기질(퇴비·유박)', '화학(복합·단비)', '양액 비료', '엽면시비·미량요소', '토양개량제', '기타'];

export const UNITS_PESTICIDE = ['mL', 'L', 'g', 'kg', '병', '봉지'];
export const UNITS_FERTILIZER = ['kg', '포대', 'L', '톤'];

export const DILUTIONS = ['500', '1000', '2000'];
export const AREA_UNITS = ['㎡', '평', '동 전체'];

export const SKY = ['맑음', '구름많음', '흐림', '비', '눈'];

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 표준 영농기록장 A~M열 (영농일지 입력 항목표 v0.1 4장)
export const EXCEL_HEADERS = [
  '작업일', '필지', '작목', '날씨', '구입/사용',
  '농약 종류', '농약 제품명', '농약 구입량/사용량',
  '비료 종류', '비료 제품명', '비료 구입량/사용량',
  '작업단계(작업명)', '세부작업내용',
];

export function tasksFor(crop) {
  return crop === '딸기' ? TASKS_STRAWBERRY : TASKS_TOMATO;
}
export function pestsFor(crop) {
  return crop === '딸기' ? PESTS_STRAWBERRY : PESTS_TOMATO;
}
