# 운영 보완 및 트러블슈팅

성능 테스트·장애 대응 과정에서 발견한 병목과 해결 이력 모음집입니다.

---

## 📋 트러블슈팅 인덱스

| 제목 | 분류 | 환경 | 상태 |
|------|-----|------|------|
| [Chrome QUIC / HTTP3 — Cloudflare Proxy 전환](#chrome-quic-http3-cloudflare-proxy-전환) | 네트워크 | Dev (On-Prem) | ✅ 해결 |

> 인덱스 링크는 페이지 내 해당 섹션으로 이동합니다.

---

## Chrome QUIC / HTTP3 — Cloudflare Proxy 전환

**증상**: Dev는 On-Prem 공유기 환경이라 Chrome이 기본 사용하는 **QUIC(UDP) 트래픽이 홈 라우터의 UDP NAT에서 간헐적으로 드롭**. 페이지 로딩이 끊기거나 WebSocket 세션이 자주 끊어지는 증상 발생.

**원인**:

- SK브로드밴드 → 공유기 구간의 UDP NAT 처리가 불안정 (TCP는 정상, UDP는 연결 추적이 약함)
- Chrome이 HTTP/3(QUIC)를 선호하면서 장시간 연결 유지 시도
- UDP 패킷 드롭이 누적되어 세션 실패

**해결**:

- **Cloudflare Proxy를 Dev 진입 앞단에 배치**
- **Cloudflare Edge(서울 PoP)가 QUIC 수신** → 내부로는 **HTTP/2(TCP)로 변환**해 전달
- 공유기는 TCP만 처리하면 되므로 NAT 안정성 확보

```
Before: Chrome --QUIC/UDP--> ISP --UDP--> 공유기(❌ 간헐 드롭) --> Ingress
After : Chrome --QUIC/UDP--> Cloudflare Edge --HTTP/2/TCP--> 공유기(✅ 안정) --> Ingress
```

**부수 효과**:

- Cloudflare IP 화이트리스트 기반 접근 제어(팀 전용 Dev 보호)
- TLS 종료를 엣지에서 처리해 내부 경로 단순화
- 상세 디버깅 이력은 Obsidian `troubleshooting/2026-03-17-chrome-quic-http3-troubleshooting.md` 참조
