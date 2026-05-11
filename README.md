# SIGINT — 한국 주식 복합 신호 분석 앱

백엔드 서버 없이 React Native 단독으로 동작하는 한국 주식 분석 + 종목 추천 안드로이드 앱.

## 주요 기능

| 기능 | 설명 |
|------|------|
| 실시간 대시보드 | 체결강도 · 거래량 · 투자자별 가집계 · PER/PBR/P/FCR |
| 테마 감지 | KIS 업종지수 + DART 공시 → 온디바이스 LLM 감성분석 |
| 복합 신호 알림 | 7가지 프리셋 + AND/OR 직접 조합 · 로컬 푸시 |
| 종목 추천 스크리너 | 코스피200 + 코스닥150 전체 자동 필터링 + 스코어 순 정렬 |

## 빌드 방법

```bash
# 의존성 설치
npm install

# Dev Build (네이티브 모듈 필수 — Expo Go 불가)
npx expo run:android

# 릴리즈 APK
npx expo build:android --type apk
```

> **주의**: `llama.rn`, `@notifee/react-native` 는 네이티브 빌드 전용입니다.  
> Expo Go에서는 실행되지 않습니다.

## 온디바이스 LLM

- 모델: **Gemma 3 1B IT Q4_K_M** (~800MB GGUF)
- 첫 실행 시 Wi-Fi 환경에서 자동 다운로드
- 추론: 초당 5~15 토큰 (RAM 4GB 이상 권장)
- 역할: 뉴스 감성 분석 + 종목 AI 코멘트 (JSON 출력 전용)

## API 키 설정

설정 화면에서 입력 → 기기 내 보안 저장소(expo-secure-store) 에 암호화 저장.

| 키 | 발급처 |
|----|--------|
| KIS_APP_KEY / KIS_APP_SECRET | [KIS Open API](https://apiportal.koreainvestment.com) |
| DART_API_KEY | [DART 오픈API](https://opendart.fss.or.kr) |

**API 키 없이도 Mock 데이터로 UI 전체 동작합니다.**

## 스크리너 스코어 기준 (100점 만점)

| 부문 | 배점 | 주요 지표 |
|------|------|-----------|
| 수급 | 40점 | 외국인 연속 순매수 · 기관 순매수 · 체결강도 |
| 밸류 | 35점 | PBR · PER · P/FCR (섹터 평균 대비) |
| 모멘텀 | 25점 | 거래량 급증 · 업종지수 · 테마 등급 |

## 아키텍처

```
Android App (React Native)
├── KIS Open API (REST / WebSocket)
├── DART Open API (뉴스 수집)
├── llama.rn → Gemma 3 1B (온디바이스 추론)
├── @notifee/react-native (로컬 알림)
├── Zustand (전역 상태)
└── AsyncStorage (재무지표 캐시 · 히스토리)
```

## 프로젝트 구조

```
src/
├── constants/   alertPresets.ts · stockUniverse.ts
├── services/    kisApi · kisWebSocket · dartApi · llmService · themeScorer · alertEngine · screenerService
├── store/       stockStore · themeStore · alertStore · screenerStore · llmStore
├── hooks/       useRealTimePrice · useThemeAnalysis · useAlertBuilder · useScreener · useLlmModel
├── screens/     Dashboard · Recommend · Theme · AlertBuilder · Settings · StockDetail
├── components/  common/ · chart/ · theme/ · alert/ · recommend/ · llm/
├── navigation/  RootNavigation (BottomTab 5개 + Stack)
└── types/       stock · theme · alert · screener · llm
```
