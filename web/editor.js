(()=>{
const $=id=>document.getElementById(id);
const defaultTracks=()=>[{id:'v1',name:'VIDEO 1',type:'video'},{id:'v2',name:'VIDEO 2',type:'video'},{id:'t1',name:'IMAGES',type:'image'},{id:'a1',name:'AUDIO 1',type:'audio'},{id:'a2',name:'AUDIO 2',type:'audio'}];
let assets=[],tracks=defaultTracks();
let clips=[],selectedAsset=null,selectedClip=null,playhead=0,zoom=100,history=[],future=[],currentProject='Untitled Project',activeMediaUrl=null,playing=false,raf=null,lastTick=0;
const video=$('previewVideo'),img=$('previewImage');
let sourceMode=false;
video.muted=true;
const uid=()=>Math.random().toString(36).slice(2,10);
const fmt=s=>{s=Math.max(0,s||0);return String(Math.floor(s/60)).padStart(2,'0')+':'+(s%60).toFixed(1).padStart(4,'0')};
const assetById=id=>assets.find(a=>a.id===id);
const clipById=id=>clips.find(c=>c.id===id);
const rate=c=>Math.max(.25,Math.min(4,Number(c.rate)||1));
const dur=c=>Math.max(0,c.out-c.in)/rate(c);
const sourceTime=(c,local)=>Math.max(c.in,Math.min(c.out,(c.reverse?c.out:c.in)+(c.reverse?-1:1)*local*rate(c)));
const keyTime=(c,local)=>c.in+local*rate(c);
function followMedia(el,c,local,run){
 const end=Number.isFinite(el.duration)?Math.max(0,el.duration-.015):c.out;
 const target=Math.min(end,sourceTime(c,local));
 if(el.readyState && !el.seeking && Math.abs(el.currentTime-target)>(run&&!c.reverse?.20:.025))el.currentTime=target;
 if(run&&!c.reverse){
  el.preservesPitch=true;
  el.playbackRate=rate(c);
  if(el.paused)el.play().catch(()=>{});
 }else el.pause();
}

const totalDuration=()=>Math.max(0,...clips.map(c=>c.start+dur(c)));
const toast=msg=>{let t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,2200)};
function snapshot(){scheduleSave();history.push(JSON.stringify({clips,tracks,playhead}));if(history.length>60)history.shift();future=[];updateUndoRedo()}
function restore(s){let x=JSON.parse(s);clips=x.clips;tracks=x.tracks;playhead=x.playhead;selectedClip=null;renderAll()}
function undo(){if(!history.length)return;future.push(JSON.stringify({clips,tracks,playhead}));restore(history.pop())}
function redo(){if(!future.length)return;history.push(JSON.stringify({clips,tracks,playhead}));restore(future.pop())}
function updateUndoRedo(){$('undoBtn').disabled=!history.length;$('redoBtn').disabled=!future.length}
function mediaType(file){if(file.type.startsWith('video/'))return'video';if(file.type.startsWith('audio/'))return'audio';if(file.type.startsWith('image/'))return'image';return null}
function importFiles(files){let added=0;for(const file of files){let type=mediaType(file);if(!type)continue;let a=assets.find(x=>!x.url&&x.name===file.name&&x.size===file.size);if(a){Object.assign(a,{file,url:URL.createObjectURL(file)})}else{a={id:uid(),name:file.name,type,size:file.size,duration:null,file,url:URL.createObjectURL(file)};assets.push(a);}if(type==='video'||type==='audio'){let el=document.createElement(type);el.preload='metadata';el.src=a.url;el.onloadedmetadata=()=>{if(Number.isFinite(el.duration)&&el.duration>0)a.duration=el.duration;el.removeAttribute('src');el.load();renderLibrary();scheduleSave()};}if(type==='audio')decodeWave(a);added++}renderLibrary();if(added)scheduleSave();if(added)toast(added+' media file(s) imported');else toast('No supported media files found')}
function renderLibrary(){$('libraryList').innerHTML='';if(!assets.length){$('libraryList').innerHTML='<div class="empty">Your media will appear here.</div>';return}for(const a of assets){let el=document.createElement('div');el.className='media-item';el.tabIndex=0;el.setAttribute('role','button');el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();el.click()}};el.style.borderColor=a.id===selectedAsset?'#68a7ff':'';el.innerHTML=`<div class="media-icon">${a.type==='video'?'▶':a.type==='audio'?'♫':'▧'}</div><div class="media-name"><strong title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</strong><small>${a.type.toUpperCase()} · ${a.duration?fmt(a.duration):bytes(a.size)}</small></div>`;el.onclick=()=>{selectedAsset=a.id;sourceMode=true;renderLibrary();previewAsset(a);animationPreview()};$('libraryList').appendChild(el)}}
function bytes(n){return n<1024*1024?(n/1024).toFixed(0)+' KB':(n/1024/1024).toFixed(1)+' MB'}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function previewAsset(a){if(!a)return; if(!playing)stopPlayback();$('previewPlaceholder').style.display='none';$('previewLabel').textContent=a.name;if(activeMediaUrl){/* object URLs remain owned by assets */}if(!a.url&&a.type!=='title'){video.style.display='none';img.style.display='none';return}if(a.type==='title'){video.style.display='none';img.style.display='none';return}if(a.type==='video'){video.muted=false;img.style.display='none';video.style.display='block';video.src=a.url;video.currentTime=0;video.pause()}else if(a.type==='image'){video.pause();video.style.display='none';img.src=a.url;img.style.display='block'}else{video.pause();video.style.display='none';img.style.display='none';$('previewPlaceholder').style.display='grid';$('previewPlaceholder').innerHTML='<div class="big">♫</div><strong>'+escapeHtml(a.name)+'</strong><div class="hint">Audio asset selected — add it to an audio track</div>'}}
function addClip(assetId,trackId){let a=assetById(assetId);if(!a)return;let tr=tracks.find(t=>t.id===trackId);if(!tr||tr.locked){toast('Choose an unlocked track');return;}let length=a.duration|| (a.type==='image'?5:10);snapshot();let c={id:uid(),assetId,trackId,start:Math.max(0,playhead),in:0,out:length};clips.push(c);selectedClip=c.id;playhead=c.start;renderAll();toast('Added to '+tr.name)}
function addTrack(type){snapshot();let n=tracks.filter(t=>t.type===type).length+1;let id=uid();tracks.push({id,name:(type==='video'?'VIDEO':type==='audio'?'AUDIO':'IMAGE')+' '+n,type});renderTimeline()}
function selectClip(id){sourceMode=false;selectedClip=id;let c=clipById(id);if(c){let a=assetById(c.assetId);$('selectedLabel').textContent=a?.name||'Clip';$('clipStart').value=c.start.toFixed(1);$('clipIn').value=c.in.toFixed(1);$('clipOut').value=c.out.toFixed(1);$('clipDuration').value=dur(c).toFixed(1);['clipStart','clipIn','clipOut','applyTrimBtn'].forEach(k=>$(k).disabled=false);previewAsset(a);seekPreview(c,Math.max(0,playhead-c.start))}else{$('selectedLabel').textContent='Nothing selected';['clipStart','clipIn','clipOut','clipDuration','applyTrimBtn'].forEach(k=>$(k).disabled=true)}renderTimeline();creativeInspector();motionInspector();animationInspector();proInspector();renderProTools()}
function applyInspector(){let c=clipById(selectedClip);if(!c||locked(c))return;let start=Number($('clipStart').value),inn=Number($('clipIn').value),out=Number($('clipOut').value);if(![start,inn,out].every(Number.isFinite)||start<0||inn<0||out<=inn){toast('Check the clip timing values');return}let a=assetById(c.assetId);if(a?.duration&&out>a.duration){toast('Source Out exceeds media duration');return}snapshot();c.start=start;c.in=inn;c.out=out;renderAll();toast('Clip updated')}
function renderTimeline(){let root=$('timeline');root.innerHTML='';let duration=Math.max(20,totalDuration()+5);let width=duration*zoom;let ruler=document.createElement('div');ruler.className='ruler';ruler.style.width=width+'px';for(let s=0;s<=duration;s+=5){let m=document.createElement('span');m.className='ruler-mark';m.style.left=(s*zoom)+'px';m.textContent=fmt(s);ruler.appendChild(m)}root.appendChild(ruler);
for(const tr of tracks){let row=document.createElement('div');row.className='track';let label=document.createElement('div');label.className='track-label';label.textContent=tr.name;label.style.flexWrap="wrap";for(const [key,txt] of [["locked","L"],["hidden","H"],["muted","M"]]){let b=document.createElement("button");b.textContent=txt;b.title=key;b.style.cssText="padding:1px 4px;font-size:10px;";b.style.background=tr[key]?"#7651a8":"";b.onclick=()=>{snapshot();tr[key]=!tr[key];renderAll()};label.append(b)};row.appendChild(label);let lane=document.createElement('div');lane.className='track-lane';lane.style.width=width+'px';lane.style.flex='0 0 '+width+'px';lane.dataset.track=tr.id;lane.ondragover=e=>e.preventDefault();lane.ondrop=e=>{e.preventDefault();let id=e.dataTransfer.getData('clip');let c=clipById(id);if(c&&!locked(c)&&!tr.locked&&compatibleTrack(c,tr)){snapshot();let rect=lane.getBoundingClientRect();c.start=Math.max(0,(e.clientX-rect.left)/zoom);c.trackId=tr.id;renderAll()}};for(const c of clips.filter(x=>x.trackId===tr.id)){let a=assetById(c.assetId);let el=document.createElement('div');el.tabIndex=0;el.setAttribute('role','button');el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();selectClip(c.id)}};el.className='clip '+(a?.type||'video')+(c.id===selectedClip?' selected':'');el.style.left=(c.start*zoom)+'px';el.style.width=Math.max(28,dur(c)*zoom)+'px';el.textContent=a?.name||'Missing media';el.draggable=false;el.style.touchAction='none';el.onpointerdown=e=>{if(e.button!==0||tr.locked)return; e.stopPropagation();const x=e.clientX,old=c.start,oldIn=c.in,oldOut=c.out,rect=el.getBoundingClientRect(),edge=e.clientX-rect.left<8?'left':rect.right-e.clientX<8?'right':'move';let moved=false;el.setPointerCapture(e.pointerId);el.onpointermove=ev=>{let d=(ev.clientX-x)/zoom;if(!moved&&Math.abs(ev.clientX-x)<4)return;if(!moved){snapshot();moved=true}if(edge==='move')c.start=snapTime(old+d,c);else {
 const limit=a?.duration||86400;
 if(edge==='left'){
  const shift=(snapTime(old+d,c)-old)*rate(c);
  if(c.reverse){c.out=Math.max(oldIn+.1,Math.min(limit,oldOut-shift));c.start=old+(oldOut-c.out)/rate(c)}
  else{c.in=Math.max(0,Math.min(oldOut-.1,oldIn+shift));c.start=old+(c.in-oldIn)/rate(c)}
 }else{
  const end=old+(oldOut-oldIn)/rate(c);
  const shift=(snapTime(end+d,c)-end)*rate(c);
  if(c.reverse)c.in=Math.max(0,Math.min(oldOut-.1,oldIn-shift));
  else c.out=Math.max(oldIn+.1,Math.min(limit,oldOut+shift));
 }
}el.style.left=c.start*zoom+'px';el.style.width=Math.max(28,dur(c)*zoom)+'px'};el.onpointerup=el.onpointercancel=()=>{el.onpointermove=null;if(moved){selectedClip=c.id;renderAll()}}};el.ondragstart=e=>e.dataTransfer.setData('clip',c.id);el.onclick=e=>{e.stopPropagation();selectClip(c.id)};el.ondblclick=()=>{selectClip(c.id);playhead=c.start;updatePlayhead();};decorateClip(el,c,a);lane.appendChild(el)}lane.onclick=e=>{let rect=lane.getBoundingClientRect();playhead=Math.max(0,(e.clientX-rect.left)/zoom);previewAt(playhead);updatePlayhead();motionInspector()};row.appendChild(lane);root.appendChild(row)}
let ph=document.createElement('div');ph.className='playhead';ph.style.left=(94+playhead*zoom)+'px';ph.style.height=(tracks.length*58+24)+'px';root.style.position='relative';root.appendChild(ph);
$('durationLabel').textContent=totalDuration().toFixed(1)+' seconds';$('timecode').textContent=fmt(playhead)+' / '+fmt(totalDuration())}
function renderAll(){sourceMode=false;scheduleSave();renderLibrary();renderTimeline();selectClip(selectedClip);updatePlayhead();updateUndoRedo()}
function updatePlayhead(){creativePreview();motionPreview();animationPreview();let ph=$('timeline').querySelector('.playhead');if(ph)ph.style.left=(94+playhead*zoom)+'px';$('timecode').textContent=fmt(playhead)+' / '+fmt(totalDuration())}
function seekPreview(c,offset){let a=assetById(c.assetId);if(!a)return;if(a.type==='video'){followMedia(video,c,offset,false)}}
function activeClipAt(t){return clips.filter(c=>!trackOf(c)?.hidden&&['video','image'].includes(assetById(c.assetId)?.type)&&t>=c.start&&t<c.start+dur(c)).sort((a,b)=>tracks.findIndex(x=>x.id===b.trackId)-tracks.findIndex(x=>x.id===a.trackId))[0]}
function previewAt(t){sourceMode=false;let c=activeClipAt(t);if(c){let a=assetById(c.assetId);if(a){if(a.type==='video'){if(video.src!==a.url)previewAsset(a);followMedia(video,c,t-c.start,false)}else if(a.type==='image'){if(img.src!==a.url||img.style.display==='none')previewAsset(a)}}}else{$('previewLabel').textContent='No clip at playhead';video.pause();video.style.display='none';img.style.display='none'}}
function stopPlayback(){playing=false;for(const a of audioPlayers.values())a.pause();if(raf)cancelAnimationFrame(raf);raf=null;$('playBtn').textContent='▶ Play';video.pause()}
function tick(ts){
 if(!playing)return;
 if(!lastTick)lastTick=ts;
 playhead+=(ts-lastTick)/1000;lastTick=ts;
 if(playhead>=totalDuration()){playhead=0;stopPlayback();previewAt(playhead)}
 updatePlayhead();
 if(playing)raf=requestAnimationFrame(tick);
}
function togglePlay(){if(playing){stopPlayback();return}video.pause();sourceMode=false;if(!clips.length){toast('Add a clip to the timeline first');return}if(playhead>=totalDuration())playhead=0;ensurePreviewAudio();playing=true;lastTick=0;$('playBtn').textContent='Ⅱ Pause';raf=requestAnimationFrame(tick)}
function split(){
 const c=clipById(selectedClip);
 if(!c||locked(c)){toast('Select an unlocked clip first');return}
 const at=sourceTime(c,playhead-c.start);
 if(at<=c.in+.03||at>=c.out-.03){toast('Move the playhead inside the selected clip');return}
 snapshot();
 const right={...c,id:uid(),start:playhead};
 if(c.reverse){right.out=at;c.in=at}else{right.in=at;c.out=at}
 clips.push(right);selectedClip=right.id;renderAll();toast('Clip split');
}
function deleteClip(){if(!selectedClip||locked(clipById(selectedClip)))return;snapshot();clips=clips.filter(c=>c.id!==selectedClip);selectedClip=null;renderAll();toast('Clip deleted')}
function serialize(){return{format:'joster-studio-project',version:'2.0',name:currentProject,tracks,clips:clips.map(c=>({...c})),assets:assets.map(a=>({id:a.id,name:a.name,type:a.type,size:a.size,duration:a.duration,peaks:a.peaks})),savedAt:new Date().toISOString(),note:'Media files are not embedded. Keep original files available and re-import them when opening on another device.'}}
function saveProject(){persistProject(true)}
function downloadProject(){let data=serialize();let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});downloadBlob(blob,(currentProject.replace(/[^\w-]+/g,'_')||'joster-project')+'.joster');toast('Project file exported')}
async function downloadBlob(blob,name,transcode=false){
 if(window.JosterAndroid){
  if(downloadBlob.busy){toast('Wait for the current export');return false}
  downloadBlob.busy=true;
  try{
   if(!JosterAndroid.begin())throw Error('Cannot create temporary file');
   for(let offset=0;offset<blob.size;offset+=192*1024){
    const part=new Uint8Array(await blob.slice(offset,offset+192*1024).arrayBuffer());
    let raw='';for(let i=0;i<part.length;i+=8192)raw+=String.fromCharCode(...part.subarray(i,i+8192));
    if(!JosterAndroid.append(btoa(raw)))throw Error('Cannot write temporary file');
   }
   if(!JosterAndroid.finish(name,blob.type.split(';')[0]||'application/octet-stream',transcode))throw Error('Cannot start file save');
   return true;
  }catch(e){JosterAndroid.abort();downloadBlob.busy=false;toast(e.message);return false}
 }
 const url=URL.createObjectURL(blob),anchor=document.createElement('a');
 anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 return true;
}
window.josterSaveResult=message=>{
 downloadBlob.busy=false;toast(message);
 if($('exportDialog').open)$('renderStatus').textContent=message;
};
async function openProjectFile(file){
 try{
  const {data,media}=await readProject(file);applyProject(data);
  for(const a of assets){const file=media.get(a.id);if(file){if(a.url)URL.revokeObjectURL(a.url);Object.assign(a,{file,url:URL.createObjectURL(file)})}}
  await recoverMedia();
  await persistProject(false);toast('Project opened. Re-import any missing media.');
 }catch(e){toast('That project file could not be opened')}
}
function newProject(){if(!confirm('Start a new project? Save your current project first if needed.'))return;clips=[];selectedClip=null;selectedAsset=null;stopPlayback();replaceMedia([]);tracks=defaultTracks();playhead=0;currentProject='Untitled Project';history=[];future=[];renderAll();toast('New project ready')}
$('importBtn').onclick=()=>$('mediaInput').click();$('mediaInput').onchange=e=>importFiles(e.target.files);
$('dropzone').ondragover=e=>{e.preventDefault();e.currentTarget.style.borderColor='#68a7ff'};$('dropzone').ondragleave=e=>e.currentTarget.style.borderColor='';$('dropzone').ondrop=e=>{e.preventDefault();e.currentTarget.style.borderColor='';importFiles(e.dataTransfer.files)};
$('addSelectedBtn').onclick=()=>{let a=assetById(selectedAsset);if(!a){toast('Select media in the library first');return}if(a.type==='title'){toast('Use Add title to create a title clip');return}let type=a.type==='audio'?'audio':a.type==='image'?'image':'video';let tr=tracks.find(t=>t.type===type&&!t.locked);if(!tr){toast('Add or unlock a '+type+' track');return}addClip(a.id,tr.id)};
$('addVideoBtn').onclick=()=>addTrack('video');$('addAudioBtn').onclick=()=>addTrack('audio');$('addImageBtn').onclick=()=>addTrack('image');
$('splitBtn').onclick=split;$('deleteBtn').onclick=deleteClip;$('undoBtn').onclick=undo;$('redoBtn').onclick=redo;$('applyTrimBtn').onclick=applyInspector;$('zoomInput').oninput=e=>{zoom=Number(e.target.value);renderTimeline()};
$('playBtn').onclick=togglePlay;$('prevBtn').onclick=()=>{let c=clips.filter(x=>x.start<playhead-.05).sort((a,b)=>b.start-a.start)[0];playhead=c?c.start:0;previewAt(playhead);updatePlayhead();motionInspector()};$('nextBtn').onclick=()=>{let c=clips.filter(x=>x.start>playhead+.05).sort((a,b)=>a.start-b.start)[0];if(c){playhead=c.start;previewAt(playhead);updatePlayhead();motionInspector()}};
$('saveBtn').onclick=saveProject;$('exportProjectBtn').onclick=downloadProject;$('openBtn').onclick=()=>$('projectInput').click();$('projectInput').onchange=e=>{if(e.target.files[0])openProjectFile(e.target.files[0])};$('newProjectBtn').onclick=newProject;
$('fitBtn').onclick=()=>{$('zoomInput').value= Math.max(40,Math.min(180,Math.floor(900/Math.max(20,totalDuration()))));zoom=Number($('zoomInput').value);renderTimeline()};

document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,button,[contenteditable],dialog'))return;if(e.code==='Space'){e.preventDefault();togglePlay()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject()}if(e.key==='Delete'||e.key==='Backspace')deleteClip();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo()}});

const audioPlayers=new Map();

const motionDefaults={x:0,y:0,scale:100,rotation:0,opacity:100};
function motionValue(c,t){let base={...motionDefaults};if(!c)return base;let keys=[...(c.keys||[])].sort((a,b)=>a.t-b.t);if(!keys.length)return base;let l=keys[0],r=keys.at(-1);for(let i=1;i<keys.length;i++)if(t<=keys[i].t){l=keys[i-1];r=keys[i];break}let f=r.t===l.t?0:Math.max(0,Math.min(1,(t-l.t)/(r.t-l.t)));if(c.easing==='smooth')f=f*f*(3-2*f);if(c.easing==='hold'&&f<1)f=0;for(let k in base)base[k]=(l[k]??base[k])+((r[k]??base[k])-(l[k]??base[k]))*f;return base}
function motionInspector(){let root=$('motion');root.replaceChildren();let c=clipById(selectedClip);if(!c)return;let a=assetById(c.assetId);if(!a||a.type==='audio')return;let t=Math.max(c.in,Math.min(c.out,keyTime(c,playhead-c.start))),v=motionValue(c,t),inputs={};for(let k in v){let l=document.createElement('label');l.className='field';l.textContent=k+' '+(k==='rotation'?'degrees':k==='x'||k==='y'?'% of element':'%');let i=document.createElement('input');i.type='number';i.value=Math.round(v[k]*10)/10;i.step=1;inputs[k]=i;l.append(i);root.append(l)}let b=document.createElement('button');b.textContent='◆ Set keyframe at playhead';b.onclick=()=>{if(locked(c))return;if(playhead<c.start||playhead>c.start+dur(c)){toast('Move playhead inside clip');return}snapshot();let t=keyTime(c,playhead-c.start);let k={t};for(let n in inputs)k[n]=Number(inputs[n].value)||0;k.scale=Math.max(1,k.scale);k.opacity=Math.max(0,Math.min(100,k.opacity));c.keys=[...(c.keys||[]).filter(x=>Math.abs(x.t-t)>.03),k];renderAll()};root.append(b);let clear=document.createElement('button');clear.textContent='Clear keyframes';clear.onclick=()=>{if(locked(c))return;snapshot();c.keys=[];renderAll()};root.append(clear);let l=document.createElement('label');l.className='field';l.textContent='Entrance / exit effect';let sel=document.createElement('select');for(let x of ['none','fade','slide','zoom','wipe'])sel.add(new Option(x,x));sel.value=c.motionEffect||'none';sel.disabled=locked(c);sel.onchange=()=>{snapshot();c.motionEffect=sel.value;updatePlayhead()};l.append(sel);root.append(l);root.append(selectField('Keyframe easing',c,'easing',[['linear','Linear'],['smooth','Ease in/out'],['hold','Hold']]));let d=document.createElement('label');d.className='field';d.textContent='Effect duration (sec)';let i=document.createElement('input');i.type='number';i.min=.1;i.step=.1;i.value=c.motionDuration||.5;i.disabled=locked(c);i.onchange=()=>{snapshot();c.motionDuration=Math.max(.1,Number(i.value)||.5);updatePlayhead()};d.append(i);root.append(d)}
function motionPreview(){let c=activeClipAt(playhead),title=clips.filter(c=>!trackOf(c)?.hidden&&assetById(c.assetId)?.type==='title'&&playhead>=c.start&&playhead<c.start+dur(c)).at(-1);for(let [el,k] of [[video,c],[img,c],[$('titleOverlay'),title]]){let t=k?keyTime(k,playhead-k.start):0,v=motionValue(k,t),f=k?Math.max(0,Math.min(1,(playhead-k.start)/(k.motionDuration||.5),(k.start+dur(k)-playhead)/(k.motionDuration||.5))):1;let effect=k?.motionEffect;el.style.transform=`translate(${v.x+(effect==='slide'?(1-f)*100:0)}%,${v.y}%) rotate(${v.rotation}deg) scale(${v.scale/100*(effect==='zoom'?.5+.5*f:1)})`;let fade=k?.fade?Math.max(0,Math.min(1,(playhead-k.start)/k.fade,(k.start+dur(k)-playhead)/k.fade)):1;el.style.opacity=v.opacity/100*fade*(effect==='fade'?f:1);el.style.clipPath=effect==='wipe'?`inset(0 ${(1-f)*100}% 0 0)`:''}}
async function decodeWave(a){if(!a.file||a.file.size>40*1024*1024)return;let ctx;try{ctx=new (window.AudioContext||window.webkitAudioContext)();let buf=await ctx.decodeAudioData(await a.file.arrayBuffer()),data=buf.getChannelData(0),peaks=[];for(let i=0;i<240;i++){let start=Math.floor(i*data.length/240),end=Math.floor((i+1)*data.length/240),peak=0;for(let j=start;j<end;j++)peak=Math.max(peak,Math.abs(data[j]));peaks.push(peak)}a.peaks=peaks;renderTimeline()}catch(e){}finally{if(ctx)ctx.close().catch(()=>{})}}
function decorateClip(el,c,a){if(a?.peaks){let cv=document.createElement('canvas');cv.width=240;cv.height=20;cv.className='wave';let g=cv.getContext('2d');g.fillStyle='#fff';for(let i=0;i<240;i++){let n=Math.min(239,Math.floor((c.in+dur(c)*i/240)/(a.duration||c.out)*240)),h=Math.max(1,(a.peaks[n]||0)*20);g.fillRect(i,10-h/2,1,h)}el.append(cv)}for(let k of c.keys||[]){if(k.t<c.in||k.t>c.out)continue;let m=document.createElement('span');m.className='keymark';m.textContent='◆';m.style.left=((k.t-c.in)/dur(c)*100)+'%';el.append(m)}}

function creativeInspector(){const c=clipById(selectedClip),root=$('creative');root.replaceChildren();if(!c)return;const a=assetById(c.assetId);const fields=a?.type==='title'?[['text','Title text','text','New title'],['font','Font size','number',48],['color','Color','color','#ffffff'],['align','Alignment','select','center']]:[['volume','Volume %','number',100],['fade','Fade seconds','number',0],['brightness','Brightness %','number',100],['contrast','Contrast %','number',100],['saturation','Saturation %','number',100],['blur','Blur px','number',0]];for(const [key,label,type,def] of fields){let l=document.createElement('label');l.className='field';l.textContent=label;let input=document.createElement(type==='select'?'select':'input');if(type==='select'){for(const v of ['center','left','right'])input.add(new Option(v,v))}else input.type=type;input.value=c[key]??def;input.disabled=locked(c);input.onchange=()=>{snapshot();c[key]=type==='number'?Math.max(0,Number(input.value)||0):input.value;creativePreview();renderTimeline()};l.append(input);root.append(l)}}
function creativePreview(){let title=clips.filter(c=>!trackOf(c)?.hidden&&assetById(c.assetId)?.type==='title'&&playhead>=c.start&&playhead<c.start+dur(c)).at(-1),overlay=$('titleOverlay');overlay.textContent=!sourceMode&&title?captionText(title,playhead):'';overlay.style.fontSize=(title?.font||48)+'px';overlay.style.color=title?.color||'#fff';overlay.style.textAlign=title?.align||'center';overlay.style.justifyItems=title?.align==='left'?'start':title?.align==='right'?'end':'center';refreshPreviewAudio()}
$('titleBtn').onclick=()=>{snapshot();let tr=tracks.find(t=>t.type==='title');if(!tr){tr={id:uid(),name:'TITLES',type:'title'};tracks.unshift(tr)}let a={id:uid(),name:'Title',type:'title',duration:0,size:0};assets.push(a);let c={id:uid(),assetId:a.id,trackId:tr.id,start:playhead,in:0,out:5,text:'New title',font:48,color:'#ffffff'};clips.push(c);selectedClip=c.id;renderAll()};
$('duplicateBtn').onclick=()=>{let c=clipById(selectedClip);if(!c||locked(c))return;snapshot();let n={...c,id:uid(),start:c.start+dur(c)};clips.push(n);selectedClip=n.id;renderAll()};

const motion=document.createElement('div');motion.id='motion';motion.className='inspector-grid';motion.style.marginTop='12px';$('creative').after(motion);
try{let saved=localStorage.getItem('joster-editor-autosave');if(saved){let data=JSON.parse(saved);if(data.format==='joster-studio-project'){tracks=data.tracks||tracks;clips=data.clips||[];assets=(data.assets||[]).map(a=>({...a,...(assets.find(x=>x.id===a.id&&x.url)||{})}));currentProject=data.name||currentProject;$('saveStatus').textContent='Autosave found'}}}catch(e){}
renderAll();
let exporting=false,cancelExport=false;
$('renderBtn').onclick=()=>{$('exportDialog').showModal()};
$('cancelRender').onclick=()=>{if(exporting)cancelExport=true;else $('exportDialog').close()};
$('startRender').onclick=async()=>{
 if(exporting)return;let length=totalDuration();if(!length){$('renderStatus').textContent='Add clips first.';return}if(clips.some(c=>{let a=assetById(c.assetId);return !a||(a.type!=='title'&&!a.url)})){$('renderStatus').textContent='Reconnect all missing media first.';return}
 exporting=true;cancelExport=false;stopPlayback();$('startRender').disabled=true;let ctx,rec,stream,players=[],chunks=[],cv=$('renderCanvas'),g=cv.getContext('2d');let status=$('renderStatus');
 try{
 let h=Number($('renderResolution').value);if(h===2160&&navigator.deviceMemory&&navigator.deviceMemory<4)throw Error('4K needs more memory on this device. Try 1080p.');let ratio=$('renderRatio').value;cv.width=ratio==='portrait'?Math.round(h*9/16/2)*2:ratio==='square'?h:Math.round(h*16/9/2)*2;cv.height=ratio==='portrait'?h:ratio==='square'?h:h; if(ratio==='portrait'){cv.width=h;cv.height=Math.round(h*16/9/2)*2}let fps=Number($('renderFps').value),w=cv.width,H=cv.height;
 if(!window.MediaRecorder||!cv.captureStream)throw Error('This browser does not support video recording.');const webm=['video/webm;codecs=vp8,opus','video/webm'];
 const mp4=['video/mp4;codecs=avc1,mp4a.40.2','video/mp4;codecs=avc1,opus','video/mp4'];
 const candidates=$('renderFormat').value==='mp4'?(window.JosterAndroid?[...webm,...mp4]:[...mp4,...webm]):webm;let mime=candidates.find(x=>MediaRecorder.isTypeSupported(x));if(!mime)throw Error('No supported export format.');
 ctx=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();await loadNoiseGate(ctx);let dest=ctx.createMediaStreamDestination();status.textContent='Preparing media…';
 const wait=(el,event)=>new Promise((resolve,reject)=>{let timer=setTimeout(()=>reject(Error('Media loading timed out')),15000);el.addEventListener(event,()=>{clearTimeout(timer);resolve()},{once:true});el.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Cannot decode media'))},{once:true})});
 for(let c of clips){if(cancelExport)throw Error('Cancelled');let a=assetById(c.assetId),el=null,gain=null;if(a.type==='image'){el=new Image();let ready=wait(el,'load');el.src=a.url;await ready}else if(a.type!=='title'){el=document.createElement(a.type);el.preload='auto';el.playsInline=true;let ready=wait(el,'loadeddata');el.src=a.url;await ready;let source=ctx.createMediaElementSource(el);gain=makeAudioChain(ctx,source,dest);gain.output.gain.value=0;const begin=Math.min(sourceTime(c,0),Math.max(0,el.duration-.015));if(begin>.01){let seek=wait(el,'seeked');el.currentTime=begin;await seek}}players.push({c,a,el,gain,started:false})}
 stream=cv.captureStream(fps);for(let t of dest.stream.getAudioTracks())stream.addTrack(t);rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:h>=2160?22000000:h>=1080?8000000:h>=720?4000000:2000000});rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};let finished=new Promise((resolve,reject)=>{rec.onstop=resolve;rec.onerror=()=>reject(Error('Recording failed'))});
 const clamp=x=>Math.max(0,Math.min(1,x));
 function frame(t){g.fillStyle='#000';g.fillRect(0,0,w,H);let active=[];for(let p of players){let {c,a,el,gain}=p,local=t-c.start,on=local>=0&&local<dur(c);if(gain){gain.output.gain.value=on?audioLevel(c,local):0;configureAudio(gain,c);if(on)followMedia(el,c,local,true);else el.pause()}if(on&&!trackOf(c)?.hidden&&a.type!=='audio')active.push(p)}
 active.sort((a,b)=>{if(a.a.type==='title')return b.a.type==='title'?0:1;if(b.a.type==='title')return -1;return tracks.findIndex(x=>x.id===b.c.trackId)-tracks.findIndex(x=>x.id===a.c.trackId)});
 for(let {c,a,el} of active){let local=t-c.start,v=motionValue(c,keyTime(c,local)),f=clamp(Math.min(local,dur(c)-local)/(c.motionDuration||.5)),effect=c.motionEffect;g.save();g.globalAlpha=visualFade(c,local)*clamp(v.opacity/100)*(c.fade?clamp(Math.min(local,dur(c)-local)/c.fade):1)*(effect==='fade'?f:1);g.translate(w/2+(v.x+(effect==='slide'?(1-f)*100:0))*w/100,H/2+v.y*H/100);g.rotate(v.rotation*Math.PI/180);let scale=v.scale/100*(effect==='zoom'?.5+.5*f:1);g.scale(scale,scale);if(effect==='wipe'){g.beginPath();g.rect(-w/2,-H/2,w*f,H);g.clip()}if(a.type==='title'){g.fillStyle=c.color||'#fff';g.font=`bold ${(c.font||48)*H/390}px system-ui`;g.textBaseline='middle';g.textAlign=c.align||'center';g.fillText(captionText(c,t),c.align==='left'?-w*.45:c.align==='right'?w*.45:0,0,w*.9)}else{let sw=el.videoWidth||el.naturalWidth,sh=el.videoHeight||el.naturalHeight;if(sw&&sh){let s=Math.min(w/sw,H/sh);g.filter=visualFilter(c);drawPro(g,el,c,sw*s,sh*s)}}g.restore()}}
 frame(0);rec.start(250);let start=performance.now();await new Promise((resolve,reject)=>{function step(now){try{let t=(now-start)/1000;if(cancelExport||t>=length){resolve();return}frame(t);$('renderProgress').value=t/length*100;status.textContent=`Rendering ${fmt(t)} / ${fmt(length)} — ${mime.includes('mp4')?'MP4':'WebM'}`;requestAnimationFrame(step)}catch(e){reject(e)}}requestAnimationFrame(step)});rec.stop();await finished;if(cancelExport){status.textContent='Export cancelled.';return}let actual=rec.mimeType||mime;const transcode=!!window.JosterAndroid&&$('renderFormat').value==='mp4';
 const saved=await downloadBlob(new Blob(chunks,{type:actual}),'joster-video.'+(actual.includes('mp4')||transcode?'mp4':'webm'),transcode);
 $('renderProgress').value=100;
 status.textContent=saved?(transcode?'Converting to MP4…':window.JosterAndroid?'Choose where to save the file.':'Export complete. Check your downloads.'):'Export could not be saved.';
 }catch(e){status.textContent=e.message||'Export failed.'}finally{if(rec&&rec.state!=='inactive')rec.stop();for(let p of players)if(p.gain){p.el.pause();p.el.removeAttribute('src');p.el.load()}if(stream)stream.getTracks().forEach(t=>t.stop());if(ctx)await ctx.close().catch(()=>{});exporting=false;$('startRender').disabled=false}
};


function captionText(c,t){let text=c.text??'New title';return c.typing?Array.from(text).slice(0,Math.floor(Math.max(0,t-c.start)*c.typing)).join(''):text}
const creator=document.createElement('section');creator.className='panel';creator.innerHTML=`<div class="panel-head">Creator Studio</div><div class="panel-body" style="display:flex;gap:8px;flex-wrap:wrap"><button id="captionAdd">Add caption</button><button id="typingToggle">Toggle live typing</button><button id="srtIn">Import SRT</button><button id="srtOut">Export SRT</button><button id="voiceRecord">Record voiceover</button><button id="thumbOpen">Thumbnail studio</button><button id="introAdd">Add intro title</button><button id="outroAdd">Add outro title</button><input type="file" id="srtFile" accept=".srt" hidden><span id="creatorStatus" class="hint"></span></div>`;document.querySelector('.timeline-panel').after(creator);
function addCaption(text,start,length,typing=0){let tr=tracks.find(t=>t.type==='title');if(!tr){tr={id:uid(),name:'TITLES',type:'title'};tracks.unshift(tr)}let a={id:uid(),name:'Caption',type:'title',size:0,duration:0};assets.push(a);let c={id:uid(),assetId:a.id,trackId:tr.id,start,in:0,out:length,text,font:32,color:'#ffffff',typing,keys:[{t:0,x:0,y:32,scale:100,rotation:0,opacity:100}]};clips.push(c);selectedClip=c.id;return c}
$('captionAdd').onclick=()=>{let text=prompt('Caption text');if(!text)return;snapshot();addCaption(text,playhead,Math.max(2,text.length/15),15);renderAll()};
$('typingToggle').onclick=()=>{let c=clipById(selectedClip);if(locked(c)||assetById(c?.assetId)?.type!=='title'){toast('Select a title or caption');return}snapshot();c.typing=c.typing?0:15;updatePlayhead();toast(c.typing?'Live typing enabled':'Live typing disabled')};
function parseStamp(s){let m=s.match(/(\d+):(\d+):(\d+)[,.](\d{3})/);return m?+m[1]*3600+ +m[2]*60+ +m[3]+ +m[4]/1000:NaN}
function stamp(t){let ms=Math.round(t*1000);return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(n=>String(n).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0')}
$('srtIn').onclick=()=>$('srtFile').click();$('srtFile').onchange=async e=>{let f=e.target.files[0];if(!f)return;let blocks=(await f.text()).replace(/\r/g,'').trim().split(/\n\s*\n/),items=[];for(let b of blocks){let lines=b.split('\n'),i=lines.findIndex(l=>l.includes('-->'));if(i<0)continue;let [a,z]=lines[i].split('-->').map(parseStamp);if(Number.isFinite(a)&&z>a)items.push([lines.slice(i+1).join(' '),a,z-a])}if(!items.length){toast('No valid subtitles');return}snapshot();items.forEach(x=>addCaption(...x));renderAll();toast(items.length+' captions imported');e.target.value=''};
$('srtOut').onclick=()=>{let list=clips.filter(c=>!trackOf(c)?.hidden&&assetById(c.assetId)?.type==='title').sort((a,b)=>a.start-b.start);downloadBlob(new Blob([list.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.start+dur(c))}\n${c.text||''}\n`).join('\n')],{type:'text/plain'}),'captions.srt')};
for(let [id,txt] of [['introAdd','Welcome to my channel'],['outroAdd','Thanks for watching!']])$(id).onclick=()=>{snapshot();let c=addCaption(txt,id==='introAdd'?0:totalDuration(),4);c.font=48;c.keys=[];c.motionEffect='fade';renderAll()};
let micRec,micStream;$('voiceRecord').onclick=async()=>{if(micRec?.state==='recording'){micRec.stop();return}try{micStream=await navigator.mediaDevices.getUserMedia({audio:true});let start=playhead,parts=[],beg=performance.now();micRec=new MediaRecorder(micStream);micRec.ondataavailable=e=>parts.push(e.data);micRec.onstop=()=>{let duration=(performance.now()-beg)/1000;micStream.getTracks().forEach(t=>t.stop());let type=micRec.mimeType||'audio/webm',f=new File(parts,'Voiceover-'+Date.now()+'.'+(type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'webm'),{type});importFiles([f]);let a=assets.at(-1);a.duration=duration;playhead=start;let tr=tracks.find(t=>t.type==='audio'&&!t.locked);if(!tr){addTrack('audio');tr=tracks.at(-1)}addClip(a.id,tr.id);$('voiceRecord').textContent='Record voiceover'};micRec.start();$('voiceRecord').textContent='Stop recording'}catch(e){micStream?.getTracks().forEach(t=>t.stop());toast('Microphone unavailable. Use HTTPS and allow access.')}};
const td=document.createElement('dialog');td.style.cssText='background:#191e28;color:white;border:1px solid #465164;border-radius:12px;max-width:95vw;width:680px';td.innerHTML=`<h2>Thumbnail Studio</h2><canvas id="thumbCanvas" width="1280" height="720" style="width:100%;background:#111"></canvas><div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0"><input id="thumbText" value="YOUR VIDEO TITLE" style="max-width:100%"><input id="thumbColor" type="color" value="#ffffff" aria-label="Thumbnail text color"><label>Title size <input id="thumbSize" type="range" min="42" max="112" value="88"></label><label>Bottom shade <input id="thumbShade" type="range" min="0" max="100" value="80"></label><select id="thumbStyle"><option value="dark">Dark gradient</option><option value="pop">Bold pop</option><option value="clean">Clean</option></select><input id="thumbImage" type="file" accept="image/*"><button id="thumbFrame">Use current frame</button><button id="thumbSave">Save PNG</button><button id="thumbClose">Close</button></div>`;document.body.append(td);let bg=null;function drawThumb(){let cv=$('thumbCanvas'),g=cv.getContext('2d'),style=$('thumbStyle').value;g.fillStyle=style==='pop'?'#5933c9':style==='clean'?'#36546b':'#101522';g.fillRect(0,0,1280,720);if(bg){let w=bg.videoWidth||bg.naturalWidth||bg.width,h=bg.videoHeight||bg.naturalHeight||bg.height;if(w&&h){let scale=Math.max(1280/w,720/h);g.drawImage(bg,(1280-w*scale)/2,(720-h*scale)/2,w*scale,h*scale)}}let gr=g.createLinearGradient(0,0,0,720);gr.addColorStop(0,'#0000');gr.addColorStop(1,'rgba(0,0,0,'+($('thumbShade').value/100)+')');g.fillStyle=gr;g.fillRect(0,0,1280,720);g.font='900 '+$('thumbSize').value+'px system-ui';g.textAlign='center';g.lineJoin='round';g.lineWidth=12;g.strokeStyle='#111';g.fillStyle=$('thumbColor').value;let words=$('thumbText').value.split(/\s+/),lines=[''];for(let word of words){let i=lines.length-1;if(g.measureText(lines[i]+' '+word).width>1120&&lines[i])lines.push(word);else lines[i]+=(lines[i]?' ':'')+word}lines=lines.slice(0,5);lines.forEach((l,i)=>{let y=650-(lines.length-1-i)*100;g.strokeText(l,640,y,1120);g.fillText(l,640,y,1120)})}
$('thumbOpen').onclick=()=>{stopPlayback();td.showModal();drawThumb()};$('thumbClose').onclick=()=>td.close();for(let id of ['thumbText','thumbColor','thumbStyle','thumbSize','thumbShade'])$(id).oninput=drawThumb;$('thumbImage').onchange=e=>{let f=e.target.files[0];if(!f)return;let im=new Image(),u=URL.createObjectURL(f);im.onload=()=>{bg=im;drawThumb();URL.revokeObjectURL(u)};im.src=u};$('thumbFrame').onclick=()=>{
 if(getComputedStyle($('layerPreview')).visibility==='hidden'){toast('Move the playhead onto a clip');return}
 const frame=$('layerPreview'),copy=document.createElement('canvas');
 copy.width=frame.width;copy.height=frame.height;copy.getContext('2d').drawImage(frame,0,0);
 bg=copy;drawThumb();
};$('thumbSave').onclick=()=>$('thumbCanvas').toBlob(b=>downloadBlob(b,'joster-thumbnail.png'),'image/png');


function keyedSource(el,c){if(!c.chroma)return el;let w=el.videoWidth||el.naturalWidth,h=el.videoHeight||el.naturalHeight;if(!w||!h)return el;let cv=keyedSource.cv||(keyedSource.cv=document.createElement('canvas'));let scale=Math.min(1,960/w);const width=Math.max(1,Math.round(w*scale)),height=Math.max(1,Math.round(h*scale));if(cv.width!==width)cv.width=width;if(cv.height!==height)cv.height=height;let g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(el,0,0,cv.width,cv.height);let im=g.getImageData(0,0,cv.width,cv.height),d=im.data;let threshold=c.chromaThreshold??45;for(let i=0;i<d.length;i+=4){let excess=d[i+1]-Math.max(d[i],d[i+2]);if(excess>threshold){const strength=Math.min(1,(excess-threshold)/(c.chromaSoftness||30));d[i+3]*=1-strength;d[i+1]-=excess*strength}}g.putImageData(im,0,0);return cv}
function animationInspector(){let root=$('animationFields');if(!root)return;root.replaceChildren();let c=clipById(selectedClip),a=assetById(c?.assetId);if(!c||!['video','image'].includes(a?.type)){root.textContent='Select an image or video clip.';return}let label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=!!c.chroma;check.disabled=locked(c);check.onchange=()=>{snapshot();c.chroma=check.checked;animationPreview()};label.append(check,' Remove green screen');root.append(label);let l=document.createElement('label'),r=document.createElement('input');r.type='range';r.min=0;r.max=150;r.value=c.chromaThreshold??45;r.disabled=locked(c);r.onchange=()=>{snapshot();c.chromaThreshold=+r.value;animationPreview()};l.append(' Green threshold ',r);root.append(l)}
function animationPreview(){let cv=$('layerPreview');if(!cv)return;let g=cv.getContext('2d');const programVisible=!sourceMode&&clips.some(c=>playhead>=c.start&&playhead<c.start+dur(c));cv.style.visibility=programVisible?'visible':'hidden';$('titleOverlay').style.visibility='hidden';g.fillStyle='#000';g.fillRect(0,0,cv.width,cv.height);let w=cv.width,h=cv.height;let active=sourceMode?[]:clips.filter(c=>!trackOf(c)?.hidden&&playhead>=c.start&&playhead<c.start+dur(c)&&['image','video','title'].includes(assetById(c.assetId)?.type)).sort((a,b)=>tracks.findIndex(x=>x.id===b.trackId)-tracks.findIndex(x=>x.id===a.trackId));let cache=animationPreview.cache||(animationPreview.cache=new Map());for(let c of active){let a=assetById(c.assetId),local=playhead-c.start,v=motionValue(c,keyTime(c,local)),f=Math.max(0,Math.min(1,Math.min(local,dur(c)-local)/(c.motionDuration||.5)));g.save();g.globalAlpha=visualFade(c,local)*Math.max(0,Math.min(1,v.opacity/100))*(c.motionEffect==='fade'?f:1)*(c.fade?Math.max(0,Math.min(1,Math.min(local,dur(c)-local)/c.fade)):1);g.translate(w/2+(v.x+(c.motionEffect==='slide'?(1-f)*100:0))*w/100,h/2+v.y*h/100);g.rotate(v.rotation*Math.PI/180);let z=v.scale/100*(c.motionEffect==='zoom'?.5+.5*f:1);g.scale(z,z);if(c.motionEffect==='wipe'){g.beginPath();g.rect(-w/2,-h/2,w*f,h);g.clip()}if(a.type==='title'){g.fillStyle=c.color||'#fff';g.font=`bold ${(c.font||48)*h/390}px system-ui`;g.textAlign=c.align||'center';g.textBaseline='middle';g.fillText(captionText(c,playhead),c.align==='left'?-w*.45:c.align==='right'?w*.45:0,0,w*.9)}else if(a.url){let el=cache.get(c.id);if(!el||el.src!==a.url){el=document.createElement(a.type==='video'?'video':'img');el.muted=true;el.playsInline=true;el.src=a.url;el.onloadeddata=el.onload=()=>animationPreview();el.onseeked=()=>{if(!playing)animationPreview()};cache.set(c.id,el)}if(a.type==='video'&&el.readyState>=2){followMedia(el,c,local,playing)}let sw=el.videoWidth||el.naturalWidth,sh=el.videoHeight||el.naturalHeight;if(sw&&sh){let k=Math.min(w/sw,h/sh);g.filter=visualFilter(c);drawPro(g,el,c,sw*k,sh*k)}}g.restore()}for(let [id,el] of cache)if(!active.some(c=>c.id===id)){if(el.tagName==='VIDEO'){el.pause();el.removeAttribute('src');el.load()}cache.delete(id)}}
const anim=document.createElement('section');anim.className='panel';anim.innerHTML=`<div class="panel-head">Animation Studio</div><div class="panel-body"><canvas id="layerPreview" width="640" height="360" style="background:#000;display:block;margin:auto"></canvas><p class="hint">Layer preview · higher timeline tracks appear in front. Select a clip for animation presets.</p><div id="animationFields" style="display:flex;gap:12px;flex-wrap:wrap"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button id="animLayer">Add artwork layer</button><button id="animPip">Picture in picture</button><button id="animPan">Pan right</button><button id="animZoom">Slow zoom</button><button id="animBounce">Character bounce</button><button id="animReset">Reset motion</button></div></div>`;creator.after(anim);
$('animLayer').onclick=()=>{snapshot();tracks.unshift({id:uid(),name:'ARTWORK '+(tracks.length+1),type:'image'});renderAll()};
for(let [id,preset] of [['animPip','pip'],['animPan','pan'],['animZoom','zoom'],['animBounce','bounce'],['animReset','reset']])$(id).onclick=()=>{let c=clipById(selectedClip);if(!c||locked(c)||assetById(c.assetId)?.type==='audio'){toast('Select a visual clip');return}snapshot();let k=(t,x=0,y=0,scale=100)=>({t,x,y,scale,rotation:0,opacity:100});c.keys=preset==='pip'?[k(c.in,30,28,35)]:preset==='pan'?[k(c.in,-15,0,125),k(c.out,15,0,125)]:preset==='zoom'?[k(c.in),k(c.out,0,0,135)]:preset==='bounce'?[k(c.in),k(keyTime(c,dur(c)*.25),0,-12),k(keyTime(c,dur(c)*.5)),k(keyTime(c,dur(c)*.75),0,-12),k(c.out)]:[];renderAll()};
$('previewWrap').append($('layerPreview'));
animationInspector();animationPreview();


function trackOf(c){return tracks.find(t=>t.id===c?.trackId)}
function locked(c){return !!trackOf(c)?.locked}
function mix(c){let tr=trackOf(c);return tr?.muted?0:Math.max(0,Math.min(1,(tr?.gain??100)/100))}
function snapTime(t,c){t=Math.max(0,t);if(!$('proSnap')?.checked)return Math.round(t*10)/10;let points=[0,playhead,...clips.filter(x=>x.id!==c.id).flatMap(x=>[x.start,x.start+dur(x)])];let best=points.reduce((a,b)=>Math.abs(b-t)<Math.abs(a-t)?b:a,points[0]);return Math.abs(best-t)<12/zoom?best:Math.round(t*10)/10}
function drawPro(g,el,c,w,h){let src=keyedSource(el,c),sw=src.videoWidth||src.naturalWidth||src.width,sh=src.videoHeight||src.naturalHeight||src.height;let x=(c.cropX??0)/100,y=(c.cropY??0)/100;g.drawImage(src,sw*x,sh*y,sw*(1-2*x),sh*(1-2*y),-w/2,-h/2,w,h)}
function proInspector(){let root=$('proFields');if(!root)return;root.replaceChildren();let c=clipById(selectedClip);if(c){for(let [key,label,min,max] of [['hue','Hue rotation',-180,180],['sepia','Warm / sepia',0,100],['cropX','Horizontal crop %',0,45],['cropY','Vertical crop %',0,45]]){let l=document.createElement('label');l.className='field';l.textContent=label;let i=document.createElement('input');i.type='range';i.min=min;i.max=max;i.value=c[key]??0;i.disabled=locked(c);i.onchange=()=>{snapshot();c[key]=+i.value;updatePlayhead()};l.append(i);root.append(l)}}let mixer=$('proMixer');mixer.replaceChildren();for(let tr of tracks){let l=document.createElement('label');l.className='field';l.textContent=tr.name+' · '+(tr.muted?'Muted':'Gain');let i=document.createElement('input');i.type='range';i.min=0;i.max=100;i.value=tr.gain??100;i.onchange=()=>{snapshot();tr.gain=+i.value;updatePlayhead()};l.append(i);mixer.append(l)}}
const pro=document.createElement('section');pro.className='panel';pro.innerHTML=`<div class="panel-head">Professional Studio</div><div class="panel-body"><label><input type="checkbox" id="proSnap" checked> Snap clips to playhead and clip edges</label><h4>Color & crop (layer preview and export)</h4><div id="proFields" class="inspector-grid"></div><h4>Track audio mixer</h4><div id="proMixer" class="inspector-grid"></div><p class="hint">Track buttons: L locks direct timeline edits, H hides visuals, M mutes sound. Crop is symmetrical.</p></div>`;document.querySelector('.main').append(pro);proInspector();


const mobileBar=document.createElement('nav');mobileBar.className='mobilebar';mobileBar.innerHTML=`<button id="mobileFocus" aria-pressed="false">Focus workspace</button><button id="mobileTimeline" aria-pressed="false">Timeline first</button><button id="mobileFull">Fullscreen preview</button><label>Preview <select id="mobileRatio"><option value="landscape">16:9</option><option value="portrait">9:16</option><option value="square">1:1</option></select></label><label><input type="checkbox" id="mobileEco"> Low-power layer preview</label>`;document.querySelector('.topbar').after(mobileBar);
const app=document.querySelector('.app');for(const [id,cls] of [['mobileFocus','wide-preview'],['mobileTimeline','timeline-first']])$(id).onclick=()=>{$(id).setAttribute('aria-pressed',String(app.classList.toggle(cls)))};
$('mobileFull').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('previewWrap').requestFullscreen)await $('previewWrap').requestFullscreen();else toast('Fullscreen unavailable in this browser')}catch(e){toast('Fullscreen unavailable')}};
$('mobileRatio').onchange=()=>{let v=$('mobileRatio').value;$('previewWrap').classList.toggle('portrait',v==='portrait');$('previewWrap').classList.toggle('square',v==='square');$('renderRatio').value=v};
$('mobileEco').onchange=()=>{let cv=$('layerPreview');cv.width=$('mobileEco').checked?320:640;cv.height=$('mobileEco').checked?180:360;animationPreview()};
for(const panel of document.querySelectorAll('.panel')){let head=panel.querySelector(':scope > .panel-head');if(!head||!panel.querySelector(':scope > .panel-body'))continue;let b=document.createElement('button');b.className='mobile-collapse';b.textContent='Collapse';b.setAttribute('aria-expanded','true');b.onclick=()=>{let closed=panel.classList.toggle('mobile-collapsed');b.textContent=closed?'Expand':'Collapse';b.setAttribute('aria-expanded',String(!closed))};head.append(b)}
const nav=document.createElement('div');nav.className='timeline-nav';nav.innerHTML=`<button id="navBack">−5 sec</button><button id="navForward">+5 sec</button><button id="navFollow">Find playhead</button><input id="navSeek" type="range" min="0" max="1" step="0.01" value="0" aria-label="Timeline position">`;document.querySelector('.timeline-toolbar').after(nav);
function mobileSeek(t){stopPlayback();playhead=Math.max(0,Math.min(totalDuration(),t));updatePlayhead();previewAt(playhead);animationPreview();$('navSeek').value=playhead}
$('navBack').onclick=()=>mobileSeek(playhead-5);$('navForward').onclick=()=>mobileSeek(playhead+5);$('navSeek').oninput=e=>mobileSeek(+e.target.value);$('navFollow').onclick=()=>{$('timelineScroll').scrollLeft=Math.max(0,94+playhead*zoom-$('timelineScroll').clientWidth/2)};
let oldUpdate=updatePlayhead;updatePlayhead=function(){oldUpdate();$('navSeek').max=Math.max(.01,totalDuration());$('navSeek').value=playhead};
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,button,[contenteditable]'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();mobileSeek(playhead+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?5:1))}});updatePlayhead();


const recovery=document.createElement('section');recovery.className='panel';recovery.innerHTML=`<div class="panel-head">Project Recovery</div><div class="panel-body"><label class="field">Project name<input id="projectName"></label><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button id="recoverSave">Save media & project</button><button id="storageProtect">Request persistent storage</button><button id="restoreMedia">Restore saved media</button></div><p class="hint" id="recoveryStatus">Checking browser storage…</p></div>`;document.querySelector('.sidebar').append(recovery);
$('projectName').value=currentProject;$('projectName').onchange=()=>{currentProject=$('projectName').value.trim()||'Untitled Project';persistProject(false)};
var dbPromise,lastSaved,saveTimer,restored,saveQueue;
const savedFiles=new Map();
function mediaDB(){
 return dbPromise||(dbPromise=new Promise((resolve,reject)=>{
  const request=indexedDB.open('joster-media-v09',2);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains('media'))db.createObjectStore('media');
   if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects');
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 }));
}
function dbGet(db,store,id){
 return new Promise((ok,no)=>{
  const r=db.transaction(store).objectStore(store).get(id);
  r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
 });
}
function scheduleSave(){
 if(!restored)return;
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>persistProject(false),650);
}
function persistProject(manual,slot='autosave'){
 if(!restored)return Promise.resolve(false);
 const data=serialize(),media=assets.filter(a=>a.file).map(a=>[a.id,a.file]);
 const signature=JSON.stringify({...data,savedAt:null});
 async function commit(){
  if(!manual&&slot==='autosave'&&signature===lastSaved)return true;
  try{
   const db=await mediaDB();
   await new Promise((ok,no)=>{
    const tx=db.transaction(['media','projects'],'readwrite');
    tx.oncomplete=ok;tx.onabort=()=>no(tx.error||Error('Save aborted'));
    const store=tx.objectStore('media');
    for(const [id,file] of media)if(savedFiles.get(id)!==file)store.put(file,id);
    tx.objectStore('projects').put(data,slot);
   });
   for(const [id,file] of media)savedFiles.set(id,file);
   if(slot==='autosave')lastSaved=signature;
   $('saveStatus').textContent='Saved locally';
   $('recoveryStatus').textContent='Saved project and available media · '+new Date().toLocaleTimeString();
   if(manual&&slot==='autosave')toast('Project and media saved locally');
   return true;
  }catch(e){
   $('recoveryStatus').textContent='Storage failed: '+e.message;
   if(manual)toast('Local save failed');
   return false;
  }
 }
 saveQueue=(saveQueue||Promise.resolve()).then(commit,commit);
 return saveQueue;
}
function replaceMedia(next){
 const kept=new Set(next.map(a=>a.url));
 for(const a of assets)if(a.url&&!kept.has(a.url))URL.revokeObjectURL(a.url);
 for(const el of audioPlayers.values())releaseAudio(el);
 audioPlayers.clear();
 for(const el of animationPreview.cache?.values()||[])if(el.tagName==='VIDEO')el.pause();
 animationPreview.cache?.clear();
 assets=next;
}
async function recoverMedia(initial=false){
 try{
  const db=await mediaDB();
  if(initial){
   const data=await dbGet(db,'projects','autosave');
   if(data)applyProject(data);
  }
  const current=assets;
  const files=await Promise.all(current.map(a=>a.url||a.type==='title'?null:dbGet(db,'media',a.id)));
  if(current!==assets)return;
  files.forEach((file,i)=>{if(file&&!current[i].url){savedFiles.set(current[i].id,file);Object.assign(current[i],{file,url:URL.createObjectURL(file)})}});
  renderAll();
  $('recoveryStatus').textContent=current.filter(a=>a.url).length+' media available · '+current.filter(a=>a.type!=='title'&&!a.url).length+' missing';
 }catch(e){$('recoveryStatus').textContent='Local media storage unavailable: '+e.message}
}
function applyProject(data){
 if(data?.format!=='joster-studio-project'||!Array.isArray(data.tracks)||!Array.isArray(data.clips)||!Array.isArray(data.assets))throw Error('Invalid project file');
 stopPlayback();
 replaceMedia(data.assets.map(a=>{
  const existing=assets.find(x=>x.id===a.id&&x.url);
  return existing?{...a,file:existing.file,url:existing.url}:{...a};
 }));
 tracks=data.tracks;clips=data.clips;currentProject=data.name||'Imported Project';
 selectedClip=null;selectedAsset=null;playhead=0;history=[];future=[];lastSaved='';
 $('projectName').value=currentProject;
}
$('recoverSave').onclick=()=>persistProject(true);$('restoreMedia').onclick=()=>recoverMedia();
$('storageProtect').onclick=async()=>{
 try{toast(await navigator.storage.persist()?'Persistent storage granted':'Persistent storage unavailable; keep backups')}
 catch(e){toast('Persistent storage unavailable')}
};
$('newProjectBtn').addEventListener('click',()=>{$('projectName').value=currentProject});
document.addEventListener('visibilitychange',()=>{if(document.hidden)persistProject(false)});
if(isSecureContext&&['http:','https:'].includes(location.protocol)){
 if('serviceWorker' in navigator&&!window.JosterAndroid)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

const premiere=document.createElement('section');premiere.className='panel';premiere.innerHTML=`<div class="panel-head">Project Dashboard</div><div class="panel-body"><label class="field">Saved projects<select id="premiereProjects"></select></label><div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0"><button id="premiereSave">Save as project</button><button id="premiereOpen">Open saved project</button><button id="premiereNew">New blank project</button></div><h4>Channel branding</h4><label class="field">Channel name<input id="brandName" placeholder="Your channel"></label><label class="field">Title color<input type="color" id="brandColor" value="#ffffff"></label><label class="field">Watermark position<select id="brandCorner"><option value="right">Bottom right</option><option value="left">Bottom left</option></select></label><button id="brandSave">Save branding</button> <button id="brandInsert">Insert branded title</button> <button id="brandWatermark">Insert watermark</button><h4>Sound effects</h4><select id="soundKind"><option value="pop">Pop</option><option value="chime">Chime</option><option value="whoosh">Whoosh</option></select> <button id="soundAdd">Add sound at playhead</button><details><summary>Quick start tutorial</summary><p>Import media, select an asset and add it to the timeline. Select a clip to trim or animate it. Save your project in the dashboard, then use Export Video to render. Keep original media backups.</p></details><p class="hint" id="premiereStatus"></p></div>`;document.querySelector('.sidebar').append(premiere);
function projectList(){try{return JSON.parse(localStorage.getItem('joster-project-library')||'[]')}catch(e){return []}}
function refreshProjects(){let el=$('premiereProjects');el.replaceChildren();for(let p of projectList())el.add(new Option(p.name,p.id));}
$('premiereSave').onclick=async()=>{
 if(!restored)return;
 try{
  const data=serialize(),list=projectList(),old=list.find(x=>x.name===data.name);
  const id=old?.id||uid();
  if(!await persistProject(true,'project:'+id))return;
  localStorage.setItem('joster-project-library',JSON.stringify([...list.filter(x=>x.id!==id),{id,name:data.name}]));
  refreshProjects();$('premiereProjects').value=id;toast('Project snapshot saved');
 }catch(e){toast('Project library storage failed')}
};
async function loadPremiere(data){
 const saved=await dbGet(await mediaDB(),'projects','project:'+data.id);
 applyProject(saved||data);await recoverMedia();await persistProject(false);
}
$('premiereOpen').onclick=async()=>{let p=projectList().find(x=>x.id===$('premiereProjects').value);if(p&&restored&&confirm('Open saved project? Save current edits first.')){try{await loadPremiere(p)}catch(e){toast('Could not open saved project')}}};
$('premiereNew').onclick=async()=>{if(saving||!confirm('Start blank project? Save current edits first.'))return;await loadPremiere({name:'Untitled Project',assets:[],clips:[],tracks:[{id:'v1',name:'VIDEO 1',type:'video'},{id:'a1',name:'AUDIO 1',type:'audio'}]})};
try{let b=JSON.parse(localStorage.getItem('joster-brand')||'{}');$('brandName').value=b.name||'';$('brandColor').value=b.color||'#ffffff';$('brandCorner').value=b.corner||'right'}catch(e){}
$('brandSave').onclick=()=>{try{localStorage.setItem('joster-brand',JSON.stringify({name:$('brandName').value,color:$('brandColor').value,corner:$('brandCorner').value}));toast('Branding saved')}catch(e){toast('Unable to save branding')}};
$('brandInsert').onclick=()=>{snapshot();let c=addCaption($('brandName').value||'Joster Studio',playhead,4);c.color=$('brandColor').value;c.font=48;renderAll()};
$('brandWatermark').onclick=()=>{
 snapshot();
 const c=addCaption($('brandName').value||'Joster Studio',playhead,Math.max(2,totalDuration()-playhead));
 c.color=$('brandColor').value;c.font=25;
 c.align=$('brandCorner').value;
 c.keys=[{t:0,x:0,y:42,scale:100,rotation:0,opacity:75}];
 renderAll();
};
$('soundAdd').onclick=()=>{let kind=$('soundKind').value,sr=22050,n=Math.floor(sr*.65),buf=new ArrayBuffer(44+n*2),v=new DataView(buf);let str=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};str(0,'RIFF');v.setUint32(4,36+n*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2,true);for(let i=0;i<n;i++){let t=i/sr,e=Math.min(1,t*100)*Math.exp(-t*(kind==='pop'?18:6)),x=kind==='whoosh'?(Math.random()*2-1)*Math.sin(Math.PI*i/n):Math.sin(2*Math.PI*(kind==='pop'?220*t+400*t*t:660*t))+ .3*Math.sin(2*Math.PI*990*t);v.setInt16(44+i*2,Math.max(-32767,Math.min(32767,x*e*14000)),true)}let f=new File([buf],kind+'.wav',{type:'audio/wav'});importFiles([f]);let a=assets.at(-1);a.duration=n/sr;let tr=tracks.find(t=>t.type==='audio');if(!tr){addTrack('audio');tr=tracks.at(-1)}addClip(a.id,tr.id)};
refreshProjects();

var previewContext;
async function loadNoiseGate(ctx){
 if(!ctx.audioWorklet)return false;
 try{await ctx.audioWorklet.addModule('./noise-gate.js');ctx.josterGate=true;return true}
 catch(e){return false}
}
function makeAudioChain(ctx,source,destination){
 const rumble=ctx.createBiquadFilter(),low=ctx.createBiquadFilter(),mid=ctx.createBiquadFilter(),high=ctx.createBiquadFilter();
 rumble.type='highpass';rumble.Q.value=.707;
 low.type='lowshelf';low.frequency.value=180;
 mid.type='peaking';mid.frequency.value=1400;mid.Q.value=.8;
 high.type='highshelf';high.frequency.value=4200;
 const pan=ctx.createStereoPanner(),output=ctx.createGain();
 const gate=ctx.josterGate?new AudioWorkletNode(ctx,'joster-noise-gate',{outputChannelCount:[2]}):null;
 source.connect(rumble).connect(low).connect(mid).connect(high).connect(pan);
 if(gate)pan.connect(gate).connect(output);
 else pan.connect(output);
 output.connect(destination);
 return {source,rumble,low,mid,high,pan,output,gate};
}
function configureAudio(chain,c){
 const tr=trackOf(c);
 chain.rumble.frequency.value=c.rumble?100:10;
 if(chain.gate)chain.gate.parameters.get('threshold').value=c.gate?(c.gateThreshold??-45):-90;
 chain.low.gain.value=c.eqLow||0;chain.mid.gain.value=c.eqMid||0;chain.high.gain.value=c.eqHigh||0;
 chain.pan.pan.value=Math.max(-1,Math.min(1,((c.pan||0)+(tr?.pan||0))/100));
}
function audioLevel(c,local){
 if(c.reverse||tracks.some(t=>t.solo)&&!trackOf(c)?.solo)return 0;
 const fades=c.fade?Math.min(1,local/c.fade,(dur(c)-local)/c.fade):1;
 return mix(c)*Math.max(0,Math.min(2,(c.volume??100)/100))*Math.max(0,fades);
}
function ensurePreviewAudio(){
 if(!window.AudioContext)return;
 if(!previewContext){
  previewContext=new AudioContext();
  loadNoiseGate(previewContext).then(ready=>{
   if(!ready)return;
   for(const el of audioPlayers.values())releaseAudio(el);
   audioPlayers.clear();
  });
 }
 previewContext.resume().catch(()=>{});
}
function releaseAudio(el){
 el.pause();for(const node of Object.values(el.audioChain||{}))node?.disconnect();
 el.removeAttribute('src');el.load();
}
function refreshPreviewAudio(){
 if(!playing||!previewContext)return;
 const active=new Set();
 for(const c of clips){
  const a=assetById(c.assetId),local=playhead-c.start;
  if(!a?.url||!['audio','video'].includes(a.type)||local<0||local>=dur(c)||c.reverse)continue;
  active.add(c.id);
  let el=audioPlayers.get(c.id);
  if(!el||el.src!==a.url){
   if(el)releaseAudio(el);
   el=new Audio(a.url);
   el.audioChain=makeAudioChain(previewContext,previewContext.createMediaElementSource(el),previewContext.destination);
   audioPlayers.set(c.id,el);
  }
  configureAudio(el.audioChain,c);
  el.audioChain.output.gain.value=audioLevel(c,local);
  followMedia(el,c,local,true);
 }
 for(const [id,el] of audioPlayers)if(!active.has(id)){
  releaseAudio(el);audioPlayers.delete(id);
 }
}
function compatibleTrack(c,tr){
 const type=assetById(c.assetId)?.type;
 return type===tr.type||['image','video'].includes(type)&&['image','video'].includes(tr.type);
}
function setField(target,key,value){
 snapshot();target[key]=value;renderAll();
}
function selectField(label,target,key,options,onchange){
 const field=document.createElement('label'),select=document.createElement('select');
 field.className='field';field.textContent=label;select.setAttribute('aria-label',label);
 for(const [value,text] of options)select.add(new Option(text,value));
 select.value=String(target[key]??options[0]?.[0]??"");
 select.disabled=target.trackId?locked(target):false;
 select.onchange=()=>onchange?onchange(select.value):setField(target,key,select.value);
 field.append(select);return field;
}
function numberField(label,target,key,min,max,step=1){
 const field=document.createElement('label'),input=document.createElement('input');
 field.className='field';field.textContent=label;input.type='number';input.min=min;input.max=max;input.step=step;
 input.value=target[key]??(key==='chromaSoftness'?30:key==='gateThreshold'?-45:0);input.disabled=target.trackId?locked(target):false;
 input.onchange=()=>setField(target,key,Math.max(min,Math.min(max,Number(input.value)||0)));
 field.append(input);return field;
}
function toggleField(label,target,key){
 const field=document.createElement('label'),input=document.createElement('input');
 input.type='checkbox';input.checked=!!target[key];input.disabled=target.trackId?locked(target):false;
 input.onchange=()=>setField(target,key,input.checked);field.append(input,' '+label);return field;
}
function renderProTools(){
 const root=$('proTools');
 if(!root)return;
 root.replaceChildren();
 const c=clipById(selectedClip),a=assetById(c?.assetId);
 if(c&&a){
  const destinations=tracks.filter(t=>compatibleTrack(c,t)&&(!t.locked||t.id===c.trackId));
  root.append(selectField('Track',c,'trackId',destinations.map(t=>[t.id,t.name])));
  if(['audio','video'].includes(a.type)){
   root.append(selectField('Speed',c,'rate',[1,.25,.5,.75,1.25,1.5,2,3,4].map(n=>[n,n+'×']),value=>setField(c,'rate',Number(value))));
   if(a.type==='video')root.append(toggleField('Reverse video (silent)',c,'reverse'));
   root.append(numberField('Bass (dB)',c,'eqLow',-18,18),numberField('Mid (dB)',c,'eqMid',-18,18),
    numberField('Treble (dB)',c,'eqHigh',-18,18),numberField('Stereo pan',c,'pan',-100,100),
    toggleField('Reduce low-frequency rumble',c,'rumble'));
   if(window.AudioWorkletNode)root.append(toggleField('Noise gate',c,'gate'),numberField('Gate threshold (dBFS)',c,'gateThreshold',-70,-15));
  }
  if(['video','image'].includes(a.type)){
   root.append(numberField('Chroma edge softness',c,'chromaSoftness',1,120));
   root.append(numberField('Crossfade in (sec)',c,'crossfade',0,Math.min(10,dur(c)),.1));
  }
  if(a.type==='title')root.append(numberField('Typing characters/sec',c,'typing',0,70));
 }
 const mixRoot=$('proTrackTools');mixRoot.replaceChildren();
 for(const t of tracks.filter(t=>t.type==='audio'||t.type==='video')){
  mixRoot.append(numberField(t.name+' pan',t,'pan',-100,100),toggleField(t.name+' solo',t,'solo'));
 }
}
const toolsPanel=document.createElement('section');
toolsPanel.className='panel';
toolsPanel.innerHTML='<div class="panel-head">Clip &amp; Mix Controls</div><div class="panel-body"><div class="inspector-grid" id="proTools"></div><div class="inspector-grid" id="proTrackTools"></div></div>';
pro.after(toolsPanel);
function visualFilter(c){
 const filters=[];
 if((c.brightness??100)!==100)filters.push(`brightness(${c.brightness}%)`);
 if((c.contrast??100)!==100)filters.push(`contrast(${c.contrast}%)`);
 if((c.saturation??100)!==100)filters.push(`saturate(${c.saturation}%)`);
 if(c.blur)filters.push(`blur(${c.blur}px)`);
 if(c.hue)filters.push(`hue-rotate(${c.hue}deg)`);
 if(c.sepia)filters.push(`sepia(${c.sepia}%)`);
 return filters.join(' ')||'none';
}
function visualFade(c,local){
 return c.crossfade?Math.max(0,Math.min(1,local/c.crossfade)):1;
}
function setPreviewRatio(){
 const v=$('mobileRatio').value,cv=$('layerPreview'),base=$('mobileEco').checked?360:720;
 $('previewWrap').classList.toggle('portrait',v==='portrait');$('previewWrap').classList.toggle('square',v==='square');
 cv.width=v==='portrait'?Math.round(base*9/16):base;
 cv.height=v==='landscape'?Math.round(base*9/16):base;
 $('renderRatio').value=v;
 animationPreview();
}
$('mobileRatio').onchange=$('mobileEco').onchange=setPreviewRatio;

const live=document.createElement('button');
live.textContent='Dictate captions';
const speech=window.SpeechRecognition||window.webkitSpeechRecognition;
live.hidden=!speech;
if(speech){
 let recognition;
 live.onclick=()=>{
  if(recognition){recognition.stop();return}
  if(!confirm('Start microphone dictation? Your browser may send speech to its recognition service.'))return;
  const start=playhead, clock=performance.now();
  let last=start;
  const engine=new speech();
  engine.continuous=true;engine.lang=navigator.language;
  engine.onresult=e=>{
   for(let i=e.resultIndex;i<e.results.length;i++){
    if(!e.results[i].isFinal)continue;
    const text=e.results[i][0].transcript.trim();
    if(!text)continue;
    const end=start+(performance.now()-clock)/1000;
    snapshot();addCaption(text,last,Math.max(1,end-last),0);last=end;
    renderAll();
   }
  };
  engine.onerror=e=>{$('creatorStatus').textContent='Dictation unavailable: '+e.error};
  engine.onend=()=>{recognition=null;live.textContent='Dictate captions'};
  try{engine.start();recognition=engine;live.textContent='Stop dictation'}
  catch(e){$('creatorStatus').textContent=e.message}
 };
}
$('captionAdd').after(live);

const backup=document.createElement('button');
backup.textContent='Back up with media';
backup.onclick=()=>{
 const data=serialize(),files=assets.filter(a=>a.file).map(a=>a.file);
 data.embedded=assets.filter(a=>a.file).map(a=>({id:a.id,size:a.file.size,type:a.file.type}));
 const header=new Blob([JSON.stringify(data)]);
 downloadBlob(new Blob(['JOSTER2\n',String(header.size).padStart(12,'0'),'\n',header,...files],{type:'application/octet-stream'}),'joster-project.joster');
};
$('exportProjectBtn').after(backup);
async function readProject(file){
 if(await file.slice(0,8).text()!=='JOSTER2\n')return {data:JSON.parse(await file.text()),media:new Map()};
 const end=21+Number(await file.slice(8,20).text());
 if(!Number.isSafeInteger(end)||end<=21||end>file.size||end>25*1024*1024)throw Error('Invalid backup');
 const data=JSON.parse(await file.slice(21,end).text()),media=new Map();
 let offset=end;
 for(const item of data.embedded){
  const asset=data.assets.find(a=>a.id===item.id);
  if(!asset||!Number.isSafeInteger(item.size)||item.size<0||offset+item.size>file.size)throw Error('Invalid backup media');
  media.set(item.id,new File([file.slice(offset,offset+item.size)],asset.name,{type:item.type}));
  offset+=item.size;
 }
 if(offset!==file.size)throw Error('Invalid backup length');
 return {data,media};
}
recoverMedia(true).finally(()=>{
 restored=true;
 scheduleSave();
});
renderProTools();
setPreviewRatio();


$('exportDialog').addEventListener('cancel',e=>{if(exporting){e.preventDefault();cancelExport=true}});
})();
