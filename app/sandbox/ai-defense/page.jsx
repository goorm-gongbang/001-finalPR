"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function AIDefenseSandbox() {
    const [logs, setLogs] = useState([]);
    const [defenseActive, setDefenseActive] = useState(false);

    const addLog = (msg, type = "info") => {
        setLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
    };

    const simulateAttack = () => {
        addLog("Warning: Detected rapid sequential requests from IP 192.168.1.100", "warning");
        if (defenseActive) {
            setTimeout(() => addLog("AI Defense: Blocked malicious pattern. Timeout 10min applied.", "success"), 500);
        } else {
            setTimeout(() => addLog("System Overload: Queue length increased anomalously.", "error"), 500);
        }
    };

    return (
        <div className="w-full">
            <div className="mb-4">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink href="/sandbox">Sandbox</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage className="font-semibold text-gray-900">AI 공격/방어 대응</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            </div>

            <div className="mb-8 mt-12 pb-6 border-b border-gray-100">
                <h1 className="text-[36px] font-bold mb-4 text-gray-900">🤖 봇 및 매크로 방어 시연 (Sandbox)</h1>
                <p className="text-[16px] text-gray-600 leading-relaxed">
                    실시간 티켓팅 시뮬레이션 환경입니다. 실제 스크립트 기반 매크로 공격과 Playball의 보안 솔루션의 AI 방어 메커니즘을 시연합니다.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mt-8">
                {/* Control Panel */}
                <Card className="shadow-none border-gray-200">
                    <CardHeader className="border-b border-gray-100 mb-6 bg-slate-50/50 rounded-t-xl pb-4">
                        <CardTitle className="text-xl font-bold text-slate-800">제어 패널</CardTitle>
                        <CardDescription>AI 방어 시스템 활성화 및 공격 시뮬레이션을 제어합니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-8">
                        <div>
                            <h2 className="text-[15px] font-bold mb-4 text-slate-800">방어 시스템 제어</h2>
                            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <span className="font-semibold text-[15px] text-slate-700">AI 런타임 탐지 (mTLS / WAF)</span>
                                <Switch
                                    checked={defenseActive}
                                    onCheckedChange={(checked) => {
                                        setDefenseActive(checked);
                                        addLog(`방어 시스템 구동 상태 변경: ${checked ? "활성화" : "비활성화"}`);
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <h2 className="text-[15px] font-bold mb-4 text-slate-800">공격 시뮬레이션</h2>
                            <div className="flex flex-col gap-3">
                                <Button onClick={simulateAttack} variant="destructive" className="w-full py-6 text-[15px] shadow-sm tracking-wide rounded-lg hover:bg-red-600 font-semibold cursor-pointer">
                                    🚀 분산 봇 티켓팅 매크로 공격 실행
                                </Button>
                                <Button onClick={() => addLog("서버가 정상적으로 응답하고 있습니다. (Latency: 12ms)")} variant="default" className="w-full py-6 text-[15px] shadow-sm rounded-lg font-semibold text-white cursor-pointer">
                                    일반 유저 접속 시뮬레이션
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Live Terminal */}
                <div className="bg-slate-900 border-gray-800 border rounded-xl p-6 shadow-xl flex flex-col h-[500px]">
                    <h2 className="text-[15px] font-mono text-slate-300 mb-6 flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        텔레메트리 모니터링 콘솔
                    </h2>
                    <div className="flex-1 overflow-y-auto font-mono text-xs space-y-2 bg-black/40 p-5 rounded border border-white/5">
                        <div className="text-slate-500 tracking-wide">[SYSTEM] System initialization complete...</div>
                        {logs.map((log, i) => (
                            <div key={i} className={`tracking-wide
                                ${log.type === "info" ? "text-slate-300" : ""}
                                ${log.type === "warning" ? "text-amber-400" : ""}
                                ${log.type === "error" ? "text-red-400" : ""}
                                ${log.type === "success" ? "text-emerald-400" : ""}
                            `}>
                                <span className="text-slate-600 mr-3">[{log.time}]</span>
                                {log.msg}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
