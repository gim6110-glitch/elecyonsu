/* Electronically signed training roster: mobile completion and protected same-device re-sign. */
(function(){
'use strict';
const D=document;
const form=D.getElementById('publicSign');
if(!form) return;
const $=id=>D.getElementById(id);
const html=
 '<div id="sigStatusOverlay" class="sig-overlay"><section class="sig-card" role="dialog" aria-modal="true" aria-labelledby="sigStatusHeading">'+
  '<div id="sigStatusIcon" class="sig-icon">✓</div>'+
  '<h2 id="sigStatusHeading" class="sig-heading"></h2>'+
  '<p id="sigStatusBody" class="sig-copy"></p>'+
  '<div class="sig-actions"><button type="button" id="sigStatusPrimary" class="sig-primary"></button>'+
  '<button type="button" id="sigStatusSecondary" class="sig-secondary"></button></div></section></div>'+
 '<div id="sigEditOverlay" class="sig-overlay"><section class="sig-card" role="dialog" aria-modal="true" aria-labelledby="sigEditHeading">'+
  '<h2 id="sigEditHeading" class="sig-editor-heading">서명 다시 작성</h2>'+
  '<p class="sig-editor-help">새 서명을 작성해 기존 서명을 수정합니다.<br>같은 휴대폰에서 작성한 서명만 수정할 수 있습니다.</p>'+
  '<p id="sigEditPerson" class="sig-editor-help"></p>'+
  '<canvas id="sigEditCanvas" class="sig-inkpad" aria-label="서명 수정 입력 영역"></canvas>'+
  '<div class="sig-editor-tools"><button type="button" id="sigEditClear" class="alt">서명 지우기</button>'+
  '<button type="button" id="sigEditCancel" class="alt">취소</button></div>'+
  '<div class="sig-actions"><button type="button" id="sigEditSave" class="sig-primary">수정 완료</button></div>'+
  '<p id="sigEditError" class="sig-error" aria-live="polite"></p>'+
 '</section></div>';
D.body.insertAdjacentHTML('beforeend',html);
const statusOverlay=$('sigStatusOverlay'),editOverlay=$('sigEditOverlay');
const primary=$('sigStatusPrimary'),secondary=$('sigStatusSecondary');
const signButton=form.querySelector('button[onclick="submitSign()"]');
const pad=$('sigEditCanvas');
let editCtx=null,editDrawn=false,penDown=false,editing=null,submitting=false,saving=false;

function refreshModalScroll(){
 D.body.classList.toggle('sig-modal-open',
  statusOverlay.classList.contains('active')||editOverlay.classList.contains('active'));
}
function closeStatus(){statusOverlay.classList.remove('active');refreshModalScroll();}
function closeEdit(){editOverlay.classList.remove('active');editing=null;refreshModalScroll();}
function presentStatus(kind,heading,message,primaryText,secondaryText,onPrimary,onSecondary){
 $('sigStatusIcon').className='sig-icon'+(kind==='question'?' question':kind==='locked'?' locked':'');
 $('sigStatusIcon').textContent=kind==='success'?'✓':kind==='question'?'?':'!';
 $('sigStatusHeading').textContent=heading;
 $('sigStatusBody').textContent=message;
 primary.textContent=primaryText||'확인';
 secondary.textContent=secondaryText||'';
 secondary.hidden=!secondaryText;
 primary.onclick=function(){closeStatus();if(onPrimary)onPrimary();};
 secondary.onclick=function(){closeStatus();if(onSecondary)onSecondary();};
 statusOverlay.classList.add('active');refreshModalScroll();
 primary.focus();
}
function keyFor(training,name,position){
 return 'elecyonsu:edit-proof:'+training+':'+encodeURIComponent(name)+':'+encodeURIComponent(position);
}
function storedProof(training,name,position){
 try{return localStorage.getItem(keyFor(training,name,position));}catch(_){return null;}
}
function saveProof(training,name,position,value){
 try{localStorage.setItem(keyFor(training,name,position),value);return true;}
 catch(_){return false;}
}
function createProof(){
 if(!window.crypto||!crypto.getRandomValues)throw Error('안전한 연결(HTTPS)이 필요합니다.');
 const raw=new Uint8Array(32);crypto.getRandomValues(raw);
 return Array.from(raw,x=>x.toString(16).padStart(2,'0')).join('');
}
function resetOriginal(){
 if($('signName'))$('signName').value='';
 if($('signPosition'))$('signPosition').value='';
 if($('selfConfirm'))$('selfConfirm').checked=false;
 if(typeof clearSign==='function')clearSign();
 if($('signResult'))$('signResult').textContent='';
 if(signButton){signButton.disabled=false;signButton.textContent='서명 제출';}
 $('signName')?.focus();
}
function showSuccess(updated,savedLocally){
 if($('signResult'))$('signResult').textContent=updated?'서명이 수정되었습니다.':'서명이 완료되었습니다.';
 if(signButton)signButton.disabled=true;
 const msg=updated
  ? '새로 작성한 서명으로 정상적으로 변경되었습니다.'
  : '전자서명이 정상적으로 제출되었습니다.'+
    (savedLocally?' 같은 휴대폰에서는 나중에 서명을 수정할 수 있습니다.':' 이 브라우저에서는 수정 권한을 저장하지 못했습니다.');
 presentStatus('success',updated?'서명 수정 완료':'서명 제출 완료',
  msg,'확인','다른 참석자 서명',null,resetOriginal);
}
function showEditUnavailable(){
 presentStatus('locked','서명 수정 안내',
  '이전에 등록된 서명이거나 다른 휴대폰에서 제출한 서명입니다. 안전한 수정을 위해 연수 담당자에게 서명 초기화를 요청한 뒤 다시 작성해 주세요.',
  '확인');
}
function handleDuplicate(data){
 presentStatus('question','이미 서명이 등록되었습니다',
  '기존 서명이 있습니다. 수정하시겠습니까?',
  '수정','취소',
  function(){
   const proof=storedProof(data.token,data.name,data.position);
   if(!proof){showEditUnavailable();return;}
   openEdit({...data,proof});
  });
}
function point(e){
 const r=pad.getBoundingClientRect();
 return {x:e.clientX-r.left,y:e.clientY-r.top};
}
function setupPad(){
 const rect=pad.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,3);
 pad.width=Math.max(1,Math.round(rect.width*ratio));
 pad.height=Math.max(1,Math.round(rect.height*ratio));
 editCtx=pad.getContext('2d');
 editCtx.setTransform(ratio,0,0,ratio,0,0);
 editCtx.strokeStyle='#1c2b47';editCtx.fillStyle='#1c2b47';
 editCtx.lineWidth=2.8;editCtx.lineCap='round';editCtx.lineJoin='round';
 editDrawn=false;penDown=false;
}
pad.addEventListener('pointerdown',e=>{
 if(!editCtx)return;
 e.preventDefault();penDown=true;editDrawn=true;
 try{pad.setPointerCapture(e.pointerId);}catch(_){}
 const p=point(e);editCtx.beginPath();editCtx.moveTo(p.x,p.y);
 editCtx.beginPath();editCtx.arc(p.x,p.y,1.4,0,Math.PI*2);editCtx.fill();
 editCtx.beginPath();editCtx.moveTo(p.x,p.y);
});
pad.addEventListener('pointermove',e=>{
 if(!penDown||!editCtx)return;
 e.preventDefault();const p=point(e);editCtx.lineTo(p.x,p.y);editCtx.stroke();
});
pad.addEventListener('pointerup',()=>{penDown=false;});
pad.addEventListener('pointercancel',()=>{penDown=false;});
function openEdit(record){
 editing=record;
 $('sigEditPerson').textContent=record.name+' · '+record.position;
 $('sigEditError').textContent='';
 $('sigEditSave').disabled=false;
 editOverlay.classList.add('active');refreshModalScroll();
 requestAnimationFrame(()=>{setupPad();$('sigEditClear').focus();});
}
$('sigEditClear').onclick=()=>{if(editCtx)setupPad();};
$('sigEditCancel').onclick=closeEdit;
$('sigEditSave').onclick=async function(){
 if(saving||!editing)return;
 if(!editDrawn){$('sigEditError').textContent='새 서명을 작성해 주세요.';return;}
 saving=true;this.disabled=true;this.textContent='수정 중...';
 try{
  const status=req(await sb.rpc('submit_signature_with_edit_token',{
   p_token:editing.token,p_name:editing.name,p_position:editing.position,
   p_signature:pad.toDataURL('image/png'),p_edit_token:editing.proof,p_replace:true
  }));
  if(status==='UPDATED'){closeEdit();showSuccess(true,true);return;}
  if(status==='EDIT_PROOF_REQUIRED'||status==='EDIT_DENIED'){
   closeEdit();showEditUnavailable();return;
  }
  const labels={CLOSED:'서명 접수가 종료되었습니다.',INVALID_IMAGE:'서명 이미지 형식을 확인해 주세요.',
   NOT_SIGNED:'담당자가 서명을 초기화했습니다. 원래 화면에서 새로 서명해 주세요.',
   NO_MATCH:'명단에 등록된 성명·직급과 일치하지 않습니다.',
   AMBIGUOUS:'동명이인과 직급이 중복되어 관리자 확인이 필요합니다.'};
  $('sigEditError').textContent=labels[status]||'서명을 수정하지 못했습니다. 다시 시도해 주세요.';
 }catch(e){console.error(e);$('sigEditError').textContent=e?.message||'서명 수정 중 오류가 발생했습니다.';}
 finally{saving=false;this.disabled=false;this.textContent='수정 완료';}
};
window.submitSign=async function(){
 if(submitting)return;
 const name=$('signName').value.trim(),position=$('signPosition').value.trim();
 if(!name||!position)return notice('성명과 직급을 입력해 주세요.');
 if(!$('selfConfirm')?.checked)return notice('본인 직접 서명 확인에 동의해 주세요.');
 if(!drawn)return notice('손글씨 서명을 작성해 주세요.');
 const token=new URLSearchParams(location.search).get('sign');
 if(!token)return notice('유효하지 않은 서명 링크입니다.');
 submitting=true;
 if(signButton){signButton.disabled=true;signButton.textContent='제출 중...';}
 try{
  const proof=storedProof(token,name,position)||createProof();
  const status=req(await sb.rpc('submit_signature_with_edit_token',{
   p_token:token,p_name:name,p_position:position,
   p_signature:$('signcanvas').toDataURL('image/png'),
   p_edit_token:proof,p_replace:false
  }));
  if(status==='OK'){
   const saved=saveProof(token,name,position,proof);
   showSuccess(false,saved);return;
  }
  if(status==='ALREADY'){handleDuplicate({token,name,position});return;}
  const labels={NO_MATCH:'명단과 일치하는 성명·직급이 없습니다. 담당자에게 확인해 주세요.',
   AMBIGUOUS:'같은 성명과 직급의 참석자가 여러 명입니다. 담당자에게 문의해 주세요.',
   CLOSED:'서명 접수가 종료되었습니다.',
   INVALID_IMAGE:'서명 크기 또는 형식이 올바르지 않습니다.',
   INVALID_TOKEN:'안전한 서명 처리에 실패했습니다. 페이지를 새로고침해 주세요.'};
  notice(labels[status]||'서명을 제출하지 못했습니다. 다시 시도해 주세요.');
 }catch(e){console.error(e);notice(e?.message||'서명 제출 중 오류가 발생했습니다.');}
 finally{
  submitting=false;
  if(signButton&&signButton.textContent==='제출 중...'){
   signButton.disabled=false;signButton.textContent='서명 제출';
  }
 }
};
})();