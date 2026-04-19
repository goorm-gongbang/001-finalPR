# TeamCity 연동 및 파이프라인

이 문서는 Playball 프로젝트의 CI/CD를 담당하는 **TeamCity** 파이프라인 구성 및 운영 체계에 대해 설명합니다.

![teamcity](/images/infrastructure/teamcity/01_teamcity.png)

---

## 1. 다른 CI/CD 툴과의 비교 (TeamCity 채택 이유)

다른 대표적인 CI/CD 툴들(예: GitHub Actions, Jenkins, GitLab CI 등)과 비교하였을 때 TeamCity가 가지는 주요한 차이점과 프로젝트에 채택하게 된 장점은 다음과 같습니다.

### 비교 및 차이점

- **GitHub Actions**: 사용이 상대적으로 편하지만, Github에 상당히 의존적이며, Private Repository의 경우에는 사용료가 붙음
- **Jenkins**: 플러그인에 매우 의존적이며 익숙치 않은 사람에겐 사용이 힘듬
- **TeamCity**: UI가 직관적이고 사용하기 편하며, 자체 구축시 허용되는 선까지 무료 사용 가능(100개의 빌드구성 + 3대의 에이전트)

### 주요 장점

- **강력한 빌드 의존성(Build Chains) 관리**: 직관적인 UI로 계층적인 빌드 흐름을 쉽게 구성 및 모니터링 가능
- **빠른 이력 조회**: 내장된 RDBMS + 설정 파일을 사용하기 때문에 동시 빌드 및 이력 조회의 성능이 좋음
- **빠른 사용 가능(Batteries Included)**: 필수 기능들이 내장되어 있어 별도의 플러그인 설치 없이도 빠르게 사용 가능
- **접근 권한 관리**: 읽기/쓰기가 전부 가능한 어드민과 읽기만 가능한 뷰어권한으로 사용자 그룹을 나눌 수 있음

---

## 2. TeamCity 인프라 구조

TeamCity 서버와 에이전트, 그리고 외부 접속을 위한 리버스 프록시를 하나의 클라우드 VM 인스턴스에서 Docker Compose로 실행 및 관리합니다.

### 2.1. 호스팅 및 인스턴스 사양

- **클라우드 제공자**: GCP Compute Engine
- **인스턴스 타입**: e2-standard-4
- **시스템 사양**: 4 vCPU, 16 GiB Memory
- **운영 체제 (OS)**: Debian-12-bookworm-v20260114
- **스토리지 (Volume)**: 50GB
- **VPC 방화벽 규칙**: 
  - allow-http-https: 0.0.0.0/0 tcp:80,443
  - allow-teamcity: 0.0.0.0/0 tcp:22
  - default-allow-ssh 0.0.0.0/0 tcp:22
  - default-allow-rdp 0.0.0.0/0 tcp:3389
  - default-allow-icmp 0.0.0.0/0 icmp
  - default-allow-internal [IP_ADDRESS] tcp:0-65535, udp:0-65535, icmp

### 2.2. 내부 컴포넌트 구성

- **Teamcity Server**: 전체 시스템을 관리하는 컨트롤 타워로, 프로젝트 관리, 빌드 큐 운영, UI, 에이전트 배정 등의 역할을 수행
- **Teamcity Agent**: 서버로부터 전달받은 작업을 수행하는 노드로 주로 빌드 스크립트 실행
  - 초반에는 에이전트를 2대만 사용했으나, 동시에 여러 이미지 빌드 시 소요되는 병목을 줄이기 위해 추후 3대로 늘리며 VM 인스턴스 사양도 업그레이드함
- **Caddy**: 리버스 프록시 서버로, SSL 인증서를 자동 관리하며 `teamcity-gb.duckdns.org` 도메인과 맵핑
- **DuckDNS**: IP가 아닌 도메인 기반의 안정적인 접속을 제공하기 위해 사용

---

## 3. 파이프라인(CI/CD) 상세 흐름 및 전략

주 빌드 저장소(`goormgb-backend`)의 마이크로서비스를 효율적으로 빌드하고 배포하기 위해 구성된 의존성 파이프라인 단계입니다.

### 3.1. 모노레포 트리거 및 CI 전략

- **서비스별 빌드 분리**: `Auth-Guard`, `Order-Core`등 각 서비스마다 독립적인 Build Configuration(빌드 구성) 생성
- **지능형 트리거(VCS Trigger Rules)**:
  - 본인의 서비스 폴더 (`+:Service-Name/**`)의 변경이 있을때만 빌드가 시작
  - 공통 모듈(`+:common-core/**`)이나 루트 설정이 바뀌면 모든 서비스의 빌드가 시작
  - 배포 환경별로 맞는 브랜치에(`dev`,`staging`,`prod`) 들어오는 커밋만 감지하도록 설정
    ![trigger](/images/infrastructure/teamcity/02_teamcity.png)

### 3.2. 도커 빌드 및 이미지 태깅

- **이미지 태깅 규칙**: Git 커밋 해시(`%build.vsc.number%`)를 7자리로 잘라 `해시값.빌드넘버` 형태로 규격화 후 태그 생성
- **멀티 아키텍처 지원 (buildx)**: 다양한 환경을 고려하여 `linux/arm64`, `linux/amd64` 멀티 아키텍처로 Docker 이미지를 병렬 빌드 후 ECR에 푸시
- **Helm Update 빌드 트리거 (Build Chains)**: 빌드가 끝난 후 JSON Payload에 서비스명(`SERVICE_NAME`), 이미지 태그(`TAG`), 브랜치명 등을 담아 TeamCity API를 통해 `Helm Update` 빌드로 POST 요청을 보내 비동기 트리거
- **상태별 디스코드 연동**: 빌드 시작 전(`STARTED`)과 완료 후(`SUCCESS` / `FAILURE`)의 상태, 소요 시간, 결과 등 업데이트 내용을 디스코드 웹훅(Embed)으로 팀 채널에 전송
  ![build](/images/infrastructure/teamcity/03_teamcity.png?w=50%)

### 3.3. GitOps 배포 연동 및 알림 (CD)

- **Helm Values 다중 자동 갱신**: 운영 체계 동기화를 위해, `303-goormgb-k8s-helm` 저장소를 체크아웃 후 `apps`뿐 아니라 부하테스트용 `apps-loadtest` 경로의 `values.yaml` 파일 내 `tag`값을 동시에 새 이미지 태그로 갱신하여 커밋
- **완벽한 FIFO 충돌 방지**: Git 커밋 충돌 방지와 재시도를 최대 3번(rebase) 진행하며, 특히 TeamCity 설정 단에서 동시 실행을 차단(`maxRunningBuilds = 1`)하여 여러 서비스의 빌드가 동시에 끝나더라도 철저히 순차적(FIFO)으로 GitOps 갱신을 보장
- **디스코드 연동**: 어떤 대상 서비스가 해당 환경(`ca-staging` 등)에서 업데이트 성공(초록) 및 실패(빨강) 했는지 디스코드 웹훅으로 임베드 전송
  ![helm](/images/infrastructure/teamcity/04_teamcity.png?w=60%)

---
