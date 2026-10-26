const lobby=document.querySelector('#lobby'), game=document.querySelector('#game'), nameEl=document.querySelector('#name'), codeEl=document.querySelector('#code');
const errorEl=document.querySelector('#error'), roomCode=document.querySelector('#roomCode'), statusEl=document.querySelector('#status'), scores=document.querySelector('#scores'), message=document.querySelector('#message'), countdown=document.querySelector('#countdown'), target=document.querySelector('#target'), start=document.querySelector('#start');
let ws, myId, currentRound, currentTarget;

function connect(initialMessage) {
  ws = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
  );

  ws.onopen = () => {
    if (initialMessage) {
      send(initialMessage);
    }
  };

  ws.onmessage = e => handle(JSON.parse(e.data));

  ws.onerror = () => {
    showError('Connection failed. Please refresh and try again.');
  };

  ws.onclose = () => {
    if (!game.classList.contains('hidden')) {
      message.textContent = 'Connection lost. Refresh to reconnect.';
      start.disabled = true;
    }
  };
}
function send(x){if(ws?.readyState===1)ws.send(JSON.stringify(x))}
function enter(){lobby.classList.add('hidden');game.classList.remove('hidden')}
function showError(x){errorEl.textContent=x}
function handle(d){
 if(d.type==='error') return showError(d.message);
 if(d.type==='joined'){myId=d.playerId;roomCode.textContent=d.code;enter();return}
 if(d.type==='state'){
   currentRound=d.round;currentTarget=d.target; renderPlayers(d.players);
   target.classList.add('hidden'); countdown.textContent='';
   if(d.phase==='countdown'){message.textContent='Get ready!'; countdown.textContent=d.countdown>0?d.countdown:'';}
   else if(d.phase==='playing'){message.textContent='';target.classList.remove('hidden');positionTarget()}
   else if(d.phase==='finished'){message.textContent=d.message||'Game over';start.textContent='Play Again'}
   else {message.textContent=d.message||'Waiting…'}
   start.disabled=d.players.length<2 || d.phase==='countdown' || d.phase==='playing';
   statusEl.textContent=d.phase==='playing'?'🔥 LIVE':d.players.length<2?'Waiting for player…':'Ready';
   if(d.winner){message.textContent=d.message;start.disabled=false}
 }
}
function renderPlayers(players){scores.innerHTML=players.map(p=>`<div class="player"><b>${escapeHtml(p.name)}${p.id===myId?' (You)':''}</b><div class="score">${p.score}</div></div>`).join('')}
function positionTarget(){const a=document.querySelector('.arena');const x=25+Math.random()*65,y=20+Math.random()*60;target.style.left=x+'%';target.style.top=y+'%'}
function escapeHtml(s){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
document.querySelector('#create').onclick=()=>{
  errorEl.textContent='';
  connect({type:'create',name:nameEl.value});
};

document.querySelector('#showJoin').onclick=()=>document.querySelector('#joinBox').classList.remove('hidden');
document.querySelector('#join').onclick=()=>{
  if(!codeEl.value.trim()) return showError('Enter a room code.');
  errorEl.textContent='';
  connect({type:'join',code:codeEl.value.trim(),name:nameEl.value});
};

start.onclick=()=>send({type:'start'});
target.onclick=()=>{target.classList.add('hidden');send({type:'hit',round:currentRound,target:currentTarget})};
document.querySelector('#back').onclick=()=>location.reload();
