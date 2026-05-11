/**
 * 컬럼명을 기반으로 적절한 필드 타입을 추론합니다. (한글 필드명 대응 강화)
 */
export function inferColumnType(name: string): string {
  const lowercase = name.toLowerCase();
  
  // 1. 날짜/시간 관련
  if (
    lowercase.includes('date') || 
    lowercase.includes('at') || 
    lowercase.includes('time') ||
    lowercase.includes('일자') ||
    lowercase.includes('시간') ||
    lowercase.includes('연월')
  ) return 'date';

  // 2. 금액/통화 관련
  if (
    lowercase.includes('amount') || 
    lowercase.includes('price') || 
    lowercase.includes('cost') || 
    lowercase.includes('fee') ||
    lowercase.includes('금액') ||
    lowercase.includes('가액') ||
    lowercase.includes('세액') ||
    lowercase === '부가세' ||
    lowercase === '봉사료' ||
    lowercase === '잔액'
  ) return 'currency';

  // 3. 숫자 관련
  if (
    lowercase.includes('count') || 
    lowercase.includes('quantity') || 
    lowercase.includes('수량') ||
    lowercase.includes('단가') ||
    (lowercase.includes('id') && lowercase !== 'id' && !lowercase.includes('uuid'))
  ) return 'number';

  // 4. 불리언 관련
  if (
    lowercase.startsWith('is') || 
    lowercase.startsWith('has') || 
    lowercase === 'active' || 
    lowercase === 'deleted' ||
    lowercase === '사용여부' ||
    lowercase === '삭제여부'
  ) return 'boolean';

  // 5. 긴 텍스트 관련
  if (
    lowercase.includes('memo') || 
    lowercase.includes('description') || 
    lowercase.includes('data') || 
    lowercase.includes('비고') || 
    lowercase.includes('적요') ||
    lowercase.includes('주소')
  ) return 'textarea';

  // 6. 특수 형식
  if (lowercase.includes('email') || lowercase.includes('이메일')) return 'email';
  if (
    lowercase.includes('phone') || 
    lowercase.includes('tel') || 
    lowercase.includes('mobile') ||
    lowercase.includes('전화번호') ||
    lowercase.includes('연락처')
  ) return 'phone';

  return 'string';
}
