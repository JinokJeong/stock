// HTS 스타일 캔들차트 — TradingView Lightweight Charts (WebView)
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { kisApi, ChartPeriod, ChartCandle } from '../../services/kisApi';
import { colors } from '../../theme/colors';

interface Props {
  code: string;
  height?: number;
}

// ─── WebView 내부 HTML ────────────────────────────────────────────────────────
const CHART_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;-webkit-user-select:none}
html,body{background:#0d1117;overflow:hidden;width:100vw;height:100vh;font-family:-apple-system,sans-serif}
#wrap{display:flex;flex-direction:column;width:100vw;height:100vh}
#tf{display:flex;align-items:center;gap:2px;padding:5px 8px;background:#161b22;flex-shrink:0}
.tb{color:#6e7681;background:none;border:1px solid transparent;border-radius:4px;padding:3px 8px;font-size:12px;cursor:pointer;-webkit-appearance:none}
.tb.on{color:#58a6ff;border-color:#388bfd55;background:#388bfd18}
#leg{display:flex;gap:10px;padding:3px 8px;background:#0d1117;flex-shrink:0}
.lg{font-size:10px;font-weight:700}
#mc{flex:none}
#vc{flex:none}
#ld{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0d1117;z-index:99}
#err{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#0d1117;color:#6e7681;font-size:13px;z-index:99}
.sp{width:28px;height:28px;border:2px solid #21262d;border-top-color:#58a6ff;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div id="wrap">
  <div id="tf">
    <button class="tb" onclick="onTf(this,'30m')">30분</button>
    <button class="tb on" onclick="onTf(this,'D')">일</button>
    <button class="tb" onclick="onTf(this,'W')">주</button>
    <button class="tb" onclick="onTf(this,'M')">월</button>
    <button class="tb" onclick="onTf(this,'Y')">년</button>
  </div>
  <div id="leg">
    <span class="lg" style="color:#f59e0b">MA5</span>
    <span class="lg" style="color:#22c55e">MA10</span>
    <span class="lg" style="color:#a78bfa">MA20</span>
    <span class="lg" style="color:#94a3b8" id="lv"></span>
  </div>
  <div id="mc"></div>
  <div id="vc"></div>
</div>
<div id="ld"><div class="sp"></div></div>
<div id="err">차트 라이브러리 로드 실패<br>인터넷 연결을 확인하세요</div>

<script src="https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js"
  onerror="showErr()"></script>
<script>
var UP='#ef4444',DN='#3b82f6',BG='#0d1117',GR='#21262d',TX='#6e7681',BD='#30363d';
var mc,vc,cs,m5,m10,m20,vs;

function showErr(){
  document.getElementById('ld').style.display='none';
  document.getElementById('err').style.display='flex';
}

function initCharts(){
  var w=window.innerWidth;
  var tot=window.innerHeight-document.getElementById('tf').offsetHeight-document.getElementById('leg').offsetHeight;
  var mh=Math.round(tot*0.70), vh=Math.round(tot*0.30);
  document.getElementById('mc').style.height=mh+'px';
  document.getElementById('vc').style.height=vh+'px';

  var base={
    layout:{background:{color:BG},textColor:TX},
    grid:{vertLines:{color:GR},horzLines:{color:GR}},
    crosshair:{mode:LightweightCharts.CrosshairMode.Normal},
    rightPriceScale:{borderColor:BD},
    timeScale:{borderColor:BD,timeVisible:true,secondsVisible:false,rightOffset:5},
    handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true},
    handleScale:{axisPressedMouseMove:false,mouseWheel:true,pinch:true}
  };

  mc=LightweightCharts.createChart(document.getElementById('mc'),Object.assign({},base,{width:w,height:mh}));
  vc=LightweightCharts.createChart(document.getElementById('vc'),Object.assign({},base,{
    width:w,height:vh,
    rightPriceScale:{borderColor:BD,scaleMargins:{top:0.1,bottom:0}},
    crosshair:{mode:LightweightCharts.CrosshairMode.Normal}
  }));

  cs=mc.addCandlestickSeries({upColor:UP,downColor:DN,borderUpColor:UP,borderDownColor:DN,wickUpColor:UP,wickDownColor:DN});
  m5 =mc.addLineSeries({color:'#f59e0b',lineWidth:1,lastValueVisible:false,priceLineVisible:false});
  m10=mc.addLineSeries({color:'#22c55e',lineWidth:1,lastValueVisible:false,priceLineVisible:false});
  m20=mc.addLineSeries({color:'#a78bfa',lineWidth:1,lastValueVisible:false,priceLineVisible:false});
  vs =vc.addHistogramSeries({priceFormat:{type:'volume'}});

  // 크로스헤어 거래량 표시
  vc.subscribeCrosshairMove(function(p){
    if(p.seriesData&&p.seriesData.size>0){
      var d=p.seriesData.get(vs);
      if(d) document.getElementById('lv').textContent='Vol '+(d.value/10000).toFixed(0)+'만';
    }
  });

  // 타임스케일 동기화
  var lk=false;
  mc.timeScale().subscribeVisibleLogicalRangeChange(function(r){
    if(lk||!r)return;lk=true;vc.timeScale().setVisibleLogicalRange(r);lk=false;
  });
  vc.timeScale().subscribeVisibleLogicalRangeChange(function(r){
    if(lk||!r)return;lk=true;mc.timeScale().setVisibleLogicalRange(r);lk=false;
  });

  window.addEventListener('resize',function(){
    var ww=window.innerWidth;
    var tot2=window.innerHeight-document.getElementById('tf').offsetHeight-document.getElementById('leg').offsetHeight;
    var mh2=Math.round(tot2*0.70),vh2=Math.round(tot2*0.30);
    document.getElementById('mc').style.height=mh2+'px';
    document.getElementById('vc').style.height=vh2+'px';
    mc.resize(ww,mh2);vc.resize(ww,vh2);
  });
}

function ma(data,n){
  var r=[];
  for(var i=n-1;i<data.length;i++){
    var s=0;for(var j=i-n+1;j<=i;j++)s+=data[j].close;
    r.push({time:data[i].time,value:+(s/n).toFixed(2)});
  }
  return r;
}

function setData(candles){
  if(!candles||!candles.length)return;
  document.getElementById('ld').style.display='none';
  cs.setData(candles);
  m5.setData(ma(candles,5));
  m10.setData(ma(candles,10));
  m20.setData(ma(candles,20));
  vs.setData(candles.map(function(c){
    return{time:c.time,value:c.volume||0,color:c.close>=c.open?UP+'aa':DN+'aa'};
  }));
  mc.timeScale().fitContent();
  vc.timeScale().fitContent();
}

function onTf(btn,tf){
  document.querySelectorAll('.tb').forEach(function(b){b.classList.remove('on')});
  btn.classList.add('on');
  document.getElementById('ld').style.display='flex';
  try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'tfChange',tf:tf}));}catch(e){}
}

function handleMsg(e){
  try{var m=JSON.parse(e.data);if(m.type==='setData')setData(m.candles);}catch(x){}
}
document.addEventListener('message',handleMsg);
window.addEventListener('message',handleMsg);

function tryInit(){
  if(typeof LightweightCharts==='undefined'){setTimeout(tryInit,100);return;}
  initCharts();
  try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));}catch(e){}
}
// 5초 안에 라이브러리 로드 안되면 에러
setTimeout(function(){if(typeof LightweightCharts==='undefined')showErr();},5000);
tryInit();
</script>
</body>
</html>`;

// ─── React Native 컴포넌트 ───────────────────────────────────────────────────

export function TradingChart({ code, height = 440 }: Props) {
  const webViewRef  = useRef<WebView>(null);
  const readyRef    = useRef(false);
  const pendingRef  = useRef<ChartCandle[] | null>(null);
  const tfRef       = useRef<ChartPeriod>('D');
  const [loading, setLoading] = useState(true);
  const [webErr,  setWebErr]  = useState(false);

  const sendToChart = useCallback((candles: ChartCandle[]) => {
    if (!webViewRef.current || !readyRef.current) {
      pendingRef.current = candles;
      return;
    }
    const json = JSON.stringify(candles);
    webViewRef.current.injectJavaScript(`setData(${json}); true;`);
  }, []);

  const loadData = useCallback(async (tf: ChartPeriod) => {
    try {
      const candles = await kisApi.getCandlesForChart(code, tf);
      sendToChart(candles);
    } catch {
      // 데이터 없으면 빈 차트 유지
    } finally {
      setLoading(false);
    }
  }, [code, sendToChart]);

  // code 변경 시 데이터 재로드
  useEffect(() => {
    if (!readyRef.current) return;
    setLoading(true);
    loadData(tfRef.current);
  }, [code, loadData]);

  const onMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') {
        readyRef.current = true;
        if (pendingRef.current) {
          sendToChart(pendingRef.current);
          pendingRef.current = null;
        } else {
          loadData(tfRef.current);
        }
      } else if (msg.type === 'tfChange') {
        tfRef.current = msg.tf as ChartPeriod;
        setLoading(true);
        loadData(msg.tf);
      }
    } catch { /* ignore parse errors */ }
  }, [loadData, sendToChart]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html: CHART_HTML }}
        originWhitelist={['*']}
        scrollEnabled={false}
        onMessage={onMessage}
        onError={() => setWebErr(true)}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="compatibility"
        style={styles.webview}
      />
      {loading && !webErr && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      )}
      {webErr && (
        <View style={styles.overlay}>
          <Text style={styles.errText}>WebView 로드 실패</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  webview: { flex: 1, backgroundColor: '#0d1117' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d1117aa',
  },
  errText: { color: colors.text3, fontSize: 13 },
});
