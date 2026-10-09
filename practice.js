const $=s=>document.querySelector(s);
const esc=s=>String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const result=$("#result");
async function run(action){
 const question=$("#topic").value.trim();
 if(!question){result.textContent="Enter a topic or question first.";return}
 $("#ask").disabled=$("#quiz").disabled=true;result.textContent="Checking connected study notes…";
 try{
  const r=await fetch("/api/study-assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,subject:$("#subject").value,action})});
  const d=await r.json();if(!r.ok)throw new Error(d.error||"Study AI is unavailable.");
  if(action==="quiz"){
   result.innerHTML="<h2>"+esc(d.title||"Practice questions")+"</h2>"+(d.questions||[]).map((q,i)=>'<article class="doc-row" style="display:block;margin:12px 0"><strong>Q'+(i+1)+". "+esc(q.question)+"</strong>"+(q.options||[]).map((o,j)=>"<p>"+String.fromCharCode(65+j)+". "+esc(o)+"</p>").join("")+'<button data-answer="'+i+'">Reveal answer</button><div id="a'+i+'" hidden><p><b>Answer:</b> '+esc(q.answer)+'</p><p>'+esc(q.explanation)+'</p></div></article>').join("")||"No matching source text was found.";
  }else{
   result.innerHTML='<article style="text-align:left;white-space:pre-wrap;line-height:1.8;margin-top:20px">'+esc(d.answer||"No answer returned.")+'</article>'+(d.sources&&d.sources.length?'<p class="muted">Sources: '+d.sources.map(s=>esc(s.title+" ("+s.subject+")")).join(", ")+"</p>":"");
  }
 }catch(e){result.textContent=e.message||"Study AI is unavailable until its key and notes are configured."}
 finally{$("#ask").disabled=$("#quiz").disabled=false}
}
$("#ask").onclick=()=>run("answer");$("#quiz").onclick=()=>run("quiz");
document.addEventListener("click",e=>{const b=e.target.closest("[data-answer]");if(!b)return;const el=$("#a"+b.dataset.answer);el.hidden=!el.hidden;b.textContent=el.hidden?"Reveal answer":"Hide answer"});
