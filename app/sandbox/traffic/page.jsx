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

export default function TrafficSandbox() {
    const [trafficLogs, setTrafficLogs] = useState([]);
    const [queueActive, setQueueActive] = useState(false);

    const addLog = (msg, type = "info") => {
        setTrafficLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
    };

    const burstTraffic = () => {
        addLog("Alert: Vercel CDN detected incoming 10,000 requests/sec", "warning");
        if (queueActive) {
            setTimeout(() => addLog("Redis ZSET Queue Activated: Throttling admission to 200 users/sec", "success"), 500);
            setTimeout(() => addLog("Backend DB Load Normal (CPU 32%)", "info"), 1200);
        } else {
            setTimeout(() => addLog("System Alert: API Gateway 502 Bad Gateway - Timeout", "error"), 500);
            setTimeout(() => addLog("Database connection pool saturated (CPU 99%)", "error"), 1000);
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
                            <BreadcrumbPage className="font-semibold text-gray-900">대규모 트래픽 대응</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            </div>

            <div className="mb-8 mt-12 pb-6 border-b border-gray-100">
                <h1 className="text-[36px] font-bold mb-4 text-gray-900">🌊 대규모 트래픽 대응 시연</h1>
                <p className="text-[16px] text-gray-600 leading-relaxed">
                    티켓 배포 등 트래픽이 일시적으로 폭발하는 상황을 재현합니다. Redis 기반 대기열이 작동할 때와 작동하지 않을 때의 시스템 생존 여부와 처리율을 비교할 수 있습니다.
                </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 mt-8">
                {/* Control Panel */}
                <Card className="shadow-none border-gray-200">
                    <CardHeader className="border-b border-gray-100 mb-6 bg-slate-50/50 rounded-t-xl pb-4">
                        <CardTitle className="text-xl font-bold text-slate-800">제어 패널</CardTitle>
                        <CardDescription>트래픽 스로틀링 및 대역폭 트리거를 설정합니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-8">
                        <div>
                            <h2 className="text-[15px] font-bold mb-4 text-slate-800">기반 인프라 제어</h2>
                            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <span className="font-semibold text-[15px] text-slate-700">Redis ZSET 기반 대기열 시스템</span>
                                <Switch
                                    checked={queueActive}
                                    onCheckedChange={(checked) => {
                                        setQueueActive(checked);
                                        addLog(`대기열 시스템 상태 변경: ${checked ? "On" : "Off"}`);
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <h2 className="text-[15px] font-bold mb-4 text-slate-800">부하 발생 트리거</h2>
                            <div className="flex flex-col gap-3">
                                <Button onClick={burstTraffic} variant="destructive" className="w-full py-6 text-[15px] shadow-sm cursor-pointer rounded-lg hover:bg-red-600">
                                    💥 10,000 req/sec 대규모 트래픽 주입
                                </Button>
                                <Button onClick={() => addLog("일반 평시 트래픽 처리 중 (50 req/sec)")} variant="outline" className="w-full py-6 text-[15px] shadow-sm cursor-pointer rounded-lg">
                                    평상시 부하
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Live Terminal */}
                <div className="bg-slate-900 border-gray-800 border rounded-xl p-6 shadow-xl flex flex-col h-[480px]">
                    <h2 className="text-[15px] font-mono text-slate-300 mb-6 flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        클라우드 인프라 모니터링 로그
                    </h2>
                    <div className="flex-1 overflow-y-auto font-mono text-xs space-y-2 bg-black/40 p-5 rounded border border-white/5">
                        <div className="text-slate-500 tracking-wide">[SYSTEM] Cluster Ready</div>
                        {trafficLogs.map((log, i) => (
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
