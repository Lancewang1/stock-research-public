/* Inside WB: shared scenario state and persistence. */
let profitPeriod='2027Q1';
function renderProfitPanel(){
  let host=$('#wbProfit');if(!host){host=document.createElement('div');host.id='wbProfit';host.className='wb-extra';$('#tblwrap').insertAdjacentElement('afterend',host);}
  const q=result.quarters.find(q=>q.period===profitPeriod),d=q?.profitDetail,b=CASE.profitModel?.quarters?.[profitPeriod];if(!d)return;
  const p=d.parameters;
  const implied=WBM.solveMSProfit(b,p);
  const opened=[...host.querySelectorAll('details')].map(x=>x.open);
  const input=(key,label,ratio=false)=>`<label style="display:inline-flex;flex-direction:column;gap:5px;margin:6px;min-width:170px">${esc(label)}<input aria-label="${esc(label)}" type="number" step="any" data-profit="${key}" data-scale="${ratio?100:1}" value="${+(p[key]*(ratio?100:1)).toFixed(6)}" style="width:160px;padding:7px"></label>`;
  const names={workspace:'Workspace',traditional:'传统 GCP',ai:'AI 云服务',tpu:'独立 TPU 交付'};
  const row=(name,x)=>`<tr><td>${name}</td>${['revenue','cogs','grossProfit','rd','sm','ga','operatingIncome'].map(f=>`<td>${bn(x[f],2)}</td>`).join('')}<td>${pf(x.revenue?x.grossProfit/x.revenue:null)}</td><td>${pf(x.revenue?x.operatingIncome/x.revenue:null)}</td></tr>`;
  host.innerHTML=`<h3>Cloud 业务 → 成本 / 折旧 → 集团 EPS</h3><p>选择预测季度 <select id="wbProfitPeriod" aria-label="利润模型季度">${Object.keys(CASE.profitModel.quarters).map(t=>`<option ${t===profitPeriod?'selected':''}>${t}</option>`).join('')}</select>　金额 USD bn；输入金额 USD mn。修改后自动更新上方主表及保存的情景。</p>
  <p class="note">默认是 MS 目标反推的条件基准，非独立预测或MS原始经营假设。四块收入与下方MS收入基准一致；额外校准收益为零。固定收入结构、折旧和SBC后，反推统一现金成本倍率。修改任何参数后不自动对齐MS。2028仅年度延展。</p>
  <div id="wbMSImplied"><h3>MS 基准 → 隐含假设 → 用户情景</h3><p>本季 MS Cloud收入 ${bn(b.cloudRevenue,3)} bn / 营业利润 ${bn(b.cloudOperatingIncome,3)} bn；当前收入 ${bn(q.segments.cloud,3)} bn / 营业利润 ${bn(q.cloudOperatingIncome,3)} bn，利润偏离 ${bn(q.cloudOperatingIncome-b.cloudOperatingIncome,3)} bn。</p>
  ${input('cloudCashCostMultiplier','Cloud现金成本倍率')}
  <p>初始反推倍率 <b>${nf(b.parameters.cloudCashCostMultiplier,4)}×</b>。有效直接成本率和经营费用率 = 下方参考费率 × 此倍率；D&A、SBC不乘此倍率。</p>
  <div class="wb-scroll"><table class="wb-table"><thead><tr><th>业务</th><th>当前有效直接成本率</th><th>当前有效经营费用率</th></tr></thead><tbody>${Object.entries(d.parts).map(([k,x])=>`<tr><td>${names[k]}</td><td>${pf(x.effectiveDirectRate)}</td><td>${pf(x.effectiveOpexRate)}</td></tr>`).join('')}</tbody></table></div>
  <p>在当前其他假设下，对齐MS Cloud利润所需倍率：<b>${implied.feasible?nf(implied.value,4)+'×':'无可行解'}</b>。公式：（当前Cloud收入 − MS目标利润 − Cloud D&A − Cloud SBC）÷ 倍率为1时的Cloud现金成本。范围0–3×，范围内不代表经济上合理。</p>
  <button id="wbProfitFitMS" ${implied.feasible?'':'disabled'}>按当前其他假设反推并应用本季成本倍率</button> <button id="wbProfitRestoreMS">本季全部恢复MS基准</button><p class="note">重新反推是明确操作，仅对齐Cloud营业利润，不保证集团EPS回到MS；若主表仍有手动费用覆盖，请查看下方差额。MS Cloud利润本身是分部残差，反推也不能验证其真实性。</p></div>
  <div class="wb-scroll"><table class="wb-table"><thead><tr><th>业务</th><th>收入</th><th>营业成本</th><th>毛利</th><th>研发</th><th>销售</th><th>管理</th><th>营业利润</th><th>毛利率</th><th>营业利润率</th></tr></thead><tbody>${Object.entries(d.parts).map(([k,x])=>row(names[k],x)).join('')}
  <tr><td>未分配成本 / 负值为收益</td><td>—</td><td>—</td><td>—</td><td>${bn(d.cloudUnallocatedCost,2)}</td><td>—</td><td>—</td><td>${bn(-d.cloudUnallocatedCost,2)}</td><td>—</td><td>—</td></tr>${row('Cloud 合计',d.totals)}</tbody></table></div>
  <p>额外未分配项对Cloud利润贡献 ${bn(-d.cloudUnallocatedCost,2)} bn；MS隐含基准默认是0。若手动填入，暂列研发调整，不能当作已识别收益。<button id="wbProfitNoResidual">将本季额外未分配项归零</button></p>
  <p>主表手动费用覆盖：${d.manualOverrides.length?esc(d.manualOverrides.join(' / ')):'无'}；相对业务成本模型的额外成本 ${bn(d.manualCostAdjustment,2)} bn。<button id="wbProfitClearMargins">本季恢复业务成本驱动</button></p>
  <details open><summary>四块收入与参考费率 · 可编辑</summary><p class="note">AI客户和TPU沿下方种子假设，其他企业收入反推至MS总额；Workspace/传统GCP的内部比例沿旧结构代理，不由MS总额唯一识别。参考费率是倍率调整前的研究假设，不是MS披露费率；实际生效费率见上表。不含另分配的D&A与SBC。TPU交付与云服务不重复。</p>
  ${Object.keys(names).map(k=>input(k+'Revenue',names[k]+'收入（mn）')+(k==='ai'?'':input(k+'DirectRate',names[k]+'直接成本率 %',true))+input(k+'OpexRate',names[k]+'经营费用率 %',true)).join('')}
  ${input('aiThirdPartyShare','AI第三方算力收入份额 %',true)}${input('aiThirdPartyCostRate','第三方算力采购成本率 %',true)}${input('aiOwnOperatingRate','自有算力运营成本率 %',true)}${input('cloudUnallocatedCost','额外未分配成本（默认0，mn）')}
  <p class="note">AI直接成本 = AI收入 × [第三方份额 × 采购成本率 + 自有份额 × 自有运营成本率] × Cloud现金成本倍率。采购成本率以第三方业务收入为分母。Barclays第三方采购仅Q1有值，其后空白不当作零。</p></details>
  <details><summary>分类资产 / 年限 → 折旧 → COGS与研发</summary><p>服务器基准资产代理 ${bn(b.serverAssets,2)} bn；其他资产代理 ${bn(b.otherAssets,2)} bn。由 MS 折旧与 Barclays 分类构成反推，非已披露资产原值；按固定资产尺度做年限敏感性，非完整新增/退役资产滚动模型。</p>
  ${input('serverLife','服务器年限（年）')}${input('otherLife','其他资产年限（年）')}${input('serverAssetMultiplier','服务器资产倍率')}${input('otherAssetMultiplier','其他资产倍率')}${input('cloudDepShare','集团D&A分配Cloud %',true)}${input('workspaceDepShare','Cloud D&A分配Workspace %',true)}${input('traditionalDepShare','Cloud D&A分配传统GCP %',true)}${input('depreciationCogsShare','D&A分配营业成本 %',true)}
  <p>季度折旧 = 服务器资产×倍率÷年限÷4 + 其他资产×倍率÷年限÷4 = ${bn(d.depreciation,2)} bn；另含摊销 ${bn(d.amortization,2)} bn。Cloud D&A余量分配AI；独立TPU交付不分配自有云折旧。COGS之外的D&A计研发。年限与分配参照Barclays旧模型，Cloud分配为研究假设。已计入成本，不重复扣减。</p></details>
  <details open><summary>非 Cloud：可识别成本与共享成本</summary><p>搜索分销TAC、网络TAC和YouTube内容成本采用MS原模型公式。YouTube内容成本 =（广告 + YouTube订阅）×分成率 + NFL固定内容成本。其他订阅/设备与Other Bets成本尚不可单独识别，保留在共享残余中；下表差额是扣已识别成本后的贡献，不是完整业务毛利。</p>
  ${input('searchTacRate','搜索分销TAC率 %',true)}${input('networkTacRate','网络TAC率 %',true)}${input('youtubeContentRate','YouTube内容分成率 %',true)}${input('youtubeSubsShare','订阅中YouTube份额 %',true)}${input('nflContentCost','NFL内容成本（mn）')}
  <div class="wb-scroll"><table class="wb-table"><thead><tr><th>业务</th><th>收入bn</th><th>已识别直接成本bn</th><th>扣已识别成本后贡献bn</th></tr></thead><tbody>${Object.entries(d.nonCloudDirect?.parts||{}).map(([k,x])=>`<tr><td>${esc(({search:'搜索及其他',network:'网络',youtube:'YouTube广告',youtubeSubs:'YouTube订阅',otherSubs:'其他订阅/平台/设备',bets:'Other Bets'})[k])}</td><td>${bn(x.revenue,2)}</td><td>${bn(x.cost,2)}</td><td>${x.cost==null?'未识别':bn(x.revenue-x.cost,2)}</td></tr>`).join('')}</tbody></table></div><p>非Cloud剩余营业成本（含未分配现金成本、D&A、SBC）：${bn(d.nonCloud.cogs-(d.nonCloudDirect?.total||0),2)} bn；非Cloud研发/销售/管理及其他费用：${bn(d.nonCloud.rd+d.nonCloud.sm+d.nonCloud.ga+d.nonCloud.otherOpex,2)} bn。共享费用不强行分到具体业务。</p><p class="note">${esc(b.nonCloudCostSource||'来源缺失')}</p></details>
  <details open><summary>相对初始MS：集团毛利率与营业利润变化桥</summary><p class="note">按下表顺序逐步替换参数，交叉影响归入后发生的步骤；不是因果归因。收入结构包括Cloud四块和非Cloud业务结构。</p><div class="wb-scroll"><table class="wb-table"><thead><tr><th>驱动</th><th>毛利变化bn</th><th>毛利率变化pp</th><th>营业利润变化bn</th></tr></thead><tbody>${(d.attribution||[]).map(x=>`<tr><td>${esc(x.label)}</td><td>${bn(x.grossProfit,3)}</td><td>${nf(x.grossMarginPoints,3)}</td><td>${bn(x.operatingIncome,3)}</td></tr>`).join('')}</tbody></table></div></details>
  <details open><summary>SBC 与 GAAP / 调整后盈利桥</summary>${input('sbcMultiplier','集团SBC倍率')}${input('sbcTaxBenefitRate','SBC税效应率 %',true)}${input('cloudSbcShare','集团SBC分配Cloud %',true)}
  <p>净利润 ${bn(q.netIncome,2)} + SBC ${bn(q.sbc,2)} − SBC税效应 ${bn(q.sbcTaxBenefit,2)} = 调整后净利润 <b>${bn(q.adjustedNetIncome,2)} bn</b>；扣优先股股息后 ÷ 稀释股数 = 调整后 EPS <b>${nf(q.adjustedEps,3)}</b>（原EPS ${nf(q.eps,3)}）。调整后营业利润 ${bn(q.adjustedOperatingIncome,2)} bn。</p><p class="note">此调整口径仅加回SBC并扣相关税效应，不排除投资收益等其他项目，非公司公布Non-GAAP指标。年度按季度分子合计÷天数加权股数，不加总季度EPS。SBC分项用MS费用构成；Cloud占比及业务分配属研究假设。</p></details>
  <details><summary>证据位置与计算边界</summary><p>MS 2026-10-29：${esc(b.sourceCells.ms)}</p><p>Barclays 2026-07-24：${esc(b.sourceCells.barclays)}</p><p>MS Cloud营业利润本身由集团减其他业务残差得到，不能当独立利润率证据。Barclays TPU 25%为营业利润率，不是毛利率。</p><p>${esc(d.allocationNote)}；现金成本残余按初始MS固定，不重新拟合。资产与SBC成本在Cloud收入降至零时仍保留。</p></details>`;
  host.querySelectorAll('details').forEach((x,i)=>{if(i<opened.length)x.open=opened[i];});
}
document.addEventListener('change',event=>{
  if(event.target.id==='wbProfitPeriod'){profitPeriod=event.target.value;renderProfitPanel();return;}
  const el=event.target.closest('[data-profit]');if(!el)return;
  try{if(!el.value.trim())throw new Error('参数不可留空');const next=clone(overrides);next[profitPeriod]??={};next[profitPeriod].profit??={};next[profitPeriod].profit[el.dataset.profit]=Number(el.value)/Number(el.dataset.scale);commit(next,'Cloud分业务盈利情景');}catch(e){error(e.message);renderProfitPanel();}
});
document.addEventListener('click',event=>{
  if(['wbProfitFitMS','wbProfitRestoreMS'].includes(event.target.id)){
    try{const next=clone(overrides);if(event.target.id==='wbProfitRestoreMS')delete next[profitPeriod];else{const q=result.quarters.find(x=>x.period===profitPeriod),solution=WBM.solveMSProfit(CASE.profitModel.quarters[profitPeriod],q.profitDetail.parameters);if(!solution.feasible)throw new Error('当前条件下无可行成本倍率');next[profitPeriod]??={};next[profitPeriod].profit={...next[profitPeriod].profit,...solution.changes};}commit(next,'MS隐含假设 · 用户情景');}catch(e){error(e.message);}return;
  }
  if(!['wbProfitNoResidual','wbProfitClearMargins'].includes(event.target.id))return;
  try{const next=clone(overrides);next[profitPeriod]??={};if(event.target.id==='wbProfitNoResidual'){next[profitPeriod].profit??={};next[profitPeriod].profit.cloudUnallocatedCost=0;}else for(const k of ['grossMargin','opexRatio','rdRatio','smRatio','gaRatio'])delete next[profitPeriod][k];commit(next,'Cloud盈利敏感性');}catch(e){error(e.message);}
});
