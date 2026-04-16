# Kafka · Caffeine 캐싱

PlayBall은 서비스 간 비동기 메시징으로 **Apache Kafka 3.7.1**을 사용하며, DB 부하를 흡수하기 위해 **Caffeine** 로컬 캐시와 **Redis** 분산 캐시를 계층적으로 활용합니다.

상세 내용은 [시스템 아키텍처](/development/system-architecture), [Redis 구성](/development/redis), [성능 최적화](/development/performance-optimization) 문서를 참조하세요.
