/* Pure domain functions shared by the browser and Node's test runner. */
globalThis.PomoCore=Object.freeze({
  amount(value){
    const raw=String(value??'').normalize('NFKC').trim().replace(/^人民币\s*/, '').replace(/[,，\s]/g,'');
    const m=raw.match(/^[¥￥]?(\d+(?:\.\d{1,2})?)(万|亿)?(?:人民币|元)?$/);
    if(!m)return null;
    const n=Number(m[1])*(m[2]==='万'?10000:m[2]==='亿'?100000000:1);
    return Number.isFinite(n)&&n>=.01&&n<=1e12?Math.round(n*100)/100:null;
  },
  duration(months){
    if(!Number.isFinite(months)||months<0)return {value:null,num:'无法估算',unit:''};
    const value=months>=12?months/12:months,unit=months>=12?'年':'个月';
    return {value,num:value>0&&value<.1?'少于0.1':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(value),unit};
  },
  financial(amount,baseline,personal=null){
    const income=personal?personal.income:baseline.income;
    const savingIncome=personal?personal.income:baseline.savingsIncome;
    const expense=personal?personal.expense:baseline.expense;
    return {income,savingIncome,expense,surplus:savingIncome-expense,earningMonths:income>0?amount/income:null,savingMonths:savingIncome>expense?amount/(savingIncome-expense):null};
  },
  quantity(amount,price){const cents=Math.round(price*100);return Number.isFinite(amount)&&Number.isFinite(price)&&cents>0?Math.floor((Math.round(amount*100)+1e-7)/cents):0},
  usage(quantity,basis){
    const u=basis?.usage;
    if(!u||!Number.isFinite(quantity)||quantity<1||!Number.isFinite(u.usesPerUnit)||u.usesPerUnit<=0||!Number.isFinite(u.perDay)||u.perDay<=0||typeof u.frequency!=='string'||typeof u.action!=='string')return null;
    const days=quantity*u.usesPerUnit/u.perDay;
    const span=days>=365?'约'+new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(days/365)+'年':'约'+new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(days)+'天';
    return {days,text:days<1?`如果${u.frequency}，还不足1天的用量。`:u.mode==='rotation'?`如果${u.frequency}，可以连续${span}不重复。`:`如果${u.frequency}，可以${u.action}${span}。`,note:u.note||'频率仅为换算场景，不是使用建议。'};
  },
  selectGoods(amount,pool,previous=[],random=Math.random){
    const shuffle=rows=>{const copy=[...rows];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy};
    const unique=[...new Map(pool.filter(g=>g[0]!=='iPhone Duo'||g[2]<=amount).map(g=>[g[0],g])).values()],affordable=unique.filter(g=>g[2]<=amount);
    const candidates=affordable.length>=8?affordable:unique,chosen=[];
    const category=g=>g[5]?.category||'daily';
    const duo=candidates.find(g=>g[0]==='iPhone Duo'&&g[2]<=amount);
    if(duo)chosen.push(duo);
    for(const group of shuffle(['digital','fashion','entertainment','travel','sport','daily'])){
      if(chosen.some(g=>category(g)===group))continue;
      const next=shuffle(candidates.filter(g=>category(g)===group&&!chosen.includes(g)))[0];if(next)chosen.push(next);
    }
    for(const g of shuffle(candidates)){
      if(chosen.length>=8)break;if(chosen.includes(g)||category(g)==='daily'&&chosen.filter(x=>category(x)==='daily').length>=2)continue;chosen.push(g);
    }
    for(const g of shuffle(candidates)){if(chosen.length>=8)break;if(!chosen.includes(g))chosen.push(g)}
    // A new comparison changes the selection as well as the order when possible.
    const prior=new Set(previous.map(g=>g[0]));
    if(chosen.length&&chosen.every(g=>prior.has(g[0]))){const replacement=shuffle(candidates.filter(g=>!prior.has(g[0])&&category(g)!=='daily'))[0];const at=chosen.findLastIndex(g=>g!==duo);if(replacement&&at>=0)chosen[at]=replacement}
    return shuffle(chosen).map(g=>JSON.parse(JSON.stringify(g)));
  },
  validBaseline(b){return !!b&&Number.isInteger(b.year)&&b.year>=2020&&Number.isFinite(b.income)&&b.income>0&&Number.isFinite(b.savingsIncome)&&Number.isFinite(b.expense)&&b.savingsIncome>=0&&b.expense>=0&&typeof b.incomeLabel==='string'&&typeof b.savingsLabel==='string'&&b.wageSource&&typeof b.wageSource.title==='string'&&typeof b.wageSource.url==='string'&&b.householdSource&&typeof b.householdSource.title==='string'&&typeof b.householdSource.url==='string'},
  validPersonal(p){return !!p&&Number.isFinite(p.income)&&Number.isFinite(p.expense)&&p.income>=0&&p.expense>=0&&p.income<=1e12&&p.expense<=1e12},
  safeLink(value){try{const u=new URL(value);return u.protocol==='https:'||u.protocol==='http:'?u.href:null}catch{return null}},
  cleanRecords(value){
    if(!Array.isArray(value))return [];
    return value.filter(r=>r&&typeof r.id==='string'&&Number.isFinite(r.amount)&&r.amount>=.01&&r.amount<=1e12&&typeof r.label==='string'&&typeof r.date==='string'&&globalThis.PomoCore.validBaseline(r.baseline)&&Array.isArray(r.goods)&&r.goods.length>=8&&r.goods.every(g=>Array.isArray(g)&&typeof g[0]==='string'&&typeof g[1]==='string'&&typeof g[3]==='string'&&typeof g[4]==='string'&&Number.isFinite(g[2])&&g[2]>=.01)).slice(0,100);
  }
});
