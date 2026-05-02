/**
 * Finance Hub 표준 컬럼 명명 규칙 및 마스터 연동 설정
 */

export interface SchemaStandard {
    canonicalName: string;      // 표준 명칭
    variants: string[];         // 허용되는 변형 명칭 (소문자, 공백 제거 후 비교)
    masterTable: string;        // 연동할 마스터 테이블명
    nameFields: string[];       // 검색에 사용할 이름 필드 후보
    businessNumberFields?: string[]; // 검색에 사용할 사업자번호 필드 후보
    lookupField: string;        // 마스터 테이블에서 검색할 필드 (기본값: 'name')
}

export const SCHEMA_STANDARDS: SchemaStandard[] = [
    {
        canonicalName: '거래처ID',
        variants: ['client_id', '거래처id', '거래처id', 'dataid', 'did', 'clientid'],
        masterTable: 'master_client',
        nameFields: ['상호', '거래처명', '거래처', '고객명'],
        businessNumberFields: ['사업자등록번호', '사업자번호', '등록번호'],
        lookupField: 'name'
    },
    {
        canonicalName: '사원ID',
        variants: ['user_id', '사원id', '사원번호', 'staff_id', '담당자id'],
        masterTable: 'user',
        nameFields: ['담당자', '사원명', '성명', '작성자'],
        lookupField: 'name'
    },
    {
        canonicalName: '제품ID',
        variants: ['product_id', 'item_id', '제품코드', '제품id', '제품명id', 'productid'],
        masterTable: 'master_product',
        nameFields: ['제품명', '품목명', '모델명'],
        lookupField: 'name'
    },
    {
        canonicalName: '자재ID',
        variants: ['material_id', '자재코드', '자재id', '자재명id'],
        masterTable: 'master_material',
        nameFields: ['자재명', '원재료명'],
        lookupField: 'name'
    },
    {
        canonicalName: '프로젝트ID',
        variants: ['project_id', '현장id', '현장코드', '프로젝트id', 'p_id'],
        masterTable: 'master_project',
        nameFields: ['프로젝트명', '현장명', '공사명'],
        lookupField: 'name'
    }
];

/**
 * 특정 컬럼명이 어떤 표준 규칙에 해당하는지 찾아 반환합니다.
 */
export function findSchemaStandard(columnName: string): SchemaStandard | undefined {
    const cleanName = columnName.replace(/\s+/g, '').toLowerCase();
    
    return SCHEMA_STANDARDS.find(s => 
        s.canonicalName === columnName || 
        s.variants.some(v => v.replace(/\s+/g, '').toLowerCase() === cleanName)
    );
}
