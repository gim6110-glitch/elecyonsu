/* Smart form detection for digital training rosters.
   PDF.js text extraction and ruled-table geometry, ExcelJS cell-header analysis.
   No OCR: image-only PDFs require manual layout verification. */
(function(){
'use strict';
const D=document,$=id=>D.getElementById(id);
if(!$('templateList')||!$('mapping'))return;
const norm=s=>String(s??'').replace(/[\s:：()[\]{}<>·•_]/g,'').toLowerCase();
const fields=[
 ['num',/^(연번|번호|순번|no|순서|번)$/i],
 ['pos',/^(직위|직급|직책|직종|직위직급|직급직위)$/i],
 ['name',/^(성명|이름|교직원명|교사명|참석자|참석자명|참가자명|참석자성명)$/i],
 ['sign',/^(서명|서명란|확인서명|날인|서명날인|인|싸인|signature)$/i],
 ['title',/^(연수명|교육명|행사명|과정명|강의명|제목|연수제목)$/i],
 ['date',/^(일시|연수일시|교육일시|교육일자|날짜|일자|일시시간)$/i],
 ['place',/^(장소|연수장소|교육장소|교육장|교육실)$/i]
];
function field(text){
 const n=norm(text);for(const [name,re] of fields)if(re.test(n))return name;
 return null;
}
const med=a=>{const v=a.slice().sort((x,y)=>x-y);return v.length?v[Math.floor(v.length/2)]:0};
const num=n=>Number.isFinite(+n)?+n:0;
const limit=(v,min,max)=>Math.min(max,Math.max(min,v));
const textValue=cell=>{
 let v=cell?.value;
 if(v&&typeof v==='object'){
  if(Array.isArray(v.richText))return v.richText.map(x=>x.text||'').join('');
  if(v.text)return String(v.text);
  if(v.result!=null)return String(v.result);
  return '';
 }
 return v==null?'':String(v);
};
const columnName=n=>{let out='';for(let x=n;x>0;x=Math.floor((x-1)/26))out=String.fromCharCode(65+(x-1)%26)+out;return out};
const colNum=s=>String(s||'').toUpperCase().split('').reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
const imageData=t=>baseBytes(t.file_data);
function notifyStatus(msg,good=false){
 if($('autoMapStatus')){$('autoMapStatus').textContent=msg;$('autoMapStatus').dataset.good=good?'yes':'no';}
 if(typeof notice==='function')notice(msg);
}
function chooseHeader(rows){
 let best=null;
 for(const row of rows){
  for(const p of row.items.filter(x=>x.field==='pos')){
   for(const n of row.items.filter(x=>x.field==='name'&&x.x>p.x)){
    for(const s of row.items.filter(x=>x.field==='sign'&&x.x>n.x)){
     const span=s.x-p.x;
     if(span<20||span>500)continue;
     const score=90-span*.06+row.items.filter(x=>x.field==='num'&&x.x<p.x).length*8;
     if(!best||score>best.score)best={row,p,n,s,score};
    }
   }
  }
 }
 return best;
}
function extractHeaderGroups(items){
 const headers=items.filter(x=>['pos','name','sign','num'].includes(x.field));
 const bands=[];
 for(const it of headers.sort((a,b)=>a.y-b.y)){
  let row=bands.find(b=>Math.abs(b.y-it.y)<12);
  if(!row){row={y:it.y,items:[]};bands.push(row)}
  row.items.push(it);
 }
 const valid=[];
 for(const row of bands){
  const ps=row.items.filter(x=>x.field==='pos').sort((a,b)=>a.x-b.x);
  for(const p of ps){
   const end=(ps.find(x=>x.x>p.x)||{x:Infinity}).x;
   const n=row.items.find(x=>x.field==='name'&&x.x>p.x&&x.x<end);
   const s=row.items.find(x=>x.field==='sign'&&x.x>(n?.x||p.x)&&x.x<end);
   if(!n||!s)continue;
   const index=row.items.filter(x=>x.field==='num'&&x.x<p.x&&x.x>p.x-100).sort((a,b)=>b.x-a.x)[0];
   valid.push({y:row.y,pos:p.x,name:n.x,sign:s.x,
    num:index?.x||null, width:Math.max(80,s.x-p.x+70)});
  }
 }
 if(!valid.length)return null;
 const groupsByRow=[];
 for(const g of valid){
  let row=groupsByRow.find(b=>Math.abs(b.y-g.y)<12);
  if(!row){row={y:g.y,blocks:[]};groupsByRow.push(row)}
  row.blocks.push(g);
 }
 groupsByRow.sort((a,b)=>b.blocks.length-a.blocks.length||a.y-b.y);
 const top=groupsByRow[0];
 return {y:top.y,groups:top.blocks.sort((a,b)=>a.pos-b.pos).slice(0,4)};
}
async function horizontalLines(pdfPage,block,headingY,pageHeight){
 const view=pdfPage.getViewport({scale:1});
 const canvas=D.createElement('canvas');
 canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
 await pdfPage.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport:view}).promise;
 const W=canvas.width,H=canvas.height,px=canvas.getContext('2d').getImageData(0,0,W,H).data;
 const left=limit(Math.floor((block.num||block.pos-23)-12),0,W-1);
 const right=limit(Math.ceil(block.sign+Math.max(35,(block.sign-block.name)*.8)),left+2,W);
 const width=right-left;
 let ys=[];
 for(let y=limit(Math.floor(headingY+2),1,H-2);y<Math.min(H-7,pageHeight-5);y++){
  let best=0,run=0,dark=0;
  for(let x=left;x<right;x++){
   const i=(y*W+x)*4;
   if(px[i]<145&&px[i+1]<145&&px[i+2]<145){run++;dark++;}
   else{best=Math.max(best,run);run=0;}
  }
  best=Math.max(best,run);
  if(best>Math.max(45,width*.56)||dark/width>.83)ys.push(y);
 }
 const collapsed=[];
 for(const y of ys){
  if(collapsed.length&&y-collapsed[collapsed.length-1]<=2)collapsed[collapsed.length-1]=Math.round((collapsed[collapsed.length-1]+y)/2);
  else collapsed.push(y);
 }
 return collapsed;
}
async function analyzePdf(t){
 if(!window.pdfjsLib)throw Error('PDF.js 라이브러리를 불러오지 못했습니다.');
 pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const doc=await pdfjsLib.getDocument({data:imageData(t)}).promise;
 const page=await doc.getPage(1),vp=page.getViewport({scale:1});
 const txt=await page.getTextContent();
 const items=txt.items.filter(x=>x.str&&x.str.trim()).map(it=>{
  const tr=pdfjsLib.Util.transform(vp.transform,it.transform);
  return {str:it.str,field:field(it.str),x:tr[4]+(it.width||0)/2,
   y:tr[5]-Math.abs(tr[3]||10)*.35,w:it.width||0};
 });
 const header=extractHeaderGroups(items);
 if(!header)return {ok:false,reason:'PDF에서 직위·성명·서명 머리글을 찾지 못했습니다. 스캔 PDF이거나 특수 서식입니다. 「PDF 양식 위치 설정」에서 직접 지정해 주세요.'};
 const blocks=[];
 for(const h of header.groups){
  const lines=await horizontalLines(page,h,header.y,vp.height);
  const usable=lines.filter(y=>y>header.y+3);
  const steps=usable.slice(1).map((y,i)=>y-usable[i]).filter(d=>d>=12&&d<=65);
  const step=med(steps);
  if(!step||usable.length<2)continue;
  const rows=usable.slice(1).filter((y,i)=>i===0||y-usable[i]<step*1.6).length;
  blocks.push({pos:Math.round(h.pos),name:Math.round(h.name),sign:Math.round(h.sign),
   num:h.num==null?null:Math.round(h.num),start:Math.round(usable[0]+step/2),
   step:+step.toFixed(2),rows:limit(rows,1,120),
   signWidth:limit((h.sign-h.name)*1.2,40,140)});
 }
 if(!blocks.length)return {ok:false,reason:'직위·성명·서명 열은 찾았지만 행 높이를 확정하지 못했습니다. 표가 없는 PDF라면 위치 설정에서 첫 행과 간격을 지정해 주세요.'};
 const findLabel=k=>items.find(it=>it.field===k&&it.y<header.y-5);
 const detail={};
 for(const [key,prefix] of [['title','title'],['date','date'],['place','place']]){
  const h=findLabel(key);
  if(h){detail[prefix+'X']=Math.round(limit(h.x+h.w/2+65,20,vp.width-30));
   detail[prefix+'Y']=Math.round(h.y+2)}
 }
 const total=blocks.reduce((n,g)=>n+g.rows,0);
 const m={...(t.mapping||{}),autoMode:'pdf',autoVersion:1,pdfBlocks:blocks,
  autoConfidence:total>3?'high':'medium',pdfWidth:vp.width,pdfHeight:vp.height,
  cols:blocks.length,redraw:'no',pos:blocks[0].pos,name:blocks[0].name,
  sign:blocks[0].sign,num:blocks[0].num||undefined,
  start:blocks[0].start,step:blocks[0].step,offset:blocks[1]?blocks[1].pos-blocks[0].pos:0,
  detectedCapacity:total,...detail};
 return {ok:true,mapping:m,msg:'PDF 표 '+blocks.length+'개 영역, 총 '+total+'칸을 인식했습니다. 미리보기에서 위치를 확인해 주세요.'};
}
function scanExcelHeaders(sheet){
 const groups=[];
 const maxR=Math.min(Math.max(sheet.rowCount,20),130);
 const maxC=Math.min(Math.max(sheet.columnCount,8),65);
 for(let r=1;r<=maxR;r++){
  const found={};
  for(let c=1;c<=maxC;c++){
   const cell=sheet.getCell(r,c);
   if(cell.isMerged&&cell.master!==cell)continue;
   const type=field(textValue(cell));
   if(type){(found[type] ||= []).push({c,r,addr:cell.address});}
  }
  const ps=found.pos||[],ns=found.name||[],ss=found.sign||[];
  for(const p of ps){
   const end=(ps.find(x=>x.c>p.c)||{c:Infinity}).c;
   const n=ns.find(x=>x.c>p.c&&x.c<end);
   const s=ss.find(x=>x.c>(n?.c||p.c)&&x.c<end);
   if(n&&s)groups.push({r,p,n,s,num:(found.num||[]).filter(x=>x.c<p.c).slice(-1)[0]||null,score:4});
  }
 }
 return groups.sort((a,b)=>a.r-b.r);
}
async function analyzeExcel(t){
 if(!window.ExcelJS)throw Error('ExcelJS 라이브러리를 불러오지 못했습니다.');
 const wb=new ExcelJS.Workbook();
 await wb.xlsx.load(imageData(t));
 let match=null,sheet=null;
 for(const ws of wb.worksheets){
  const found=scanExcelHeaders(ws);
  if(found.length&&(!match||found[0].r<match.r)){match=found[0];sheet=ws}
 }
 if(!match)return {ok:false,reason:'엑셀에서 직급·성명·서명 열을 동시에 찾지 못했습니다. 직접 열을 지정해야 합니다.'};
 const labels={};
 for(let r=1;r<=Math.min(match.r,60);r++){
  for(let c=1;c<=Math.min(sheet.columnCount+5,40);c++){
   const val=field(textValue(sheet.getCell(r,c)));
   if(['title','date','place'].includes(val)&&!labels[val]){
    let target=sheet.getCell(r,c+1);
    if(target.isMerged&&target.master===target)target=sheet.getCell(r+1,c);
    labels[val]=target.address;
   }
  }
 }
 const start=match.r+1;
 let footer=0;
 for(let r=start;r<=Math.min(sheet.rowCount+1,start+250);r++){
  let flags=0;
  for(let c of [match.p.c,match.n.c,match.s.c]){
   const v=norm(textValue(sheet.getCell(r,c)));
   if(/^(합계|계|총계|작성자|결재|확인자|담당자|비고사항|교감|교장)$/.test(v))flags++;
  }
  if(flags){footer=r;break;}
 }
 const existingRows=Math.max(0,(footer||sheet.rowCount+1)-start);
 const m={...(t.mapping||{}),autoMode:'xlsx',autoVersion:1,
  sheetName:sheet.name,headerRow:match.r,
  pos:columnName(match.p.c),name:columnName(match.n.c),sign:columnName(match.s.c),
  num:match.num?columnName(match.num.c):null,
  start,step:1,excelCells:labels,excelCapacity:footer?footer-start:Math.max(50,existingRows)};
 return {ok:true,mapping:m,msg:'Excel 「'+sheet.name+'」 시트의 '+match.r+'행 머리글과 열 위치를 인식했습니다. 출력 전에 미리보기를 확인해 주세요.'};
}
async function detect(t,save=true){
 const result=t.kind==='pdf'?await analyzePdf(t):await analyzeExcel(t);
 if(!result.ok)return result;
 if(save){
  req(await sb.from('templates').update({mapping:result.mapping}).eq('id',t.id));
  t.mapping=result.mapping;
 }
 return result;
}
const button=D.createElement('button');
button.id='autoMapButton';button.type='button';button.className='alt';button.textContent='✨ 양식 자동 위치 인식';
const status=D.createElement('p');status.id='autoMapStatus';status.style.cssText='font-size:13px;color:#50627c;margin:7px 0;line-height:1.5';
$('mapping').prepend(status);$('mapping').prepend(button);
button.onclick=async()=>{
 const t=templates.find(x=>x.id===$('chosenTemplate').value);
 if(!t)return notice('먼저 PDF 또는 Excel 양식을 선택해 주세요.');
 button.disabled=true;button.textContent='양식 분석 중...';status.textContent='글자와 표 구조를 분석하고 있습니다.';
 try{
  const result=await detect(t);
  notifyStatus(result.ok?result.msg:result.reason,result.ok);
  if(result.ok){
   if(t.kind==='pdf'){
    for(const key of ['pos','name','sign','start','step']){
     const el=$('map'+key.charAt(0).toUpperCase()+key.slice(1));
     if(el)el.value=t.mapping[key]||'';
    }
    if($('m_pos'))for(const k of ['pos','name','sign','start','step','offset','cols']){
      const el=$('m_'+k);if(el)el.value=t.mapping[k]??'';
    }
   }else{
    for(const [k,id] of [['pos','mapPos'],['name','mapName'],['sign','mapSign'],['start','mapStart'],['step','mapStep']]){
     if($(id))$(id).value=t.mapping[k]||'';
    }
   }
  }
 }catch(e){console.error(e);notifyStatus('양식 자동 분석 중 오류가 발생했습니다: '+(e.message||e));}
 finally{button.disabled=false;button.textContent='✨ 양식 자동 위치 인식';}
};
const oldSave=window.saveTemplate;
window.saveTemplate=async function(){
 const ids=new Set(templates.map(t=>t.id));
 await oldSave();
 const created=templates.find(t=>!ids.has(t.id));
 if(!created)return;
 notifyStatus('업로드한 양식을 자동 분석합니다.');
 try{
  const result=await detect(created);
  notifyStatus(result.ok?created.title+' — '+result.msg:created.title+' — '+result.reason,result.ok);
 }catch(e){console.error(e);notifyStatus('양식 저장은 완료됐지만 자동 분석은 실패했습니다: '+(e.message||e))}
};
const oldChoose=window.chooseTemplate;
window.chooseTemplate=async function(){
 await oldChoose();
 const t=templates.find(x=>x.id===$('chosenTemplate').value);
 if(t?.mapping?.autoMode)status.textContent=(t.kind==='pdf'?'PDF':'Excel')+' 자동 인식 설정이 저장되어 있습니다. 출력 미리보기로 확인해 주세요.';
 else if(t)status.textContent='「양식 자동 위치 인식」을 눌러 표 위치를 자동 탐색할 수 있습니다.';
 else status.textContent='';
};
async function loadSignatures(){
 const ids=people.map(p=>p.id);
 if(!current||!ids.length)return;
 const result=req(await sb.from('participants').select('id,signature_data').eq('training_id',current.id));
 const images=new Map((result||[]).map(p=>[p.id,p.signature_data]));
 for(const p of people)if(images.has(p.id))p.signature_data=images.get(p.id);
}
const readImage=src=>new Promise((resolve,reject)=>{
 const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;
});
async function renderAutoPdf(t){
 const m=t.mapping,blocks=m.pdfBlocks;
 if(!blocks?.length)throw Error('자동 인식한 PDF 표가 없습니다. 위치 인식을 다시 실행해 주세요.');
 const pdf=await pdfjsLib.getDocument({data:imageData(t)}).promise;
 const page=await pdf.getPage(1),viewport=page.getViewport({scale:2});
 const w=viewport.width/2,h=viewport.height/2;
 const capacity=Math.max(1,Math.min(Number(current?.page_size)||50,
  blocks.reduce((n,b)=>n+b.rows,0)));
 const pages=Math.max(1,Math.ceil(people.length/capacity));
 const sizeStyle=D.getElementById('smartTemplatePrintPage')||D.createElement('style');
 sizeStyle.id='smartTemplatePrintPage';
 sizeStyle.textContent='@media print{@page{size:'+(w*25.4/72).toFixed(2)+'mm '+(h*25.4/72).toFixed(2)+'mm;margin:0}}';
 if(!sizeStyle.isConnected)D.head.appendChild(sizeStyle);
 const results=[];
 for(let p=0;p<pages;p++){
  const c=D.createElement('canvas');c.width=Math.ceil(viewport.width);c.height=Math.ceil(viewport.height);
  const g=c.getContext('2d',{alpha:false});
  await page.render({canvasContext:g,viewport}).promise;
  g.save();g.scale(2,2);g.textAlign='center';g.textBaseline='middle';
  if(m.titleX&&m.titleY&&current.title){g.font='bold 13px "Malgun Gothic",sans-serif';g.fillStyle='#151f33';g.fillText(current.title,m.titleX,m.titleY,220)}
  if(m.dateX&&m.dateY&&current.when_text){g.font='10px "Malgun Gothic",sans-serif';g.fillText(current.when_text,m.dateX,m.dateY,180)}
  if(m.placeX&&m.placeY&&current.place){g.font='10px "Malgun Gothic",sans-serif';g.fillText(current.place,m.placeX,m.placeY,160)}
  const slots=people.slice(p*capacity,(p+1)*capacity);
  let offset=0;
  const each=Math.ceil(capacity/blocks.length);
  for(let b=0;b<blocks.length;b++){
   const block=blocks[b],n=Math.min(block.rows,each,capacity-offset);
   const rowHeight=block.step||24;
   const fieldWidth=Math.max(34,block.name-block.pos);
   for(let row=0;row<n;row++){
    const who=slots[offset+row];if(!who)continue;
    const y=block.start+row*rowHeight;
    g.font='10px "Malgun Gothic","Noto Sans CJK KR",sans-serif';g.fillStyle='#121a2b';
    if(block.num!=null){
     g.fillStyle='#fff';g.fillRect(block.num-10,y-6,20,12);
     g.fillStyle='#121a2b';g.fillText(String(p*capacity+offset+row+1),block.num,y,22);
    }
    g.fillText(who.position||'',block.pos,y,Math.max(34,fieldWidth*.9));
    g.fillText(who.full_name||'',block.name,y,Math.max(38,(block.sign-block.name)*.95));
    if(who.signature_data?.startsWith('data:image/png;base64,')){
     try{
      const image=await readImage(who.signature_data);
      const maxW=block.signWidth||65,maxH=Math.min(rowHeight*.8,25);
      const ratio=Math.min(maxW/image.width,maxH/image.height);
      g.drawImage(image,block.sign-image.width*ratio/2,y-image.height*ratio/2,
       image.width*ratio,image.height*ratio);
     }catch(e){console.warn('서명 이미지 출력',e)}
    }
   }
   offset+=n;
  }
  g.restore();
  results.push('<article class="paper-sheet" style="--page-ratio:'+w+'/'+h+';--form-w-mm:'+(w*25.4/72).toFixed(2)+'mm;--form-h-mm:'+(h*25.4/72).toFixed(2)+'mm;width:'+w+'px;height:'+h+'px"><img alt="맞춤 서명부 '+(p+1)+'페이지" style="display:block;width:100%;height:100%" src="'+c.toDataURL('image/png')+'"></article>');
 }
 return results.join('');
}
// When administrators correct detected coordinates in the existing visual mapper,
// keep automatic rendering synchronized with those manual corrections.
function correctPdfBlocks(template,updated){
 const old=template.mapping||{};
 const first=old.pdfBlocks?.[0];
 if(!first)return {...old,...updated};
 const delta={
  pos:num(updated.pos)-first.pos,name:num(updated.name)-first.name,
  sign:num(updated.sign)-first.sign,start:num(updated.start)-first.start
 };
 const step=num(updated.step)||first.step;
 const blocks=old.pdfBlocks.map((b,i)=>({
  ...b,pos:b.pos+delta.pos,name:b.name+delta.name,
  sign:b.sign+delta.sign,start:b.start+delta.start,step
 }));
 if(blocks.length>1&&num(updated.offset)>0){
  const gap=num(updated.offset)-(old.pdfBlocks[1].pos-old.pdfBlocks[0].pos);
  blocks.forEach((b,i)=>{if(i){b.pos+=gap*i;b.name+=gap*i;b.sign+=gap*i;if(b.num!=null)b.num+=gap*i}});
 }
 blocks.forEach((b,i)=>{if(b.num!=null)b.num+=delta.pos});
 return {...old,...updated,pdfBlocks:blocks};
}
$('saveMapVisual')?.addEventListener('click',async function(ev){
 const t=templates.find(x=>x.id===$('chosenTemplate').value);
 if(t?.mapping?.autoMode!=='pdf')return;
 ev.preventDefault();ev.stopImmediatePropagation();
 const keys=['titleX','titleY','dateX','dateY','placeX','placeY',
  'pos','name','sign','start','step','offset','gridX','gridY','gridW','gridH','cols'];
 const next={};
 for(const k of keys)if($('m_'+k))next[k]=num($('m_'+k).value);
 next.redraw=$('m_redraw')?.value||'no';
 if(next.step<8||next.pos<0||next.name<=next.pos||next.sign<=next.name)return notice('직위·성명·서명 위치 및 행 간격을 확인하세요.');
 const saved=correctPdfBlocks(t,next);
 try{
  req(await sb.from('templates').update({mapping:saved}).eq('id',t.id));
  t.mapping=saved;$('pdfMappingDialog')?.classList.remove('active');
  notifyStatus('보정한 좌표를 원본 PDF 양식에 저장했습니다. 미리보기에 바로 적용됩니다.',true);
 }catch(e){console.error(e);notifyStatus('위치 수정 저장 실패: '+(e.message||e));}
},true);
const oldSaveMapping=window.saveMapping;
window.saveMapping=async function(){
 const t=templates.find(x=>x.id===$('chosenTemplate').value);
 if(t?.mapping?.autoMode!=='pdf')return oldSaveMapping();
 const next={pos:num($('mapPos').value),name:num($('mapName').value),
   sign:num($('mapSign').value),start:num($('mapStart').value),step:num($('mapStep').value)};
 if(next.step<8||next.pos<=0||next.name<=next.pos||next.sign<=next.name)
  return notice('위치나 행 간격을 확인해 주세요.');
 const mapped=correctPdfBlocks(t,next);
 try{req(await sb.from('templates').update({mapping:mapped}).eq('id',t.id));
  t.mapping=mapped;notifyStatus('보정된 PDF 입력 위치를 저장했습니다.',true);}
 catch(e){console.error(e);notifyStatus('보정 위치 저장 실패: '+(e.message||e));}
};

const oldPreview=window.previewPrint;
window.previewPrint=async function(){
 const t=templates.find(x=>x.id===current?.selected_template_id);
 if(!t||t.kind!=='pdf'||t.mapping?.autoMode!=='pdf'){
  D.getElementById('smartTemplatePrintPage')?.remove();
  if(t?.kind==='pdf'){
   const m=t.mapping||{};
   const manual=!!(m.titleX!=null&&m.gridX!=null&&m.start!=null);
   if(!manual){
    notifyStatus('이 PDF는 표 위치가 확정되지 않았습니다. 먼저 「양식 자동 위치 인식」을 누르거나 「PDF 양식 위치 설정」에서 좌표를 지정해 주세요.');
    return;
   }
  }
  return oldPreview();
 }
 const root=$('paperPreviewRoot'),body=$('pvPages');
 root.classList.add('active');body.innerHTML='<div class="card">원본 PDF 양식에 데이터를 배치하는 중…</div>';
 try{
  await loadSignatures();
  const html=await renderAutoPdf(t);
  $('printArea').innerHTML=html;body.innerHTML=html;
  notifyStatus('자동 인식한 원본 PDF 양식으로 미리보기를 생성했습니다.');
 }catch(e){
  console.error(e);body.innerHTML='';
  notifyStatus('맞춤 양식 미리보기를 만들지 못했습니다. 양식 위치를 확인해 주세요: '+(e.message||e));
 }
};
const oldExport=window.exportCustom;
window.exportCustom=async function(format){
 const t=templates.find(x=>x.id===current?.selected_template_id);
 if(format==='pdf')return window.previewPrint();
 if(format!=='xlsx'||!t||t.kind!=='xlsx'||t.mapping?.autoMode!=='xlsx')return oldExport(format);
 if(!window.ExcelJS)return notice('ExcelJS 로딩이 필요합니다.');
 try{
  await loadSignatures();
  const book=new ExcelJS.Workbook();await book.xlsx.load(imageData(t));
  const m=t.mapping,ws=book.getWorksheet(m.sheetName)||book.worksheets[0];
  if(!ws)throw Error('시트를 찾지 못했습니다.');
  const start=Number(m.start)||2,step=Math.max(1,Number(m.step)||1);
  const maxRows=Number(m.excelCapacity)||50;
  if(people.length>maxRows)throw Error('이 양식의 인식된 명단 공간은 '+maxRows+'명입니다. 데이터가 더 많으면 양식에 행을 추가하거나 기본 양식을 사용해 주세요.');
  const cols=[m.pos,m.name,m.sign].map(colNum);
  if(cols.some(x=>x<1))throw Error('직위·성명·서명 열을 확인해 주세요.');
  for(let i=0;i<people.length;i++){
   const p=people[i],r=start+i*step;
   if([cols[0],cols[1]].some(c=>{
    const old=textValue(ws.getCell(r,c));return old.trim()!=='';
   }))throw Error(r+'행에 기존 입력값이 있어 자동으로 덮어쓰지 않았습니다. 빈 양식을 사용해 주세요.');
   ws.getCell(r,cols[0]).value=p.position;
   ws.getCell(r,cols[1]).value=p.full_name;
   if(m.num)ws.getCell(m.num+r).value=i+1;
   if(p.signature_data?.startsWith('data:image/png;base64,')){
    const id=book.addImage({base64:p.signature_data,extension:'png'});
    const target=ws.getCell(r,cols[2]);
    const height=ws.getRow(r).height||22;
    ws.addImage(id,{tl:{col:cols[2]-1+.08,row:r-1+.08},
      ext:{width:Math.min(94,(ws.getColumn(cols[2]).width||13)*6.5),height:Math.min(28,height*1.25)},
      editAs:'oneCell'});
   }
  }
  for(const [name,value] of [['title',current.title],['date',current.when_text],['place',current.place]]){
   const target=m.excelCells?.[name];
   if(target&&value)ws.getCell(target).value=value;
  }
  const buffer=await book.xlsx.writeBuffer();
  download((current.title||'연수')+'_맞춤서명부.xlsx',new Blob([buffer],
   {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  notifyStatus('원본 Excel 양식의 열 위치에 맞춰 저장했습니다.');
 }catch(e){console.error(e);notifyStatus('맞춤 Excel 출력 실패: '+(e.message||e))}
};
window.ElecyonsuSmartTemplate={
 detectPdf:analyzePdf,detectExcel:analyzeExcel,
 _test:{norm,field,extractHeaderGroups,scanExcelHeaders,columnName,colNum}
};
})();