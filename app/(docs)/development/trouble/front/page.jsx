import { DocPageLayout } from "@/components/docs/DocPageLayout";

export default function Page() {
    return (
        <DocPageLayout category="development" title="트러블 슈팅">
            <div className="mx-auto w-full max-w-5xl px-4 py-10">
                <div className="space-y-8">
                    <section className="rounded-3xl border border-red-100 bg-red-50/60 p-8 shadow-sm">
                        <div className="mb-5 inline-flex rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">
                            문제
                        </div>

                        <div className="space-y-5 text-[15px] leading-8 text-slate-800">
                            <h3>lighthouse 성능 개선을 위해 홈 화면 SSR 전환 후 일부 GET 요청 실패</h3>

                            <p>기존 CSR 구조에서는 홈 진입 후 브라우저에서 다음 데이터를 조회했다.</p>

                            <ul className="list-disc space-y-2 pl-6">
                                <li>경기 목록 조회</li>
                                <li>구단 목록 조회</li>
                            </ul>

                            <p>
                                SSR 전환 후에는 page.tsx에서 서버 사이드로 데이터를 미리 조회한 뒤,
                                클라이언트 컴포넌트에 props로 전달하는 구조로 변경했다.
                            </p>

                            <p>
                                그러나 SSR 전환 이후 홈 화면에서 일부 GET 요청이 정상적으로 동작하지 않는 문제가 발생했다.
                            </p>

                            <p>
                                대표적으로 구단 목록 조회 요청이 정상 응답하지 않거나, 서버 로그에서 403 응답이 확인되었다.
                            </p>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-amber-100 bg-amber-50/60 p-8 shadow-sm">
                        <div className="mb-6 inline-flex rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white">
                            원인 분석
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-2xl border border-white/70 bg-white p-6 shadow-sm">
                                <div className="mb-4 text-lg font-bold text-slate-900">
                                    1.  <span className="font-extrabold">CSR과 SSR의 요청 실행 환경이 다름</span>
                                </div>

                                <div className="space-y-4 text-[15px] leading-8 text-slate-800">
                                    <p>CSR에서는 API 요청이 브라우저에서 실행된다.</p>

                                    <p>
                                        즉 요청 주체가 사용자의 브라우저이며, 브라우저 환경에서 필요한 쿠키,
                                        클라이언트 헤더, 공통 fetch 설정이 함께 적용될 수 있다.
                                    </p>

                                    <p>반면 SSR에서는 API 요청이 브라우저가 아니라 Next.js 서버에서 실행된다.</p>

                                    <p>
                                        따라서 SSR로 변경하면 API 서버 입장에서는 요청 출처와 실행 환경이 달라지므로
                                        이로 인해 기존 CSR에서는 정상 동작하던 GET 요청이 SSR 환경에서는 실패할 수 있다.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/70 bg-white p-6 shadow-sm">
                                <div className="mb-4 text-lg font-bold text-slate-900">
                                    2. 기존 API wrapper를 우회하면서 요청 헤더가 달라짐
                                </div>

                                <div className="space-y-4 text-[15px] leading-8 text-slate-800">
                                    <p>
                                        기존 클라이언트 코드에서는 getMatches, getClubs 가 내부적으로 공통 API wrapper를 사용하고 있다.
                                    </p>

                                    <pre className="overflow-x-auto rounded-2xl bg-slate-950 p-5 text-sm leading-7 text-slate-100">
                                        {`// 예시
export const getMatches = async (date?: string) => {
  const params = date ? \`?date=\${date}\` : "";
  return await pub.get<MatchesData>(\`\${API_BASE_URL}/order/matches\${params}\`);
};`}
                                    </pre>

                                    <p>
                                        여기서 pub.get은 단순 fetch가 아니라 공통 요청 설정을 포함하는 wrapper다.
                                    </p>

                                    <p>
                                        wrapper에 공통 base config, Content-Type, 인증 관련 헤더와 같은 정보가 삽입 되어있지만
                                        SSR 전환 과정에서 서버 용 함수를 만들며 직접 fetch()을 사용함으로 기존 pub.get이 자동으로 붙여주던 요청 설정이 빠졌다.
                                    </p>

                                    <p>
                                        따라서 SSR용 fetch 요청이 기존 CSR 요청과 동일한 형태로 만들어 지지 않은 것이다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-8 shadow-sm">
                        <div className="mb-5 inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
                            해결 방법
                        </div>

                        <div className="space-y-5 text-[15px] leading-8 text-slate-800">
                            <p>
                                SSR을 적용해도 홈 화면 전체가 서버 중심으로 단순해지는 구조가 아니며 이미 홈 화면은 브라우저 상태와 상호 작용 의존도가 높기 때문에  CSR로 유지하는 것이 현재 구조에서 더 안정적이라고 판단했다.
                            </p>

                            <p>따라서 홈 화면은 CSR 구조를 유지하고, 성능 개선은 다음 방식으로 진행했다.</p>

                            <div className="rounded-2xl border border-white/70 bg-white p-6 shadow-sm">
                                <ol className="list-decimal space-y-3 pl-6 text-[15px] leading-8 text-slate-800">
                                    <li>LCP 이미지 priority 적용</li>
                                    <li>스켈레톤 크기를 실제 카드 크기와 동일하게 조정</li>
                                    <li>초기 loading 상태를 true로 설정해 layout shift 방지</li>
                                    <li>날짜 계산은 클라이언트 마운트 이후 수행</li>
                                    <li>구단 카드/경기 카드 스켈레톤 크기 고정</li>
                                </ol>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </DocPageLayout>
    );
}