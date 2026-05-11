# SIGINT

한국 주식 복합 신호 분석 + 종목 추천 안드로이드 앱.  
백엔드 서버 없이 React Native 단독으로 동작하며, AI 분석은 기기 내 LLM으로 처리한다.

---

## 핵심 기능

| 탭 | 기능 |
|----|------|
| 대시보드 | 관심 종목 실시간 체결강도 · 투자자별 가집계 · PER/PBR/P/FCR 밸류에이션 |
| 추천 종목 | 코스피200 + 코스닥150 전체 스캔 → 수급·밸류·모멘텀 복합 스코어 순 정렬 |
| 테마 감지 | 업종 지수 z-score + LLM 뉴스 감성 결합 → 테마 등급(관심/주목/급부상/과열) |
| 알림 빌더 | 7가지 프리셋 + AND/OR 직접 조합 → 로컬 푸시 알림 |
| 설정 | KIS/DART API 키 입력 · LLM 모델 다운로드 상태 |

---

## 아키텍처

```
┌──────────────────────────────────────────┐
│           Android App (React Native)     │
│                                          │
│  ┌─────────────┐   ┌──────────────────┐ │
│  │  KIS API    │   │  On-Device LLM   │ │
│  │  REST / WS  │   │  llama.rn        │ │
│  └─────────────┘   │  Gemma 3 1B GGUF │ │
│                    └──────────────────┘ │
│  ┌─────────────┐   ┌──────────────────┐ │
│  │  DART API   │   │  로컬 알림       │ │
│  │  뉴스 수집  │   │  @notifee        │ │
│  └─────────────┘   └──────────────────┘ │
│                                          │
│  Zustand (전역 상태)                     │
│  AsyncStorage (재무지표·히스토리 캐시)   │
│  expo-secure-store (API 키 암호화)       │
└──────────────────────────────────────────┘
```

**서버리스 원칙**: 모든 연산(API 호출, AI 추론, 알림 판정)이 앱 내에서 완결된다.

---

## 프로젝트 구조

```
src/
├── types/
│   ├── stock.ts          # StockData, RealtimeQuote 등
│   ├── theme.ts          # ThemeScore, NewsItem, SentimentResult
│   ├── alert.ts          # AlertCondition, AlertPreset, UserAlert
│   ├── screener.ts       # RecommendStock, ScoreBreakdown, ScreenerState
│   └── llm.ts            # LlmStatus, LlmState
│
├── constants/
│   ├── stockUniverse.ts  # 코스피200 + 코스닥150 종목 코드 (350개)
│   └── alertPresets.ts   # 7가지 복합 신호 프리셋 정의
│
├── services/
│   ├── kisApi.ts         # KIS REST — 현재가 / 재무지표 / 업종 / 가집계
│   ├── kisWebSocket.ts   # KIS 실시간 체결 WebSocket (자동 재연결)
│   ├── dartApi.ts        # DART 공시 뉴스 수집
│   ├── llmService.ts     # llama.rn 래퍼 — 다운로드 / 로드 / 추론
│   ├── themeScorer.ts    # 테마 스코어 계산 (z-score 기반)
│   ├── alertEngine.ts    # 복합 조건 판정 + Notifee 알림 발송
│   └── screenerService.ts# 전체 종목 배치 스캔 + 스코어 계산
│
├── store/                # Zustand 전역 상태
│   ├── stockStore.ts     # 관심 종목 · 실시간 시세
│   ├── themeStore.ts     # 테마 스코어 · 뉴스
│   ├── alertStore.ts     # 알림 조건 목록
│   ├── screenerStore.ts  # 스크리너 결과 · 진행률
│   └── llmStore.ts       # LLM 로드 상태
│
├── hooks/
│   ├── useRealTimePrice.ts  # KIS WS 구독 → 스토어 업데이트
│   ├── useThemeAnalysis.ts  # 5분 주기 뉴스 + LLM 분석
│   ├── useAlertBuilder.ts   # 알림 빌더 편집 상태
│   ├── useScreener.ts       # 스크리너 실행 · 정렬 · 필터
│   └── useLlmModel.ts       # 모델 다운로드 → 로드 흐름
│
├── screens/
│   ├── DashboardScreen.tsx      # 관심 종목 리스트
│   ├── RecommendScreen.tsx      # 스크리너 결과 + 프리셋 선택
│   ├── ThemeScreen.tsx          # 업종 스코어 + 뉴스 피드
│   ├── AlertBuilderScreen.tsx   # 프리셋 선택 · 조건 편집 · 내 알림
│   ├── SettingsScreen.tsx       # API 키 입력 · 모델 상태
│   └── StockDetailScreen.tsx    # 캔들차트 · 밸류에이션 · 투자자 · AI 코멘트
│
├── components/
│   ├── common/     KpiCard · GaugeBar · ValuationBar · InvestorBar · NewsItem
│   ├── chart/      CandleChart
│   ├── theme/      ThemeCard · SectorBar
│   ├── alert/      ConditionCard · OpConnector · PresetButton
│   ├── recommend/  StockScoreCard · ScoreBreakdown · PresetFilter · ScanProgress
│   └── llm/        ModelDownloader · AiInsightBox
│
├── navigation/
│   └── index.tsx   # BottomTab 5개 + StockDetail Stack (modal)
│
└── theme/
    └── colors.ts   # 다크 테마 색상 토큰
```

---

## 종목 추천 스코어 (100점 만점)

```
수급  40점 │ 외국인 연속 순매수(최대 20) · 기관 순매수(10) · 체결강도(최대 10)
밸류  35점 │ PBR 섹터 대비(최대 15) · PER(최대 10) · P/FCR(최대 10)
모멘텀 25점│ 거래량 급증(최대 10) · 업종지수 상승(최대 10) · 테마 등급(5)
```

---

## 알림 프리셋 7종

| 프리셋 | 핵심 조건 | 신뢰도 |
|--------|-----------|--------|
| 스마트머니 집결 | 외국인 3일 연속 + 기관 순매수 + 저PBR | ★★★★★ |
| 가치 바닥 전환 | PER·PBR·P/FCR 동시 저평가 + 외국인 전환 | ★★★★★ |
| 기관 선행 매수 | 기관 3일 연속 + 저PBR + 체결강도 110↑ | ★★★★ |
| 모멘텀 폭발 | 체결강도 140↑ + 거래량 2배 + 외국인 매수 | ★★★★ |
| 고점 돌파 확인 | 체결강도 130↑ + 거래량 1.8배 + KOSPI 아웃퍼폼 | ★★★★ |
| 테마 초입 포착 | 업종 2%↑ + 체결강도 120↑ + 거래량 1.5배 | ★★★ |
| 과매도 반등 | 5일 낙폭 -5% + 저PBR + 외국인 전환 매수 | ★★★ |

---

## 온디바이스 LLM

| 항목 | 내용 |
|------|------|
| 모델 | Qwen2.5 0.5B Instruct Q4_K_M (GGUF) |
| 크기 | ~380MB (앱 번들 미포함, 설정 화면에서 Wi-Fi 다운로드) |
| 추론 속도 | 5~15 토큰/초 (RAM 4GB 이상 권장) |
| 역할 | 뉴스 감성 분석 → `{sentiment, urgency, summary}` JSON 출력 |
|      | 종목 AI 코멘트 → 한 문장 자연어 생성 |
| 제약 | Expo Go 불가, Dev Build(`npx expo run:android`) 전용 |

---

## 외부 API

### KIS Open API
- 발급: [https://apiportal.koreainvestment.com](https://apiportal.koreainvestment.com)
- 사용: 현재가, 체결강도, 투자자별 가집계, PER/PBR, 업종지수, FCF
- 인증: Access Token 6시간 캐시 → 자동 갱신

### DART Open API
- 발급: [https://opendart.fss.or.kr](https://opendart.fss.or.kr)
- 사용: 최신 공시 뉴스 수집 (테마 감성 분석 소스)

> API 키 없이도 **Mock 데이터**로 전체 UI가 정상 동작한다.  
> 키는 설정 화면에서 입력하며 `expo-secure-store`에 암호화 저장된다.

---

## 캐시 전략

| 데이터 | 갱신 주기 | 저장소 |
|--------|-----------|--------|
| 재무지표 (PER/PBR/P/FCR) | 하루 1회 | AsyncStorage |
| 업종 평균 (비교 기준값) | 하루 1회 | AsyncStorage |
| 업종 변화율 히스토리 | 누적 최대 20일 | AsyncStorage |
| 실시간 체결 · 거래량 | 스캔 시 직접 조회 | — |
| KIS Access Token | 6시간 | AsyncStorage |
| API 키 | 영구 | expo-secure-store |

---

## 빌드

```bash
# 의존성 설치
npm install

# Android 네이티브 폴더 생성 (최초 1회)
npx expo prebuild --platform android

# Dev Build 실행 (에뮬레이터 또는 USB 기기)
npx expo run:android
```

### 환경 요구사항

| 항목 | 권장 버전 |
|------|-----------|
| Node.js | 20 LTS 또는 22 LTS |
| JDK | 17 (Amazon Corretto 17) |
| Android SDK | compileSdk 36 / targetSdk 35 / minSdk 26 |
| Android Studio | Hedgehog 이상 |

> **주의**: `llama.rn`과 `@notifee/react-native`는 네이티브 모듈이므로 **Expo Go에서 실행 불가**.

---

## 기술 스택

| 영역 | 라이브러리 |
|------|-----------|
| 프레임워크 | React Native 0.81 · Expo 54 |
| AI 추론 | llama.rn 0.12 · Qwen2.5 0.5B Instruct GGUF |
| 상태 관리 | Zustand 5 |
| 네비게이션 | React Navigation 7 (Stack + BottomTab) |
| 알림 | @notifee/react-native 9 |
| 파일 I/O | react-native-fs |
| HTTP | axios |
| 보안 저장소 | expo-secure-store |
| 타입 | TypeScript 5.9 strict mode |
