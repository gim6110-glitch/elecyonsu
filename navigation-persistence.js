/* Keep the current administrator page on refresh, without storing passwords or tokens. */
(function(){
'use strict';
const PREFIX='elecyonsu:last-page:v1:';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function key(id){return PREFIX+id;}
function read(id){
 if(!id)return null;
 try{
  const raw=sessionStorage.getItem(key(id));
  if(!raw)return null;
  const value=JSON.parse(raw);
  if(value?.view==='detail'&&UUID.test(value.trainingId)){
   return {view:'detail',trainingId:value.trainingId,scrollY:Math.max(0,Number(value.scrollY)||0)};
  }
  return {view:'home',scrollY:Math.max(0,Number(value?.scrollY)||0)};
 }catch(_){return null;}
}
function save(id,value){
 if(!id||new URLSearchParams(location.search).has('sign'))return;
 try{sessionStorage.setItem(key(id),JSON.stringify(value));}catch(_){}
}
function clear(id){
 if(!id)return;
 try{sessionStorage.removeItem(key(id));}catch(_){}
}
window.ElecyonsuNavState={read,save,clear};
const previousShowHome=window.showHome;
window.showHome=async function(...args){
 const result=await previousShowHome.apply(this,args);
 if(user?.id)save(user.id,{view:'home',scrollY:0});
 return result;
};
const previousOpenTraining=window.openTraining;
window.openTraining=async function(id,...args){
 const result=await previousOpenTraining.call(this,id,...args);
 if(user?.id&&current?.id===id){
  save(user.id,{view:'detail',trainingId:id,scrollY:0});
 }
 return result;
};
let busy=false;
window.addEventListener('scroll',()=>{
 if(busy||!user?.id||!current?.id||document.getElementById('detail')?.classList.contains('hidden'))return;
 busy=true;
 requestAnimationFrame(()=>{
  busy=false;
  const value=read(user.id);
  if(value?.view==='detail'&&value.trainingId===current.id){
   value.scrollY=window.scrollY||0;save(user.id,value);
  }
 });
},{passive:true});
})();