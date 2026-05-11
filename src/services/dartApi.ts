// DART Open API — 공시/뉴스 수집
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { NewsItem } from '../types/theme';

const DART_BASE = 'https://opendart.fss.or.kr/api';

function makeMockNews(count = 5): NewsItem[] {
  const titles = [
    'HBM 수요 급증으로 반도체 업종 주목',
    '2차전지 소재 기업 영업이익 신기록',
    '정부 바이오 R&D 지원 확대 발표',
    '자동차 수출 실적 사상 최대 달성',
    '게임사 신작 흥행으로 주가 급등',
  ];
  return titles.slice(0, count).map((title, i) => ({
    id: `mock_${i}`,
    title,
    url: '',
    publishedAt: new Date().toISOString(),
  }));
}

export async function fetchRecentNews(
  corpCode?: string,
  count = 20
): Promise<NewsItem[]> {
  try {
    const apiKey = await SecureStore.getItemAsync('DART_API_KEY');
    if (!apiKey) return makeMockNews(count);

    const params: Record<string, any> = {
      crtfc_key: apiKey,
      sort: 'date',
      sort_mth: 'desc',
      page_no: 1,
      page_count: count,
    };
    if (corpCode) params.corp_code = corpCode;

    const res = await axios.get(`${DART_BASE}/search.json`, { params, timeout: 10000 });
    const items: NewsItem[] = (res.data.list ?? []).map((d: any) => ({
      id: d.rcept_no,
      title: d.report_nm,
      url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}`,
      publishedAt: d.rcept_dt,
      corpCode: d.corp_code,
      corpName: d.corp_name,
    }));
    return items.length > 0 ? items : makeMockNews(count);
  } catch {
    return makeMockNews(count);
  }
}
