/* Dual default books. Meeting form is faithfully vector-recreated from the provided A4 PDF. */
(function(){
'use strict';
const D=document,$=id=>D.getElementById(id),sel=$('dlgRegistrationType');
if(!sel)return;
const meeting=()=>current?.registration_type==='meeting';
const esc=s=>escapeHtml(String(s??''));
const style=D.createElement('style');
style.textContent=[
'#dlgRegistrationType{background:#f2f6fc;border:1px solid #afc0e0;font-weight:700}',
'#meetingTypeHelp{font-size:13px;color:#54677d;background:#edf3ff;padding:10px;border-radius:9px;line-height:1.55}',
'.meeting-sheet{width:595px;height:841px;background:#fff;display:block;margin:0 auto;box-shadow:0 1px 6px #13203e28}',
'.meeting-sheet svg{width:100%;height:100%;display:block}',
'#pvPages .meeting-sheet{width:min(595px,calc(100vw - 42px))!important;height:auto!important;aspect-ratio:595/841;flex:none}',
'@media print{#printArea .meeting-sheet{width:210mm!important;height:297mm!important;max-width:none!important;margin:0!important;padding:0!important;box-shadow:none!important;break-after:page;page-break-after:always}#printArea .meeting-sheet:last-child{break-after:auto!important;page-break-after:auto!important}#printArea .meeting-sheet svg{width:100%!important;height:100%!important}}'
].join('\n');
D.head.appendChild(style);
const note=D.createElement('p');note.id='meetingTypeHelp';sel.insertAdjacentElement('afterend',note);
function dialogFields(){
 const m=sel.value==='meeting',size=$('dlgSize');
 $('dlgTitle').previousElementSibling.textContent=m?'회의명 *':'연수명 *';
 $('dlgTitle').placeholder=m?'예: 2026학년도 교직원 협의회':'예: 2026 정보·AI 교원 연수';
 $('dlgWhen').previousElementSibling.textContent=m?'회의 일시 *':'연수 일시 *';
 $('dlgPlace').previousElementSibling.textContent=m?'회의 장소 *':'연수 장소 *';
 size.disabled=m;if(m)size.value=12;
 size.previousElementSibling.textContent=m?'한 페이지 참석자 수 (12명 고정)':'페이지당 인원수';
 const op=$('dlgTemplate').querySelector('option[value=""]');
 if(op)op.textContent=m?'회의 등록부 (기본 양식)':'연수 등록부 (기본 양식)';
 note.textContent=m?'첨부 PDF 기준: 회의명·일시·장소 입력 / 연번·성명·구분·서명 / 페이지당 12명':'기존 연수 등록부 양식과 페이지당 인원수 설정을 사용합니다.';
 $('appDialogTitle').textContent=$('dlgSave').textContent==='저장'?'등록부 정보 수정':'새 등록부 만들기';
}
sel.addEventListener('change',dialogFields);
const prevNew=window.newTraining,prevEdit=window.editTraining;
window.newTraining=function(){prevNew();sel.value='training';dialogFields();};
window.editTraining=function(){prevEdit();sel.value=meeting()?'meeting':'training';dialogFields();};
const prevHome=window.showHome;
window.showHome=async function(){
 const out=await prevHome();
 const h=$('home')?.querySelector('h2');if(h)h.textContent='연수·회의 등록부 목록';
 const b=$('home')?.querySelector('button[onclick="newTraining()"]');if(b)b.textContent='+ 등록부 만들기';
 return out;
};
function updateRows(){
 const m=meeting(),p=$('position'),table=$('people');
 if(p){const label=p.previousElementSibling;if(label?.tagName==='LABEL')label.textContent=m?'구분':'직위';p.placeholder=m?'예: 위원 / 참석 / 교사':'예: 교사';}
 const head=table?.querySelectorAll('thead th');if(head?.[1])head[1].textContent=m?'구분':'직급';
 table?.querySelectorAll('.roster-mobile-card .muted').forEach(el=>{
  el.textContent=el.textContent.replace(/^(직급|구분):/,m?'구분:':'직급:');
 });
}
const prevRender=window.renderPeople;
window.renderPeople=function(){const ret=prevRender();updateRows();return ret;};
const prevOpen=window.openTraining;
window.openTraining=async function(id){
 await prevOpen(id);
 if(!current||current.id!==id)return;
 const m=meeting();
 D.body.dataset.registrationType=m?'meeting':'training';
 const title=$('detailTitle');if(title){const sub=D.createElement('p');sub.className='muted';sub.textContent=m?'회의 등록부 · 1페이지 12명':'연수 등록부';title.prepend(sub);}
 const edit=$('detail')?.querySelector('button[onclick="editTraining()"]');if(edit)edit.textContent=m?'회의 정보 수정':'연수 정보 수정';
 const option=$('chosenTemplate')?.querySelector('option[value=""]');if(option)option.textContent=m?'회의 등록부 (기본)':'연수 등록부 (기본)';
 const print=$('detail')?.querySelector('button[onclick="previewPrint()"]');if(print)print.textContent=m?'회의 등록부 인쇄 / PDF 저장':'연수 등록부 인쇄 / PDF 저장';
 if(m&&(!$('position').value||$('position').value==='교사'))$('position').value='참석';
 else if(!m&&$('position').value==='참석')$('position').value='교사';
 updateRows();
};
const prevAdd=window.addOne;
window.addOne=async function(){if(meeting()&&!$('position').value.trim())$('position').value='참석';return prevAdd();};
const prevBlank=window.downloadBlankRosterTemplate;
window.downloadBlankRosterTemplate=function(){
 if(!meeting())return prevBlank();
 if(!window.XLSX)return notice('Excel 라이브러리를 불러오지 못했습니다.');
 const book=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([['성명','구분'],['','참석']]);
 ws['!cols']=[{wch:25},{wch:23}];XLSX.utils.book_append_sheet(book,ws,'명단');
 workbookDownload(book,'회의_참석자_빈명단.xlsx');
};
const prevRoster=window.downloadRoster;
window.downloadRoster=function(){
 if(!meeting())return prevRoster();
 if(!window.XLSX)return notice('Excel 라이브러리를 불러오지 못했습니다.');
 const book=XLSX.utils.book_new();
 const sheet=XLSX.utils.json_to_sheet(people.map((p,i)=>({'연번':i+1,'성명':p.full_name,'구분':p.position,'서명':p.signed_at?'완료':'미완료','서명시각':p.signed_at||''})));
 sheet['!cols']=[{wch:9},{wch:25},{wch:20},{wch:13},{wch:26}];XLSX.utils.book_append_sheet(book,sheet,'명단');
 workbookDownload(book,(current.title||'회의')+'_참석자_명단.xlsx');
};
async function getSignatures(){
 if(!people.length)return;
 const id=current.id,data=req(await sb.from('participant_admin').select('id,signature_data').eq('training_id',id));
 if(current?.id!==id)throw Error('다른 등록부로 이동했습니다.');
 const look=new Map((data||[]).map(p=>[p.id,p.signature_data]));
 for(const p of people)if(look.has(p.id))p.signature_data=look.get(p.id);
}
function line(x1,y1,x2,y2,color='#151515',stroke=1){
 return '<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+color+'" stroke-width="'+stroke+'"/>';
}
function txt(text,x,y,size=11,extra=''){
 return '<text x="'+x+'" y="'+y+'" font-family="Malgun Gothic, Noto Sans CJK KR, sans-serif" fill="#171717" font-size="'+size+'" text-anchor="middle" dominant-baseline="middle" '+extra+'>'+esc(text)+'</text>';
}
function meetingSvg(rows,pageIndex){
 const bounds=[52.4,110.82,228.6,408.74,543.07],top=214.45,headH=34.64,rh=46.54,bottom=top+headH+12*rh;
 let html='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 841" role="img" aria-label="회의 등록부 '+(pageIndex+1)+'페이지"><rect width="595" height="841" fill="#fff"/>';
 for(const [x1,x2,color] of [[56,297,'#1ba7f3'],[297,539,'#f7c800']])html+=line(x1,89.7,x2,89.7,color,2.9);
 for(const [x1,x2,color] of [[56,297,'#319c00'],[297,539,'#ff4d28']])html+=line(x1,144.6,x2,144.6,color,2.9);
 const title=String(current?.title||'');
 html+=txt(title.slice(0,46),297.5,118,title.length>28?14:title.length>18?17:20,'font-weight="700"');
 html+='<rect x="52.4" y="163.03" width="490.25" height="44.46" fill="#fff" stroke="#111" stroke-width="1.2"/>';
 for(const [x,w] of [[52.4,39.22],[334.25,60.83]])html+='<rect x="'+x+'" y="163.03" width="'+w+'" height="44.46" fill="#eee"/>';
 for(const x of [91.62,334.25,395.08])html+=line(x,163.03,x,207.49);
 html+=txt('일시',72,185.3,12)+txt('장소',364.5,185.3,12);
 const date=String(current?.when_text||''),place=String(current?.place||'');
 html+=txt(date,212.9,185.3,date.length>24?8.3:date.length>17?9.5:11);
 html+=txt(place,469,185.3,place.length>15?9:11);
 html+='<rect x="'+bounds[0]+'" y="'+top+'" width="'+(bounds[4]-bounds[0])+'" height="'+(bottom-top)+'" fill="white" stroke="#111" stroke-width="1.2"/>';
 html+='<rect x="'+bounds[0]+'" y="'+top+'" width="'+(bounds[4]-bounds[0])+'" height="'+headH+'" fill="#eee"/>';
 for(const x of bounds.slice(1,-1))html+=line(x,top,x,bottom,'#171717',.9);
 for(let i=0;i<=12;i++)html+=line(bounds[0],top+headH+i*rh,bounds[4],top+headH+i*rh,'#171717',.8);
 for(const [label,x] of [['연번',81.7],['성명',169.7],['구분',318.7],['서명',475.9]])html+=txt(label,x,top+headH/2,11.8);
 for(let i=0;i<12;i++){
  const p=rows[i],y=top+headH+rh*(i+.5);
  html+=txt(pageIndex*12+i+1,81.7,y,11.3);
  if(!p)continue;
  const n=String(p.full_name||''),category=String(p.position||'');
  html+=txt(n,169.6,y,n.length>15?8.5:n.length>10?10:11.8);
  html+=txt(category,318.7,y,category.length>19?8:category.length>12?10:11.5);
  if(p.signature_data?.startsWith('data:image/png;base64,')&&p.signature_data.length<=180000)
   html+='<image href="'+esc(p.signature_data)+'" x="417" y="'+(y-19)+'" width="117" height="38" preserveAspectRatio="xMidYMid meet"/>';
 }
 return html+'</svg>';
}
function meetingPages(){
 let html='',pages=Math.max(1,Math.ceil(people.length/12));
 for(let p=0;p<pages;p++)html+='<article class="meeting-sheet paper-sheet">'+meetingSvg(people.slice(p*12,(p+1)*12),p)+'</article>';
 return html;
}
const prevPreview=window.previewPrint;
window.previewPrint=async function(){
 if(!meeting()||current.selected_template_id)return prevPreview();
 const root=$('paperPreviewRoot'),body=$('pvPages');
 root.classList.add('active');body.textContent='회의 등록부 미리보기를 만드는 중입니다…';
 try{
  await getSignatures();const html=meetingPages();body.innerHTML=html;$('printArea').innerHTML=html;
  const heading=root.querySelector('.pvtools b');if(heading)heading.textContent='인쇄 미리보기 — 회의 등록부';
 }catch(e){body.textContent='회의 등록부 생성 실패: '+(e.message||e);err(e)}
};
async function meetingXlsx(){
 if(!window.ExcelJS)throw Error('ExcelJS를 불러오지 못했습니다.');
 await getSignatures();
 const wb=new ExcelJS.Workbook(),ws=wb.addWorksheet('회의 등록부');
 ws.columns=[{width:11},{width:26},{width:27},{width:28}];
 ws.mergeCells('A1:D1');ws.getCell('A1').value=current.title||'회의 등록부';
 ws.getCell('A1').font={name:'맑은 고딕',size:17,bold:true};
 ws.getCell('A1').alignment={horizontal:'center',vertical:'middle'};ws.getRow(1).height=38;
 ws.getCell('A2').value='일시';ws.getCell('B2').value=current.when_text||'';
 ws.getCell('C2').value='장소';ws.getCell('D2').value=current.place||'';
 ws.getRow(2).height=30;
 ws.getRow(4).values=['연번','성명','구분','서명'];
 const edge={top:{style:'thin'},bottom:{style:'thin'},left:{style:'thin'},right:{style:'thin'}};
 for(let r=4;r<=Math.max(16,4+people.length);r++){
  ws.getRow(r).height=r===4?32:44;
  for(let c=1;c<=4;c++){
   const cell=ws.getCell(r,c);cell.border=edge;
   cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
   cell.font={name:'맑은 고딕',size:11,bold:r===4};
   if(r===4)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEEEEEE'}};
  }
 }
 for(let i=0;i<people.length;i++){
  const p=people[i],r=i+5;
  ws.getCell('A'+r).value=i+1;ws.getCell('B'+r).value=p.full_name||'';
  ws.getCell('C'+r).value=p.position||'';
  if(p.signature_data?.startsWith('data:image/png;base64,')){
   const imageId=wb.addImage({base64:p.signature_data,extension:'png'});
   ws.addImage(imageId,{tl:{col:3.08,row:r-1+.09},ext:{width:130,height:36},editAs:'oneCell'});
  }
 }
 ws.pageSetup={paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0};
 const result=await wb.xlsx.writeBuffer();
 download((current.title||'회의')+'_회의등록부.xlsx',new Blob([result],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 notice('회의 등록부 Excel 파일을 저장했습니다.');
}
const prevExport=window.exportCustom;
window.exportCustom=async function(type){
 if(!meeting()||current.selected_template_id)return prevExport(type);
 if(type==='pdf')return window.previewPrint();
 if(type==='xlsx'){try{await meetingXlsx()}catch(e){err(e)}return;}
 return prevExport(type);
};
window.MeetingRegistration={meetingSvg,meetingPages,dialogFields};
})();