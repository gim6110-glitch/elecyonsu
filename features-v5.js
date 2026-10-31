/* v5 – spreadsheet / PDF usability, atomic imports, live updates, dashboard and mobile layout */
(function(){
'use strict';
const byId=id=>document.getElementById(id);
const rules=`
/* Page */
html{scroll-behavior:smooth}body{overflow-x:hidden}
#home>.row,#detail>.actions{gap:10px}#list{display:grid;grid-template-columns:repeat(auto-fill,minmax(275px,1fr));gap:12px}
.training-card{border:1px solid #dce4f4;background:#fff;border-radius:13px;padding:18px;min-width:0;box-shadow:0 2px 7px #23365711}
.training-card h3{margin:0 0 8px;color:#243147;overflow-wrap:anywhere;font-size:18px}
.training-card p{margin:5px 0;color:#62708b;font-size:13px}
.training-card .mini-progress{height:7px;background:#eef1f8;border-radius:9px;margin:9px 0;overflow:hidden}
.training-card .mini-progress span{display:block;height:100%;background:linear-gradient(90deg,#6955ed,#e15ca5)}
.training-card .actions button{padding:9px 11px;min-width:60px}
#trainingSearch{width:100%;max-width:440px;background:white}
#people .desktop-roster{width:100%}
#people .mobile-roster{display:none}
.roster-mobile-card{border:1px solid #dfe5f1;border-radius:12px;padding:12px;margin:10px 0;background:#fff}
.roster-mobile-main{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.roster-mobile-main strong{font-size:17px}.roster-mobile-card .actions{gap:5px;margin-top:11px}
.roster-mobile-card .actions button{min-height:41px;min-width:44px;flex:1}
.v5-backdrop{position:fixed;inset:0;z-index:10020;background:#17203b99;display:none;align-items:center;justify-content:center;padding:14px}
.v5-backdrop.active{display:flex}.v5-modal{background:#fff;border-radius:16px;padding:22px;width:min(500px,100%);max-height:90dvh;overflow-y:auto;box-shadow:0 20px 70px #070e2844}
.v5-modal h2{margin:0 0 14px}.v5-modal label{display:block;margin:10px 0 0}
.v5-modal .actions{justify-content:flex-end;margin-top:12px}
#excelTemplatePreview{border:1px solid #e1e7f2;padding:11px;border-radius:10px;margin:10px 0;display:none}
#excelTemplatePreview .excel-sample{width:100%;overflow:auto;max-height:205px}
#excelTemplatePreview table{min-width:340px}#excelTemplatePreview td{font-size:12px}
#pdfMappingDialog .submodal-card{max-height:93dvh}
#pdfMapHelp{font-size:13px;color:#5a647b;background:#edf3ff;padding:8px;border-radius:7px}
#pvPages{width:100%;min-width:0}
#pvPages .paper-sheet{max-width:calc(100vw - 40px)!important;height:auto!important;aspect-ratio:var(--page-ratio,595/841);margin:0 auto}
#pvPages .paper-sheet>img,#pvPages .paper-sheet>svg{width:100%;height:100%}
#paperPreviewRoot .pvtools{position:sticky;top:0;z-index:2;flex-wrap:wrap}
#paperPreviewRoot .pvbody{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:14px;gap:16px}
#detail #qr img,#detail #qr canvas{max-width:100%;height:auto}
@media(min-width:851px) and (max-width:1100px){.grid{grid-template-columns:minmax(0,1.5fr) minmax(310px,1fr)}}
@media(max-width:850px){.grid{grid-template-columns:1fr}#detail .card{min-width:0}.wrap{max-width:820px}.top{padding:18px 4%}}
@media(max-width:640px){
 .wrap{padding:0 10px;margin:15px auto}
 .top{padding:15px 14px}.top h1{font-size:21px}
 .card{padding:16px;border-radius:13px;margin:12px 0}
 h2{font-size:18px}.row{gap:8px}.row>*{min-width:100%}
 input,select,textarea{font-size:16px!important;min-height:43px}
 button{min-height:42px}
 #home>.row .actions{width:100%}#home>.row .actions button{flex:1}
 #detail>.actions{display:grid;grid-template-columns:1fr 1fr}
 #detail>.actions button{margin:0;white-space:normal}
 #detail>.actions button:last-child{grid-column:1/-1}
 .desktop-roster{display:none!important}
 #people .mobile-roster{display:block}
 .roster-tools{align-items:stretch}.roster-tools>b{width:100%}
 .roster-tools .actions{display:grid;grid-template-columns:repeat(3,1fr);width:100%}
 .roster-tools .actions button{min-width:0;padding:8px 4px;margin:0}
 #appDialogCard,.v5-modal{padding:18px;max-height:93dvh}
 #pdfMappingDialog .submodal-card{padding:13px}
 #mapping .row>*{flex:1;min-width:0}
 #publicSign{padding:15px}
 #signcanvas{height:210px}
 #paperPreviewRoot .pvtools{font-size:13px}
 #paperPreviewRoot .pvtools button{flex:1}
 #list{grid-template-columns:minmax(0,1fr)}
}
@media print{
 .v5-backdrop,#excelTemplatePreview{display:none!important}
 #pvPages .paper-sheet{max-width:none!important;width:210mm!important;height:297mm!important;aspect-ratio:auto!important}
 .training-card{display:none}
}
`;
const style=document.createElement('style');style.textContent=rules;document.head.appendChild(style);

// Training collection enhancements: search, summary counts, clone and delete.
const home=byId('home');
const list=byId('list');
const searchBox=document.createElement('input');
searchBox.id='trainingSearch';searchBox.type='search';searchBox.placeholder='연수명·장소 검색';searchBox.setAttribute('aria-label','연수 검색');
list.before(searchBox);
let counts=new Map(),searchQuery='',liveChannel=null,refreshPending=false;
function tile(t){
 const a=counts.get(t.id)||{total:0,signed:0};
 const percent=a.total?Math.round(a.signed/a.total*100):0;
 return '<article class="training-card">'+
 '<h3>'+escapeHtml(t.title)+'</h3><p>📅 '+escapeHtml(t.when_text)+'</p><p>📍 '+escapeHtml(t.place)+'</p>'+
 '<p>서명 '+a.signed+' / '+a.total+'명 ('+percent+'%)</p>'+
 '<div class="mini-progress"><span style="width:'+percent+'%"></span></div>'+
 '<div class="actions"><button onclick="openTraining(\''+t.id+'\')">관리</button>'+
 '<button class="alt" onclick="cloneTraining(\''+t.id+'\')">복제</button>'+
 '<button class="danger" onclick="deleteTraining(\''+t.id+'\')">삭제</button></div></article>';
}
function renderTrainingCards(){
 const q=searchQuery.toLocaleLowerCase('ko-KR');
 const results=trainings.filter(t=>(t.title+' '+(t.place||'')+' '+(t.when_text||'')).toLocaleLowerCase('ko-KR').includes(q));
 list.innerHTML=results.length?results.map(tile).join(''):'<p class="muted">조건에 맞는 연수가 없습니다.</p>';
}
searchBox.addEventListener('input',()=>{searchQuery=searchBox.value.trim();renderTrainingCards()});
async function populateCounts(){
 try{const data=req(await sb.rpc('get_training_summaries'));counts=new Map((data||[]).map(x=>[x.training_id,{total:Number(x.total_count),signed:Number(x.signed_count)}]));}
 catch(e){console.warn('Training summaries unavailable',e);notice('연수별 인원 현황을 표시하려면 v5 SQL을 실행하세요.');counts=new Map()}
}
const previousHome=window.showHome;
window.showHome=async function(){
 stopRealtime();await previousHome();
 await populateCounts();renderTrainingCards();
};
window.cloneTraining=async function(id){
 const t=trainings.find(x=>x.id===id);if(!t)return;
 if(!confirm('"'+t.title+'" 연수를 복제하시겠습니까? 참석자 명단만 복사하며 기존 서명은 복사하지 않습니다.'))return;
 let created=null;
 try{
  created=req(await sb.from('trainings').insert({owner_id:user.id,title:t.title+' (복제)',when_text:t.when_text,place:t.place,page_size:t.page_size,selected_template_id:t.selected_template_id||null}).select().single());
  const prior=req(await sb.from('participant_admin').select('position,full_name').eq('training_id',id).order('sort_order'));
  if(prior.length)await importRows(created.id,prior);
  await showHome();notice('연수와 명단을 복제했습니다. 서명은 복사하지 않았습니다.');
 }catch(e){
  if(created){await sb.from('trainings').delete().eq('id',created.id)}
  err(e);
 }
};
window.deleteTraining=async function(id){
 const t=trainings.find(x=>x.id===id);if(!t)return;
 const name=prompt('연수 삭제는 되돌릴 수 없습니다. 삭제하려면 연수명을 그대로 입력하세요.\n'+t.title);
 if(name!==t.title)return;
 try{req(await sb.from('trainings').delete().eq('id',id));await showHome();notice('연수를 삭제했습니다.')}
 catch(e){err(e)}
};
async function importRows(trainingId,rows){
 if(!rows.length)return 0;
 const clean=rows.map(x=>({position:String(x.position||x['직급']||x['직위']||'교사').trim()||'교사',full_name:String(x.full_name||x['성명']||'').trim()}));
 if(clean.some(x=>!x.full_name||x.full_name.length>120||x.position.length>100))throw Error('일부 명단의 성명 또는 직급을 확인하세요.');
 let added=0;
 for(let start=0;start<clean.length;start+=200){
  const batch=clean.slice(start,start+200);
  added+=Number(req(await sb.rpc('add_participants_batch',{p_training:trainingId,p_rows:batch})));
 }
 return added;
}
// Atomic Excel roster import.
window.uploadRoster=async function(event){
 const file=event.target.files?.[0];if(!file)return;
 try{
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});const ws=wb.Sheets[wb.SheetNames.includes('명단')?'명단':wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{defval:''}).filter(r=>String(r['성명']||'').trim());
  if(!rows.length)throw Error('성명 열이 없거나 명단이 비어 있습니다. 먼저 빈 명단 양식을 다운로드해 작성하세요.');
  if(rows.length>200)throw Error('한 번에 200명까지 업로드하세요.');
  const duplicateNames=rows.filter((r,i)=>rows.findIndex(x=>String(x['성명']).trim()===String(r['성명']).trim() && String(x['직급']||x['직위'])===String(r['직급']||r['직위']))!==i);
  const extra=duplicateNames.length?'\n같은 성명·직급이 '+duplicateNames.length+'건 있어 확인이 필요합니다.':'';
  if(!confirm(rows.length+'명을 한 번에 등록하시겠습니까?'+extra))return;
  const count=await importRows(current.id,rows);
  await loadPeople();notice(count+'명의 명단을 한 번에 등록했습니다.');
 }catch(e){err(e)}finally{event.target.value=''}
};
// Override previous roster import button, retaining modal picker already created in v4.
byId('importPrevious').onclick=async function(){
 const item=document.querySelector('input[name="previousTraining"]:checked');
 if(!item)return notice('이전 연수를 선택해 주세요.');
 const btn=this;btn.disabled=true;
 try{
  const rows=req(await sb.from('participant_admin').select('position,full_name').eq('training_id',item.value).order('sort_order'));
  if(!rows.length)return notice('이전 연수에 참석자가 없습니다.');
  if(!confirm('이전 연수의 직급·성명 '+rows.length+'명을 복사할까요? 서명은 복사되지 않습니다.'))return;
  const count=await importRows(current.id,rows);
  byId('previousRosterDialog').classList.remove('active');
  await loadPeople();notice(count+'명의 명단을 복사했습니다.');
 }catch(e){err(e)}finally{btn.disabled=false}
};
// Replace recurring heavy full-image fetch: only status fields refreshed.
let activeTrainingId=null;
window.loadPeople=async function(){
 if(!current)return;
 const target=current.id;
 try{
  const rows=req(await sb.from('participant_admin')
    .select('id,training_id,position,full_name,sort_order,signed_at,created_at')
    .eq('training_id',target).order('sort_order',{ascending:true}).order('created_at',{ascending:true}));
  if(!current||current.id!==target)return;
  people=rows||[];
  const signed=people.reduce((n,p)=>n+(p.signed_at?1:0),0),pct=people.length?Math.round(signed/people.length*100):0;
  byId('count').textContent=signed+' / '+people.length+'명';
  byId('pct').textContent=pct+'% 완료';
  byId('progress').value=pct;
  renderPeople();
 }catch(e){err(e)}
};
async function loadSignatureImages(){
 if(!current)return;
 const id=current.id;
 const signed=people.filter(x=>x.signed_at);
 if(!signed.length)return;
 const data=req(await sb.from('participant_admin').select('id,signature_data').eq('training_id',id).not('signed_at','is',null).order('sort_order',{ascending:true}).limit(1000));
 if(current?.id!==id)throw Error('연수를 변경했습니다. 다시 시도하세요.');
 const imgs=new Map(data.map(x=>[x.id,x.signature_data]));
 people.forEach(p=>{if(p.signed_at)p.signature_data=imgs.get(p.id)||null});
}
function stopRealtime(){
 if(liveChannel){sb?.removeChannel(liveChannel);liveChannel=null}
 clearInterval(poll);poll=null;
}
function startRealtime(){
 if(!current||!sb)return;
 const id=current.id;
 liveChannel=sb.channel('signatures-'+id)
 .on('postgres_changes',{event:'*',schema:'public',table:'participants',filter:'training_id=eq.'+id},()=>{
  if(current?.id!==id||refreshPending)return;
  refreshPending=true;Promise.resolve().then(()=>loadPeople()).finally(()=>refreshPending=false);
 }).subscribe(state=>{
  if(state==='SUBSCRIBED'){
   clearInterval(poll);
   poll=setInterval(()=>{if(current?.id===id)loadPeople()},60000);
  }else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'){
   clearInterval(poll);
   poll=setInterval(()=>{if(current?.id===id)loadPeople()},15000);
  }
 });
}
const openPrior=window.openTraining;
window.openTraining=async function(id){
 stopRealtime();await openPrior(id);
 if(current?.id===id)startRealtime();
};
const previewPrior=window.previewPrint;
window.previewPrint=async function(){
 try{await loadSignatureImages();await previewPrior()}
 catch(e){err(e)}
};
const exportPrior=window.exportCustom;
window.exportCustom=async function(type){
 try{await loadSignatureImages();await exportPrior(type)}
 catch(e){err(e)}
};
// Mobile-first participant card layout.
const oldRender=window.renderPeople;
window.renderPeople=function(){
 oldRender();
 const host=byId('people');
 const table=host.querySelector('table');if(!table)return;
 table.classList.add('desktop-roster');
 const selectedCheckboxes=new Map([...table.querySelectorAll('input.roster-chk[data-id]')].map(x=>[x.dataset.id,x.checked]));
 const safeID=id=>String(id).replace(/[^a-f0-9-]/gi,'');
 const mobile=document.createElement('div');mobile.className='mobile-roster';
 mobile.innerHTML=people.map((p,i)=>'<article class="roster-mobile-card">'+
  '<div class="roster-mobile-main"><label style="display:flex;gap:9px;align-items:center;font-size:16px">'+
  '<input type="checkbox" class="roster-chk" data-id="'+safeID(p.id)+'" '+(selectedCheckboxes.get(p.id)?'checked':'')+' aria-label="'+escapeHtml(p.full_name)+' 선택">'+
  '<strong>'+(i+1)+'. '+escapeHtml(p.full_name)+'</strong></label>'+
  '<span class="'+(p.signed_at?'tag':'muted')+'">'+(p.signed_at?'서명 완료':'미완료')+'</span></div>'+
  '<div class="muted" style="margin-top:6px">직급: '+escapeHtml(p.position)+'</div>'+
  '<div class="actions"><button class="alt" '+(i===0?'disabled':'')+' onclick="movePerson(\''+p.id+'\',-1)" aria-label="위로 이동">↑ 위</button>'+
  '<button class="alt" '+(i===people.length-1?'disabled':'')+' onclick="movePerson(\''+p.id+'\',1)" aria-label="아래로 이동">↓ 아래</button>'+
  '<button class="alt" onclick="editPerson(\''+p.id+'\')">수정</button>'+
  '<button class="alt" '+(!p.signed_at?'disabled':'')+' onclick="resetPerson(\''+p.id+'\')">서명 초기화</button>'+
  '<button class="danger" onclick="delPerson(\''+p.id+'\')">삭제</button></div></article>').join('');
 host.appendChild(mobile);
};
// Sync hidden/visible checkboxes when user switches device width.
byId('people').addEventListener('change',event=>{
 if(!event.target.matches('input.roster-chk[data-id]'))return;
 const id=event.target.dataset.id;
 byId('people').querySelectorAll('input.roster-chk[data-id]').forEach(el=>{if(el.dataset.id===id)el.checked=event.target.checked});
});
// Participant editing: central modal, not browser prompt.
document.body.insertAdjacentHTML('beforeend',`
<div id="participantModal" class="v5-backdrop" role="dialog" aria-modal="true" aria-label="참석자 수정">
 <form class="v5-modal" id="participantForm">
  <h2>참석자 정보 수정</h2>
  <label for="editPosition">직급 / 직위</label><input id="editPosition" maxlength="100" required>
  <label for="editName">성명</label><input id="editName" maxlength="120" required>
  <p class="muted">이미 서명한 참석자의 성명·직급을 바꾸면 기존 서명 기록의 대상 정보도 변경됩니다.</p>
  <div class="actions"><button type="button" class="alt" id="editPersonCancel">취소</button><button type="submit" id="editPersonSave">저장</button></div>
 </form>
</div>`);
let editingParticipant=null;
window.editPerson=function(id){
 const p=people.find(p=>p.id===id);if(!p)return;
 editingParticipant=p;byId('editPosition').value=p.position;byId('editName').value=p.full_name;
 byId('participantModal').classList.add('active');byId('editName').focus();
};
const closePerson=()=>byId('participantModal').classList.remove('active');
byId('editPersonCancel').onclick=closePerson;
byId('participantModal').addEventListener('click',e=>{if(e.target===byId('participantModal'))closePerson()});
byId('participantForm').addEventListener('submit',async e=>{
 e.preventDefault();const p=editingParticipant;if(!p||!current)return;
 const position=byId('editPosition').value.trim(),full_name=byId('editName').value.trim();
 if(!position||!full_name)return notice('직급과 이름을 입력해 주세요.');
 if(p.signed_at&&(position!==p.position||full_name!==p.full_name)&&!confirm('이미 서명이 있는 참석자입니다. 기록 이름을 바꾸시겠습니까?'))return;
 const btn=byId('editPersonSave');btn.disabled=true;
 try{req(await sb.from('participants').update({position,full_name}).eq('training_id',current.id).eq('id',p.id));
 closePerson();await loadPeople();notice('참석자 정보를 수정했습니다.')}
 catch(error){err(error)}finally{btn.disabled=false}
});
// Enhanced Excel layout inspector using the selected source workbook.
const templateMapping=byId('mapping');
const preview=document.createElement('div');preview.id='excelTemplatePreview';
templateMapping.append(preview);
const changePrior=window.chooseTemplate;
window.chooseTemplate=function(){
 changePrior();
 renderExcelPreview().catch(e=>{console.warn(e);preview.textContent='Excel 미리보기를 표시할 수 없습니다.'});
};
async function renderExcelPreview(){
 const template=templates.find(t=>t.id===byId('chosenTemplate').value);
 if(!template||template.kind!=='xlsx'){preview.style.display='none';return}
 preview.style.display='block';preview.textContent='Excel 양식 확인 중…';
 if(!window.ExcelJS){preview.textContent='ExcelJS 로드가 필요합니다.';return}
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(baseBytes(template.file_data));
 const ws=wb.worksheets[0];if(!ws){preview.textContent='사용 가능한 워크시트가 없습니다.';return}
 const table=document.createElement('table');
 for(let row=1;row<=Math.min(10,ws.rowCount||10);row++){
  const tr=document.createElement('tr');
  for(let col=1;col<=Math.min(6,ws.columnCount||6);col++){
   const td=document.createElement('td');td.textContent=String(ws.getRow(row).getCell(col).text||'').slice(0,50);
   tr.append(td);
  }
  table.append(tr);
 }
 preview.innerHTML='<b>Excel 양식 구조 확인</b><p class="muted">'+escapeHtml(ws.name)+' · '+ws.rowCount+'행 · 최초 10행 미리보기. 위 입력칸에서 직급·성명·서명 열을 지정하세요.</p>';
 const shell=document.createElement('div');shell.className='excel-sample';shell.append(table);preview.append(shell);
}
// Surface-only enhancements for PDF mapping controls; coordinates remain per template and need testing.
const mapper=byId('pdfMappingDialog');
if(mapper){
 const text=document.createElement('p');text.id='pdfMapHelp';
 text.textContent='필드 선택 → PDF에서 위치 클릭 → 설정 저장 → 출력 미리보기에서 확인하세요. 다른 학교 서식은 표 위치를 자동으로 감지하지 않습니다.';
 mapper.querySelector('#mappingField')?.insertAdjacentElement('afterend',text);
}
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape')return;
 ['participantModal','previousRosterDialog','pdfMappingDialog','appDialogRoot','paperPreviewRoot'].forEach(id=>byId(id)?.classList.remove('active'));
});
})();
