'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { loginAction, logoutAction } from '@/app/actions/auth';
import { checkSetupRequiredAction } from '@/app/actions/setup';
import { LayoutDashboard, LogIn, Lock, User, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    // 마운트 시 필요한 초기화 작업(셋업 상태 검증 & 기존 세션 파기)을 병렬로 전송하여 RTT를 중첩시킵니다.
    const initializeLoginPage = async () => {
      console.log('[CLIENT DEBUG] LoginPage mounted: executing parallel initialization...');
      try {
        const [isRequired] = await Promise.all([
          checkSetupRequiredAction(),
          (async () => {
            try {
              await logoutAction();
              localStorage.clear();
              sessionStorage.clear();
              console.log('[CLIENT DEBUG] Session kill switch completed: auth cookies & storage cleared.');
            } catch (e) {
              console.error('[CLIENT DEBUG] Session kill switch failed:', e);
            }
          })()
        ]);

        if (isRequired) {
          router.push('/setup');
        }
      } catch (err) {
        console.error('[CLIENT DEBUG] Initialization error:', err);
      }
    };

    initializeLoginPage();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginAction(username, password);
      if (result.success) {
        // [성능 및 UX 극대화] SPA 라우터(router.push/refresh)를 사용하면 Vercel 프로덕션 환경에서 가상 DOM 교체 및 쿠키 동기화 지연으로 인해 약 2초간의 프리징 멈춤 렉이 발생합니다.
        // 이를 네이티브 리다이렉트(window.location.href)로 대체하여 0ms 만에 즉시 브라우저 레벨에서 화면을 전환하도록 구동시킵니다.
        if (result.user.role === 'VIEWER') {
          window.location.href = '/workspace';
        } else {
          window.location.href = '/';
        }
      }
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다. 다시 확인해 주세요.');
      // 로그인 실패 시에만 다시 아이디/비밀번호를 입력할 수 있도록 로딩 상태를 해제합니다.
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-gray-50 to-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-500/20 mb-6 group hover:scale-110 transition-transform duration-300">
                <LayoutDashboard size={32} className="group-hover:rotate-12 transition-transform" />
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-3">Excel to DB</h1>
            <p className="text-gray-500 font-medium">데이터 관리 시스템 로그인이 필요합니다.</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-white shadow-2xl rounded-3xl p-8 overflow-hidden relative group">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-400 via-blue-600 to-indigo-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          {/* [성능 및 UX 개선] 로딩 중에 표시되는 프리미엄 글래스모픽 미세 오버레이 */}
          {isLoading && (
            <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] z-10 animate-in fade-in duration-300" />
          )}
          
          <form onSubmit={handleLogin} className={`space-y-6 transition-all duration-300 ${isLoading ? 'opacity-50 blur-[0.5px]' : ''}`}>
            <div className="space-y-2">
              <label htmlFor="username" className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">
                Username (ID)
              </label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-blue-500 transition-colors pointer-events-none">
                  <User size={18} />
                </div>
                <input
                  id="username"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  disabled={isLoading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) font-bold text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  required
                />
              </div>
              <p className="text-[10px] text-gray-400 text-right px-1">초기 계정인 경우 'admin_user'를 사용해 주세요.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">
                Password
              </label>
              <div className="relative group/input">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-blue-500 transition-colors pointer-events-none">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) font-bold text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle size={18} className="shrink-0" />
                <span className="text-sm font-bold">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:shadow-blue-500/40 active:scale-95 transition-all disabled:opacity-50 group flex items-center justify-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  로그인 처리 중...
                </>
              ) : (
                <>
                  <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
                  LOGIN
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
             <div className="flex items-center justify-center gap-2 text-gray-400 text-xs font-semibold">
                <Lock size={12} />
                <span>데이터 보안 관리를 위해 인증이 필요합니다.</span>
             </div>
          </div>
        </div>
        
        <p className="text-center mt-8 text-gray-400 text-[11px] font-black uppercase tracking-widest">
            © 2026 Excel to DB : 마이 스마트 데이터 베이스
        </p>
      </div>
    </div>
  );
}
