/* 전자 연수등록부 개선: 중앙 모달, QR, 학교 기본 50인 양식 */
(function(){
const CSS = `
/* 중앙 입력 모달 */
#appDialogRoot{position:fixed;inset:0;background:rgba(20,28,47,.55);z-index:9999;display:none;align-items:center;justify-content:center;padding:16px}
#appDialogRoot.active{display:flex}
#appDialogCard{width:min(510px,100%);max-height:94vh;overflow-y:auto;background:#fff;border-radius:13px;padding:25px;box-shadow:0 18px 55px #091a3a55}
#appDialogCard .dialog-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px}
#appDialogCard h2{margin:0;font-size:20px}
#appDialogCard label{display:block;margin:9px 0 2px;font-size:13px;color:#29334a}
#appDialogCard input,#appDialogCard select{width:100%;margin:2px 0 9px}
#appDialogCard .dialog-footer{display:flex;justify-content:flex-end;gap:5px;margin-top:10px}
#appDialogCard .dialog-footer button{min-width:80px}
#appDialogCard .modal-note{font-size:12px;color:#64748b}
#paperPreviewRoot{position:fixed;inset:0;z-index:9000;background:#e7ebf3;display:none;flex-direction:column}
#paperPreviewRoot.active{display:flex}
#paperPreviewRoot .pvtools{display:flex;align-items:center;gap:9px;padding:12px 16px;background:#fff;box-shadow:0 1px 5px #1f293722}
#paperPreviewRoot .pvbody{overflow:auto;padding:22px 10px;display:grid;justify-content:center;gap:20px}
.paper-sheet{width:595px;height:841px;background:white;box-shadow:0 3px 17px #19264430;overflow:hidden;page-break-after:always;break-after:page}
.paper-sheet svg{display:block;width:100%;height:100%}
#qr{min-height:170px}#qr img,#qr canvas{display:block;margin:auto;max-width:190px}
#detail table button{min-width:27px}
@page{size:A4;margin:0}
@media print{
 body>header,#appDialogRoot,#paperPreviewRoot{display:none!important}
 body>main.wrap:not(#printArea){display:block!important;margin:0!important;padding:0!important;max-width:none!important;width:100%!important}
 body>main.wrap> :not(#printArea){display:none!important}
 #printArea{display:block!important;position:static!important;margin:0!important;padding:0!important}
 .paper-sheet{width:210mm;height:297mm;box-shadow:none!important;margin:0;page-break-after:always;break-after:page}
 .paper-sheet:last-child{page-break-after:auto;break-after:auto}
 .paper-sheet svg{width:210mm;height:297mm}
}
`;
const style=document.createElement('style');style.textContent=CSS;document.head.append(style);
document.body.insertAdjacentHTML('beforeend',`
<div id="appDialogRoot" role="dialog" aria-modal="true" aria-labelledby="appDialogTitle">
  <div id="appDialogCard">
    <div class="dialog-head"><h2 id="appDialogTitle">새 연수 만들기</h2><button type="button" class="alt" id="dialogX" aria-label="닫기">×</button></div>
    <form id="trainingForm">
      <label for="dlgTitle">연수명 *</label><input id="dlgTitle" required maxlength="150" placeholder="예: 2026 정보보안 및 개인정보보호 교육">
      <label for="dlgWhen">일시 *</label><input id="dlgWhen" required placeholder="예: 2026. 11. 2.(월) 14:00">
      <label for="dlgPlace">장소 *</label><input id="dlgPlace" required placeholder="예: 미디어실">
      <label for="dlgSize">페이지당 인원수</label>
      <input id="dlgSize" type="number" min="1" max="50" value="50" required><label for="dlgTemplate">등록부 출력 양식</label><select id="dlgTemplate"><option value="">기본 양식 (자동 조절)</option></select>
      <div class="modal-note">A4 한 페이지는 가독성을 위해 최대 50명까지 설정할 수 있습니다. 업로드한 원본 PDF의 표는 고정되어 있어 별도 위치 매핑이 필요할 수 있습니다.</div>
      <div class="dialog-footer"><button type="button" class="alt" id="dlgCancel">취소</button><button type="submit" id="dlgSave">만들기</button></div>
    </form>
  </div>
</div>
<div id="paperPreviewRoot" role="dialog" aria-modal="true" aria-label="인쇄 미리보기">
 <div class="pvtools"><b>인쇄 미리보기 — 학교 기본 서명부</b><div style="flex:1"></div><button id="pvPdf">PDF 저장 / 인쇄</button><button class="alt" id="pvClose">닫기 ×</button></div>
 <div class="pvbody" id="pvPages"></div>
</div>`);
const D=document;
const dialog=D.getElementById('appDialogRoot');
const dTitle=D.getElementById('dlgTitle'),dWhen=D.getElementById('dlgWhen'),dPlace=D.getElementById('dlgPlace');
let editingId=null;
const closeDialog=()=>dialog.classList.remove('active');
D.getElementById('dialogX').onclick=closeDialog;
D.getElementById('dlgCancel').onclick=closeDialog;
dialog.addEventListener('click',e=>{if(e.target===dialog)closeDialog()});
window.newTraining=function(){
 editingId=null;D.getElementById('appDialogTitle').textContent='새 연수 만들기';
 D.getElementById('dlgSave').textContent='만들기';
 dTitle.value='';dWhen.value='';dPlace.value='';$('dlgSize').value=50;
 dialog.classList.add('active');dTitle.focus();
};
window.editTraining=function(){
 if(!current)return;
 editingId=current.id;D.getElementById('appDialogTitle').textContent='연수 정보 수정';
 D.getElementById('dlgSave').textContent='저장';
 dTitle.value=current.title||'';dWhen.value=current.when_text||'';dPlace.value=current.place||'';$('dlgSize').value=Math.min(50,Math.max(1,current.page_size||50));
 dialog.classList.add('active');dTitle.focus();
};
D.getElementById('trainingForm').addEventListener('submit',async(e)=>{
 e.preventDefault();const title=dTitle.value.trim(),when_text=dWhen.value.trim(),place=dPlace.value.trim();
 if(!title||!when_text||!place)return;const page_size=Math.floor(Number($('dlgSize').value));if(!Number.isInteger(page_size)||page_size<1||page_size>50)return notice('인원수는 1~50명으로 설정하세요.');const selected_template_id=$('dlgTemplate').value||null;
 let btn=D.getElementById('dlgSave');btn.disabled=true;
 try{
  if(editingId){
    const id=editingId;
    req(await sb.from('trainings').update({title,when_text,place,page_size,selected_template_id}).eq('id',id));
    closeDialog();await openTraining(id);notice('연수 정보가 수정되었습니다.');
  }else{
    const t=req(await sb.from('trainings').insert({owner_id:user.id,title,when_text,place,page_size:50}).select().single());
    closeDialog();await openTraining(t.id);notice('연수가 생성되었습니다.');
  }
 }catch(ex){err(ex)}finally{btn.disabled=false}
});
window.openTraining=async function(id){
 clearInterval(poll);
 try{
  current=req(await sb.from('trainings').select('*').eq('id',id).single());
  show('detail');
  $('detailTitle').innerHTML='<h2>'+escapeHtml(current.title)+'</h2><p>'+escapeHtml(current.when_text)+' · '+escapeHtml(current.place)+'</p>';
  await Promise.all([loadPeople(),loadTemplates()]);
  fillTemplateOptions();
  const url=signUrl();$('publicUrl').value=url;
  renderQR(url);
  poll=setInterval(loadPeople,7000);
 }catch(e){err(e)}
};
function renderQR(url){
 const e=$('qr');e.innerHTML='';
 if(typeof QRCode==='function'){
  try{new QRCode(e,{text:url,width:188,height:188,colorDark:'#141b31',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});return;}
  catch(ex){console.warn(ex)}
 }
 e.innerHTML='<div style="color:#ba342b">QR 생성 라이브러리를 불러오지 못했습니다.<br>아래 링크를 복사해서 사용하세요.</div>';
}
window.openQr=function(){
 const w=window.open('','_blank');if(!w){notice('팝업 차단을 해제해 주세요');return}
 const src=$('qr').querySelector('img')?.src||$('qr').querySelector('canvas')?.toDataURL('image/png');
 const image=src?'<img src="'+src+'" style="width:370px;height:370px;image-rendering:pixelated">':'';
 w.document.write('<!doctype html><html lang="ko"><meta charset="utf-8"><title>서명 QR</title><body style="text-align:center;font:20px sans-serif;padding-top:6vh"><h1>'+escapeHtml(current.title)+'</h1>'+image+'<p style="font-size:15px">'+escapeHtml(signUrl())+'</p></body></html>');w.document.close();
};
window.renderPeople=function(){
 $('people').innerHTML='<table><thead><tr><th>연번</th><th>직급</th><th>성명</th><th>서명</th><th>작업</th></tr></thead><tbody>'+
 people.map((p,i)=>'<tr><td>'+(i+1)+'</td><td>'+escapeHtml(p.position)+'</td><td>'+escapeHtml(p.full_name)+'</td><td>'+(p.signed_at?'<span class="tag">✓ 완료</span>':'미완료')+'</td><td class="actions"><button class="alt" title="위로 이동" '+(i===0?'disabled':'')+' onclick="movePerson(\''+p.id+'\',-1)">↑</button><button class="alt" title="아래로 이동" '+(i===people.length-1?'disabled':'')+' onclick="movePerson(\''+p.id+'\',1)">↓</button><button class="alt" title="수정" onclick="editPerson(\''+p.id+'\')">✎</button><button class="danger" title="삭제" onclick="delPerson(\''+p.id+'\')">✕</button></td></tr>').join('')+'</tbody></table>';
};
window.movePerson=async function(id,delta){
 const i=people.findIndex(x=>x.id===id),j=i+delta;
 if(i<0||j<0||j>=people.length)return;
 const order=people.slice();[order[i],order[j]]=[order[j],order[i]];
 try{for(let k=0;k<order.length;k++){if(order[k].sort_order!==k+1)req(await sb.from('participants').update({sort_order:k+1}).eq('id',order[k].id))}await loadPeople()}
 catch(ex){err(ex)}
};
window.delPerson=async function(id){
 if(!confirm('명단에서 삭제할까요? 등록된 서명도 함께 삭제됩니다.'))return;
 try{req(await sb.from('participants').delete().eq('id',id));await loadPeople();
 for(let i=0;i<people.length;i++){if(people[i].sort_order!==i+1)req(await sb.from('participants').update({sort_order:i+1}).eq('id',people[i].id))}
 await loadPeople();notice('삭제하고 연번을 자동으로 재정렬했습니다.')
 }catch(ex){err(ex)}
};
let nextOrder=1;
const oldLoadPeople=window.loadPeople;
window.loadPeople=async function(){await oldLoadPeople();nextOrder=Math.max(1,...people.map(x=>Number(x.sort_order)+1||1))};
window.addPerson=async function(position,name){
 const code=randomCode();
 req(await sb.rpc('add_participant',{p_training:current.id,p_position:position,p_name:name,p_code:code,p_order:nextOrder++}));
 return code;
};
window.uploadRoster=async function(ev){
 const f=ev.target.files?.[0];if(!f)return;
 try{
  if(!window.XLSX)throw Error('Excel 라이브러리 로드 실패');
  const wb=XLSX.read(await f.arrayBuffer(),{type:'array'}),sheet=wb.Sheets[wb.SheetNames.includes('명단')?'명단':wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(sheet,{defval:''}).filter(x=>String(x['성명']||'').trim());
  if(!rows.length)throw Error('양식의 첫 행에 직급(또는 직위)·성명 열이 있어야 합니다.');
  if(rows.length>200)throw Error('한 번에 200명까지 등록할 수 있습니다.');
  if(!confirm(rows.length+'명을 현재 연수에 추가할까요?'))return;
  const codes=[];
  for(const item of rows){
    const name=String(item['성명']).trim(),position=String(item['직급']||item['직위']||'교사').trim();
    codes.push({성명:name,확인코드:await addPerson(position,name)});
  }
  const data=XLSX.utils.book_new();XLSX.utils.book_append_sheet(data,XLSX.utils.json_to_sheet(codes),'코드');
  workbookDownload(data,'서명확인코드_안전하게보관.xlsx');
  await loadPeople();notice('명단 등록 완료. 개인별 확인코드 파일을 안전하게 보관하세요.');
 }catch(ex){err(ex)}finally{ev.target.value=''}
};
function svgText(x,y,text,size=11,weight='normal',extra=''){
 return '<text x="'+x+'" y="'+y+'" text-anchor="middle" dominant-baseline="middle" font-size="'+size+'" font-weight="'+weight+'" font-family="Malgun Gothic,Apple SD Gothic Neo,Noto Sans CJK KR,sans-serif" fill="#141414" '+extra+'>'+escapeHtml(text||'')+'</text>';
}
function templatePage(batch,start){
 // 업로드된 양식.pdf의 실제 A4 595×841 좌표에 맞춘 표 재구성. 25행×2단.
 const capacity=Math.min(50,Math.max(1,Number(current.page_size)||50)),rows=Math.ceil(capacity/2);const col=[58,92.2,160.8,212.4,298.6,332.8,401.2,452.8,539.7],top=164.3,head=19.1,rowh=Math.min(30,606.25/rows);
 let s='<svg viewBox="0 0 595 841" xmlns="http://www.w3.org/2000/svg" aria-label="학교 전자 연수등록부 양식">';
 s+='<rect x="56.5" y="73.4" width="240.7" height="3.1" fill="#00a9ff"/><rect x="297.2" y="73.4" width="241.2" height="3.1" fill="#ffcf0d"/>';
 s+='<rect x="56.5" y="118.5" width="240.7" height="3.2" fill="#45a000"/><rect x="297.2" y="118.5" width="241.2" height="3.2" fill="#ff481e"/>';
 s+=svgText(298,102,current.title,18,'bold');
 // info row with centered values to right of labels
 s+='<rect x="58" y="133.2" width="481.7" height="22.4" fill="none" stroke="#111" stroke-width="1.1"/>';
 s+='<path d="M96.8 133.2 V155.6 M297.1 133.2 V155.6 M331.6 133.2 V155.6" fill="none" stroke="#111" stroke-width=".85"/>';
 s+=svgText(77.4,144.4,'일시',11,'bold')+svgText(314.3,144.4,'장소',11,'bold');
 s+=svgText(197,144.4,current.when_text,11)+svgText(436,144.4,current.place,11);
 // header and table grid
 s+='<rect x="58" y="'+top+'" width="481.7" height="'+(head+rows*rowh)+'" fill="none" stroke="#111" stroke-width="1.2"/>';
 s+='<rect x="58" y="'+top+'" width="481.7" height="'+head+'" fill="#f0f0f0"/>';
 for(const x of col.slice(1,-1))s+='<line x1="'+x+'" y1="'+top+'" x2="'+x+'" y2="'+(top+head+rows*rowh)+'" stroke="#111" stroke-width=".9"/>';
 s+='<line x1="58" y1="'+(top+head)+'" x2="539.7" y2="'+(top+head)+'" stroke="#111" stroke-width="1.1"/>';
 for(let i=1;i<=rows;i++){let y=(top+head+i*rowh).toFixed(2);s+='<line x1="58" y1="'+y+'" x2="539.7" y2="'+y+'" stroke="#111" stroke-width=".77"/>'}
 const headers=[['연번',75],['직급',126],['성명',186.6],['서명',255.5],['연번',315.7],['직급',367],['성명',427],['서명',496.2]];
 headers.forEach(v=>s+=svgText(v[1],173.9,v[0],11,'bold'));
 for(let i=0;i<rows;i++){
  const y=top+head+rowh*(i+.5);
  for(let side=0;side<2;side++){
   const relative=side*rows+i,person=batch[relative],sequence=start+relative+1;
   if(relative>=capacity)continue;s+=svgText(side?315.7:75,y,sequence,10);
   if(!person)continue;
   s+=svgText(side?367:126,y,person.position,Math.min(10,person.position.length>5?8.5:10));
   s+=svgText(side?427:186.6,y,person.full_name,Math.min(10,person.full_name.length>5?8.2:10));
   if(person.signature_data?.startsWith('data:image/png;base64,')){
    const x=side?455:214;s+='<image x="'+x+'" y="'+(y-9)+'" width="82" height="19" preserveAspectRatio="xMidYMid meet" href="'+person.signature_data+'"/>';
   }
  }
 }
 s+='</svg>';
 return '<article class="paper-sheet">'+s+'</article>';
}
window.printMarkup=function(){
 const capacity=Math.min(50,Math.max(1,Number(current.page_size)||50)),groups=Math.max(1,Math.ceil(people.length/capacity)),arr=[];
 for(let k=0;k<groups;k++)arr.push(templatePage(people.slice(k*capacity,k*capacity+capacity),k*capacity));
 return arr.join('');
};
window.previewPrint=function(){
 const html=printMarkup();
 $('printArea').innerHTML=html;
 D.getElementById('pvPages').innerHTML=html;
 D.getElementById('paperPreviewRoot').classList.add('active');
};
D.getElementById('pvClose').onclick=()=>D.getElementById('paperPreviewRoot').classList.remove('active');
D.getElementById('pvPdf').onclick=()=>window.print();

/* 실제 학교 PDF 파일을 한 번 업로드하면 그 원본 페이지를 배경으로 사용한다.
   pdf.js로 브라우저 내부에서 그린 뒤 한글 명단/서명을 올려 PDF 인쇄를 지원한다. */
function imageFromData(src){return new Promise((resolve,reject)=>{
 const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;
})}
async function makeOriginalTemplatePages(template){
 if(!window.pdfjsLib)throw Error('PDF 읽기 라이브러리를 불러오지 못했습니다.');
 pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const src=await pdfjsLib.getDocument({data:baseBytes(template.file_data)}).promise;
 const pdf=await src.getPage(1),scale=2,viewport=pdf.getViewport({scale});
 const pages=Math.max(1,Math.ceil(people.length/50)),images=[];
 for(let n=0;n<pages;n++){
  const c=document.createElement('canvas');c.width=Math.round(viewport.width);c.height=Math.round(viewport.height);
  const g=c.getContext('2d',{alpha:false});await pdf.render({canvasContext:g,viewport}).promise;
  g.save();g.setTransform(scale,0,0,scale,0,0);
  const fullName=current.title||'';g.textAlign='center';g.textBaseline='middle';
  // 원본 [제목] 표시를 깨끗하게 가리고 연수명으로 대체
  g.fillStyle='#fff';g.fillRect(222,84,150,31);
  g.fillStyle='#111';g.font='bold 18px "Malgun Gothic","Noto Sans CJK KR",sans-serif';
  if(g.measureText(fullName).width>450){g.font='bold 13px "Malgun Gothic","Noto Sans CJK KR",sans-serif'}
  g.fillText(fullName,297,101,460);
  g.font='11px "Malgun Gothic","Noto Sans CJK KR",sans-serif';
  // 정보 칸 중앙 정렬
  g.fillText(current.when_text||'',196.8,145,195);
  g.fillText(current.place||'',435.5,145,204);
  const batch=people.slice(n*50,(n+1)*50);
  for(let k=0;k<50;k++){
   const side=Math.floor(k/25),row=k%25,p=batch[k];
   const y=195.5+row*24.27,offset=side?241.3:0;
   // 두 번째 페이지부터 연번을 새로 매긴다
   if(n>0){g.fillStyle='#fff';g.fillRect((side?304:65),y-10,27,20);
      g.fillStyle='#111';g.font='10px "Malgun Gothic",sans-serif';
      g.fillText(String(n*50+k+1),side?316:75.5,y);
   }
   if(!p)continue;
   g.fillStyle='#111';g.font='10px "Malgun Gothic","Noto Sans CJK KR",sans-serif';
   g.fillText(p.position||'',126+offset,y,64);
   g.fillText(p.full_name||'',186.7+offset,y,48);
   if(p.signature_data?.startsWith('data:image/png;base64,')){
    try{const im=await imageFromData(p.signature_data);
       const ratio=Math.min(80/im.width,19/im.height);
       g.drawImage(im,255.4+offset-im.width*ratio/2,y-im.height*ratio/2,im.width*ratio,im.height*ratio);
    }catch(e){console.warn('서명 이미지 처리 실패',e)}
   }
  }
  g.restore();
  images.push('<article class="paper-sheet"><img alt="전자서명 등록부 '+(n+1)+'페이지" style="width:100%;height:100%;display:block" src="'+c.toDataURL('image/png')+'"></article>');
 }
 return images.join('');
}
window.previewPrint=async function(){
 const preview=D.getElementById('paperPreviewRoot');const body=D.getElementById('pvPages');
 preview.classList.add('active');body.innerHTML='<div style="padding:35px">인쇄 미리보기를 만드는 중입니다…</div>';
 try{
  // 지정하지 않아도 관리자 계정에 가장 최근 저장된 PDF를 기본 양식으로 적용
  const selected=chosen?.(),pdfTemplate=selected?.kind==='pdf'?selected:templates.find(t=>t.kind==='pdf');
  const html=pdfTemplate?await makeOriginalTemplatePages(pdfTemplate):printMarkup();
  $('printArea').innerHTML=html;body.innerHTML=html;
  if(pdfTemplate)notice('업로드한 실제 학교 PDF 양식에 명단을 반영했습니다.');
 }catch(e){
  console.error(e);notice('학교 원본 PDF 적용에 실패해 기본 50명 양식으로 대체합니다: '+(e.message||e));
  const html=printMarkup();$('printArea').innerHTML=html;body.innerHTML=html;
 }
};
})();