import { queryTable } from '@/egdesk-helpers';

export interface GuardrailRule {
    id: string;
    reportId: string;
    columnName: string;
    ruleType: 'RANGE' | 'REGEX' | 'MUST_MATCH' | 'FORBIDDEN' | 'DUPLICATE';
    ruleValue: string;
    severity: 'BLOCK' | 'WARN';
    errorMessage: string;
    adminAdvice: string;
}

export interface ValidationResult {
    isValid: boolean;
    failedRules: GuardrailRule[];
    isBlocked: boolean;
}

export class GuardrailService {
    /**
     * 특정 리포트에 설정된 모든 가드레일 규칙을 가져옵니다.
     */
    static async getRulesForReport(reportId: string): Promise<GuardrailRule[]> {
        try {
            const rulesRaw = await queryTable('input_guardrail', {
                filters: { reportId }
            });
            const rules = Array.isArray(rulesRaw) ? rulesRaw : (rulesRaw as any)?.rows ?? [];
            return rules as GuardrailRule[];
        } catch (err) {
            console.error('[GuardrailService] Error fetching rules:', err);
            return [];
        }
    }

    /**
     * 추출된 데이터 행에 대해 가드레일 검증을 수행합니다.
     */
    static async validateRow(reportId: string, rowData: any, tableName?: string): Promise<ValidationResult> {
        const rules = await this.getRulesForReport(reportId);
        if (rules.length === 0) return { isValid: true, failedRules: [], isBlocked: false };

        const failedRules: GuardrailRule[] = [];
        let isBlocked = false;

        for (const rule of rules) {
            const val = rowData[rule.columnName];
            const isFailed = await this.evaluateRule(val, rule, tableName);

            if (isFailed) {
                failedRules.push(rule);
                if (rule.severity === 'BLOCK') {
                    isBlocked = true;
                }
            }
        }

        return {
            isValid: failedRules.length === 0,
            failedRules,
            isBlocked
        };
    }

    /**
     * 개별 규칙을 평가합니다.
     */
    private static async evaluateRule(value: any, rule: GuardrailRule, tableName?: string): Promise<boolean> {
        if (value === undefined || value === null || value === '') return false;

        switch (rule.ruleType) {
            case 'RANGE': {
                // 형식: "min-max" 또는 ">X" 또는 "<X"
                const strVal = String(value).replace(/[^0-9.-]/g, '');
                const num = Number(strVal);
                if (isNaN(num)) return false;

                if (rule.ruleValue.includes('-')) {
                    const [min, max] = rule.ruleValue.split('-').map(Number);
                    return num < min || num > max;
                } else if (rule.ruleValue.startsWith('>')) {
                    return num <= Number(rule.ruleValue.substring(1));
                } else if (rule.ruleValue.startsWith('<')) {
                    return num >= Number(rule.ruleValue.substring(1));
                } else if (!isNaN(Number(rule.ruleValue))) {
                    // 단일 값인 경우 '최대값'으로 간주하여 초과 시 실패
                    return num > Number(rule.ruleValue);
                }
                return false;
            }

            case 'REGEX': {
                try {
                    const regex = new RegExp(rule.ruleValue, 'i');
                    return !regex.test(String(value));
                } catch (e) {
                    return false;
                }
            }

            case 'MUST_MATCH': {
                return String(value).trim() !== rule.ruleValue.trim();
            }

            case 'FORBIDDEN': {
                return String(value).includes(rule.ruleValue);
            }

            case 'DUPLICATE': {
                if (!tableName) return false;
                try {
                    // 실제 물리 테이블에서 해당 컬럼 값이 존재하는지 확인
                    const existing = await queryTable(tableName, {
                        filters: { [rule.columnName]: String(value) },
                        limit: 1
                    });
                    return existing && existing.length > 0;
                } catch (e) {
                    return false;
                }
            }

            default:
                return false;
        }
    }
}
