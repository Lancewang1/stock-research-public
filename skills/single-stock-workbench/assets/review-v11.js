/* Dated fundamental review. Standalone, no network or framework dependency. */
(function (global) {
  'use strict';
  const mounted = new WeakMap();
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const num = (value, digits = 2) => finite(value) ? value.toLocaleString('en-US', {minimumFractionDigits: digits, maximumFractionDigits: digits}) : '未取得';
  const pct = value => finite(value) ? (value > 0 ? '+' : '') + num(value * 100) + '%' : '未取得';
  const points = value => finite(value) ? (value > 0 ? '+' : '') + num(value) + 'pp' : '未取得';
  const direction = value => !finite(value) || value === 0 ? '' : value > 0 ? 'rv11-up' : 'rv11-down';
  const shortDate = value => String(value || '').slice(5, 10).replace('-', '/');
  const safeURL = value => /^https?:\/\//i.test(String(value || '')) ? String(value) : null;
  const list = values => (values || []).map(value => '<li>' + esc(value) + '</li>').join('');
  const css = `
.rv11{color:var(--fg,#1c1e23);font:inherit;line-height:1.65;--rv11-accent:var(--accent,#415ccc)}
.rv11 *{box-sizing:border-box}.rv11 h2,.rv11 h3,.rv11 h4,.rv11 p{margin:0}.rv11 button{font:inherit}
.rv11 .rv11-head{padding:19px 21px;background:var(--panel,#fff);border:1px solid var(--line,#dedbd2);border-radius:12px}
.rv11 .rv11-kicker{color:var(--muted,#687080);font-size:12px;letter-spacing:.04em}.rv11 h2{font-size:20px;font-weight:750;margin:5px 0 10px}
.rv11 .rv11-summary{font-size:15px;line-height:1.85;max-width:1100px}.rv11 .rv11-meta{margin-top:12px;color:var(--muted,#687080);font-size:12px}
.rv11 .rv11-key-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}
.rv11 .rv11-stat{padding:12px 15px;background:var(--panel2,#f8f7f3);border:1px solid var(--line,#dedbd2);border-radius:9px}
.rv11 .rv11-stat strong{display:block;font-size:25px;font-variant-numeric:tabular-nums;line-height:1.3}.rv11 .rv11-stat small{color:var(--muted,#687080);font-size:12px}
.rv11 .rv11-controversies{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:15px 0 18px}
.rv11 .rv11-controversy{padding:15px;border:1px solid var(--line,#dedbd2);border-radius:10px;background:var(--panel,#fff);border-top:3px solid var(--rv11-accent)}
.rv11 .rv11-controversy h3{font-size:14px;margin-bottom:7px}.rv11 .rv11-controversy p{font-size:13px}.rv11 .rv11-test{margin-top:9px!important;color:var(--muted,#687080)}
.rv11 .rv11-chain-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin:15px 0 8px}.rv11 .rv11-chain-head h3{font-size:17px}.rv11 .rv11-chain-head span{font-size:12px;color:var(--muted,#687080)}
.rv11 .rv11-nav{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 17px}.rv11 .rv11-nav button,.rv11 .rv11-date{border:1px solid var(--line,#dedbd2);background:var(--panel,#fff);color:var(--fg,#1c1e23);cursor:pointer;border-radius:7px;padding:5px 10px}
.rv11 .rv11-nav button:hover,.rv11 .rv11-date:hover,.rv11 button[aria-pressed=true]{color:var(--rv11-accent);border-color:var(--rv11-accent);background:var(--panel2,#f8f7f3)}
.rv11 button:focus-visible,.rv11 summary:focus-visible,.rv11 a:focus-visible{outline:2px solid var(--rv11-accent);outline-offset:3px}
.rv11 .rv11-event{display:grid;grid-template-columns:100px minmax(0,1fr);gap:14px;margin-bottom:14px;scroll-margin-top:22px}
.rv11 .rv11-when{padding-top:14px;text-align:center}.rv11 .rv11-date{width:100%;font-size:16px;font-weight:700}.rv11 .rv11-session{display:block;font-size:11px;color:var(--muted,#687080);margin-top:5px}
.rv11 .rv11-event-body{border:1px solid var(--line,#dedbd2);border-radius:10px;background:var(--panel,#fff);padding:16px 18px;border-left:3px solid var(--line,#dedbd2)}
.rv11 .rv11-event.rv11-selected .rv11-event-body{border-left-color:var(--rv11-accent)}.rv11 .rv11-event h4{font-size:16px;line-height:1.5;margin-bottom:11px}
.rv11 .rv11-steps{display:grid;grid-template-columns:1fr 1fr;gap:18px}.rv11 .rv11-step-label{display:block;font-size:11px;font-weight:700;color:var(--rv11-accent);letter-spacing:.03em;margin-bottom:4px}.rv11 .rv11-steps p{font-size:13px}
.rv11 .rv11-market{margin-top:12px;padding:9px 11px;background:var(--panel2,#f8f7f3);border-radius:7px;display:flex;gap:8px 15px;align-items:baseline;flex-wrap:wrap;font-size:12px;font-variant-numeric:tabular-nums}
.rv11 .rv11-market b{font-weight:700}.rv11 .rv11-window{color:var(--muted,#687080)}.rv11 .rv11-up{color:var(--up,#b65045)}.rv11 .rv11-down{color:var(--down,#24836a)}
.rv11 .rv11-price-note{font-size:11px;color:var(--muted,#687080);margin:5px 0 0}.rv11 .rv11-brokers{margin-top:11px;font-size:12px}.rv11 .rv11-brokers ul{margin:4px 0 0;padding-left:17px}.rv11 .rv11-brokers li{margin:2px 0}
.rv11 details{border-top:1px solid var(--line,#dedbd2);margin-top:11px;padding-top:8px}.rv11 summary{cursor:pointer;color:var(--muted,#687080);font-size:12px}.rv11 summary:hover{color:var(--fg,#1c1e23)}
.rv11 .rv11-detail-body{font-size:12px;color:var(--muted,#687080);padding-top:9px}.rv11 .rv11-detail-body ul{margin:5px 0 10px;padding-left:18px}.rv11 .rv11-detail-body li{margin-bottom:5px}
.rv11 .rv11-source{padding:8px 0;border-top:1px dashed var(--line,#dedbd2);overflow-wrap:anywhere}.rv11 .rv11-source:first-child{border-top:0}.rv11 .rv11-source b{font-size:12px;color:var(--fg,#1c1e23)}.rv11 .rv11-source a{color:var(--rv11-accent);text-decoration:none}.rv11 .rv11-source a:hover{text-decoration:underline}.rv11 .rv11-source p{font-size:11px;margin-top:3px}
.rv11 .rv11-source-kind{display:inline-block;margin-left:5px;padding:1px 6px;background:var(--panel2,#f8f7f3);border-radius:4px;font-size:10px;color:var(--muted,#687080)}
.rv11 .rv11-section{border:1px solid var(--line,#dedbd2);border-radius:10px;background:var(--panel,#fff);padding:11px 16px;margin:12px 0}.rv11 .rv11-section>summary{font-size:14px;font-weight:650;color:var(--fg,#1c1e23)}
.rv11 .rv11-scroll{overflow-x:auto;max-width:100%;margin-top:12px}.rv11 table{width:100%;border-collapse:collapse;font-size:12px;line-height:1.6;text-align:left}.rv11 th,.rv11 td{padding:9px 10px;border-bottom:1px solid var(--line,#dedbd2);vertical-align:top}.rv11 th{font-size:11px;color:var(--muted,#687080);font-weight:650;background:var(--panel2,#f8f7f3);white-space:nowrap}.rv11 td.rv11-number{white-space:nowrap;font-variant-numeric:tabular-nums}
.rv11 .rv11-material{padding:10px 0;border-bottom:1px solid var(--line,#dedbd2)}.rv11 .rv11-material:last-child{border-bottom:0}.rv11 .rv11-material h4{font-size:13px;margin-bottom:5px}.rv11 .rv11-material h4 span{font-size:11px;font-weight:400;color:var(--muted,#687080);margin-left:9px}
.rv11 .rv11-foot{font-size:11px;color:var(--muted,#687080);padding:10px 2px}.rv11 .rv11-status{font-size:12px;color:var(--rv11-accent);min-height:1.5em}
@media(max-width:1000px){.rv11 .rv11-controversies{grid-template-columns:1fr}.rv11 .rv11-controversy{padding:12px 15px}.rv11 .rv11-event{grid-template-columns:82px minmax(0,1fr);gap:9px}.rv11 .rv11-steps{gap:13px}}
@media(max-width:680px){.rv11 .rv11-head{padding:15px}.rv11 h2{font-size:18px}.rv11 .rv11-key-stats{gap:6px}.rv11 .rv11-stat{padding:9px}.rv11 .rv11-stat strong{font-size:20px}.rv11 .rv11-stat small{font-size:10px}.rv11 .rv11-event{display:block}.rv11 .rv11-when{text-align:left;display:flex;align-items:center;gap:10px;padding:0 0 6px}.rv11 .rv11-date{width:auto;font-size:13px}.rv11 .rv11-session{margin:0}.rv11 .rv11-event-body{padding:13px}.rv11 .rv11-steps{grid-template-columns:1fr;gap:10px}.rv11 .rv11-chain-head{display:block}.rv11 .rv11-nav button{font-size:11px}.rv11 .rv11-section{padding:10px}.rv11 .rv11-market{gap:5px 11px}}
`;

  function render(container, data, options = {}) {
    if (!container || typeof container.innerHTML !== 'string') throw new TypeError('ReviewV11.render requires a DOM container');
    if (mounted.has(container)) mounted.get(container)();
    if (!data || !Array.isArray(data.events)) {
      container.innerHTML = '<div class="rv11">近期复盘资料尚未载入。</div>';
      return {destroy() { container.innerHTML = ''; }};
    }
    if (!document.getElementById('review-v11-style')) {
      const style = document.createElement('style');
      style.id = 'review-v11-style'; style.textContent = css; document.head.appendChild(style);
    }
    const sources = Object.fromEntries((data.sources || []).map(s => [s.id, s]));
    const kinds = {
      media_report:'媒体全文', media_reported_analyst:'媒体转述机构', company_release_republished:'公司新闻稿转载',
      company_filing:'公司披露', filing_index:'申报索引', broker_report_original:'卖方原件',
      user_supplied_sell_side_model:'本地卖方模型', unverified_transcript_excerpt:'待核对电话会摘录',
      unverified_expert_excerpt:'待核对专家摘录', market_api:'行情接口'
    };
    function sourceHTML(ref, role) {
      const source = sources[ref];
      if (!source) return '<div class="rv11-source">来源未取得：' + esc(ref) + '</div>';
      const url = safeURL(source.url);
      const title = url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(source.title) + ' ↗</a>' : esc(source.title);
      return '<div class="rv11-source"><b>' + title + '</b><span class="rv11-source-kind">' + esc(kinds[source.kind] || source.kind || '来源') + '</span><p>' + esc(role || '当时已发布') + ' · ' + esc(source.publishedAt || source.date || '日期待核对') + '</p><p>' + esc(source.file || '') + ' · ' + esc(source.page || (source.cells || []).join(' / ')) + '</p><p>' + esc(source.note || '') + '</p></div>';
    }
    function marketHTML(obs) {
      if (!obs) return '';
      const returns = obs.returns || {};
      const v = obs.volume;
      return '<div class="rv11-market"><span class="rv11-window">' + shortDate(obs.startDate) + ' → ' + shortDate(obs.endDate) + '</span>' + ['GOOGL','QQQ','XLC'].map(s => '<span>' + s + ' <b class="' + direction(returns[s]) + '">' + pct(returns[s]) + '</b></span>').join('') + (v ? '<span title="' + esc(v.baselineStart + '至' + v.baselineEnd + '，' + v.baselineSessions + '个交易日均量') + '">终点量比 <b>' + num(v.multiple) + '×</b></span>' : '') + '</div>';
    }
    function eventHTML(event, i) {
      const detail = (event.details || []).length + (event.sourceRefs || []).length + (event.verificationRefs || []).length + (event.supplementalRefs || []).length;
      return '<article class="rv11-event" data-event="' + esc(event.id) + '"><div class="rv11-when"><button type="button" class="rv11-date" data-focus="' + esc(event.id) + '" aria-pressed="false" title="定位 ' + esc(event.priceObservation.startDate + ' 至 ' + event.priceObservation.endDate) + ' 行情">' + shortDate(event.date) + '</button><span class="rv11-session">' + esc(event.session) + '</span></div><div class="rv11-event-body"><h4>' + esc(event.title) + '</h4><div class="rv11-steps"><div><span class="rv11-step-label">01 新增信息</span><p>' + esc(event.newInformation) + '</p></div><div><span class="rv11-step-label">02 预期发生什么变化</span><p>' + esc(event.expectationChange) + '</p></div></div><div><span class="rv11-step-label" style="margin-top:12px">03 首个可观察交易窗口</span>' + marketHTML(event.priceObservation) + (event.priceNote ? '<p class="rv11-price-note">' + esc(event.priceNote) + '</p>' : '') + '</div><div class="rv11-brokers"><span class="rv11-step-label">04 机构反应 · 盈利与估值</span><ul>' + list(event.brokerResponses) + '</ul></div>' + (detail ? '<details><summary>展开依据、原文定位与时点限制</summary><div class="rv11-detail-body">' + ((event.details || []).length ? '<ul>' + list(event.details) + '</ul>' : '') + (event.sourceRefs || []).map(ref => sourceHTML(ref, '当时已发布；不表示发布前已被市场知悉')).join('') + (event.verificationRefs || []).map(ref => sourceHTML(ref, '之后核验；不倒填成当时已知')).join('') + (event.supplementalRefs || []).map(ref => sourceHTML(ref, '补充摘录；发布时间/完整原文未验证')).join('') + '</div></details>' : '') + '</div></article>';
    }
    const keyWindows = [0,1,3].map(i => (data.windows || [])[i]).filter(Boolean);
    const statsHTML = keyWindows.map(w => '<div class="rv11-stat"><small>' + esc(w.label) + ' · ' + shortDate(w.startDate) + '–' + shortDate(w.endDate) + '</small><strong class="' + direction(w.returns.GOOGL) + '">' + pct(w.returns.GOOGL) + '</strong><small>GOOGL；相对QQQ ' + points(w.excessVsQQQPctPoints) + '</small></div>').join('');
    const controversyHTML = (data.controversies || []).map((c,i) => '<article class="rv11-controversy"><h3>' + (i+1) + ' · ' + esc(c.title) + '</h3><p>' + esc(c.evidence) + '</p><p class="rv11-test">验证：' + esc(c.test) + '</p></article>').join('');
    const expectationRows = (data.expectationComparisons || []).map(row => '<tr><td>' + esc(row.metric) + '</td><td>' + esc(row.forecastPublishedAt.slice(0,10)) + '<br><small>' + esc(row.sourceRefs.includes('review-zacks-preview') ? 'Zacks媒体样本' : 'Yahoo媒体样本') + '</small></td><td class="rv11-number">' + num(row.expectation,0) + '</td><td class="rv11-number">' + num(row.actual,0) + '</td><td class="rv11-number ' + direction(row.surprisePct) + '">' + pct(row.surprisePct / 100) + '</td></tr>').join('');
    const brokerRows = (data.brokerComparisons || []).map(row => '<tr><td><b>' + esc(row.broker) + '</b><br>' + esc(row.date) + '<br><small>' + esc(row.security) + '</small></td><td>' + esc(row.rating) + '<br>' + (finite(row.oldTarget) ? num(row.oldTarget,0) + ' → ' : '') + (finite(row.newTarget) ? num(row.newTarget,0) + ' USD' : '目标价未取得') + '</td><td>' + esc(row.view) + '<br>' + esc(row.earningsRevision) + '</td><td>' + esc(row.caveat) + '</td></tr>').join('');
    const windowRows = (data.windows || []).map(row => '<tr><td>' + esc(row.label) + '<br><small>' + esc(row.startDate + ' → ' + row.endDate) + '</small></td>' + ['GOOGL','QQQ','XLC'].map(s => '<td class="rv11-number ' + direction(row.returns[s]) + '">' + pct(row.returns[s]) + '</td>').join('') + '<td class="rv11-number">' + points(row.excessVsQQQPctPoints) + '</td><td class="rv11-number">' + points(row.excessVsXLCPctPoints) + '</td></tr>').join('');
    container.innerHTML = '<section class="rv11"><div class="rv11-head"><div class="rv11-kicker">GOOGL · 基本面复盘 · 2026/10/13–11/04</div><h2>' + esc(data.title) + '</h2><p class="rv11-summary">' + esc(data.summary) + '</p><div class="rv11-meta">研究截至 ' + esc(data.asOf) + ' · 行情截至 ' + esc(data.marketAsOf) + ' · 新闻档案补查 ' + esc(data.supplementRetrievedOn) + '</div></div><div class="rv11-key-stats">' + statsHTML + '</div><div class="rv11-controversies">' + controversyHTML + '</div><div class="rv11-chain-head"><h3>信息 → 预期 → 市场反应 → 机构修订</h3><span>点击日期定位上方价格图；依据默认收起</span></div><nav class="rv11-nav" aria-label="近期复盘事件日期">' + data.events.map(e => '<button type="button" data-focus="' + esc(e.id) + '" aria-pressed="false" title="' + esc(e.title) + '">' + shortDate(e.date) + ' ' + esc(e.session) + '</button>').join('') + '</nav><p class="rv11-status" role="status" aria-live="polite"></p><div class="rv11-events">' + data.events.map(eventHTML).join('') + '</div>' +
      '<details class="rv11-section"><summary>事前预期与实际：5组同业务口径对照</summary><div class="rv11-detail-body"><p>单位：USD mn。保留两个发布日的媒体样本，Cloud预期不同，分别计算。10-Q实际值用于事后核验；不把10/29报道倒填为事前预测。Zacks总收入和EPS口径未明，不计算其预期差。</p><div class="rv11-scroll"><table><thead><tr><th>指标</th><th>事前发布日期</th><th>预期</th><th>实际</th><th>实际 / 预期 − 1</th></tr></thead><tbody>' + expectationRows + '</tbody></table></div>' + sourceHTML('review-zacks-preview', '财报前媒体样本') + sourceHTML('review-yahoo-preview', '财报前媒体样本') + '</div></details>' +
      '<details class="rv11-section"><summary>机构修订全表：保留日期、预测年份和股类</summary><div class="rv11-detail-body"><p>以下为有日期的媒体转述；未取得本轮完整卖方原始模型。目标价变化不能自动分解成盈利或估值变化。</p><div class="rv11-scroll"><table><thead><tr><th>机构 / 版本 / 股类</th><th>评级与目标价</th><th>经营判断与盈利调整</th><th>解释边界</th></tr></thead><tbody>' + brokerRows + '</tbody></table></div></div></details>' +
      '<details class="rv11-section"><summary>本地研报、电话会、专家材料：哪些真正支持本次复盘</summary><div class="rv11-detail-body">' + (data.materials || []).map(m => '<div class="rv11-material"><h4>' + esc(m.label) + '<span>' + esc(m.status) + '</span></h4><p>' + esc(m.body) + '</p><details><summary>查看材料及页码</summary>' + m.sourceRefs.map(ref => sourceHTML(ref,'材料身份与日期见说明')).join('') + '</details></div>').join('') + '</div></details>' +
      '<details class="rv11-section"><summary>区间收益与方法说明</summary><div class="rv11-detail-body"><p>' + esc(data.priceBasis) + ' 相对收益为简单百分点差，不是因果分解。</p><div class="rv11-scroll"><table><thead><tr><th>窗口</th><th>GOOGL</th><th>QQQ</th><th>XLC</th><th>相对QQQ</th><th>相对XLC</th></tr></thead><tbody>' + windowRows + '</tbody></table></div><ul>' + list(data.limitations) + '</ul><p>扩大到9/01起点时，最大收盘回撤是9/21→11/02的−21.40%；本页10/13起点是十月局部高点，两者不混用。</p></div></details>' +
      '<p class="rv11-foot">价格观察不等于催化归因。原始时间戳、材料位置及证据强度可在每个节点展开；Wind数据来源于万得Wind金融数据服务。</p></section>';

    function onClick(evt) {
      const button = evt.target.closest('button[data-focus]');
      if (!button || !container.contains(button)) return;
      const event = data.events.find(item => item.id === button.dataset.focus);
      if (!event) return;
      container.querySelectorAll('button[data-focus]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.focus === event.id)));
      container.querySelectorAll('.rv11-event').forEach(el => el.classList.toggle('rv11-selected', el.dataset.event === event.id));
      const obs = event.priceObservation;
      container.querySelector('.rv11-status').textContent = '已选：' + event.date + ' ' + event.session + '；观察窗口 ' + obs.startDate + ' → ' + obs.endDate + '。';
      const focus = {eventId: event.id, date: event.date, startDate: obs.startDate, endDate: obs.endDate, session: event.session};
      if (typeof options.onFocus === 'function') options.onFocus(focus);
      else {
        const node = Array.from(container.querySelectorAll('.rv11-event')).find(el => el.dataset.event === event.id);
        if (node) node.scrollIntoView({behavior:'smooth',block:'start'});
      }
    }
    container.addEventListener('click', onClick);
    let destroyed = false;
    const cleanup = () => {
      if (destroyed) return;
      destroyed = true;
      container.removeEventListener('click', onClick);
      if (mounted.get(container) === cleanup) mounted.delete(container);
    };
    mounted.set(container, cleanup);
    return {destroy: cleanup};
  }
  global.ReviewV11 = Object.freeze({render});
})(window);
