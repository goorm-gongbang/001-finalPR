## 1. 개요

### 1.1 목적

> 본 가이드는 국제 표준(OWASP) 및 국내 표준(KISA)을 기반으로, 
프로젝트에서 사용될 **기술 스택(Java/Spring Boot, Python/FastAPI, Next.js)**에 따라
개발자가 즉시 참고할 수 있는 보안 코딩 가이드를 제공하여 
발생할 수 있는 보안 약점을 사전에 제거하는 것을 목적으로 합니다.
> 

### 1.2 적용 대상

- **Backend**: Java 21, Spring Boot 4.0.2 (JPA, QueryDSL, Spring Security)
- **AI Service**: Python 3.12, FastAPI (LangChain, PyTorch)
- **Frontend**: Next.js 16 (React)
- **DB/Infra**: PostgreSQL, Redis, AWS EKS

### 1.3 공통 보안 원칙

<aside>

1. **모든 입력값 검증**: 프론트엔드 검증은 우회가 가능하므로, 백엔드에서 반드시 2차 검증을 수행한다.
2. **민감 정보 하드코딩 금지**: API Key, DB Password 등은 코드에 포함하지 않고 환경 변수(`.env`) 또는 Secrets Manager를 사용한다.
3. **에러 메시지 최소화**: 실운영 환경에서 Stack Trace를 노출하지 않는다.
</aside>

---

## 2. Java / Spring Boot 보안 가이드

### 2.1 SQL Injection 방지 (JPA/QueryDSL)

**원칙**: 동적 쿼리 작성 시 문자열 연결(`+`)을 절대 금지하며, Parameter Binding 기능을 제공하는 JPA/QueryDSL 메서드만 사용합니다.

```java
// [BAD] 문자열 연결 (절대 금지)
String query = "SELECT * FROM Member WHERE name = '" + inputName + "'";

// [GOOD] JPA Repository (자동 바인딩)
Optional<Member> findByName(String name);

// [GOOD] QueryDSL (자동 바인딩)
queryFactory.selectFrom(member)
    .where(member.name.eq(inputName))
    .fetch();
```

### 2.2 인증 및 권한 (Authentication)

**원칙**: 비밀번호는 단방향 해시(BCrypt)로 저장하고, JWT 검증 시 서명 확인을 필수로 수행합니다.

**[비밀번호 암호화]**

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(); // 기본 강도 10 이상 권장
}
```

**[JWT 서명 검증]**

```java
// jjwt 라이브러리 사용 시 verifyWith() 필수
Jwts.parser()
    .verifyWith(secretKey)
    .build()
    .parseSignedClaims(token);
```

### 2.3 동시성 제어 (Concurrency)

**원칙**: 분산 환경(Scale-out)에서는 Java `synchronized`가 동작하지 않으므로, Redis 분산 락(Distributed Lock)을 사용합니다.

```java
// [GOOD] Redisson Distributed Lock
RLock lock = redissonClient.getLock("stockBox");
try {
    if (lock.tryLock(1, 3, TimeUnit.SECONDS)) {
        // 재고 감소 로직
    }
} finally {
    lock.unlock();
}
```

### 2.4 로깅 보안 (Log Masking)

**원칙**: 로그 파일에 개인정보(주민번호, 전화번호 등)가 평문으로 남지 않도록 Logback 마스킹 패턴을 적용합니다.

```xml
<!-- logback-spring.xml -->
<replace pattern="(\\d{6}-?)\\d{7}">$1*******</replace>
```

---

## 3. Python / FastAPI (AI Service) 보안 가이드

### 3.1 Injection 방지 (SQL & Prompt)

**원칙**: DB 쿼리는 ORM을 사용하고, LLM 프롬프트는 템플릿 변수로 처리하여 Injection을 방지합니다.

**[SQL Injection 방지]**

```python
# [BAD] f-string 사용
query = f"SELECT * FROM users WHERE id = {user_id}"

# [GOOD] SQLAlchemy ORM
stmt = select(User).where(User.id == user_id)
result = await session.execute(stmt)
```

**[Prompt Injection 방지]**

```python
# [GOOD] Prompt Template 사용
from langchain.prompts import PromptTemplate
template = "Translate the following text to English: {user_input}"
prompt = PromptTemplate(input_variables=["user_input"], template=template)
```

### 3.2 안전하지 않은 Deserialization (Pickle 금지)

**원칙**: `pickle`은 임의 코드 실행 위험이 있으므로, 신뢰할 수 없는 데이터 로드 시 절대 사용하지 않습니다.

```python
# [BAD] 절대 금지
import pickle
data = pickle.loads(untrusted_payload)

# [GOOD] JSON 또는 Safetensors 사용
import json
data = json.loads(trusted_payload)
```

### 3.3 속도 제한 (Rate Limiting)

**원칙**: AI 모델 추론과 같이 리소스 소모가 큰 API는 `SlowAPI` 등을 사용하여 요청 횟수를 제한합니다.

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/generate")
@limiter.limit("5/minute")
async def generate_image(request: Request):
    return {"image": ...}
```

### 3.4 의존성 취약점 점검

**원칙**: `pip-audit`을 사용하여 설치된 패키지의 CVE를 주기적으로 확인합니다.

```bash
pip install pip-audit
pip-audit
```

---

## 4. Frontend (Next.js) 보안 가이드

### 4.1 XSS (Cross-Site Scripting) 방지

**원칙**: 사용자 입력을 HTML로 렌더링해야 할 경우, 반드시 `DOMPurify`로 살균(Sanitize) 처리 합니다.

```tsx
import DOMPurify from 'dompurify';

// [BAD] 검증 없는 HTML 삽입
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// [GOOD] DOMPurify로 살균 후 삽입
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userContent) }} />
```

### 4.2 민감 정보 노출 방지

**원칙**: 브라우저로 전송되는 클라이언트 사이드 코드에는 어떠한 Secret Key도 포함되어서는 안 됩니다.

- `.env.local` 변수 중 `NEXT_PUBLIC_` 접두사가 없는 변수는 서버 사이드에서만 접근 가능합니다.

---

## 5. 자가 점검 체크리스트

| Category | Check Item | Action / Criteria |
| --- | --- | --- |
| **Java / Spring** | SQL Injection | QueryDSL/JPA 사용 여부 확인 |
|  | Password Auth | BCrypt 암호화 적용 여부 |
|  | JWT Validation | 서명(Signature) 검증 로직 포함 여부 |
|  | Concurrency | Redis Distributed Lock 사용 여부 (vs synchronized) |
|  | Logging | 주민번호 등 민감 정보 마스킹 처리 확인 |
| **Python / AI** | SQL Injection | SQLAlchemy ORM 사용 여부 |
|  | Deserialization | `pickle` 사용 금지 및 JSON/Safetensors 대체 확인 |
|  | Rate Limiting | `SlowAPI` 등을 통한 API 속도 제한 적용 여부 |
|  | Dependency | `pip-audit`을 통한 취약점 점검 수행 |
| **Frontend / Common** | XSS Prevention | `dangerouslySetInnerHTML` 사용 시 `DOMPurify` 적용 필 |
|  | Secret Management | `.env` 사용 및 Git 업로드 제외 확인 |

---

### 6. 참고 표준 (Reference)

- [KISA 소프트웨어 개발보안 가이드 (2021)](https://drive.google.com/file/d/167jVWpnK-1wmj0-aI420fahpfr-fWux7/view?usp=sharing)
- [CWE (Common Weakness Enumeration) Top 25 (2023)](https://cwe.mitre.org/top25/archive/2023/2023_cwe_top25.html)
- [OWASP Top 10 (2025)](https://owasp.org/Top10/)
