// Transparent, deterministic agent tools. An optional LLM can enrich language later;
// eligibility, availability, permissions, and fairness remain enforced by backend rules.
import { db, parseJson } from './db.js';

function areaParts(value=''){const aliases={bangalore:'bengaluru',bengaluru:'bengaluru'};return String(value).split(',').map(x=>x.trim().toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ')).filter(x=>x&&!['india','karnataka','tamil nadu','telangana','andhra pradesh','maharashtra','delhi'].includes(x)).map(x=>aliases[x]||x);}
function inSameArea(a,b){const A=areaParts(a),B=areaParts(b);return A.length>0&&B.length>0&&A.some(x=>B.includes(x));}
export function discoveryAgent(query = '', resources = []) {
 const normalized = String(query).toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 const stop = new Set(['i','need','want','looking','for','a','an','the','to','use','using','my','please','find','me','some','with','on','of','and']);
 const terms = normalized.split(' ').filter(t=>t && !stop.has(t));
 const ranked = resources.map(r => {
  const name = String(r.name||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  const hay = `${r.name} ${r.category} ${r.description} ${r.location} ${r.requirements}`.toLowerCase();
  const exactName = Boolean(name && normalized.includes(name));
  const matchedTerms = terms.filter(t => hay.includes(t)).length;
  // An exact resource-name match must outrank generic keyword overlap.
  const score = (exactName ? 10000 : 0) + matchedTerms;
  const matchReason = exactName ? `Exact resource-name match; also matches ${matchedTerms} relevant search term${matchedTerms===1?'':'s'}` : matchedTerms ? `Matches ${matchedTerms} relevant search term${matchedTerms===1?'':'s'}` : 'Available resource; review details for fit';
  return { ...r, matchScore: score, matchReason, exactNameMatch: exactName };
 }).sort((a,b) => b.matchScore-a.matchScore || String(a.name).localeCompare(String(b.name)));
 return { agent:'Resource Discovery Agent', mode:'rules-based', summary:normalized ? `Ranked ${ranked.length} resources against the user request. Exact resource-name matches receive priority.` : `No search request was provided; showing ${ranked.length} available resources in general-browse mode.`, results:ranked };
}
export function eligibilityAgent(resource, user, qualificationText = '') {
 const req = (resource.requirements || '').trim();
 const institutional = /institutional email|student id/i.test(req);
 const trainingRequired = /training|induction|certificate|qualification/i.test(req);
 // Only administrator-reviewed records count as verified. User-entered notes are not proof.
 const records = user?.id ? db.prepare("SELECT title,issuer,credential_id FROM qualifications WHERE user_id=? AND status='verified'").all(user.id) : [];
 const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const reqNorm = norm(req);
 const matching = records.filter(q => {
   const title = norm(q.title);
   const resourceName = norm(resource.name);
   // A reviewer-approved record may be titled with the resource name rather than
   // the exact training phrase (a common demo form mistake). Because the record
   // is explicitly marked verified by an authorised reviewer, accept that exact
   // resource-specific title as a match; unreviewed/pending records never qualify.
   if (resourceName && title === resourceName) return true;
   if (/3d/.test(reqNorm) && /print/.test(reqNorm) && /safety|training/.test(reqNorm)) return /3d/.test(title) && /print/.test(title) && /safety|training/.test(title);
   if (/electronic/.test(reqNorm) && /induction|training/.test(reqNorm)) return /electronic/.test(title) && /induction|training/.test(title);
   const keywords = reqNorm.split(' ').filter(w=>w.length>3 && !['verified','required','certificate','qualification'].includes(w));
   return keywords.length>0 && keywords.some(w=>title.includes(w));
 });
 const trainingPresent = !trainingRequired || matching.length>0;
 const eligible = !trainingRequired || trainingPresent;
 const status = eligible ? 'eligible' : 'requires_verification';
 const reasons = [];
 if (institutional && user.verified) reasons.push('Account has a verified demo profile.');
 if (trainingRequired && trainingPresent) reasons.push(`A reviewed qualification record matches the requirement: ${matching.map(q=>q.title).join(', ')}.`);
 if (trainingRequired && !trainingPresent) reasons.push(`Required condition: ${req}. No administrator-verified matching qualification record was found, so a provider must review evidence manually.`);
 if (qualificationText) reasons.push('User-supplied qualification notes are treated as an unverified claim, not proof of training.');
 if (!reasons.length) reasons.push('No additional qualification requirement was identified by the basic rule check.');
 return { agent:'Eligibility & Safety Agent', mode:'rules-based', status, eligible: status==='eligible', reasons, required: req || 'No special qualification listed', matchedQualifications: matching.map(q=>({title:q.title,issuer:q.issuer,credentialId:q.credential_id})), note:'Demo qualification checks rely on administrator-reviewed records; this is not external issuer verification. Provider approval remains required.' };
}
export function bookingAgent(resource, studentId, startAt, endAt, purpose) {
 const start = new Date(startAt), end = new Date(endAt);
 const problems = [];
 if (!startAt || !endAt || Number.isNaN(+start) || Number.isNaN(+end) || end <= start) problems.push('Choose a valid start and end time.');
 if (String(purpose || '').trim().length < 8) problems.push('Please describe the intended use in at least 8 characters.');
 if (start < new Date(Date.now()-60000)) problems.push('Booking start time must be in the future.');
 if (resource.status !== 'available') problems.push(`Resource status is ${resource.status}.`);
 if (startAt && endAt && end > start) {
  const hours = (end-start)/3600000;
  if (hours > (resource.max_hours || 4)) problems.push(`Booking exceeds the ${resource.max_hours || 4}-hour maximum.`);
  const conflict = db.prepare(`SELECT id FROM bookings WHERE resource_id=? AND status IN ('approved','checked_in') AND start_at < ? AND end_at > ?`).get(resource.id,end.toISOString(),start.toISOString());
  if (conflict) problems.push(`Conflicts with confirmed booking #${conflict.id}.`);
 }
 const recent = db.prepare(`SELECT COUNT(*) n FROM bookings WHERE student_id=? AND created_at >= datetime('now','-7 days') AND status NOT IN ('rejected','cancelled')`).get(studentId).n;
 if (recent >= 5) problems.push('Weekly fair-access limit reached (5 active or recent requests in this demo).');
 return { agent:'Booking Analysis Agent', mode:'rules-based', recommendation:problems.length ? 'review_required' : 'provider_review', conflicts:problems.filter(p=>p.toLowerCase().includes('conflict')), issues:problems, summary:problems.length ? 'Request needs attention before approval.' : 'No basic rule conflicts found; provider review is still required.', humanApprovalRequired:true };
}
export function fairnessAgent(resourceId, studentId) {
 const userUsage = db.prepare(`SELECT COUNT(*) n FROM bookings WHERE student_id=? AND status IN ('approved','checked_in','returned') AND created_at >= datetime('now','-30 days')`).get(studentId).n;
 const waitlisted = db.prepare(`SELECT id,student_id,created_at FROM bookings WHERE resource_id=? AND status='waitlisted' ORDER BY created_at ASC,id ASC`).all(resourceId);
 const position = waitlisted.findIndex(b=>b.student_id===studentId)+1;
 return { agent:'Fair Access Agent', mode:'transparent-rules', recentUsage30Days:userUsage, waitingListPosition:position || null, waitingListLength:waitlisted.length, rule:'FIFO waiting list; maximum 5 requests per student per rolling 7 days; no protected characteristics used.', recommendation:userUsage>=4?'Consider offering an opportunity to a lower-usage eligible user.':'Apply published queue order and availability rules.' };
}
export function incidentAgent(type, description, initialCondition='', finalCondition='') {
 const keywords = ['damage','broken','crack','missing','not working','late','overdue','spill','fault','scratched','dent','loose','disconnected'];
 const reportText = `${type||''} ${description||''}`.toLowerCase();
 const finalText = String(finalCondition||description||'').toLowerCase();
 const initialText = String(initialCondition||'').toLowerCase();
 // Focus flags on the incident description and final report; an issue already recorded at pickup is not automatically treated as new damage.
 const flags = keywords.filter(k=>reportText.includes(k)||finalText.includes(k));
 const previouslyRecorded = keywords.filter(k=>initialText.includes(k));
 const newlyMentioned = flags.filter(k=>!previouslyRecorded.includes(k));
 const severity = newlyMentioned.some(x=>['damage','broken','crack','missing','not working','fault','dent','loose','disconnected'].includes(x)) ? 'needs_review' : flags.length ? 'review_recommended' : 'routine_review';
 const summary = newlyMentioned.length ? `Potential condition issue(s) mentioned in the return/incident report: ${newlyMentioned.join(', ')}. Compare pickup and return evidence; a person must decide whether the issue is new.` : flags.length ? `Issue terms were found (${flags.join(', ')}), but the initial-condition note may already mention them. Compare the evidence before deciding.` : 'No predefined issue keywords found. Review the written notes and photos; absence of keywords does not prove the item is undamaged.';
 return { agent:'Return & Incident Agent', mode:'rules-based-evidence-triage', severity, flags, newlyMentioned, previouslyRecorded, summary, decision:'human_review_required', humanApprovalRequired:true };
}
export function providerAssistantAgent(question, providerId) {
 const resources = db.prepare('SELECT COUNT(*) n FROM resources WHERE owner_id=?').get(providerId).n;
 const pending = db.prepare(`SELECT COUNT(*) n FROM bookings b JOIN resources r ON r.id=b.resource_id WHERE r.owner_id=? AND b.status='pending'`).get(providerId).n;
 const overdue = db.prepare(`SELECT COUNT(*) n FROM bookings b JOIN resources r ON r.id=b.resource_id WHERE r.owner_id=? AND b.status='checked_in' AND b.end_at < ?`).get(providerId,new Date().toISOString()).n;
 const incidents = db.prepare(`SELECT COUNT(*) n FROM incidents i JOIN bookings b ON b.id=i.booking_id JOIN resources r ON r.id=b.resource_id WHERE r.owner_id=? AND i.status='open'`).get(providerId).n;
 return { agent:'Provider Assistant Agent', mode:'live-database-summary', answer:`You manage ${resources} resource(s). There are ${pending} pending booking request(s), ${overdue} booking(s) currently overdue, and ${incidents} open incident(s).${question ? ` For your question (“${question.slice(0,160)}”), start with the relevant dashboard list; this summary uses your own resource records only.` : ''}`, metrics:{resources,pending,overdue,openIncidents:incidents} };
}
function workflowStep(agent, status, summary, evidence = []) {
 return { agent, status, summary, evidence };
}
function withWorkflow(result, steps, decisionGate = 'No privileged action was executed by an agent.') {
 return { ...result, workflow: { id: `SS-${Date.now().toString(36).toUpperCase()}`, mode: 'multi-agent-rule-orchestration', steps, decisionGate, generatedAt: new Date().toISOString() } };
}

export function orchestrate(task, input, actor) {
 switch(task) {
  case 'discovery': {
   let rows;
   if(actor.role==='admin') rows=db.prepare(`SELECT r.*,u.location owner_location FROM resources r JOIN users u ON u.id=r.owner_id WHERE r.status='available' ORDER BY r.created_at DESC`).all();
   else {
    if(!actor.location) return withWorkflow({agent:'Resource Discovery Agent',mode:'locality-filtered',summary:'Add your city or area to your profile to discover nearby providers only.',results:[]},[
     workflowStep('Locality Gate','blocked','No registered area is available; resource discovery is safely restricted.', ['Update your profile with city/area before searching.'])
    ], 'No resources were returned because the locality prerequisite is missing.');
    rows=db.prepare(`SELECT r.*,u.location owner_location FROM resources r JOIN users u ON u.id=r.owner_id WHERE r.status='available' ORDER BY r.created_at DESC`).all().filter(r=>inSameArea(actor.location,r.owner_location));
   }
   const ranked=discoveryAgent(input.query,rows);
   return withWorkflow({...ranked,mode:'locality-filtered-agent-pipeline',summary:`Discovery agent ranked ${ranked.results.length} available resource(s) after applying the registered-area gate.`},[
    workflowStep('Locality Filter Agent','passed',`Kept ${rows.length} available resource(s) matching the user's registered area.`,[actor.location||'Admin view']),
    workflowStep('Intent Matching Agent','completed',`Ranked resources against ${String(input.query||'').trim()?`the query “${String(input.query).slice(0,80)}”`:'a general browse request'}.`,ranked.results.slice(0,3).map(r=>`${r.name}: ${r.matchReason}`)),
    workflowStep('Safety / Availability Gate','passed','Only resources marked available were included.')
   ], 'Search ranking never overrides locality, availability, or backend access rules.');
  }
  case 'eligibility': {
   const resource=db.prepare('SELECT * FROM resources WHERE id=?').get(Number(input.resourceId));
   if(!resource) throw Object.assign(new Error('Resource not found'),{status:404});
   const result=eligibilityAgent(resource,actor,input.qualificationText||'');
   return withWorkflow(result,[workflowStep('Eligibility & Safety Agent',result.status==='eligible'?'passed':'manual-review',result.note,result.reasons)],'Qualification claims are not treated as verified evidence; provider review remains in control.');
  }
  case 'booking': {
   const resource=db.prepare('SELECT r.*,u.location owner_location FROM resources r JOIN users u ON u.id=r.owner_id WHERE r.id=?').get(Number(input.resourceId));
   if(!resource) throw Object.assign(new Error('Resource not found'),{status:404});
   if(actor.role!=='admin'&&!inSameArea(actor.location,resource.owner_location)) throw Object.assign(new Error('This resource is outside your registered area. Nearby-area access only.'),{status:403});
   const eligibility=eligibilityAgent(resource,actor,input.qualificationText||'');
   const booking=bookingAgent(resource,actor.id,input.startAt,input.endAt,input.purpose||'');
   const fairAccess=fairnessAgent(resource.id,actor.id);
   const blocked=booking.issues.length>0;
   const needsVerification=eligibility.status!=='eligible';
   const recommendation=blocked?'review_required':needsVerification?'requires_verification':'provider_review';
   const steps=[
    workflowStep('Eligibility & Safety Agent',needsVerification?'manual-review':'passed',needsVerification?'Resource requirements need human verification.':'No additional training requirement was detected.',eligibility.reasons),
    workflowStep('Booking Analysis Agent',blocked?'flagged':'passed',booking.summary,booking.issues.length?booking.issues:['Time range, purpose, resource status, and current booking conflicts checked.']),
    workflowStep('Fair Access Agent',fairAccess.recentUsage30Days>=4?'priority-review':'passed',fairAccess.recommendation,[`30-day usage: ${fairAccess.recentUsage30Days}`,`Wait-list position: ${fairAccess.waitingListPosition||'not currently waitlisted'}`]),
    workflowStep('Human Approval Gate','required','Provider must make the final decision after reviewing agent evidence.',[`Recommendation: ${recommendation}`])
   ];
   return withWorkflow({agent:'Booking Workflow Orchestrator',mode:'multi-agent-rule-orchestration',eligibility,booking,fairAccess,recommendation,agentsInvoked:steps.map(s=>s.agent),humanApprovalRequired:true,summary:`Three specialist agents analysed the request. Outcome: ${recommendation.replaceAll('_',' ')}.`},steps,'Agents provide evidence and recommendations only. Backend policy checks and provider approval control the actual booking state.');
  }
  case 'fairness': {
   const result=fairnessAgent(Number(input.resourceId),actor.id);
   return withWorkflow(result,[workflowStep('Fair Access Agent','completed',result.recommendation,[`30-day usage: ${result.recentUsage30Days}`,`Queue position: ${result.waitingListPosition||'not currently waitlisted'}`])],'Allocation rules are transparent and do not use protected personal characteristics.');
  }
  case 'incident': {
   const result=incidentAgent(input.type,input.description,input.initialCondition,input.finalCondition);
   return withWorkflow(result,[workflowStep('Return & Incident Agent',result.severity==='needs_review'?'flagged':result.flags.length?'review-recommended':'routine-review',result.summary,[...(result.flags.length?result.flags:['No predefined risk keywords detected']),...(result.newlyMentioned?.length?[`Newly mentioned: ${result.newlyMentioned.join(', ')}`]:[]), 'Human review required; this is not a fault determination.'])],'This is a triage signal, not a finding of fault. A person must review the evidence.');
  }
  case 'provider-assistant': {
   if(actor.role!=='provider'&&actor.role!=='admin') throw Object.assign(new Error('Provider role required'),{status:403});
   const result=providerAssistantAgent(input.question,actor.id);
   return withWorkflow(result,[workflowStep('Provider Operations Agent','completed',result.answer,[`Resources: ${result.metrics.resources}`,`Pending requests: ${result.metrics.pending}`,`Overdue: ${result.metrics.overdue}`,`Open incidents: ${result.metrics.openIncidents}`])],'The assistant reads only the signed-in provider’s authorised workspace data.');
  }
  default: throw Object.assign(new Error('Unknown agent task'),{status:400});
 }
}
