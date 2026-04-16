# Thanos·S3 기반 장기 저장 — PVC(EBS)에서 S3로 전환

> **분류**: 스토리지 아키텍처 · **환경**: Staging EKS · **상태**: ✅ 적용

## 발견 계기

**Spot이 너무 자주 빠져서** 매번 모니터링 도구와 DB 클라이언트가 망가지는 현상을 체감했습니다. Spot 중단이 일어날 때마다:

- **CloudBeaver** 세션·연결 정보가 리셋 → 매번 재설정
- **Prometheus/Grafana** 등 모니터링 툴이 작동 안 함 (Pod가 재기동돼도 데이터 접근 불가)

"왜 Spot 재기동 후에도 복구가 안 되지?" 원인을 파고들다 **PVC(EBS)가 AZ에 귀속되는 구조적 한계**를 발견해 S3 중심으로 재설계했습니다. (이후 [Spot 다양화 작업](./staging-spot)과 병행 진행)

## 증상

- Spot 회수 → Pod가 다른 AZ 노드로 재스케줄
- 새 Pod가 **기존 EBS PVC에 attach 실패** → Pending 상태로 대기
- Prometheus 메트릭 시계열 단절, Grafana 조회 불가
- CloudBeaver 세션·연결 설정 매번 리셋

## 원인 — EBS는 AZ에 귀속된다

- AWS EBS 볼륨은 **생성된 AZ 안에서만 마운트** 가능
- Pod가 AZ-a에서 AZ-b로 이동하면 기존 EBS PVC 접근 불가
- **Spot 다양화로 Pod가 여러 AZ에 분산**되자 이 제약이 치명적으로 드러남

## 해결 — S3 기반 장기 저장으로 전환

- **Prometheus 메트릭**: **Thanos Sidecar + S3**로 장기 저장 전환
- **Loki 로그**: S3 chunks backend (이미 적용)
- **Tempo 트레이스**: S3 backend

PVC는 **단기 버퍼(WAL 등) 용도로만 최소한** 유지하고, 장기 데이터는 모두 S3로 보냅니다.

## 효과

| 항목 | Before (PVC/EBS) | After (S3) |
|------|-----------------|-----------|
| AZ 독립성 | ❌ AZ에 귀속 | ✅ AZ 무관 |
| Pod 이동 | ❌ 재스케줄 시 attach 실패 | ✅ 어디서든 읽기/쓰기 |
| 백업 | EBS 스냅샷 별도 관리 | S3 버저닝·lifecycle 자동 |
| 확장 | 볼륨 resize 필요 | 무제한 |
| 비용 구조 | IOPS 프로비저닝 고정비 | 사용량 기반 |

## 교훈

Spot 안정성 작업을 하며 **"인프라 스토리지 계층도 동시에 다시 봐야 한다"**는 인식을 얻음. 한 계층의 문제(노드 변동성)가 다른 계층의 제약(AZ 귀속 스토리지)을 드러내는 사례.

**원칙**: 쿠버네티스처럼 **노드·AZ가 수시로 바뀌는 런타임**에서는 상태를 AZ에 묶이지 않는 저장소(S3)에 두는 게 자연스럽다.

---

[← 트러블슈팅 인덱스로](../operational-troubleshooting)
