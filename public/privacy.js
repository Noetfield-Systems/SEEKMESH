document.getElementById('privacy-form')?.addEventListener('submit',async e=>{
  e.preventDefault();const el=document.getElementById('message');
  try{const r=await fetch('/api/privacy-request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value,requestType:document.getElementById('requestType').value})});const b=await r.json();el.textContent=r.ok?`Request ${b.requestId} recorded. Identity verification is required before action.`:b.error;}
  catch{el.textContent='Request could not be recorded.';}
});
