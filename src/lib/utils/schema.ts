/**
 * 컬럼명을 기반으로 적절한 필드 타입을 추론합니다.
 */
export function inferColumnType(name: string): string {
  const lowercase = name.toLowerCase();
  if (lowercase.includes('date') || lowercase.includes('at') || lowercase.includes('time')) return 'date';
  if (lowercase.includes('amount') || lowercase.includes('price') || lowercase.includes('cost') || lowercase.includes('fee')) return 'currency';
  if (lowercase.includes('count') || lowercase.includes('quantity') || (lowercase.includes('id') && lowercase !== 'id' && !lowercase.includes('uuid'))) return 'number';
  if (lowercase.startsWith('is') || lowercase.startsWith('has') || lowercase === 'active' || lowercase === 'deleted') return 'boolean';
  if (lowercase.includes('memo') || lowercase.includes('description') || lowercase.includes('data')) return 'textarea';
  if (lowercase.includes('email')) return 'email';
  if (lowercase.includes('phone') || lowercase.includes('tel') || lowercase.includes('mobile')) return 'phone';
  return 'string';
}
