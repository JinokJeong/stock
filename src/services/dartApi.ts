// DART Open API — 공시/뉴스 수집
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { NewsItem } from '../types/theme';

const DART_BASE = 'https://opendart.fss.or.kr/api';

export async function fetchRecentNews(
  corpCode?: string,
  count = 20
): Promise<NewsItem[]> {
  const apiKey = await SecureStore.getItemAsync('DART_API_KEY');
  if (!apiKey) return []; // DART 키 없으면 빈 목록 반환

  const params: Record<string, any> = {
    crtfc_key: apiKey,
    sort: 'date',
    sort_mth: 'desc',
    page_no: 1,
    page_count: count,
  };
  if (corpCode) params.corp_code = corpCode;

  const res = await axios.get(`${DART_BASE}/search.json`, { params, timeout: 10000 });
  return (res.data.list ?? []).map((d: any) => ({
    id:          d.rcept_no as string,
    title:       d.report_nm as string,
    url:         `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${d.rcept_no}`,
    publishedAt: d.rcept_dt as string,
    corpCode:    d.corp_code as string,
    corpName:    d.corp_name as string,
  }));
}
