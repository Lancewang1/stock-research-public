/** Build explicit MS-implied revenue assumptions; preserve the prior research seed. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {calculateCloudCase,solveMSCloudRevenue} from './cloud-model.mjs';
const path=new URL('../assets/cloud-inputs.json',import.meta.url),data=JSON.parse(readFileSync(path,'utf8'));
data.researchParameters??=structuredClone(data.parameters);
const research={...data,parameters:structuredClone(data.researchParameters)};delete research.msBaseline;
const initial=calculateCloudCase(research),solved=solveMSCloudRevenue(research,{},'enterprise');
if(!solved.feasible)throw new Error('MS baseline cannot be solved within declared bounds');
const fitted=calculateCloudCase(research,solved.overrides);
data.parameters=fitted.parameters;
data.comparisonsNote='MS作为收入目标反推企业增长；GS/JPM用于对照。客户预算、份额和TPU输入仍为研究参数。';
data.comparisons.ms.note='MS作为条件反推目标，不代表其披露客户经营假设。';
data.parameters.enterprise.status='ms_implied_assumption';
data.msBaseline={version:1,broker:'Morgan Stanley',publicationDate:data.comparisons.ms.publicationDate,method:'enterprise_residual',
  fixed:'AI客户预算、Google份额、容量、单价及独立TPU交付沿原研究输入；它们未被MS总额唯一识别。',
  solved:'其他企业服务环比增速逐季反推，使Cloud收入等于MS；Workspace/传统GCP内部比例仍是结构假设。',
  originalResearchRows:initial.quarters.map(q=>({period:q.period,cloudRevenueBn:q.cloudRevenueBn,enterpriseRevenueBn:q.enterpriseRevenueBn})),
  rows:solved.rows.map((x,i)=>({...x,seedGrowth:research.parameters.enterprise.sequentialGrowth[i],enterpriseRevenueBn:fitted.quarters[i].enterpriseRevenueBn,
    aiRevenueBn:Object.values(fitted.quarters[i].customerRevenueBn).reduce((a,b)=>a+b,0),tpuRevenueBn:fitted.quarters[i].externalTPURevenueBn})),
  note:'这是在固定条件下反推的可行解，不是MS披露的经营假设，也不是独立预测；用户修改后不自动重拟合。'};
for(const definition of data.parameterDefinitions){
  if(/^enterprise\.sequentialGrowth\.\d+$/.test(definition.path)){const i=Number(definition.path.split('.').at(-1));definition.value=data.parameters.enterprise.sequentialGrowth[i];definition.status='ms_implied_assumption';definition.basis=data.msBaseline.solved;definition.min=-.99;definition.max=2;definition.sourceRefs=['cloud-ms-implied-baseline'];}
  if(definition.path==='global.enterpriseGrowthAdjustment')definition.basis='相对MS隐含的逐季企业增长加减；修改后不自动对齐MS。';
}
data.sources=data.sources.filter(s=>s.id!=='cloud-ms-implied-baseline');data.sources.push({id:'cloud-ms-implied-baseline',title:'MS目标反推的企业服务增长基准',date:data.msBaseline.publicationDate,kind:'conditional_inverse_calculation',note:data.msBaseline.note});
data.limitations=[...(data.limitations||[]).filter(x=>!String(x).startsWith('当前默认以MS')),'当前默认以MS为收入基准；AI/TPU固定假设不由MS唯一识别，企业增长承担剩余差额。'];
if(data.allocationSensitivity)data.allocationSensitivity.method='以下为切换MS基准前保存的原研究情景分摊测试，不代表当前MS基准结果。';
writeFileSync(path,JSON.stringify(data,null,2));
const validationPath=new URL('../outputs/research/raw_cloud/input-validation.json',import.meta.url);
if(existsSync(validationPath)){const v=JSON.parse(readFileSync(validationPath,'utf8'));v.msExcludedFromInputs=false;v.msUsage='Explicit conditional revenue anchor; customer/TPU inputs not identified by MS';writeFileSync(validationPath,JSON.stringify(v,null,2));}
console.log(JSON.stringify({msRevenueBaseline:solved.rows.map(x=>({period:x.period,growth:x.value,target:x.targetRevenueBn}))}));
