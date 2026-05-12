/**
 * Finance Hub 및 HomeTax 시스템 소스의 표준 스키마 정의
 * 데이터가 없는 상태에서도 일관된 UI를 제공하기 위해 사용되는 '마스터 스키마'입니다.
 */

export interface SystemColumn {
    name: string;
    displayName: string;
    type: 'string' | 'number' | 'date' | 'currency' | 'textarea' | 'boolean';
}

// 홈택스 (세금)계산서 공통 마스터 스키마 (38개 필드)
const HOMETAX_INVOICE_MASTER_SCHEMA: SystemColumn[] = [
    { name: 'id', displayName: 'ID', type: 'string' },
    { name: 'business_number', displayName: '사업자번호', type: 'string' },
    { name: 'invoice_type', displayName: '구분(매출/매입)', type: 'string' },
    { name: '작성일자', displayName: '작성일자', type: 'date' },
    { name: '승인번호', displayName: '승인번호', type: 'string' },
    { name: '발급일자', displayName: '발급일자', type: 'date' },
    { name: '전송일자', displayName: '전송일자', type: 'date' },
    { name: '공급자사업자등록번호', displayName: '공급자 사업자번호', type: 'string' },
    { name: '공급자종사업장번호', displayName: '공급자 종사업장', type: 'string' },
    { name: '공급자상호', displayName: '공급자 상호', type: 'string' },
    { name: '공급자대표자명', displayName: '공급자 대표자', type: 'string' },
    { name: '공급자주소', displayName: '공급자 주소', type: 'string' },
    { name: '공급받는자사업자등록번호', displayName: '공급받는자 사업자번호', type: 'string' },
    { name: '공급받는자종사업장번호', displayName: '공급받는자 종사업장', type: 'string' },
    { name: '공급받는자상호', displayName: '공급받는자 상호', type: 'string' },
    { name: '공급받는자대표자명', displayName: '공급받는자 대표자', type: 'string' },
    { name: '공급받는자주소', displayName: '공급받는자 주소', type: 'string' },
    { name: '합계금액', displayName: '합계금액', type: 'currency' },
    { name: '공급가액', displayName: '공급가액', type: 'currency' },
    { name: '세액', displayName: '세액', type: 'currency' },
    { name: '전자세금계산서분류', displayName: '계산서 분류', type: 'string' },
    { name: '전자세금계산서종류', displayName: '계산서 종류', type: 'string' },
    { name: '발급유형', displayName: '발급유형', type: 'string' },
    { name: '비고', displayName: '비고', type: 'textarea' },
    { name: '영수청구구분', displayName: '영수/청구 구분', type: 'string' },
    { name: '공급자이메일', displayName: '공급자 이메일', type: 'string' },
    { name: '공급받는자이메일1', displayName: '공급받는자 이메일1', type: 'string' },
    { name: '공급받는자이메일2', displayName: '공급받는자 이메일2', type: 'string' },
    { name: '품목일자', displayName: '품목일자', type: 'date' },
    { name: '품목명', displayName: '품목명', type: 'string' },
    { name: '품목규격', displayName: '품목규격', type: 'string' },
    { name: '품목수량', displayName: '품목수량', type: 'number' },
    { name: '품목단가', displayName: '품목단가', type: 'currency' },
    { name: '품목공급가액', displayName: '품목 공급가액', type: 'currency' },
    { name: '품목세액', displayName: '품목 세액', type: 'currency' },
    { name: '품목비고', displayName: '품목 비고', type: 'textarea' },
    { name: 'excel_file_path', displayName: '원본 파일 경로', type: 'string' },
    { name: 'created_at', displayName: '수집일시', type: 'date' }
];

export const SYSTEM_SCHEMAS: Record<string, SystemColumn[]> = {
    // 1. 은행 거래 내역
    'bank_transactions': [
        { name: 'date', displayName: '거래일자', type: 'date' },
        { name: 'time', displayName: '거래시간', type: 'string' },
        { name: 'description', displayName: '적요', type: 'string' },
        { name: 'outflow', displayName: '출금액', type: 'currency' },
        { name: 'inflow', displayName: '입금액', type: 'currency' },
        { name: 'balance', displayName: '잔액', type: 'currency' },
        { name: 'bankName', displayName: '은행명', type: 'string' },
        { name: 'accountNumber', displayName: '계좌번호', type: 'string' },
        { name: 'accountName', displayName: '계좌명', type: 'string' },
        { name: 'category', displayName: '카테고리', type: 'string' },
        { name: 'memo', displayName: '메모', type: 'textarea' }
    ],
    // 2. 카드 승인 내역
    'card_approvals': [
        { name: 'date', displayName: '승인일자', type: 'date' },
        { name: 'time', displayName: '승인시간', type: 'string' },
        { name: 'merchantName', displayName: '가맹점명', type: 'string' },
        { name: 'amount', displayName: '승인금액', type: 'currency' },
        { name: 'cardNumber', displayName: '카드번호', type: 'string' },
        { name: 'cardName', displayName: '카드명', type: 'string' },
        { name: 'category', displayName: '업종', type: 'string' },
        { name: 'status', displayName: '상태', type: 'string' },
        { name: 'memo', displayName: '메모', type: 'textarea' }
    ],
    // 3. 홈택스 공통 (세금계산서, 계산서, 면세 등 모든 변종에 적용)
    'hometax_invoices': HOMETAX_INVOICE_MASTER_SCHEMA
};

// 공통 접두어/키워드 매칭을 통한 스키마 반환
export function getSystemSchema(id: string): SystemColumn[] | null {
    if (SYSTEM_SCHEMAS[id]) return SYSTEM_SCHEMAS[id];
    
    // 패턴 매칭 (hometax_로 시작하는 모든 소스에 마스터 스키마 적용)
    if (id.startsWith('hometax_')) {
        return SYSTEM_SCHEMAS['hometax_invoices'];
    }
    
    return null;
}
