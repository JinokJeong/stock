// 복합 조건 판정 + Notifee 로컬 알림 발송
import { AlertCondition, LogicOperator } from '../types/alert';
import { StockData } from '../types/stock';

let notifee: any = null;
let AndroidImportance: any = null;

async function getNotifee() {
  if (notifee) return { notifee, AndroidImportance };
  try {
    const mod = require('@notifee/react-native');
    notifee = mod.default;
    AndroidImportance = mod.AndroidImportance;
  } catch {}
  return { notifee, AndroidImportance };
}

export async function sendLocalAlert(title: string, body: string): Promise<void> {
  const { notifee: n, AndroidImportance: AI } = await getNotifee();
  if (!n) return;
  try {
    const channelId = await n.createChannel({
      id: 'sigint_alerts',
      name: 'SIGINT 신호 알림',
      importance: AI?.HIGH ?? 4,
    });
    await n.displayNotification({
      title,
      body,
      android: { channelId, pressAction: { id: 'default' } },
    });
  } catch {}
}

function checkCondition(c: AlertCondition, d: StockData): boolean {
  switch (c.type) {
    case '체결강도':
      return d.tradeStrength >= (c.value ?? 100);

    case '외국인순매수':
      if (c.op === 'turn_positive') return d.foreignTurnedPositive;
      if (c.op === 'consecutive')   return d.foreignConsecutiveDays >= (c.days ?? 1);
      return d.foreignNetAmount > 0;

    case '기관순매수':
      if (c.op === 'consecutive') return d.institutionConsecutiveDays >= (c.days ?? 1);
      return d.institutionBuyAmount > 0;

    case 'PBR':
      if (c.op === 'lte_absolute')     return d.pbr !== undefined && d.pbr <= (c.value ?? 1);
      if (c.op === 'lte_sector_ratio') return d.pbr !== undefined && d.pbrSector !== undefined && d.pbr <= d.pbrSector * (c.ratio ?? 1);
      return false;

    case 'PER':
      if (c.op === 'lte_sector_ratio') return d.per !== undefined && d.perSector !== undefined && d.per <= d.perSector * (c.ratio ?? 1);
      return false;

    case 'P/FCR':
      if (c.op === 'lte_absolute')     return d.pfcr !== undefined && d.pfcr <= (c.value ?? 10);
      if (c.op === 'lte_sector_ratio') return d.pfcr !== undefined && d.pfcrSector !== undefined && d.pfcr <= d.pfcrSector * (c.ratio ?? 1);
      return false;

    case '거래량':
      if (c.op === 'gte_avg20_ratio') return d.avgVolume20 > 0 && d.volume >= d.avgVolume20 * (c.ratio ?? 1);
      if (c.op === 'gte_prev_ratio')  return d.prevVolume > 0 && d.volume >= d.prevVolume * (c.ratio ?? 1);
      return d.volume >= (c.value ?? 0);

    case '업종지수':
      if (c.op === 'outperform_kospi') return d.sectorChangeRate > d.kospiChange;
      if (c.op === 'lte_5day_drop')    return d.sector5dayChange <= (c.value ?? -5);
      return d.sectorChangeRate >= (c.value ?? 0);

    default:
      return false;
  }
}

export function evaluateConditions(
  conditions: AlertCondition[],
  logic: LogicOperator[],
  d: StockData
): boolean {
  if (conditions.length === 0) return false;
  return conditions.reduce<boolean>((acc, cur, i) => {
    const result = checkCondition(cur, d);
    if (i === 0) return result;
    return logic[i - 1] === 'AND' ? acc && result : acc || result;
  }, false);
}
