const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const reasons = {
  "91": {title:"Issuer unavailable",type:"Temporary technical failure",tone:"warning",action:"Check the original payment status first. If it is confirmed not completed, retry once after a short delay. If the issuer is still unavailable, use the secondary acquirer where supported or offer UPI / wallet.",steps:["Check status","Wait briefly","One retry / fallback"],route:"Eligible for controlled fallback only after the original attempt is confirmed not completed."},
  "TIMEOUT": {title:"Timeout — unknown outcome",type:"Unknown payment outcome",tone:"warning",action:"Do not assume the payment failed. Query the gateway or acquirer using the original transaction reference. Retry only after the provider confirms non-completion. If successful, update the order instead.",steps:["Query original reference","Verify final state","Update order"],route:"Never start a second payment while the first transaction is pending or unknown."},
  "51": {title:"Insufficient funds",type:"Account / funds decline",tone:"danger",action:"Do not auto-retry. A repeated request cannot create available funds. Ask the customer to choose another card, UPI or wallet while preserving the cart.",steps:["Stop auto-retry","Explain clearly","Offer another method"],route:"Not eligible for alternate-acquirer routing."},
  "05": {title:"Do not honour",type:"Unclear issuer decision",tone:"danger",action:"Do not loop retries. Show a neutral decline message, suggest another payment method or contacting the bank, and investigate any unusual increase in this response code.",steps:["Stop retry loop","Show neutral message","Monitor decline spikes"],route:"Do not automatically cascade this decline to another acquirer."},
  "N7": {title:"CVV mismatch",type:"Data quality issue",tone:"danger",action:"Ask the customer to carefully re-enter the card details and CVV. Do not repeat the same unchanged request. Never store CVV in logs or support screens.",steps:["Stop unchanged retry","Re-enter details","Tokenised checkout"],route:"Not eligible for alternate-acquirer routing."},
  "54": {title:"Expired card",type:"Invalid / outdated card",tone:"danger",action:"Stop retrying this card. Ask the customer to use another valid card or select UPI / wallet. Preserve the cart so the customer can complete checkout.",steps:["Stop card retries","Preserve cart","Offer another method"],route:"Not eligible for alternate-acquirer routing."}
};
let transactions = [
 {id:"QB-92841",customer:"Aarav Mehta",method:"Card",amount:1299,reason:"Approved",status:"Success",time:"10:42 AM"},
 {id:"QB-92840",customer:"Diya Sharma",method:"Card",amount:649,reason:"91 — Issuer unavailable",status:"Pending",time:"10:39 AM"},
 {id:"QB-92839",customer:"Kabir Singh",method:"UPI",amount:899,reason:"Approved",status:"Success",time:"10:35 AM"},
 {id:"QB-92838",customer:"Anaya Roy",method:"Card",amount:1540,reason:"51 — Insufficient funds",status:"Failed",time:"10:31 AM"},
 {id:"QB-92837",customer:"Ishaan Das",method:"Wallet",amount:420,reason:"Approved",status:"Success",time:"10:27 AM"},
 {id:"QB-92836",customer:"Meera Jain",method:"Net Banking",amount:2100,reason:"Timeout — status check",status:"Pending",time:"10:20 AM"}
];
const ruleData=[["91","Issuer unavailable","Status check first. If confirmed failed, one delayed retry or controlled fallback."],["TIMEOUT","Timeout","Query original reference. Never retry an unknown outcome."],["51","Insufficient funds","No auto-retry. Offer another card, UPI or wallet."],["05","Do not honour","No retry loop. Suggest another method or contacting the bank."],["N7","CVV mismatch","Ask customer to correct details. Do not repeat unchanged data."],["54","Expired card","Stop retries on this card. Ask for a valid alternative."]];
function showToast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function statusClass(s){return s==="Success"?"success":s==="Failed"?"danger":s==="Pending"?"warning":"neutral"}
function rowHTML(t,full=false){return `<tr><td>${t.id}</td><td>${t.customer}</td><td>${t.method}</td><td>₹${Number(t.amount).toLocaleString("en-IN")}</td>${full?`<td>${t.reason}</td>`:""}<td><span class="status-pill ${statusClass(t.status)}">${t.status}</span></td><td>${t.time}</td></tr>`}
function renderTransactions(){
 $("#recentRows").innerHTML=transactions.slice(0,5).map(t=>rowHTML(t)).join("");
 const q=($("#transactionSearch")?.value||"").toLowerCase(),s=$("#statusFilter")?.value||"all",m=$("#methodFilter")?.value||"all";
 const filtered=transactions.filter(t=>(t.id+t.customer).toLowerCase().includes(q)&&(s==="all"||t.status===s)&&(m==="all"||t.method===m));
 $("#transactionRows").innerHTML=filtered.length?filtered.map(t=>rowHTML(t,true)).join(""):`<tr><td colspan="7">No transactions match these filters.</td></tr>`;
}
function navigate(page){$$(".page").forEach(p=>p.classList.remove("active"));$(`#page-${page}`)?.classList.add("active");$$(".nav-item[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("#pageCrumb").textContent=page.charAt(0).toUpperCase()+page.slice(1);$("#sidebar").classList.remove("open");window.scrollTo({top:0,behavior:"smooth"});if(page==="transactions")renderTransactions()}
$$(".nav-item[data-page]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
$$("[data-goto]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.goto)));
$("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
function openModal(){$("#paymentModal").classList.add("show")}
function closeModal(){$("#paymentModal").classList.remove("show")}
$("#newPaymentBtn").addEventListener("click",openModal);$("#newPaymentBtn2").addEventListener("click",openModal);$("#closeModal").addEventListener("click",closeModal);
$("#paymentModal").addEventListener("click",e=>{if(e.target.id==="paymentModal")closeModal()});
function createPayment(){
 const customer=$("#customerName").value.trim()||"Guest Customer",method=$("#paymentMethod").value,amount=Math.max(1,Number($("#paymentAmount").value)||1),result=$("#paymentResult").value;
 const reason=result==="success"?"Approved":result==="TIMEOUT"?"Timeout — status check":`${result} — ${reasons[result].title}`;
 const status=result==="success"?"Success":result==="TIMEOUT"||result==="91"?"Pending":"Failed";
 const id="QB-"+Math.floor(93000+Math.random()*6999),time=new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
 transactions.unshift({id,customer,method,amount,reason,status,time});
 closeModal();renderTransactions();showToast(`Demo payment ${id} created · ${status}`);
 if(result!=="success"){navigate("recovery");$("#declineCode").value=result;runRecovery()}else navigate("transactions");
}
$("#createPayment").addEventListener("click",createPayment);
function runRecovery(){
 const code=$("#declineCode").value,amount=Number($("#simAmount").value)||0,original=$("#originalStatus").value,r=reasons[code];
 let title=r.title,action=r.action,tone=r.tone,steps=[...r.steps],note=r.route;
 if(original==="success"){title="Payment already successful";tone="success";action="The original transaction is successful. Do not retry or route it again. Update the order to paid, verify the gateway reference and send the customer a confirmation.";steps=["Stop all retries","Mark order paid","Notify customer"];note="Idempotency protection: the same order/payment reference must not create another charge."}
 else if(code==="TIMEOUT"&&original==="failed"){title="Confirmed not completed";tone="success";action="The provider has confirmed that the original transaction did not complete. A single controlled retry may now be offered, using the same order-level idempotency controls. If the provider supports it, use the alternate route only for an eligible technical condition.";steps=["Status confirmed failed","One safe retry","Reconcile final state"];note="Retry is permitted only after confirmed non-completion."}
 else if(code==="91"&&original==="failed"){title="One controlled recovery attempt";tone="success";action="The original attempt is confirmed not completed. Wait briefly and retry once. If the issuer connection remains unavailable, route through the secondary acquirer if supported. Stop after one additional attempt.";steps=["Confirmed not completed","Short delay","One retry / fallback"];note="Maximum one additional attempt. Record the reason for route change."}
 else if(code==="TIMEOUT"&&original==="unknown"){tone="warning"}
 else if(code==="91"&&original==="unknown"){tone="warning"}
 const icon=tone==="success"?"✓":tone==="warning"?"!":"×";
 $("#decisionPanel").innerHTML=`<div class="decision-result"><div class="decision-banner ${tone}"><span class="decision-icon">${icon}</span><div><b>${title}</b><small>${r.type} · Amount ₹${amount.toLocaleString("en-IN")}</small></div></div><h3>Recommended next action</h3><p>${action}</p><div class="action-box"><small>ROUTING & CONTROL NOTE</small><p>${note}</p></div><div class="decision-steps">${steps.map((s,i)=>`<span>${i+1}. ${s}</span>`).join("")}</div><p style="margin-top:14px;font-size:9px">Decision is a capstone demonstration. Live decline handling must follow current issuer, network and payment-provider rules.</p></div>`;
}
$("#runRecovery").addEventListener("click",runRecovery);
$("#rulesGrid").innerHTML=ruleData.map(r=>`<article class="rule-card"><span class="rule-code">${r[0]}</span><h4>${r[1]}</h4><p>${r[2]}</p></article>`).join("");
$("#transactionSearch").addEventListener("input",renderTransactions);$("#statusFilter").addEventListener("change",renderTransactions);$("#methodFilter").addEventListener("change",renderTransactions);
const decline=[["Issuer unavailable",25],["Insufficient funds",22],["Timeouts",20],["Do not honour",18],["CVV mismatch",10],["Expired card",5]];
$("#declineBars").innerHTML=decline.map((d,i)=>`<div class="decline-bar-row"><span>${d[0]}</span><div class="decline-track"><i style="width:${d[1]}%;background:${["#7657f6","#ff9f43","#22c99a","#ff6f91","#42b7e9","#a8b0c7"][i]}"></i></div><b>${d[1]}%</b></div>`).join("");
const reconItems=[["QB-92840","₹649 · Diya Sharma","Gateway response pending","Verify original reference"],["QB-92836","₹2,100 · Meera Jain","Timeout / order not confirmed","Run status enquiry"],["QB-92821","₹1,499 · Rohan Verma","Debit reported by customer","Create support case"]];
function renderRecon(){ $("#reconList").innerHTML=reconItems.map((x,i)=>`<div class="recon-item"><div><span class="recon-symbol">${i===2?"!":"↻"}</span><div><b>${x[0]} · ${x[1]}</b><small>${x[2]}</small></div></div><button class="outline-btn recon-action" data-index="${i}">${x[3]} →</button></div>`).join("");$$(".recon-action").forEach(b=>b.addEventListener("click",()=>{const i=Number(b.dataset.index);showToast(i===2?"Support case created in demo.":"Status enquiry completed in demo.");if(i!==2)b.textContent="Checked ✓";else b.textContent="Case created ✓";b.disabled=true;}))}
renderRecon();
$("#reconcileBtn").addEventListener("click",()=>{showToast("Reconciliation complete · 2 pending items flagged.");$("#pendingCount").textContent="02";$("#matchedCount").textContent="129";});
$("#resetDemo").addEventListener("click",()=>{transactions=[{id:"QB-92841",customer:"Aarav Mehta",method:"Card",amount:1299,reason:"Approved",status:"Success",time:"10:42 AM"},{id:"QB-92840",customer:"Diya Sharma",method:"Card",amount:649,reason:"91 — Issuer unavailable",status:"Pending",time:"10:39 AM"},{id:"QB-92839",customer:"Kabir Singh",method:"UPI",amount:899,reason:"Approved",status:"Success",time:"10:35 AM"},{id:"QB-92838",customer:"Anaya Roy",method:"Card",amount:1540,reason:"51 — Insufficient funds",status:"Failed",time:"10:31 AM"},{id:"QB-92837",customer:"Ishaan Das",method:"Wallet",amount:420,reason:"Approved",status:"Success",time:"10:27 AM"},{id:"QB-92836",customer:"Meera Jain",method:"Net Banking",amount:2100,reason:"Timeout — status check",status:"Pending",time:"10:20 AM"}];renderTransactions();showToast("Demo data reset.");});
renderTransactions();
