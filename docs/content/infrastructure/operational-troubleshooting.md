# 운영 보완 및 트러블슈팅

성능 테스트·장애 대응 과정에서 발견한 병목과 해결 이력 모음집입니다. 각 항목을 클릭하면 **상세 페이지**로 이동합니다.

---

## 📋 트러블슈팅 인덱스

| 제목 | 분류 | 환경 |
|------|-----|------|
| [Chrome QUIC / HTTP3 — Cloudflare Proxy 전환](./operational-troubleshooting/chrome-quic) | 네트워크 | Dev (On-Prem) |
| **[Spot 안정성 작업 스토리]** [Staging Spot 다양화 — Karpenter NodePool 분산](./operational-troubleshooting/staging-spot) | 비용·가용성 | Staging EKS |
| **[Spot 안정성 작업 스토리]** [Thanos·S3 기반 장기 저장 — PVC(EBS)에서 S3로 전환](./operational-troubleshooting/thanos-s3) | 스토리지 아키텍처 | Staging EKS |

---

## 트러블슈팅 작성 포맷

새 이슈 추가 시 `operational-troubleshooting/{slug}.md` 파일로 생성하고, 다음 항목을 포함:

1. **증상** — 언제, 어떤 현상이 발생했는지
2. **원인** — 근본 원인 분석
3. **해결** — 적용한 조치와 근거
4. **관측 결과** — 조치 후 정량 지표 (해당 시)
5. **향후 모니터링** — 재발 감지·추가 조치 트리거
6. **참조** — 관련 커밋·문서·Obsidian 경로
