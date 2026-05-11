// 테마 분석 훅 — 뉴스 수집 + LLM 감성 분석 5분 주기 실행
import { useEffect, useRef, useCallback } from 'react';
import { fetchRecentNews } from '../services/dartApi';
import { analyzeNewsSentiment } from '../services/llmService';
import { calcThemeScore, getGrade } from '../services/themeScorer';
import { useThemeStore } from '../store/themeStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeScore } from '../types/theme';

const HISTORY_KEY_PREFIX = 'SECTOR_HISTORY_';
const INTERVAL_MS = 5 * 60 * 1000;

async function getSectorHistory(sectorCode: string): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(`${HISTORY_KEY_PREFIX}${sectorCode}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function appendSectorHistory(sectorCode: string, rate: number): Promise<void> {
  try {
    const history = await getSectorHistory(sectorCode);
    const next = [...history.slice(-19), rate];
    await AsyncStorage.setItem(`${HISTORY_KEY_PREFIX}${sectorCode}`, JSON.stringify(next));
  } catch {}
}

export function useThemeAnalysis() {
  const { setThemes, setNews, setAnalyzing, themes, isAnalyzing } = useThemeStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runAnalysis = useCallback(async () => {
    if (isAnalyzing) return;
    setAnalyzing(true);
    try {
      const news = await fetchRecentNews(undefined, 20);
      setNews(news);

      const sectorMap: Record<string, { rates: number[]; sentiments: number[]; urgencies: number[]; newsCount: number }> = {};

      for (const item of news) {
        const result = await analyzeNewsSentiment(item.title);
        const sectorCode = '0001'; // 실제 구현 시 종목→업종 매핑 필요
        if (!sectorMap[sectorCode]) {
          sectorMap[sectorCode] = { rates: [], sentiments: [], urgencies: [], newsCount: 0 };
        }
        sectorMap[sectorCode].sentiments.push(result.sentiment);
        sectorMap[sectorCode].urgencies.push(result.urgency);
        sectorMap[sectorCode].newsCount++;
      }

      const scored: ThemeScore[] = [];
      for (const [sectorCode, data] of Object.entries(sectorMap)) {
        const rate = 1.5;
        const history = await getSectorHistory(sectorCode);
        await appendSectorHistory(sectorCode, rate);
        const avgSentiment = data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length;
        const avgUrgency = data.urgencies.reduce((a, b) => a + b, 0) / data.urgencies.length;
        const score = calcThemeScore(rate, history, avgSentiment, avgUrgency);
        scored.push({
          sectorCode,
          sectorName: '전기전자',
          score,
          grade: getGrade(score),
          quantScore: score * 0.6,
          qualScore: score * 0.4,
          sectorChangeRate: rate,
          newsCount: data.newsCount,
          updatedAt: Date.now(),
        });
      }

      setThemes(scored.sort((a, b) => b.score - a.score));
    } catch {}
    setAnalyzing(false);
  }, [isAnalyzing]);

  useEffect(() => {
    runAnalysis();
    timerRef.current = setInterval(runAnalysis, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { themes, isAnalyzing, refresh: runAnalysis };
}
