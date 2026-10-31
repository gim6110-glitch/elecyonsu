/* 2026-10-30: no confirmation codes; configurable template/rows; bulk delete; previous roster chooser */
(function(){
'use strict';
const D=document,$v=id=>D.getElementById(id);
const css=D.createElement('style');css.textContent=`
.roster-tools{display:flex;gap:9px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:14px 0}
.roster-tools button{font-size:13px}.roster-chk{width:17px;height:17px;min-width:17px;margin:0;accent-color:#6255f5;cursor:pointer}
#people td:nth-child(3),#people th:nth-child(3){text-align:center;width:40px}
#previousRosterDialog,#pdfMappingDialog{position:fixed;inset:0;background:#18213ca6;z-index:10010;display:none;align-items:center;justify-content:center;padding:18px}
#previousRosterDialog.active,#pdfMappingDialog.active{display:flex}
.submodal-card{max-width:620px;width:100%;max-height:90vh;overflow:auto;border-radius:15px;padding:24px;background:#fff}
.previous-option{display:flex;justify-content:space-between;align-items:center;border:1px solid #dce2ef;padding:13px;border-radius:8px;margin:7px 0;cursor:pointer}
.template-note{padding:10px;background:#eff4ff;border-radius:8px;color:#364666;font-size:13px;margin:8px 0}
.mapping-canvas{max-width:100%;border:1px solid #aab5c7;display:block;margin:auto;cursor:crosshair}
.mapFields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.mapFields label{display:block;font-size:12px}
.mapFields input,.mapFields select{margin:1px 0 8px}
@media(max-width:600px){.mapFields{grid-template-columns:1fr}}
`;D.head.append(css);
// Delete all confirmation-code controls in the public signature page.
const oldCodeField=$v('signCode');
if(oldCodeField){
 const label=oldCodeField.previousElementSibling;
 if(label&&label.tagName==='LABEL')label.textContent='직급 / 직위';
 oldCodeField.id='signPosition';oldCodeField.placeholder='예: 교사';
 const hint=oldCodeField.nextElementSibling;
 if(hint)hint.textContent='별도 확인코드 없이 본인이 직접 서명해 주세요.';
}
if(!$v('selfConfirm')){
 $v('signcanvas').insertAdjacentHTML('beforebegin','<label style="display:flex;align-items:center;gap:8px;margin:12px 0;font-weight:400"><input id="selfConfirm" type="checkbox" style="width:19px;margin:0"> 본인이 직접 작성한 서명임을 확인합니다.</label>');
}
// Use new restricted server functions. Revoke code-based endpoints in migration.
let cachedTrainingId=null,cachedOrder=0;
window.addPerson=async function(position,name){
 if(cachedTrainingId!==current.id){cachedTrainingId=current.id;cachedOrder=0}
 if(!cachedOrder)cachedOrder=(people.length?Math.max(...people.map(p=>Number(p.sort_order)||0)):0);

 const value=String(name||'').trim(),job=String(position||'교사').trim();
 if(!value)throw Error('성명을 입력하세요');
 const order=++cachedOrder;
 req(await sb.rpc('add_participant_simple',{p_training:current.id,p_position:job,p_name:value,p_order:order}));
 return null;
};
window.addOne=async function(){
 const name=$v('personName').value.trim(),position=$v('position').value.trim()||'교사';
 if(!name)return notice('성명을 입력해 주세요.');
 try{await addPerson(position,name);$v('personName').value='';await loadPeople();notice('참석자가 추가되었습니다.')}catch(e){err(e)}
};
window.uploadRoster=async function(ev){
 const file=ev.target.files?.[0];if(!file)return;
 try{
  if(!window.XLSX)throw Error('Excel 라이브러리를 읽지 못했습니다.');
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
  const sheet=wb.Sheets[wb.SheetNames.includes('명단')?'명단':wb.SheetNames[0]];
  const entries=XLSX.utils.sheet_to_json(sheet,{defval:''}).filter(row=>String(row['성명']||'').trim());
  if(entries.length===0)throw Error('첫 행에 직위(직급)와 성명 열이 있어야 합니다.');
  if(entries.length>200)throw Error('한 번에 200명까지 등록할 수 있습니다.');
  if(!confirm(entries.length+'명을 추가하시겠습니까? 확인코드는 생성되지 않습니다.'))return;
  for(const row of entries){await addPerson(String(row['직급']||row['직위']||'교사'),String(row['성명']))}
  await loadPeople();notice(entries.length+'명 등록 완료');
 }catch(e){err(e)}finally{ev.target.value=''}
};
window.submitSign=async function(){
 const name=$v('signName').value.trim(),position=$v('signPosition').value.trim();
 if(!name||!position)return notice('성명과 직급을 입력해 주세요.');
 if(!$v('selfConfirm').checked)return notice('본인 직접 서명 확인에 동의해 주세요.');
 if(!drawn)return notice('손글씨 서명을 작성해 주세요.');
 try{
  const token=new URLSearchParams(location.search).get('sign');
  const status=req(await sb.rpc('submit_signature_simple',{p_token:token,p_name:name,p_position:position,p_signature:$v('signcanvas').toDataURL('image/png')}));
  const labels={OK:'서명이 등록되었습니다.',NO_MATCH:'명단과 일치하는 성명·직급이 없습니다. 담당자에게 확인하세요.',AMBIGUOUS:'같은 성명과 직급의 참석자가 여러 명입니다. 담당자에게 문의하세요.',ALREADY:'이미 서명한 참석자입니다.',CLOSED:'서명 접수가 종료되었습니다.',INVALID_IMAGE:'서명 크기 또는 형식이 올바르지 않습니다.'};
  $v('signResult').textContent=labels[status]||'서명을 완료하지 못했습니다.';
  if(status==='OK'){D.querySelector('button[onclick="submitSign()"]').disabled=true;notice('서명이 완료되었습니다.')}
 }catch(e){err(e)}
};
// Bulk selection and deletion.
const selected=new Set();
const peopleCard=$v('people');peopleCard.insertAdjacentHTML('beforebegin',
 '<div class="roster-tools"><b>명단 선택 관리</b><div class="actions"><button class="danger" id="deleteSelected" type="button">선택 삭제</button><button class="alt" id="selectAllRoster" type="button">전체 선택</button><button class="alt" id="clearRosterSelection" type="button">선택 해제</button></div></div>');
$v('deleteSelected').onclick=bulkDelete;
$v('selectAllRoster').onclick=()=>{people.forEach(p=>selected.add(p.id));renderPeople()};
$v('clearRosterSelection').onclick=()=>{selected.clear();renderPeople()};
peopleCard.addEventListener('change',e=>{
 if(e.target.id==='rosterSelectAll'){if(e.target.checked)people.forEach(p=>selected.add(p.id));else selected.clear();renderPeople()}
 if(e.target.matches('.roster-chk[data-id]')){let id=e.target.dataset.id;if(e.target.checked)selected.add(id);else selected.delete(id);refreshMaster()}
});
function refreshMaster(){const m=$v('rosterSelectAll');if(m){m.checked=people.length>0&&people.every(p=>selected.has(p.id));m.indeterminate=people.some(p=>selected.has(p.id))&&!m.checked}}
window.renderPeople=function(){
 const ids=new Set(people.map(p=>p.id));for(const id of [...selected])if(!ids.has(id))selected.delete(id);
 $v('people').innerHTML='<table><thead><tr><th>연번</th><th>직급</th><th><input id="rosterSelectAll" class="roster-chk" type="checkbox" aria-label="전체 선택"></th><th>성명</th><th>서명</th><th>작업</th></tr></thead><tbody>'+
 people.map((p,i)=>'<tr><td>'+(i+1)+'</td><td>'+escapeHtml(p.position)+'</td><td><input class="roster-chk" type="checkbox" data-id="'+p.id+'" aria-label="'+escapeHtml(p.full_name)+' 선택" '+(selected.has(p.id)?'checked':'')+'></td><td>'+escapeHtml(p.full_name)+'</td><td>'+(p.signed_at?'<span class="tag">완료</span>':'미완료')+'</td><td class="actions"><button class="alt" '+(!i?'disabled':'')+' onclick="movePerson(\''+p.id+'\',-1)">↑</button><button class="alt" '+(i===people.length-1?'disabled':'')+' onclick="movePerson(\''+p.id+'\',1)">↓</button><button class="alt" onclick="editPerson(\''+p.id+'\')">✎</button><button class="alt" title="서명 초기화" '+(p.signed_at?'':'disabled')+' onclick="resetPerson(\''+p.id+'\')">↻</button><button class="danger" onclick="delPerson(\''+p.id+'\')">×</button></td></tr>').join('')+'</tbody></table>';
 refreshMaster();
};
async function renumber(){
 const {data,error}=await sb.from('participant_admin').select('id,sort_order').eq('training_id',current.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
 if(error)throw error;
 for(let i=0;i<data.length;i++)if(data[i].sort_order!==i+1)req(await sb.from('participants').update({sort_order:i+1}).eq('id',data[i].id));
 await loadPeople();
}
async function bulkDelete(){
 const ids=[...selected];if(!ids.length)return notice('삭제할 참석자를 선택하세요.');
 if(!confirm(ids.length+'명을 삭제할까요? 이들의 전자서명도 함께 삭제되며 복구할 수 없습니다.'))return;
 try{req(await sb.from('participants').delete().eq('training_id',current.id).in('id',ids));selected.clear();await renumber();notice(ids.length+'명이 삭제되었습니다.')}catch(e){err(e)}
}
window.delPerson=async function(id){
 if(!confirm('선택한 참석자와 전자서명을 삭제하시겠습니까?'))return;
 try{req(await sb.from('participants').delete().eq('training_id',current.id).eq('id',id));selected.delete(id);await renumber();notice('참석자를 삭제하고 연번을 재정렬했습니다.')}catch(e){err(e)}
};
window.movePerson=async function(id,delta){
 const i=people.findIndex(p=>p.id===id),j=i+delta;if(i<0||j<0||j>=people.length)return;
 const order=people.slice();[order[i],order[j]]=[order[j],order[i]];
 try{for(let k=0;k<order.length;k++)if(order[k].sort_order!==k+1)req(await sb.from('participants').update({sort_order:k+1}).eq('id',order[k].id));await loadPeople()}catch(e){err(e)}
};
// Previous training selector: see actual trainings, then copy into current session.
D.body.insertAdjacentHTML('beforeend',`
<div id="previousRosterDialog" role="dialog" aria-modal="true">
 <div class="submodal-card"><h2>이전 연수 명단 불러오기</h2>
 <p class="muted">내가 개설한 이전 연수를 선택합니다. 직급·성명만 복사되며 기존 서명은 가져오지 않습니다.</p>
 <div id="previousRosterList"></div>
 <div class="actions" style="justify-content:flex-end"><button type="button" class="alt" id="closePrevious">취소</button><button type="button" id="importPrevious">선택한 연수 불러오기</button></div></div>
</div>`);
const pDlg=$v('previousRosterDialog');$v('closePrevious').onclick=()=>pDlg.classList.remove('active');
let sourceTrainingId=null;
window.copyRoster=async function(){
 if(!current)return;
 try{await loadTrainings();const old=trainings.filter(t=>t.id!==current.id);
  if(!old.length)return notice('이전에 생성한 다른 연수가 없습니다.');
  $v('previousRosterList').innerHTML=old.map(t=>'<label class="previous-option"><span><b>'+escapeHtml(t.title)+'</b><br><small>'+escapeHtml(t.when_text)+' · '+escapeHtml(t.place)+'</small></span><input type="radio" name="previousTraining" value="'+t.id+'" style="width:20px"></label>').join('');
  sourceTrainingId=null;pDlg.classList.add('active');
 }catch(e){err(e)}
};
$v('previousRosterList').addEventListener('change',e=>{if(e.target.name==='previousTraining')sourceTrainingId=e.target.value});
$v('importPrevious').onclick=async()=>{
 if(!sourceTrainingId)return notice('불러올 연수를 선택해 주세요.');
 const btn=$v('importPrevious');btn.disabled=true;
 try{
  const rows=req(await sb.from('participant_admin').select('position,full_name').eq('training_id',sourceTrainingId).order('sort_order',{ascending:true}));
  if(!rows.length)return notice('선택한 연수에 등록된 명단이 없습니다.');
  if(!confirm(rows.length+'명의 직급과 성명을 현재 연수에 추가하시겠습니까? (서명은 복사되지 않습니다.)'))return;
  for(const p of rows)await addPerson(p.position,p.full_name);
  pDlg.classList.remove('active');await loadPeople();notice(rows.length+'명 명단 복사가 완료되었습니다.');
 }catch(e){err(e)}finally{btn.disabled=false}
};
// Template chooser: persist choice by training, not by browser.
const origNew=window.newTraining,origEdit=window.editTraining;
function fillDialogTemplate(chosenId){
 const x=$v('dlgTemplate');
 x.innerHTML='<option value="">기본 양식 — 인원수에 따라 표 자동 조절</option>'+
 templates.map(t=>'<option value="'+t.id+'">'+escapeHtml(t.title)+' ('+t.kind.toUpperCase()+')</option>').join('');
 x.value=chosenId||'';
}
window.newTraining=function(){origNew();fillDialogTemplate('')};
window.editTraining=function(){origEdit();fillDialogTemplate(current?.selected_template_id||'')};
const origChoose=window.chooseTemplate,origFill=window.fillTemplateOptions;
let noSave=false;
window.chooseTemplate=async function(){
 origChoose();
 if(!current||noSave)return;
 const id=$v('chosenTemplate').value||null;
 try{req(await sb.from('trainings').update({selected_template_id:id}).eq('id',current.id));current.selected_template_id=id;notice('이 연수의 출력 양식 선택을 저장했습니다.')}catch(e){err(e)}
};
window.fillTemplateOptions=function(){
 noSave=true;origFill();
 $v('chosenTemplate').value=current?.selected_template_id||'';
 origChoose();noSave=false;
};
const oldHome=window.showHome;
window.showHome=async function(){selected.clear();cachedTrainingId=null;cachedOrder=0;await oldHome()};
// Visual PDF template mapping setup.
const mapUI=`
<div id="pdfMappingDialog" role="dialog" aria-modal="true">
 <div class="submodal-card" style="max-width:900px">
 <h2>학교 PDF 양식 위치 설정</h2>
 <p class="template-note">어느 학교의 PDF든 업로드한 원본을 배경으로 사용합니다. 자동 문서 인식은 하지 않으며, 아래 위치를 직접 맞춰 주세요. 표 재생성을 켜면 기존 표 위에 페이지당 인원수만큼 새로운 표를 그립니다.</p>
 <label>PDF에서 클릭해 배치할 항목</label><select id="mappingField">
 <option value="title">연수명 중앙</option><option value="date">일시 입력 위치</option><option value="place">장소 입력 위치</option>
 <option value="pos">왼쪽 첫 직급</option><option value="name">왼쪽 첫 성명</option><option value="sign">왼쪽 첫 서명</option>
 <option value="start">첫 참석자 행 Y</option>
 </select>
 <div class="mapFields">
 <label>제목 X<input id="m_titleX" type="number"></label><label>제목 Y<input id="m_titleY" type="number"></label>
 <label>일시 X<input id="m_dateX" type="number"></label><label>일시 Y<input id="m_dateY" type="number"></label>
 <label>장소 X<input id="m_placeX" type="number"></label><label>장소 Y<input id="m_placeY" type="number"></label>
 <label>직급 X<input id="m_pos" type="number"></label><label>성명 X<input id="m_name" type="number"></label>
 <label>서명 X<input id="m_sign" type="number"></label><label>첫 행 Y<input id="m_start" type="number"></label>
 <label>행 간격 pt<input id="m_step" type="number" min="8" max="100"></label>
 <label>두 번째 표 시작 간격 pt<input id="m_offset" type="number"></label>
 <label>표 단 수<select id="m_cols"><option value="2">좌우 2단</option><option value="1">1단</option></select></label>
 <label>표 재생성<select id="m_redraw"><option value="no">원본 표 유지</option><option value="yes">표를 지우고 인원수에 맞게 다시 그림</option></select></label>
 <label>표 영역 왼쪽 X<input id="m_gridX" type="number"></label><label>표 영역 위 Y<input id="m_gridY" type="number"></label>
 <label>표 영역 너비<input id="m_gridW" type="number"></label><label>표 영역 높이<input id="m_gridH" type="number"></label>
 </div>
 <p class="muted">위치 좌표 단위는 PDF 포인트(pt)이며 왼쪽 위가 원점입니다. 배경 PDF 클릭으로도 위치를 지정할 수 있습니다.</p>
 <canvas id="templateCanvas" class="mapping-canvas"></canvas>
 <div class="actions" style="justify-content:flex-end;margin-top:10px"><button class="alt" id="closeMapping">취소</button><button id="saveMapVisual">설정 저장</button></div>
 </div>
</div>`;
D.body.insertAdjacentHTML('beforeend',mapUI);
$v('closeMapping').onclick=()=>$v('pdfMappingDialog').classList.remove('active');
const mapBtn=D.createElement('button');mapBtn.className='alt';mapBtn.textContent='PDF 양식 위치 설정';mapBtn.type='button';mapBtn.onclick=openVisualMapper;
$v('mapping').appendChild(mapBtn);
let mapScale=1,visibleTemplate=null;
function mapDefaults(t){
 const m=t?.mapping||{};
 const schoolDefault=!!t&&/대전산업정보고등학교|우리 학교 기본 서명부/.test(t.title||'');
 const unconfigured=(Number(m.pos)===75&&Number(m.name)===180&&Number(m.sign)===310&&Number(m.start)===170);
 const school=schoolDefault&&unconfigured;
 return {titleX:+(m.titleX??297),titleY:+(m.titleY??101),dateX:+(m.dateX??197),dateY:+(m.dateY??145),placeX:+(m.placeX??436),placeY:+(m.placeY??145),
 pos:school?126:+(m.pos??126),name:school?187:+(m.name??187),sign:school?255:+(m.sign??255),start:school?195:+(m.start??195),step:school?24.25:+(m.step??24.25),offset:+(m.offset??241.3),
 cols:+(m.cols??2),redraw:m.redraw||(school?'yes':'no'),gridX:+(m.gridX??58),gridY:+(m.gridY??164),gridW:+(m.gridW??482),gridH:+(m.gridH??625)};
}
async function openVisualMapper(){
 const t=chosen();if(!t||t.kind!=='pdf')return notice('PDF 양식을 선택해야 위치를 설정할 수 있습니다.');
 visibleTemplate=t;const m=mapDefaults(t);
 for(const [k,v] of Object.entries(m)){const el=$v('m_'+k);if(el)el.value=v}
 $v('pdfMappingDialog').classList.add('active');
 try{
  if(!window.pdfjsLib)throw Error('PDF 라이브러리가 로딩되지 않았습니다.');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf=await pdfjsLib.getDocument({data:baseBytes(t.file_data)}).promise;
  const page=await pdf.getPage(1),view=page.getViewport({scale:1});
  mapScale=Math.min(1,780/view.width);
  const canvas=$v('templateCanvas');canvas.width=Math.floor(view.width*mapScale);canvas.height=Math.floor(view.height*mapScale);
  await page.render({canvasContext:canvas.getContext('2d'),viewport:page.getViewport({scale:mapScale})}).promise;
 }catch(e){err(e)}
}
$v('templateCanvas').addEventListener('click',e=>{
 const b=e.currentTarget.getBoundingClientRect(),x=Math.round((e.clientX-b.left)/b.width*e.currentTarget.width/mapScale),y=Math.round((e.clientY-b.top)/b.height*e.currentTarget.height/mapScale);
 const key=$v('mappingField').value;
 if(key==='title'||key==='date'||key==='place'){$v('m_'+key+'X').value=x;$v('m_'+key+'Y').value=y}
 else if(key==='start')$v('m_start').value=y;
 else{$v('m_'+key).value=x;$v('m_start').value=y}
});
$v('saveMapVisual').onclick=async()=>{
 if(!visibleTemplate)return;
 const m={};for(const key of ['titleX','titleY','dateX','dateY','placeX','placeY','pos','name','sign','start','step','offset','gridX','gridY','gridW','gridH','cols'])m[key]=Number($v('m_'+key).value);
 m.redraw=$v('m_redraw').value;
 if(m.step<8||m.gridW<50||m.gridH<50)return notice('표 영역 또는 간격 값을 확인하세요.');
 try{req(await sb.from('templates').update({mapping:m}).eq('id',visibleTemplate.id));visibleTemplate.mapping=m;
 $v('pdfMappingDialog').classList.remove('active');notice('양식 위치 설정이 저장되었습니다. 미리보기로 확인하세요.')}catch(e){err(e)}
};
// Display original PDF per selected training, never silently choose last uploaded PDF.
function paintImage(src){return new Promise((resolve,reject)=>{let im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src})}
async function customPdfPreview(t){
 if(!window.pdfjsLib)throw Error('PDF 라이브러리를 불러오지 못했습니다.');
 pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const pdf=await pdfjsLib.getDocument({data:baseBytes(t.file_data)}).promise;const page=await pdf.getPage(1),viewport=page.getViewport({scale:2});
 const w=viewport.width/2,h=viewport.height/2,m=mapDefaults(t),cols=m.cols===1?1:2;
 const capacity=Math.min(50,Math.max(1,current.page_size||50));const rows=Math.ceil(capacity/cols);
 const count=Math.max(1,Math.ceil(people.length/capacity)),parts=[];
 for(let pg=0;pg<count;pg++){
  const c=D.createElement('canvas');c.width=Math.round(viewport.width);c.height=Math.round(viewport.height);
  const g=c.getContext('2d',{alpha:false});await page.render({canvasContext:g,viewport}).promise;g.save();g.scale(2,2);
  g.textAlign='center';g.textBaseline='middle';g.fillStyle='#111';g.font='bold 17px "Malgun Gothic",sans-serif';
  g.fillStyle='#fff';g.fillRect(m.titleX-110,m.titleY-16,220,32);g.fillStyle='#111';g.fillText(current.title,m.titleX,m.titleY,Math.max(150,w-60));
  g.font='11px "Malgun Gothic",sans-serif';g.fillText(current.when_text||'',m.dateX,m.dateY,200);g.fillText(current.place||'',m.placeX,m.placeY,200);
  const currentRows=people.slice(pg*capacity,(pg+1)*capacity);
  const step=m.redraw==='yes'?Math.max(10,(m.gridH-20)/rows):m.step;
  if(m.redraw==='yes'){
    g.fillStyle='#fff';g.fillRect(m.gridX-1,m.gridY-1,m.gridW+2,m.gridH+2);g.strokeStyle='#141414';g.lineWidth=.65;
    const colW=m.gridW/cols,heads=['연번','직급','성명','서명'],ratios=[.12,.22,.25,.41];
    for(let side=0;side<cols;side++){
      let x=m.gridX+colW*side;
      for(const head of heads){const idx=heads.indexOf(head),width=colW*ratios[idx];g.strokeRect(x,m.gridY,width,20);g.fillStyle='#111';g.font='bold 10px "Malgun Gothic",sans-serif';g.fillText(head,x+width/2,m.gridY+10);x+=width}
      for(let k=0;k<rows;k++){let xx=m.gridX+colW*side;for(const ratio of ratios){const cw=colW*ratio;g.strokeRect(xx,m.gridY+20+k*step,cw,step);xx+=cw}}
    }
  }
  for(let k=0;k<capacity;k++){
    let p=currentRows[k],side=Math.floor(k/rows),r=k%rows;if(side>=cols)continue;
    const y=m.redraw==='yes'?m.gridY+20+step*(r+.5):m.start+r*m.step;
    const offset=m.redraw==='yes'?0:side*m.offset;
    const base=m.gridX+(m.gridW/cols)*side;
    const xnum=m.redraw==='yes'?base+(m.gridW/cols)*.06:m.pos+offset-51;
    const xp=m.redraw==='yes'?base+(m.gridW/cols)*.23:m.pos+offset;
    const xn=m.redraw==='yes'?base+(m.gridW/cols)*.465:m.name+offset;
    const xs=m.redraw==='yes'?base+(m.gridW/cols)*.78:m.sign+offset;
    g.fillStyle='#111';g.font='10px "Malgun Gothic",sans-serif';
    if(m.redraw==='yes')g.fillText(String(pg*capacity+k+1),xnum,y);
    if(!p)continue;
    g.fillText(p.position||'',xp,y,m.redraw==='yes'?(m.gridW/cols)*.20:68);
    g.fillText(p.full_name||'',xn,y,m.redraw==='yes'?(m.gridW/cols)*.24:60);
    if(p.signature_data?.startsWith('data:image/png;base64,')){
      try{const im=await paintImage(p.signature_data);const ratio=Math.min((m.gridW/cols)*.28/im.width,Math.min(step*.78,20)/im.height);g.drawImage(im,xs-im.width*ratio/2,y-im.height*ratio/2,im.width*ratio,im.height*ratio)}catch(e){console.warn(e)}
    }
  }
  g.restore();parts.push('<article class="paper-sheet" style="width:'+w+'px;height:'+h+'px"><img style="display:block;width:100%;height:100%" alt="서명부 '+(pg+1)+'페이지" src="'+c.toDataURL('image/png')+'"></article>');
 }
 return parts.join('');
}
window.previewPrint=async function(){
 const root=$v('paperPreviewRoot'),body=$v('pvPages');root.classList.add('active');body.innerHTML='<div class="card">서명부 미리보기 생성 중…</div>';
 try{
  const t=templates.find(x=>x.id===current?.selected_template_id);
  const html=t?.kind==='pdf'?await customPdfPreview(t):printMarkup();
  body.innerHTML=html;$v('printArea').innerHTML=html;
  if(t?.kind==='xlsx')notice('Excel 양식은 Excel 다운로드로 원본 셀 매핑을 사용할 수 있습니다. 이 PDF 미리보기는 기본 양식을 표시합니다.');
 }catch(e){err(e);const html=printMarkup();body.innerHTML=html;$v('printArea').innerHTML=html}
};
// If someone changes the template at detail view, the new selection now persists.
const p=$v('mapping');p.insertAdjacentHTML('afterbegin','<div class="template-note">선택한 학교 양식은 현재 연수에 저장됩니다. 다른 학교 PDF는 “PDF 양식 위치 설정”에서 해당 서식의 입력 위치를 맞춰 주세요.</div>');

// Keep the visual PDF mapping settings when the quick mapping fields are saved.
window.saveMapping=async function(){
 const t=chosen();if(!t)return notice('양식을 선택해 주세요.');
 const existing=t.mapping||{};
 const x=val=>t.kind==='pdf'?Number(val):String(val||'').trim().toUpperCase();
 const next={...existing,pos:x($v('mapPos').value),name:x($v('mapName').value),
   sign:x($v('mapSign').value),start:Number($v('mapStart').value),step:Number($v('mapStep').value)};
 if(!next.step||next.step<1)return notice('행 간격을 확인해 주세요.');
 try{req(await sb.from('templates').update({mapping:next}).eq('id',t.id));t.mapping=next;notice('양식의 입력 위치가 저장되었습니다.')}catch(e){err(e)}
};

/* Excel export includes actual PNG signatures, preserving uploaded XLSX workbook when possible. */
const oldExport=window.exportCustom;
window.exportCustom=async function(format){
 if(format==='pdf'){await previewPrint();return}
 if(format!=='xlsx'){return oldExport(format)}
 if(!window.ExcelJS){notice('ExcelJS 라이브러리를 불러오지 못했습니다. 네트워크를 확인하세요.');return}
 try{
  const selectedTemplate=templates.find(t=>t.id===current?.selected_template_id);
  const wb=new ExcelJS.Workbook();
  if(selectedTemplate?.kind==='xlsx')await wb.xlsx.load(baseBytes(selectedTemplate.file_data));
  else{
   const ws=wb.addWorksheet('명단');
   ws.getCell('A1').value=current.title;
   ws.getCell('A2').value='일시';ws.getCell('B2').value=current.when_text;
   ws.getCell('A3').value='장소';ws.getCell('B3').value=current.place;
   ws.getRow(7).values=['연번','직급','성명','서명'];
   ws.columns=[{width:12},{width:19},{width:23},{width:26}];
  }
  const sheet=wb.worksheets[0];if(!sheet)throw Error('양식의 시트를 읽을 수 없습니다.');
  const map=selectedTemplate?.kind==='xlsx'?(selectedTemplate.mapping||{}):{};
  const start=Math.max(1,Math.floor(Number(map.start)||8)),step=Math.max(1,Math.floor(Number(map.step)||1));
  const positionColumn=typeof map.pos==='string'&&/^[A-Z]{1,3}$/i.test(map.pos)?map.pos.toUpperCase():'B';
  const nameColumn=typeof map.name==='string'&&/^[A-Z]{1,3}$/i.test(map.name)?map.name.toUpperCase():'C';
  const signatureColumn=typeof map.sign==='string'&&/^[A-Z]{1,3}$/i.test(map.sign)?map.sign.toUpperCase():'D';
  const colIndex=(letters)=>letters.split('').reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
  const index=colIndex(signatureColumn)-1;
  people.forEach((p,i)=>{
   const row=start+i*step;sheet.getCell(positionColumn+row).value=p.position;
   sheet.getCell(nameColumn+row).value=p.full_name;
   if(!selectedTemplate||selectedTemplate.kind!=='xlsx')sheet.getCell('A'+row).value=i+1;
   if(p.signature_data?.startsWith('data:image/png;base64,')){
    const imageId=wb.addImage({base64:p.signature_data,extension:'png'});
    const rowItem=sheet.getRow(row);rowItem.height=Math.max(rowItem.height||20,27);
    sheet.addImage(imageId,{tl:{col:index+0.06,row:row-1+0.07},ext:{width:85,height:25},editAs:'oneCell'});
   }else sheet.getCell(signatureColumn+row).value='';
  });
  const buf=await wb.xlsx.writeBuffer();
  download((current.title||'연수')+'_서명부.xlsx',new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  notice('서명 이미지가 포함된 Excel 서명부를 저장했습니다.');
 }catch(e){err(e)}
};
})();
