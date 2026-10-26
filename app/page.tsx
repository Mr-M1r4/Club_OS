'use client'

import {useEffect,useMemo,useState} from 'react'
import {supabase} from '../lib/supabase'

type Row=Record<string,any>
const today=()=>new Date().toISOString().slice(0,10)
const money=(n:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n||0))
const addDays=(s:string,n:number)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
const daysLeft=(s:string)=>Math.ceil((new Date(s+'T12:00:00').getTime()-Date.now())/86400000)

export default function App(){
 const [session,setSession]=useState<any>(null),[loading,setLoading]=useState(true),[tab,setTab]=useState('dashboard')
 const [data,setData]=useState<Row>({athletes:[],plans:[],memberships:[],payments:[],products:[],staff:[],staffPayments:[],notifications:[],sales:[],audit:[],categories:[],teams:[],sessions:[],attendance:[],arrears:[],settings:null,saasSubscriptions:[],saasPayments:[],clubs:[]})
 const [role,setRole]=useState('staff'),[isPlatformAdmin,setIsPlatformAdmin]=useState(false),[staffRole,setStaffRole]=useState(''),[q,setQ]=useState(''),[modal,setModal]=useState(''),[f,setF]=useState<Row>({}),[msg,setMsg]=useState(''),[reportRange,setReportRange]=useState({from:addDays(today(),-30),to:today()})
 const base=process.env.NEXT_PUBLIC_BASE_PATH||''

 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);if(!data.session)setLoading(false)});const {data:l}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);if(!s)setLoading(false)});return()=>l.subscription.unsubscribe()},[])
 useEffect(()=>{if(session)load()},[session])
 async function load(){
  setLoading(true)
  const [u,a,pl,m,p,pr,s,sp,n,sa,au,ca,te,se,att,ar,settings,pa,subs,saasPay,ev,clubs]=await Promise.all([
   supabase.auth.getUser(),
   supabase.from('athletes').select('*').order('full_name'),
   supabase.from('membership_plans').select('*').order('price'),
   supabase.from('memberships').select('*').order('end_date',{ascending:false}),
   supabase.from('payments').select('*').order('paid_at',{ascending:false}),
   supabase.from('products').select('*,product_variants(*)').order('name'),
   supabase.from('staff_members').select('*').order('full_name'),
   supabase.from('staff_payments').select('*').order('paid_at',{ascending:false}),
   supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(100),
   supabase.from('sales').select('*').order('created_at',{ascending:false}).limit(100),
   supabase.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(100),
   supabase.from('categories').select('*').order('name'),
   supabase.from('teams').select('*').order('name'),
   supabase.from('training_sessions').select('*').order('session_date',{ascending:false}),
   supabase.from('attendance').select('*').order('marked_at',{ascending:false}),
   supabase.from('membership_arrears').select('*').order('amount_due',{ascending:false}),
   supabase.from('club_settings').select('*').maybeSingle(),
   supabase.from('platform_admins').select('user_id').limit(1),
   supabase.from('saas_subscriptions').select('*').order('current_period_end'),
   supabase.from('saas_payments').select('*').order('paid_at',{ascending:false}).limit(200),
   supabase.from('events').select('*').order('event_date',{ascending:true}),
   supabase.from('clubs').select('id,name,slug,active').order('name')
  ])
  const user=u.data.user
  if(user){
   const prf=await supabase.from('profiles').select('role,active_club_id').eq('id',user.id).maybeSingle()
   const cm=prf.data?.active_club_id?await supabase.from('club_memberships').select('role').eq('club_id',prf.data.active_club_id).eq('user_id',user.id).eq('active',true).maybeSingle():{data:null}
   setRole(cm.data?.role||prf.data?.role||'staff')
   const me=(s.data||[]).find((x:Row)=>x.email?.toLowerCase()===user.email?.toLowerCase())
   setStaffRole(me?.role||'')
   setIsPlatformAdmin((pa.data||[]).some((x:Row)=>x.user_id===user.id))
  }
  setData({athletes:a.data||[],plans:pl.data||[],memberships:m.data||[],payments:p.data||[],products:pr.data||[],staff:s.data||[],staffPayments:sp.data||[],notifications:n.data||[],sales:sa.data||[],audit:au.data||[],categories:ca.data||[],teams:te.data||[],sessions:se.data||[],attendance:att.data||[],arrears:ar.data||[],settings:settings.data||null,saasSubscriptions:subs.data||[],saasPayments:saasPay.data||[],events:ev.data||[],clubs:clubs.data||[]})
  setLoading(false)
 }
 const canManage=role==='owner'||role==='admin', canOperate=canManage||role==='staff'
 const nav=canOperate?['dashboard','athletes','memberships','plans','payments','products','staff','teams','attendance','arrears','reports','communications',...(canManage?['settings','audit']:[]),...(isPlatformAdmin?['billing']:[])]:['athletes','attendance']
 const labels:any={dashboard:'Dashboard',athletes:'Deportistas',memberships:'Membresías',payments:'Caja y pagos',products:'Productos e inventario',staff:'Personal',communications:'Comunicaciones',audit:'Auditoría',teams:'Equipos y categorías',attendance:'Asistencia',arrears:'Cartera y morosidad',reports:'Reportes',settings:'Configuración',plans:'Planes y servicios',billing:'Suscripciones SaaS'}
 const active=data.memberships.filter((m:Row)=>m.status==='active'&&m.end_date>=today())
 const exp=active.filter((m:Row)=>daysLeft(m.end_date)<=7).sort((a:Row,b:Row)=>a.end_date.localeCompare(b.end_date))
 const month=today().slice(0,7)
 const revenue=data.payments.filter((p:Row)=>p.status==='confirmed'&&p.paid_at?.slice(0,7)===month).reduce((n:number,p:Row)=>n+Number(p.amount||0),0)
 const pending=data.notifications.filter((n:Row)=>n.status==='pending').length
 const filtered=data.athletes.filter((a:Row)=>[a.full_name,a.document_number,a.phone,a.email,a.category,a.team].join(' ').toLowerCase().includes(q.toLowerCase()))
 const close=()=>{setModal('');setF({});setMsg('')}
 const createClub=async()=>{
  const name=prompt('Nombre del nuevo club')
  if(!name?.trim())return
  const slug=prompt('Slug del club (ej. club-nuevo)')
  if(!slug?.trim())return
  const r=await supabase.rpc('create_club',{p_name:name.trim(),p_slug:slug.trim()})
  if(r.error)return alert(r.error.message)
  alert('Club creado y seleccionado')
  location.reload()
 }

 if(loading)return <div className="splash"><div><div className="brand brand-lg brand-text">NEXOSPORT CLUB</div><p>Cargando NEXOSPORT CLUB…</p></div></div>
 if(!session)return <Login base={base}/>

 return <div className="app" style={{'--img-textura':'url('+base+'/fondoTextura.png)','--img-lineas':'url('+base+'/lineas.png)'} as any}>
  <aside>
   <div className="brand brand-text">NEXOSPORT CLUB</div>
   <small>CLUB OS · {role.toUpperCase()}</small>
   <nav>{nav.map((n:string)=><button key={n} className={tab===n?'active':''} onClick={()=>setTab(n)}>{labels[n]}</button>)}</nav>
   <div className="sidebottom"><span>{session.user.email}</span><button onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button></div>
  </aside>
  <main className="main">
   <header><div className="header-identity">{data.settings?.logo_url?<img className="club-logo-header" src={data.settings.logo_url} alt={data.settings.club_name||'Logo del club'}/>:<div className="club-logo-fallback">NS</div>}<div><small>{data.settings?.club_name||'NEXOSPORT CLUB'}</small><h1>{labels[tab]}</h1></div></div><div className="actions"><ClubSwitcher onSwitched={load}/>{(role==='owner'||isPlatformAdmin)&&<button onClick={createClub}>+ Nuevo club</button>}
    {tab==='athletes'&&canOperate&&<button onClick={()=>{setF({status:'active'});setModal('athlete')}}>+ Deportista</button>}
    {tab==='plans'&&canManage&&<><button onClick={()=>{setF({name:'',duration_days:'30',price:'',active:true});setModal('plan')}}>+ Plan</button><button onClick={()=>{setF({name:'',event_date:today(),start_time:'',end_time:'',location:'',description:'',expected_people:'',status:'scheduled'});setModal('event')}}>+ Evento</button></>}
    {tab==='memberships'&&canOperate&&<button onClick={()=>{setF({start_date:today(),registration_amount:0});setModal('register')}}>+ Inscripción</button>}
    {tab==='payments'&&canOperate&&<button onClick={()=>{setF({status:'confirmed',paid_at:new Date().toISOString().slice(0,16)});setModal('payment')}}>+ Pago</button>}
    {tab==='products'&&canManage&&<button onClick={()=>{setF({name:'',sku:'',description:'',image_path:'',image_url:'',variants:[{size:'',price:'',stock:''}]});setModal('product')}}>+ Producto</button>}
    {tab==='staff'&&canManage&&<button onClick={()=>{setF({role:'trainer',rate_type:'monthly',payment_rate:'',rate_quantity:''});setModal('staff')}}>+ Personal</button>}
    {tab==='teams'&&canManage&&<button onClick={()=>{setF({});setModal('team')}}>+ Equipo</button>}
    {tab==='attendance'&&canOperate&&<button onClick={()=>{setF({session_date:today(),status:'scheduled'});setModal('session')}}>+ Entrenamiento</button>}
   </div></header>
   {tab==='dashboard'&&<Dashboard data={data} active={active} exp={exp} revenue={revenue} pending={pending} onRenew={(m:Row)=>{setF({athlete_id:m.athlete_id,start_date:today()});setModal('renew')}} onTab={setTab}/>}
   {tab==='athletes'&&<Athletes rows={filtered} q={q} setQ={setQ} canManage={canManage} onEdit={(a:Row)=>{setF(a);setModal('athlete')}} onDelete={async(a:Row)=>{if(!confirm('¿Eliminar este deportista? Si tiene historial será archivado para conservarlo.'))return;const r=await supabase.rpc('delete_athlete',{p_id:a.id});if(r.error)return alert(r.error.message);alert(r.data==='deleted'?'Deportista eliminado.':'Deportista archivado porque tiene historial.');load()}}/>}
   {tab==='plans'&&<><Plans data={data} canManage={canManage} onDelete={async(p:Row)=>{if(!confirm('¿Eliminar este plan? Si tiene membresías será archivado.'))return;const r=await supabase.rpc('delete_membership_plan',{p_id:p.id});if(r.error)return alert(r.error.message);alert(r.data==='deleted'?'Plan eliminado.':'Plan archivado porque tiene historial.');load()}}/><Events data={data} canManage={canManage} onEdit={(e:Row)=>{setF(e);setModal('event')}} onDelete={async(e:Row)=>{if(!confirm('¿Eliminar este evento?'))return;const r=await supabase.from('events').delete().eq('id',e.id);if(r.error)return alert(r.error.message);load()}}/></>}
   {tab==='memberships'&&<Memberships data={data} onRenew={(m:Row)=>{setF({athlete_id:m.athlete_id,start_date:today()});setModal('renew')}}/>}
   {tab==='payments'&&<Payments data={data}/>}
   {tab==='products'&&<Products data={data} canManage={canManage} onDelete={async(p:Row)=>{if(!confirm('¿Eliminar este servicio/producto? Si tiene ventas o movimientos será archivado.'))return;const r=await supabase.rpc('delete_product',{p_id:p.id});if(r.error)return alert(r.error.message);alert(r.data==='deleted'?'Servicio eliminado.':'Servicio archivado porque tiene historial.');load()}} onSale={(v:Row,p:Row)=>{setF({product:p,variant:v,qty:'1',method:'cash'});setModal('sale')}} onAdjust={(v:Row)=>{setF({variant:v,quantity:0,notes:''});setModal('stock')}}/>}
   {tab==='staff'&&<Staff data={data} canManage={canManage} onPay={(s:Row)=>{setF({staff_id:s.id,amount:String(Number(s.payment_rate||0)*Number(s.rate_quantity||1)),quantity:String(s.rate_quantity||1),rate_type:s.rate_type,rate_unit:s.rate_type==='hourly'?'horas':s.rate_type==='session'?'sesiones':s.rate_type==='monthly'?'meses':'unidades',period_start:month+'-01',period_end:addDays(month+'-01',30),concept:'Honorarios',method:'transfer'});setModal('staffpay')}}/>}
   {tab==='communications'&&<Communications data={data} exp={exp} pending={pending} onQueue={async()=>{const r=await supabase.rpc('queue_membership_reminders');setMsg(r.error?.message||'Se agregaron '+(r.data||0)+' recordatorios a la cola.');alert(r.error?.message||'Cola actualizada');load()}}/>}
   {tab==='teams'&&<Teams data={data} canManage={canManage} onEdit={(x:Row)=>{setF(x);setModal('team')}}/>}
   {tab==='attendance'&&<Attendance data={data} canManage={canManage} onMark={(s:Row)=>{setF({session:s});setModal('attendance')}}/>}
   {tab==='arrears'&&<Arrears data={data}/>} 
   {tab==='reports'&&<Reports data={data} range={reportRange} setRange={setReportRange}/>} 
   {tab==='settings'&&canManage&&<Settings data={data} close={close} load={load} role={role}/>} 
   {tab==='audit'&&<Audit rows={data.audit}/>} 
   {tab==='billing'&&isPlatformAdmin&&<PlatformBilling data={data} load={load}/>} 
  </main>
  {modal==='plan'&&<Modal title="Nuevo plan" close={close}><PlanForm f={f} setF={setF} close={close}/></Modal>}
  {modal==='event'&&<Modal title={f.id?'Editar evento':'Nuevo evento'} close={close}><EventForm f={f} setF={setF} close={close}/></Modal>}
  {modal==='athlete'&&<Modal title={(f as any)['id']?'Editar deportista':'Nuevo deportista'} close={close}><AthleteForm f={f} setF={setF} save={async()=>{const payload:any={...f,full_name:(f as Row).full_name?.trim()};delete payload.id;delete payload.created_at;delete payload.updated_at;const r=(f as any)['id']?await supabase.from('athletes').update(payload).eq('id',(f as any)['id']):await supabase.from('athletes').insert(payload);if(r.error)setMsg(r.error.message);else{close();load()}}} msg={msg}/></Modal>}
  {modal==='register'&&<Modal title="Nueva inscripción" close={close}><Register data={data} f={f} setF={setF} close={close}/></Modal>}
  {modal==='renew'&&<Modal title="Renovar membresía" close={close}><Renew data={data} f={f} setF={setF} close={close}/></Modal>}
  {modal==='payment'&&<Modal title="Registrar pago" close={close}><PaymentForm data={data} f={f} setF={setF} close={close}/></Modal>}
  {modal==='sale'&&<Modal title={'Vender · '+f.product?.name} close={close}><Sale data={data} f={f} setF={setF} close={close}/></Modal>}
  {modal==='stock'&&<Modal title={'Ajustar stock · '+f.variant?.size} close={close}><Stock f={f} setF={setF} close={close}/></Modal>}
  {modal==='product'&&<Modal title="Nuevo producto" close={close}><ProductForm f={f} setF={setF} close={close}/></Modal>}
  {modal==='staff'&&<Modal title="Nuevo personal" close={close}><StaffForm f={f} setF={setF} close={close}/></Modal>}
  {modal==='staffpay'&&<Modal title="Registrar pago a personal" close={close}><StaffPay data={data} f={f} setF={setF} close={close}/></Modal>}
  {modal==='team'&&<Modal title={f.id?'Editar equipo':'Nuevo equipo'} close={close}><TeamForm data={data} f={f} setF={setF} close={close}/></Modal>}
  {modal==='session'&&<Modal title="Nuevo entrenamiento" close={close}><SessionForm data={data} f={f} setF={setF} close={close}/></Modal>}
  {modal==='attendance'&&<Modal title={'Asistencia · '+f.session?.session_date} close={close}><AttendanceForm data={data} f={f} close={close}/></Modal>}
 </div>
}

function Receipt({title,party,club,clubLogo,record,concept,period,contactEmail,contactPhone,onClose}:any){
 const share=async()=>{const text=`NEXOSPORT CLUB\nComprobante ${record.reference||''}\n${concept}\nValor: ${money(record.amount)}\nFecha: ${record.paid_at?.slice(0,10)||today()}`;if(navigator.share)await navigator.share({title:'Comprobante de pago',text}).catch(()=>{});else{await navigator.clipboard?.writeText(text);alert('Comprobante copiado al portapapeles.');}};
 const print=()=>window.print();
 return <div className="receipt-modal"><div className="receipt-actions"><button onClick={print}>Imprimir / Guardar PDF</button><button onClick={share}>Compartir</button>{contactEmail&&<a href={`mailto:${contactEmail}?subject=Comprobante%20${encodeURIComponent(record.reference||'')}`}>Enviar por correo</a>}{contactPhone&&<a target="_blank" rel="noreferrer" href={`https://wa.me/${String(contactPhone).replace(/\\D/g,'')}?text=${encodeURIComponent('Te envío el comprobante '+(record.reference||'')+' de '+money(record.amount)+'.')}`}>WhatsApp</a>}<button onClick={onClose}>Cerrar</button></div><div className="receipt"><div className="receipt-brand"><div className="receipt-brand-main">{clubLogo?<img className="receipt-logo" src={clubLogo} alt={club||'Logo del club'}/>:null}<div><strong>{club||'NEXOSPORT CLUB'}</strong><small>Comprobante de pago</small></div></div><b>{record.reference||'—'}</b></div><div className="receipt-meta"><div><span>Fecha</span><b>{record.paid_at?.slice(0,10)||today()}</b></div><div><span>Estado</span><b>CONFIRMADO</b></div></div><div className="receipt-party"><span>Recibido de / Pagado a</span><strong>{party||'—'}</strong></div><div className="receipt-concept"><span>Concepto</span><strong>{concept||'Pago'}</strong>{period&&<small>Periodo: {period}</small>}</div><div className="receipt-total"><span>Total</span><strong>{money(record.amount)}</strong></div><div className="receipt-footer"><span>Método: {record.method||'—'}</span><span>{club||'NEXOSPORT CLUB'}</span></div></div></div>
}
function Dashboard({data,active,exp,revenue,pending,onRenew,onTab}:any){return <><div className="stats"><Card n={data.athletes.length} l="Deportistas"/><Card n={active.length} l="Membresías activas"/><Card n={exp.length} l="Vencen en 7 días"/><Card n={money(revenue)} l="Ingresos del mes"/></div><div className="grid2"><section><div className="sectionhead"><h2>Próximos vencimientos</h2><button onClick={()=>onTab('memberships')}>Ver todo</button></div>{exp.length?<div className="list">{exp.slice(0,8).map((m:Row)=><div className="line" key={m.id}><div><b>{data.athletes.find((a:Row)=>a.id===m.athlete_id)?.full_name||'—'}</b><small>vence {m.end_date} · {Math.max(0,daysLeft(m.end_date))} días</small></div><button onClick={()=>onRenew(m)}>Renovar</button></div>)}</div>:<Empty text="No hay vencimientos próximos."/>}</section><section><div className="sectionhead"><h2>Actividad</h2><button onClick={()=>onTab('payments')}>Pagos</button></div><div className="kpi"><b>{money(revenue)}</b><span>recaudo confirmado este mes</span></div><div className="minirow"><span>Recordatorios pendientes</span><b>{pending}</b></div><div className="minirow"><span>Ventas registradas</span><b>{data.sales.length}</b></div><div className="minirow"><span>Personal activo</span><b>{data.staff.filter((s:Row)=>s.active).length}</b></div></section></div></>}
function Athletes({rows,q,setQ,canManage,onEdit,onDelete}:any){return <><div className="toolbar"><input placeholder="Buscar por nombre, documento, teléfono, categoría…" value={q} onChange={e=>setQ(e.target.value)}/></div><Table head={['Deportista','Documento','Teléfono','Categoría','Equipo','Estado','Acción']} rows={rows.map((a:Row)=>[a.full_name,a.document_number||'—',a.phone||'—',a.category||'—',a.team||'—',a.status,<div className="actions">{canManage&&<><button onClick={()=>onEdit(a)}>Editar</button><button onClick={()=>onDelete(a)}>Eliminar</button></>}</div>])}/></>}
function Plans({data,canManage,onDelete}:any){return <section><div className="sectionhead"><div><h2>Planes y servicios</h2><small>Los planes con historial se archivan en lugar de borrarse para conservar la trazabilidad.</small></div></div><Table head={['Nombre','Duración','Precio','Estado','Acción']} rows={data.plans.map((p:Row)=>[p.name,(p.duration_days||0)+' días',money(p.price),p.active?'Activo':'Archivado',canManage&&p.active?<button onClick={()=>onDelete(p)}>Eliminar</button>:null])}/></section>}
function PlanForm({f,setF,close}:any){return <div className="formgrid"><label>Nombre<input value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Duración (días)<input type="number" min="1" value={f.duration_days??''} onChange={e=>setF({...f,duration_days:e.target.value})}/></label><label>Precio<input type="number" min="0" value={f.price??''} onChange={e=>setF({...f,price:e.target.value})}/></label><button onClick={async()=>{if(!f.name?.trim())return alert('El nombre es obligatorio');if(Number(f.duration_days)<=0)return alert('La duración debe ser mayor que cero');const r=await supabase.from('membership_plans').insert({name:f.name.trim(),duration_days:Number(f.duration_days),price:Number(f.price||0),active:true});if(r.error)return alert(r.error.message);close();location.reload()}}>Guardar plan</button></div>}
function Events({data,canManage,onEdit,onDelete}:any){const events=data.events||[];return <section><div className="sectionhead"><div><h2>Eventos</h2><small>Actividades especiales, torneos, reuniones y otros eventos del club.</small></div></div>{events.length?<Table head={['Evento','Fecha','Horario','Lugar','Personas','Estado','Descripción','Acción']} rows={events.map((e:Row)=>[e.name,e.event_date,(e.start_time||'')+(e.end_time?' → '+e.end_time:''),e.location||'—',e.expected_people??'—',e.status==='scheduled'?'Programado':e.status==='completed'?'Realizado':'Cancelado',e.description||'—',canManage?<div className="actions"><button onClick={()=>onEdit(e)}>Editar</button><button onClick={()=>onDelete(e)}>Eliminar</button></div>:null])}/>:<Empty text="No hay eventos registrados."/>}</section>}
function EventForm({f,setF,close}:any){return <div className="formgrid"><label>Nombre del evento<input placeholder="Ej.: Torneo interno, clínica, reunión…" value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></label><label>Fecha<input type="date" value={f.event_date||today()} onChange={e=>setF({...f,event_date:e.target.value})}/></label><label>Inicio<input type="time" value={f.start_time||''} onChange={e=>setF({...f,start_time:e.target.value})}/></label><label>Fin<input type="time" value={f.end_time||''} onChange={e=>setF({...f,end_time:e.target.value})}/></label><label>Lugar<input placeholder="Cancha, sede, salón…" value={f.location||''} onChange={e=>setF({...f,location:e.target.value})}/></label><label>Cantidad de personas<input type="number" min="0" value={f.expected_people??''} onChange={e=>setF({...f,expected_people:e.target.value})}/></label><label>Estado<select value={f.status||'scheduled'} onChange={e=>setF({...f,status:e.target.value})}><option value="scheduled">Programado</option><option value="completed">Realizado</option><option value="cancelled">Cancelado</option></select></label><label>Descripción / detalles<textarea rows={5} placeholder="Detalla cantidad de personas, logística, materiales, instrucciones, horarios, responsables u otra información relevante…" value={f.description||''} onChange={e=>setF({...f,description:e.target.value})}/></label><button onClick={async()=>{if(!f.name?.trim())return alert('El nombre del evento es obligatorio');if(!f.event_date)return alert('La fecha del evento es obligatoria');const payload={name:f.name.trim(),event_date:f.event_date,start_time:f.start_time||null,end_time:f.end_time||null,location:f.location?.trim()||null,description:f.description?.trim()||null,expected_people:f.expected_people===''||f.expected_people==null?null:Number(f.expected_people),status:f.status||'scheduled'};if(payload.expected_people!==null&&(!Number.isInteger(payload.expected_people)||payload.expected_people<0))return alert('La cantidad de personas debe ser un número entero igual o mayor que cero');const r=f.id?await supabase.from('events').update(payload).eq('id',f.id):await supabase.from('events').insert(payload);if(r.error)return alert(r.error.message);close();location.reload()}}>{f.id?'Guardar cambios':'Crear evento'}</button></div>}
function Memberships({data,onRenew}:any){return <Table head={['Deportista','Plan','Inicio','Vence','Estado','Acción']} rows={data.memberships.map((m:Row)=>{const a=data.athletes.find((x:Row)=>x.id===m.athlete_id),p=data.plans.find((x:Row)=>x.id===m.plan_id);return [a?.full_name||'—',p?.name||'—',m.start_date,m.end_date,<span className={daysLeft(m.end_date)<=7?'warn':''}>{m.status}</span>,m.status==='active'?<button onClick={()=>onRenew(m)}>Renovar</button>:null]})}/>}
function Payments({data}:any){const [receipt,setReceipt]=useState<Row|null>(null);return <><div className="stats three"><Card n={money(data.payments.filter((p:Row)=>p.status==='confirmed'&&p.paid_at?.slice(0,7)===today().slice(0,7)).reduce((n:number,p:Row)=>n+Number(p.amount),0))} l="Recaudo del mes"/><Card n={data.payments.filter((p:Row)=>p.status==='pending').length} l="Pagos pendientes"/><Card n={data.payments.length} l="Movimientos"/></div><Table head={['Fecha','Deportista','Concepto','Método','Valor','Estado','Comprobante']} rows={data.payments.map((p:Row)=>{const a=data.athletes.find((x:Row)=>x.id===p.athlete_id);return [p.paid_at?.slice(0,10)||p.created_at?.slice(0,10),a?.full_name||'—',p.concept,p.method||'—',money(p.amount),p.status,p.status==='confirmed'?<button onClick={()=>setReceipt({record:p,party:a?.full_name,contactEmail:a?.email,contactPhone:a?.phone,concept:p.concept==='membership'?'Mensualidad':p.concept==='registration'?'Inscripción':p.concept||'Pago',club:data.settings?.club_name,clubLogo:data.settings?.logo_url})}>Recibo</button>:null]})}/>{receipt&&<Receipt {...receipt} title="Comprobante de pago" onClose={()=>setReceipt(null)}/>}</>}
function Products({data,onSale,onAdjust,onDelete,canManage}:any){return <div className="productgrid">{data.products.map((p:Row)=><section key={p.id}>{p.image_url&&<img className="product-reference-image" src={p.image_url} alt={`Imagen de referencia de ${p.name}`}/>}<div className="sectionhead"><div><h2>{p.name}</h2><small>{p.sku||'sin SKU'} · {p.active?'Activo':'Archivado'}</small></div><div className="actions">{canManage&&p.active&&<button onClick={()=>onDelete(p)}>Eliminar</button>}</div></div>{(p.product_variants||[]).map((v:Row)=><div className="variantrow" key={v.id}><span>{v.size||'Único'}</span><b>{money(v.price)}</b><span className={v.stock<3?'warn':''}>stock {v.stock}</span><div>{canManage&&<button onClick={()=>onAdjust(v)}>Ajustar</button>}<button disabled={v.stock<1} onClick={()=>onSale(v,p)}>Vender</button></div></div>)}</section>)}</div>}
function Staff({data,canManage,onPay}:any){const [receipt,setReceipt]=useState<Row|null>(null);return <><Table head={['Nombre','Rol','Tarifa','Tipo','Activo','Acción']} rows={data.staff.map((s:Row)=>[s.full_name,s.role,money(s.payment_rate),s.rate_type,s.active?'Sí':'No',canManage?<button onClick={()=>onPay(s)}>Registrar pago</button>:null])}/><h2>Historial de pagos</h2><Table head={['Personal','Periodo','Concepto','Valor','Fecha','Comprobante']} rows={data.staffPayments.map((p:Row)=>{const s=data.staff.find((x:Row)=>x.id===p.staff_id);return [s?.full_name||'—',(p.period_start||'—')+' → '+(p.period_end||'—'),p.concept,money(p.amount),p.paid_at?.slice(0,10)||'—',<button onClick={()=>setReceipt({record:p,party:s?.full_name,contactEmail:s?.email,contactPhone:s?.phone,concept:p.concept||'Honorarios',period:(p.period_start||'—')+' → '+(p.period_end||'—'),club:data.settings?.club_name,clubLogo:data.settings?.logo_url})}>Comprobante</button>]})}/>{receipt&&<Receipt {...receipt} onClose={()=>setReceipt(null)}/>}</>}
function Communications({data,exp,pending,onQueue}:any){return <><section><div className="sectionhead"><div><h2>Cola de comunicaciones</h2><small>{pending} pendientes</small></div><button onClick={onQueue}>Generar recordatorios ahora</button></div>{data.notifications.length?<Table head={['Deportista','Canal','Plantilla','Programado','Estado']} rows={data.notifications.map((n:Row)=>[data.athletes.find((a:Row)=>a.id===n.athlete_id)?.full_name||'—',n.channel,n.template,n.scheduled_for?.slice(0,16)||'—',n.status])}/>:<Empty text="La cola está vacía."/>}</section><section><h2>Acciones rápidas</h2>{exp.slice(0,10).map((m:Row)=>{const a=data.athletes.find((x:Row)=>x.id===m.athlete_id);return <div className="line" key={m.id}><div><b>{a?.full_name}</b><small>Vence {m.end_date}</small></div><div className="actions">{a?.email&&<a href={'mailto:'+a.email+'?subject=RIVER%20-%20Renovación%20de%20membresía'}>Email</a>}{a?.phone&&<a target="_blank" href={'https://wa.me/'+a.phone.replace(/\\D/g,'')}>WhatsApp</a>}{a?.phone&&<a href={'sms:'+a.phone}>SMS</a>}</div></div>})}</section></>}
function Audit({rows}:any){return <Table head={['Fecha','Acción','Entidad','ID','Detalles']} rows={rows.map((r:Row)=>[r.created_at?.slice(0,19).replace('T',' '),r.action,r.entity,r.entity_id||'—',JSON.stringify(r.details)])}/>}
function Card({n,l}:any){return <div className="card"><b>{n}</b><span>{l}</span></div>}
function Table({head,rows}:any){return <div className="table"><table><thead><tr>{head.map((h:string)=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r:any[],i:number)=><tr key={i}>{r.map((c:any,j:number)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}
function Empty({text}:any){return <div className="empty">{text}</div>}
function Modal({title,close,children}:any){return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="modal"><div className="modalhead"><h2>{title}</h2><button onClick={close}>×</button></div>{children}</div></div>}
function AthleteForm({f,setF,save,msg}:any){const [cats,setCats]=useState<Row[]>([]),[teams,setTeams]=useState<Row[]>([]);useEffect(()=>{Promise.all([supabase.from('categories').select('*').eq('active',true).order('name'),supabase.from('teams').select('*').eq('active',true).order('name')]).then(([c,t])=>{setCats(c.data||[]);setTeams(t.data||[])})},[]);return <div className="formgrid"><label>Nombre completo<input value={f.full_name||''} onChange={e=>setF({...f,full_name:e.target.value})}/></label><label>Documento<input value={f.document_number||''} onChange={e=>setF({...f,document_number:e.target.value})}/></label><label>Teléfono<input value={f.phone||''} onChange={e=>setF({...f,phone:e.target.value})}/></label><label>Correo<input type="email" value={f.email||''} onChange={e=>setF({...f,email:e.target.value})}/></label><label>Fecha de nacimiento<input type="date" value={f.birth_date||''} onChange={e=>setF({...f,birth_date:e.target.value})}/></label><Select label="Categoría" value={f.category_id} set={(v:string)=>setF({...f,category_id:v||null,category:cats.find(c=>c.id===v)?.name||f.category||''})} options={cats.map(c=>[c.id,c.name])}/><Select label="Equipo" value={f.team_id} set={(v:string)=>setF({...f,team_id:v||null,team:teams.find(t=>t.id===v)?.name||f.team||''})} options={teams.map(t=>[t.id,t.name])}/>{msg&&<div className="error">{msg}</div>}<button onClick={save}>Guardar</button></div>}
function Register({data,f,setF,close}:any){return <div className="formgrid"><Select label="Deportista" value={f.athlete_id} set={(v:string)=>setF({...f,athlete_id:v})} options={data.athletes.map((a:Row)=>[a.id,a.full_name])}/><Select label="Plan" value={f.plan_id} set={(v:string)=>setF({...f,plan_id:v})} options={data.plans.filter((p:Row)=>p.active).map((p:Row)=>[p.id,money(p.price)+' · '+p.name])}/><label>Inicio<input type="date" value={f.start_date||today()} onChange={e=>setF({...f,start_date:e.target.value})}/></label><label>Inscripción<input type="number" min="0" value={f.registration_amount??''} onChange={e=>setF({...f,registration_amount:e.target.value})}/></label><Select label="Método inscripción" value={f.registration_method||'cash'} set={(v:string)=>setF({...f,registration_method:v})} options={methods}/><Select label="Método mensualidad" value={f.membership_method||'cash'} set={(v:string)=>setF({...f,membership_method:v})} options={methods}/><button onClick={async()=>{if(!f.athlete_id||!f.plan_id)return alert('Selecciona deportista y plan');const r=await supabase.rpc('create_registration',{p_athlete_id:f.athlete_id,p_plan_id:f.plan_id,p_start_date:f.start_date||today(),p_registration_amount:Number(f.registration_amount||0),p_registration_method:f.registration_method||'cash',p_membership_method:f.membership_method||'cash'});if(r.error)alert(r.error.message);else{close();location.reload()}}}>Crear inscripción y registrar pagos</button></div>}
function Renew({data,f,setF,close}:any){return <div className="formgrid"><Select label="Plan" value={f.plan_id} set={(v:string)=>setF({...f,plan_id:v})} options={data.plans.filter((p:Row)=>p.active).map((p:Row)=>[p.id,money(p.price)+' · '+p.name])}/><label>Inicio<input type="date" value={f.start_date||today()} onChange={e=>setF({...f,start_date:e.target.value})}/></label><Select label="Método" value={f.method||'cash'} set={(v:string)=>setF({...f,method:v})} options={methods}/><button onClick={async()=>{if(!f.plan_id)return alert('Selecciona un plan');const r=await supabase.rpc('renew_membership',{p_athlete_id:f.athlete_id,p_plan_id:f.plan_id,p_start_date:f.start_date||today(),p_method:f.method||'cash'});if(r.error)alert(r.error.message);else{alert('Membresía renovada hasta '+r.data.end_date);close();location.reload()}}}>Renovar y registrar pago</button></div>}
const methods=[['cash','Efectivo'],['transfer','Transferencia'],['card','Tarjeta'],['other','Otro']]
function Select({label,value,set,options}:any){return <label>{label}<select value={value||''} onChange={e=>set(e.target.value)}><option value="">Seleccionar</option>{options.map((o:any)=><option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>}
function PaymentForm({data,f,setF,close}:any){return <div className="formgrid"><Select label="Deportista" value={f.athlete_id} set={(v:string)=>setF({...f,athlete_id:v})} options={data.athletes.map((a:Row)=>[a.id,a.full_name])}/><Select label="Concepto" value={f.concept||'membership'} set={(v:string)=>setF({...f,concept:v})} options={[['registration','Inscripción'],['membership','Mensualidad'],['product','Producto']]}/><label>Valor<input type="number" min="0" value={f.amount??''} onChange={e=>setF({...f,amount:e.target.value})}/></label><Select label="Método" value={f.method||'cash'} set={(v:string)=>setF({...f,method:v})} options={methods}/><button onClick={async()=>{if(Number(f.amount||0)<0)return alert('El valor no puede ser negativo');const r=await supabase.from('payments').insert({athlete_id:f.athlete_id||null,concept:f.concept||'membership',amount:Number(f.amount||0),method:f.method,status:'confirmed',reference:f.reference||null,paid_at:new Date().toISOString()});if(r.error)alert(r.error.message);else{close();location.reload()}}}>Registrar pago</button></div>}

function Sale({data,f,setF,close}:any){const [busy,setBusy]=useState(false);const [error,setError]=useState('');const qty=Number(f.qty);const qtyValid=Number.isInteger(qty)&&qty>=1;const sell=async()=>{if(!f.variant?.id)return setError('No se seleccionó una variante.');if(!qtyValid)return setError('La cantidad debe ser un número entero mayor o igual a 1.');if(qty>Number(f.variant.stock||0))return setError('Stock insuficiente para esta cantidad.');setBusy(true);setError('');const r=await supabase.rpc('create_sale',{p_athlete_id:f.athlete_id||null,p_variant_id:f.variant.id,p_quantity:qty,p_method:f.method||'cash'});setBusy(false);if(r.error){setError(r.error.message||'No se pudo registrar la venta.');return}close();location.reload()};return <div className="formgrid"><div className="notice"><b>{f.product?.name||'Producto'}</b> · {f.variant?.size||'Único'}<br/>Precio unitario: <b>{money(f.variant?.price)}</b> · Stock disponible: <b>{f.variant?.stock}</b></div><Select label="Deportista (opcional)" value={f.athlete_id} set={(v:string)=>setF({...f,athlete_id:v})} options={data.athletes.map((a:Row)=>[a.id,a.full_name])}/><label>Cantidad<input type="number" min="1" max={f.variant?.stock||1} value={f.qty??''} onChange={e=>setF({...f,qty:e.target.value})}/></label><Select label="Método" value={f.method||'cash'} set={(v:string)=>setF({...f,method:v})} options={methods}/>{error&&<div className="error">{error}</div>}<button disabled={busy||!qtyValid||qty>Number(f.variant?.stock||0)} onClick={sell}>{busy?'Registrando…':'Confirmar venta · '+money(Number(f.variant?.price||0)*qty)}</button></div>}

function Stock({f,setF,close}:any){return <div className="formgrid"><p>Stock actual: <b>{f.variant?.stock}</b></p><label>Ajuste (+/-)<input type="number" value={f.quantity??''} onChange={e=>setF({...f,quantity:e.target.value})}/></label><label>Nota<input value={f.notes||''} onChange={e=>setF({...f,notes:e.target.value})}/></label><button onClick={async()=>{const next=Number(f.variant.stock)+Number(f.quantity||0);if(next<0)return alert('El stock no puede quedar negativo');const a=await supabase.from('product_variants').update({stock:next}).eq('id',f.variant.id);if(a.error)return alert(a.error.message);const mv=await supabase.from('inventory_movements').insert({variant_id:f.variant.id,quantity:Number(f.quantity||0),movement_type:'adjustment',notes:f.notes||null});if(mv.error)return alert(mv.error.message);close();location.reload()}}>Aplicar ajuste</button></div>}

function ProductForm({f,setF,close}:any){const up=(i:number,k:string,v:any)=>{const vs=[...f.variants];vs[i]={...vs[i],[k]:v};setF({...f,variants:vs})};const [uploading,setUploading]=useState(false);const [imagePreview,setImagePreview]=useState(f.image_url||'');const chooseImage=async(file:File|null)=>{if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))return alert('Solo se permiten imágenes JPG, PNG o WebP.');if(file.size>5*1024*1024)return alert('La imagen no puede superar 5 MB.');setUploading(true);const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';const path=`products/${crypto.randomUUID()}.${ext}`;const up=await supabase.storage.from('product-images').upload(path,file,{contentType:file.type,upsert:false});if(up.error){setUploading(false);return alert(up.error.message)}const pub=supabase.storage.from('product-images').getPublicUrl(path);setF({...f,image_path:path,image_url:pub.data.publicUrl});setImagePreview(URL.createObjectURL(file));setUploading(false)};return <div className="formgrid"><label>Nombre<input value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></label><label>SKU<input value={f.sku||''} onChange={e=>setF({...f,sku:e.target.value})}/></label><label>Descripción<textarea value={f.description||''} onChange={e=>setF({...f,description:e.target.value})}/></label><label>Imagen de referencia<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>chooseImage(e.target.files?.[0]||null)}/></label>{imagePreview&&<div className="product-image-preview"><img src={imagePreview} alt="Vista previa del producto"/><button type="button" onClick={()=>{setF({...f,image_path:'',image_url:''});setImagePreview('')}}>Quitar imagen</button></div>}<h3>Variantes</h3>{f.variants.map((v:any,i:number)=><div className="variantform" key={i}><label>Talla<input value={v.size||''} onChange={e=>up(i,'size',e.target.value)}/></label><label>Precio<input type="number" min="0" value={v.price??''} onChange={e=>up(i,'price',e.target.value)}/></label><label>Cantidad / stock<input type="number" min="0" value={v.stock??''} onChange={e=>up(i,'stock',e.target.value)}/></label><button type="button" onClick={()=>setF({...f,variants:f.variants.filter((_:any,j:number)=>j!==i)})}>×</button></div>)}<button type="button" onClick={()=>setF({...f,variants:[...f.variants,{size:'',price:'',stock:''}]})}>+ Variante</button><button disabled={uploading} onClick={async()=>{if(!f.name?.trim())return alert('El nombre es obligatorio');const valid=f.variants.filter((v:any)=>v.size?.trim()||v.price!==''||v.stock!=='');if(!valid.length)return alert('Agrega al menos una variante con datos.');const p=await supabase.from('products').insert({name:f.name.trim(),sku:f.sku?.trim()||null,description:f.description?.trim()||null,image_path:f.image_path||null,image_url:f.image_url||null,active:true}).select().single();if(p.error)return alert(p.error.message);const vs=valid.map((v:any)=>({product_id:p.data.id,size:v.size?.trim()||null,price:Number(v.price||0),stock:Number(v.stock||0)}));const vr=await supabase.from('product_variants').insert(vs);if(vr.error)return alert(vr.error.message);close();location.reload()}}>{uploading?'Subiendo imagen…':'Guardar producto'}</button></div>}


function StaffForm({f,setF,close}:any){const unit=f.rate_type==='hourly'?'horas':f.rate_type==='session'?'sesiones':f.rate_type==='monthly'?'meses':'unidades';const singular=f.rate_type==='hourly'?'hora':f.rate_type==='session'?'sesión':f.rate_type==='monthly'?'mes': 'unidad';return <div className="formgrid"><label>Nombre completo<input value={f.full_name||''} onChange={e=>setF({...f,full_name:e.target.value})}/></label><label>Documento<input value={f.document_number||''} onChange={e=>setF({...f,document_number:e.target.value})}/></label><label>Teléfono<input value={f.phone||''} onChange={e=>setF({...f,phone:e.target.value})}/></label><label>Correo<input type="email" value={f.email||''} onChange={e=>setF({...f,email:e.target.value})}/></label><Select label="Rol" value={f.role} set={(v:string)=>setF({...f,role:v})} options={[['trainer','Entrenador'],['admin','Administración'],['coordinator','Coordinación'],['other','Otro']]}/><Select label="Tipo de tarifa" value={f.rate_type} set={(v:string)=>setF({...f,rate_type:v,rate_quantity:f.rate_quantity||'1'})} options={[['monthly','Mensual'],['session','Sesión'],['hourly','Hora'],['fixed','Fija']]}/><label>Tarifa por {singular}<input type="number" min="0" value={f.payment_rate??''} onChange={e=>setF({...f,payment_rate:e.target.value})}/></label><label>Cantidad de {unit}<input type="number" min="0.01" step="0.01" value={f.rate_quantity??''} onChange={e=>setF({...f,rate_quantity:e.target.value})}/></label><label>Notas<textarea value={f.notes||''} onChange={e=>setF({...f,notes:e.target.value})}/></label><button onClick={async()=>{if(!f.full_name?.trim())return alert('El nombre es obligatorio');if(Number(f.rate_quantity||0)<=0)return alert('La cantidad debe ser mayor que cero');const r=await supabase.from('staff_members').insert({...f,payment_rate:Number(f.payment_rate||0),rate_quantity:Number(f.rate_quantity||1),active:true});if(r.error)alert(r.error.message);else{close();location.reload()}}}>Guardar personal</button></div>}

function StaffPay({data,f,setF,close}:any){const staff=data.staff.find((s:Row)=>s.id===f.staff_id);const unit=f.rate_unit||((staff?.rate_type==='hourly')?'horas':staff?.rate_type==='session'?'sesiones':staff?.rate_type==='monthly'?'meses':'unidades');const rate=Number(staff?.payment_rate||0);const total=Number(f.quantity||0)*rate;return <div className="formgrid"><Select label="Personal" value={f.staff_id} set={(v:string)=>{const s=data.staff.find((x:Row)=>x.id===v);const u=s?.rate_type==='hourly'?'horas':s?.rate_type==='session'?'sesiones':s?.rate_type==='monthly'?'meses':'unidades';setF({...f,staff_id:v,quantity:String(s?.rate_quantity||1),rate_unit:u,amount:String(Number(s?.payment_rate||0)*Number(s?.rate_quantity||1))})}} options={data.staff.map((s:Row)=>[s.id,s.full_name])}/><label>Cantidad de {unit}<input type="number" min="0.01" step="0.01" value={f.quantity??''} onChange={e=>setF({...f,quantity:e.target.value,amount:String(Number(e.target.value||0)*rate)})}/></label><label>Valor total<input type="number" min="0" value={f.amount??''} onChange={e=>setF({...f,amount:e.target.value})}/></label><label>Inicio<input type="date" value={f.period_start||''} onChange={e=>setF({...f,period_start:e.target.value})}/></label><label>Fin<input type="date" value={f.period_end||''} onChange={e=>setF({...f,period_end:e.target.value})}/></label><label>Concepto<input value={f.concept||''} onChange={e=>setF({...f,concept:e.target.value})}/></label><Select label="Método" value={f.method||'transfer'} set={(v:string)=>setF({...f,method:v})} options={methods}/><button onClick={async()=>{if(!f.staff_id)return alert('Selecciona el personal');if(Number(f.quantity||0)<=0)return alert('La cantidad debe ser mayor que cero');const r=await supabase.rpc('record_staff_payment',{p_staff_id:f.staff_id,p_amount:Number(f.amount||0),p_period_start:f.period_start,p_period_end:f.period_end,p_concept:f.concept||'Honorarios',p_method:f.method||'transfer',p_quantity:Number(f.quantity||1)});if(r.error)alert(r.error.message);else{close();location.reload()}}}>Registrar pago</button></div>}

function Login({base}:{base:string}){const[e,setE]=useState(''),[p,setP]=useState(''),[m,setM]=useState('');return <div className="login"><div className="loginbox"><div className="brand brand-lg brand-text">RIVER</div><p>Club OS · gestión integral</p><input autoComplete="email" placeholder="Correo" value={e} onChange={x=>setE(x.target.value)}/><input autoComplete="current-password" placeholder="Contraseña" type="password" value={p} onChange={x=>setP(x.target.value)}/><button onClick={async()=>{const r=await supabase.auth.signInWithPassword({email:e,password:p});setM(r.error?.message||'')}}>Ingresar</button>{m&&<small className="error">{m}</small>}</div></div>}


function Teams({data,canManage,onEdit}:any){return <><div className="grid2"><section><div className="sectionhead"><div><h2>Categorías</h2><small>Las categorías pertenecen al club activo.</small></div>{canManage&&<button onClick={async()=>{const name=prompt('Nombre de la categoría');if(name?.trim()){const r=await supabase.from('categories').insert({name:name.trim(),active:true});if(r.error)alert(r.error.message);else location.reload()}}}>+ Categoría</button>}</div><Table head={['Categoría','Rango','Activa','Acción']} rows={data.categories.map((c:Row)=>[c.name,c.min_age||c.max_age?(String(c.min_age||'')+'–'+String(c.max_age||'')):'—',c.active?'Sí':'No',canManage&&c.active?<button onClick={async()=>{if(!confirm('¿Eliminar esta categoría? Si tiene deportistas o equipos será archivada para conservar el historial.'))return;const r=await supabase.rpc('delete_category',{p_id:c.id});if(r.error)return alert(r.error.message);alert(r.data==='deleted'?'Categoría eliminada.':'Categoría archivada porque tiene historial.');location.reload()}}>Eliminar</button>:null])}/></section><section><div className="sectionhead"><h2>Equipos</h2></div><Table head={['Equipo','Categoría','Entrenador','Horario','Activo','Acción']} rows={data.teams.map((t:Row)=>[t.name,data.categories.find((c:Row)=>c.id===t.category_id)?.name||'—',data.staff.find((s:Row)=>s.id===t.coach_id)?.full_name||'—',t.training_schedule||'—',t.active?'Sí':'No',canManage?<button onClick={()=>onEdit(t)}>Editar</button>:null])}/></section></div></>}

function TeamForm({data,f,setF,close}:any){return <div className="formgrid"><label>Nombre<input value={f.name||''} onChange={e=>setF({...f,name:e.target.value})}/></label><Select label="Categoría" value={f.category_id} set={(v:string)=>setF({...f,category_id:v||null})} options={data.categories.map((c:Row)=>[c.id,c.name])}/><Select label="Entrenador" value={f.coach_id} set={(v:string)=>setF({...f,coach_id:v||null})} options={data.staff.filter((s:Row)=>s.active).map((s:Row)=>[s.id,s.full_name])}/><label>Horario<input placeholder="Lun/Mié 18:00–20:00" value={f.training_schedule||''} onChange={e=>setF({...f,training_schedule:e.target.value})}/></label><label>Activo<select value={String(f.active??true)} onChange={e=>setF({...f,active:e.target.value==='true'})}><option value="true">Sí</option><option value="false">No</option></select></label><button onClick={async()=>{if(!f.name?.trim())return alert('El nombre es obligatorio');const payload={name:f.name.trim(),category_id:f.category_id||null,coach_id:f.coach_id||null,training_schedule:f.training_schedule?.trim()||null,active:f.active!==false};const r=f.id?await supabase.from('teams').update(payload).eq('id',f.id):await supabase.from('teams').insert(payload);if(r.error)alert(r.error.message);else{close();location.reload()}}}>Guardar equipo</button></div>}

function SessionForm({data,f,setF,close}:any){return <div className="formgrid"><Select label="Equipo" value={f.team_id} set={(v:string)=>setF({...f,team_id:v||null})} options={data.teams.filter((t:Row)=>t.active).map((t:Row)=>[t.id,t.name])}/><Select label="Entrenador" value={f.coach_id} set={(v:string)=>setF({...f,coach_id:v||null})} options={data.staff.filter((s:Row)=>s.active).map((s:Row)=>[s.id,s.full_name])}/><label>Fecha<input type="date" value={f.session_date||today()} onChange={e=>setF({...f,session_date:e.target.value})}/></label><label>Inicio<input type="time" value={f.start_time||''} onChange={e=>setF({...f,start_time:e.target.value})}/></label><label>Fin<input type="time" value={f.end_time||''} onChange={e=>setF({...f,end_time:e.target.value})}/></label><label>Cancha / lugar<input value={f.location||''} onChange={e=>setF({...f,location:e.target.value})}/></label><label>Descripción / detalles<textarea placeholder="Ej.: 25 personas, llevar balones, hidratación, uniforme, logística, observaciones..." value={f.description||''} onChange={e=>setF({...f,description:e.target.value})}/></label><label>Notas<textarea value={f.notes||''} onChange={e=>setF({...f,notes:e.target.value})}/></label><button onClick={async()=>{const r=await supabase.from('training_sessions').insert({team_id:f.team_id||null,coach_id:f.coach_id||null,session_date:f.session_date||today(),start_time:f.start_time||null,end_time:f.end_time||null,location:f.location||null,description:f.description?.trim()||null,notes:f.notes||null,status:'scheduled'});if(r.error)alert(r.error.message);else{close();location.reload()}}}>Crear entrenamiento</button></div>}

function Attendance({data,onMark}:any){return <section><div className="sectionhead"><div><h2>Sesiones de entrenamiento</h2><small>Marca asistencia por sesión y conserva el historial.</small></div></div><Table head={['Fecha','Equipo','Entrenador','Horario','Lugar','Descripción','Estado','Acción']} rows={data.sessions.map((s:Row)=>[s.session_date,data.teams.find((t:Row)=>t.id===s.team_id)?.name||'—',data.staff.find((x:Row)=>x.id===s.coach_id)?.full_name||'—',(s.start_time||'')+(s.end_time?' → '+s.end_time:''),s.location||'—',s.description||'—',s.status,<button onClick={()=>onMark(s)}>Pasar lista</button>])}/><h2>Resumen por deportista</h2><AttendanceSummary data={data}/></section>}

function AttendanceSummary({data}:any){
 const rows=data.athletes.map((a:Row)=>{
  const records=data.attendance.filter((x:Row)=>x.athlete_id===a.id)
  const total=records.length
  const present=records.filter((x:Row)=>x.status==='present').length
  const late=records.filter((x:Row)=>x.status==='late').length
  const excused=records.filter((x:Row)=>x.status==='excused').length
  const absent=records.filter((x:Row)=>x.status==='absent').length
  const denominator=total-excused
  const percentage=denominator>0?Math.round(((present+late)/denominator)*100)+'%':'—'
  return [a.full_name,present,late,absent,excused,percentage]
 })
 return <Table head={['Deportista','Presentes','Tardanzas','Ausencias','Justificadas','% asistencia']} rows={rows}/>
}

function AttendanceForm({data,f,close}:any){
 const [rows,setRows]=useState<Row[]>([])
 useEffect(()=>{supabase.from('attendance').select('*').eq('session_id',f.session.id).then(({data:d})=>setRows(d||[]))},[f.session.id])
 const team=data.teams.find((t:Row)=>t.id===f.session.team_id)
 const athletes=data.athletes.filter((a:Row)=>a.team_id===team?.id || (!a.team_id&&a.team===team?.name))
 async function mark(a:Row,status:string){
  const user=(await supabase.auth.getUser()).data.user
  const r=await supabase.from('attendance').upsert({session_id:f.session.id,athlete_id:a.id,status,marked_by:user?.id},{onConflict:'session_id,athlete_id'})
  if(r.error) alert(r.error.message)
  else setRows((current)=>[...current.filter((x:Row)=>x.athlete_id!==a.id),{athlete_id:a.id,status}])
 }
 return <div className="formgrid">
  {athletes.length ? athletes.map((a:Row)=>{
   const current=rows.find((x:Row)=>x.athlete_id===a.id)?.status||'present'
   return <label key={a.id}>{a.full_name}<select value={current} onChange={(e)=>mark(a,e.target.value)}>
    <option value="present">Presente</option><option value="late">Tarde</option><option value="absent">Ausente</option><option value="excused">Justificada</option>
   </select></label>
  }) : <Empty text="Este equipo no tiene deportistas asignados. Asigna el equipo desde la ficha del deportista."/>}
  <button onClick={close}>Cerrar</button>
 </div>
}

function Arrears({data}:any){const due=data.arrears.filter((x:Row)=>Number(x.amount_due)>0);const total=due.reduce((n:number,x:Row)=>n+Number(x.amount_due),0);return <><div className="stats three"><Card n={money(total)} l="Cartera pendiente"/><Card n={due.filter((x:Row)=>x.debt_status==='overdue').length} l="Membresías vencidas con deuda"/><Card n={due.filter((x:Row)=>x.debt_status==='pending').length} l="Pendientes actuales"/></div><Table head={['Deportista','Plan','Esperado','Pagado','Deuda','Vence','Días atraso','Estado']} rows={due.map((x:Row)=>[x.full_name,x.plan_name,money(x.expected_amount),money(x.amount_paid),money(x.amount_due),x.end_date,x.days_overdue,x.debt_status])}/></>}

function Reports({data,range,setRange}:any){const inRange=(d:string)=>d&&d.slice(0,10)>=range.from&&d.slice(0,10)<=range.to;const payments=data.payments.filter((p:Row)=>p.status==='confirmed'&&inRange(p.paid_at||p.created_at));const staff=data.staffPayments.filter((p:Row)=>p.status==='confirmed'&&inRange(p.paid_at||p.created_at));const sales=data.sales.filter((s:Row)=>inRange(s.created_at));const income=payments.reduce((n:number,p:Row)=>n+Number(p.amount||0),0);const payroll=staff.reduce((n:number,p:Row)=>n+Number(p.amount||0),0);const productIncome=sales.reduce((n:number,s:Row)=>n+Number(s.total||0),0);const exportCsv=()=>{const rows=[['Reporte','RIVER Volleyball Club'],['Desde',range.from],['Hasta',range.to],[],['Indicador','Valor'],['Ingresos confirmados',income],['Ventas de productos',productIncome],['Pagos a personal',payroll],['Cartera pendiente',data.arrears.reduce((n:number,x:Row)=>n+Number(x.amount_due||0),0)]];const csv=rows.map((r:any)=>r.map((v:any)=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='river-reporte-'+range.from+'-'+range.to+'.csv';a.click()};return <><section><div className="reportcontrols"><label>Desde<input type="date" value={range.from} onChange={e=>setRange({...range,from:e.target.value})}/></label><label>Hasta<input type="date" value={range.to} onChange={e=>setRange({...range,to:e.target.value})}/></label><button onClick={exportCsv}>Exportar CSV</button><button onClick={()=>window.print()}>Imprimir / PDF</button></div></section><div className="stats"><Card n={money(income)} l="Ingresos confirmados"/><Card n={money(productIncome)} l="Ventas productos"/><Card n={money(payroll)} l="Pagos a personal"/><Card n={money(income-payroll)} l="Flujo neto registrado"/></div><div className="grid2"><section><h2>Ingresos por concepto</h2><Table head={['Concepto','Valor']} rows={['registration','membership','product'].map((c:string)=>[c,money(payments.filter((p:Row)=>p.concept===c).reduce((n:number,p:Row)=>n+Number(p.amount),0))])}/></section><section><h2>Estado de cartera</h2><Table head={['Estado','Casos','Valor']} rows={['pending','overdue','paid'].map((s:string)=>[s,data.arrears.filter((x:Row)=>x.debt_status===s).length,money(data.arrears.filter((x:Row)=>x.debt_status===s).reduce((n:number,x:Row)=>n+Number(x.amount_due),0))])}/></section></div></>}

function Settings({data,load,role}:any){
 const s=data.settings||{}
 const currentClub=(data.clubs||[]).find((c:Row)=>c.id===s.club_id)||{}
 const [f,setF]=useState({club_name:currentClub.name||s.club_name||'NEXOSPORT CLUB',currency:s.currency||'COP',locale:s.locale||'es-CO',reminder_days:s.reminder_days??7,payment_methods:(s.payment_methods||['cash','transfer','card','other']).join(', '),templates:JSON.stringify(s.communication_templates||{},null,2),logo_path:s.logo_path||'',logo_url:s.logo_url||''})
 const [users,setUsers]=useState<Row[]>([])
 const [ownedClubIds,setOwnedClubIds]=useState<string[]>([])
 const [u,setU]=useState({full_name:'',email:'',password:'',role:'staff'})
 const [umsg,setUmsg]=useState('')
 useEffect(()=>{
  ;(async()=>{
   const user=(await supabase.auth.getUser()).data.user
   if(user){
    const m=await supabase.from('club_memberships').select('club_id').eq('user_id',user.id).eq('role','owner').eq('active',true)
    setOwnedClubIds((m.data||[]).map((x:Row)=>x.club_id))
   }
   const x=await supabase.functions.invoke('admin-users',{body:{action:'list'}})
   if(x.error)setUmsg(x.error.message);else setUsers(x.data?.users||[])
  })()
 },[])
 const [logoBusy,setLogoBusy]=useState(false)
 const [logoMsg,setLogoMsg]=useState({text:'',error:false})
 const uploadLogo=async(file:File|null)=>{
  if(!file)return
  setLogoMsg({text:'',error:false})
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setLogoMsg({text:'Formato no válido. Selecciona JPG, PNG o WebP.',error:true});return}
  if(file.size>2*1024*1024){setLogoMsg({text:'El logo no puede superar 2 MB.',error:true});return}
  if(!s.club_id){setLogoMsg({text:'No se encontró el club activo. Recarga la página y vuelve a intentarlo.',error:true});return}
  setLogoBusy(true)
  try{
   const path=s.club_id+'/logo'
   const up=await supabase.storage.from('club-logos').upload(path,file,{contentType:file.type,upsert:true,cacheControl:'0'})
   if(up.error)throw up.error
   const pub=supabase.storage.from('club-logos').getPublicUrl(path)
   const logoUrl=pub.data.publicUrl+'?v='+Date.now()
   const r=await supabase.from('club_settings').update({logo_path:path,logo_url:logoUrl,updated_at:new Date().toISOString()}).eq('club_id',s.club_id).select('club_id').maybeSingle()
   if(r.error)throw r.error
   if(!r.data)throw new Error('La imagen se cargó, pero no se pudo asociar al club. Verifica que sigas en el club correcto y que tengas permisos de administrador.')
   setF((x:any)=>({...x,logo_path:path,logo_url:logoUrl}))
   setLogoMsg({text:'Logo actualizado correctamente.',error:false})
   await load()
  }catch(err:any){
   const detail=String(err?.message||'Error desconocido')
   setLogoMsg({text:'No se pudo subir el logo: '+detail,error:true})
  }finally{setLogoBusy(false)}
 }
 const removeLogo=async()=>{
  if(!s.club_id||!f.logo_path)return
  if(!confirm('¿Quitar el logo de este club?'))return
  setLogoBusy(true)
  const r=await supabase.storage.from('club-logos').remove([f.logo_path])
  if(r.error){setLogoBusy(false);return alert(r.error.message)}
  const db=await supabase.from('club_settings').update({logo_path:null,logo_url:null,updated_at:new Date().toISOString()}).eq('club_id',s.club_id)
  if(db.error){setLogoBusy(false);return alert(db.error.message)}
  setF((x:any)=>({...x,logo_path:'',logo_url:''}))
  setLogoBusy(false)
  load()
 }
 const saveIdentity=async()=>{
  const club=(data.clubs||[]).find((c:Row)=>c.id===s.club_id)
  if(!club)return alert('No se encontró el club activo.')
  const name=f.club_name.trim()
  if(!name)return alert('El nombre del club es obligatorio.')
  const r=await supabase.rpc('rename_club',{p_club_id:s.club_id,p_name:name,p_slug:String(club.slug||'').trim(),p_active:club.active!==false})
  if(r.error)return alert(r.error.message)
  alert('Identidad del club actualizada.')
  load()
 }
 const save=async()=>{
  let templates:any={}
  try{templates=JSON.parse(f.templates||'{}')}catch{return alert('Las plantillas deben ser JSON válido.')}
  const user=(await supabase.auth.getUser()).data.user
  const club=(data.clubs||[]).find((c:Row)=>c.id===s.club_id)
  if(!club)return alert('No se encontró el club activo.')
  const clubUpdate=await supabase.rpc('rename_club',{p_club_id:s.club_id,p_name:f.club_name.trim(),p_slug:String(club.slug||'').trim(),p_active:club.active!==false})
  if(clubUpdate.error)return alert(clubUpdate.error.message)
  const r=await supabase.from('club_settings').upsert({club_id:s.club_id,club_name:f.club_name.trim(),currency:f.currency.toUpperCase(),locale:f.locale,reminder_days:Number(f.reminder_days),payment_methods:f.payment_methods.split(',').map((x:string)=>x.trim()).filter(Boolean),communication_templates:templates,updated_by:user?.id,updated_at:new Date().toISOString()})
  if(r.error)alert(r.error.message);else{alert('Configuración guardada');load()}
 }
 const create=async()=>{setUmsg('');const r=await supabase.functions.invoke('admin-users',{body:{action:'create',...u}});if(r.error||r.data?.error)setUmsg(r.error?.message||r.data?.error||'No se pudo crear');else{setU({full_name:'',email:'',password:'',role:'staff'});const x=await supabase.functions.invoke('admin-users',{body:{action:'list'}});setUsers(x.data?.users||[])}}
 const changeRole=async(id:string,value:string)=>{const r=await supabase.functions.invoke('admin-users',{body:{action:'role',id,role:value}});if(r.error||r.data?.error)return setUmsg(r.error?.message||r.data?.error);const x=await supabase.functions.invoke('admin-users',{body:{action:'list'}});setUsers(x.data?.users||[])}
 const deleteClub=async(club:Row)=>{
  if(!confirm('¿Eliminar este club? Se conservarán sus datos históricos, pero el club quedará inactivo y su suscripción será cancelada.'))return
  const r=await supabase.rpc('delete_club',{p_id:club.id})
  if(r.error)return alert(r.error.message)
  alert('Club eliminado (archivado) correctamente.')
  load()
 }
 const ownedClubs=(data.clubs||[]).filter((c:Row)=>ownedClubIds.includes(c.id))
 return <><section><div className="sectionhead"><div><h2>Identidad del club</h2><small>Nombre y logo visibles en la cabecera y en los comprobantes del club.</small></div><button onClick={saveIdentity}>Guardar identidad</button></div><div className="formgrid"><label>Nombre del club<input value={f.club_name} onChange={e=>setF({...f,club_name:e.target.value})}/></label><label>Logo del club<input type="file" accept="image/jpeg,image/png,image/webp" disabled={logoBusy} onChange={e=>{const file=e.target.files?.[0]||null;e.currentTarget.value="";void uploadLogo(file)}}/></label>{logoMsg.text&&<small className={logoMsg.error?"error":"muted"} role="status">{logoMsg.text}</small>}{logoBusy&&<small className="muted" role="status">Subiendo y guardando el logo…</small>}{f.logo_url&&<div className="club-logo-settings"><img src={f.logo_url} alt="Logo actual del club"/><div><span className="muted">Logo actual</span><button type="button" disabled={logoBusy} onClick={removeLogo}>Quitar logo</button></div></div>}<small className="muted">JPG, PNG o WebP · máximo 2 MB. El logo se almacena separado por club y solo owner/admin puede modificarlo.</small></div></section>
 <section><div className="sectionhead"><div><h2>Configuración general</h2><small>Moneda, localización, avisos y plantillas de comunicación.</small></div><button onClick={save}>Guardar cambios</button></div><div className="formgrid"><label>Moneda<input value={f.currency} onChange={e=>setF({...f,currency:e.target.value.toUpperCase()})}/></label><label>Localización<input value={f.locale} onChange={e=>setF({...f,locale:e.target.value})}/></label><label>Días de aviso de vencimiento<input type="number" min="0" max="30" value={f.reminder_days??''} onChange={e=>setF({...f,reminder_days:e.target.value})}/></label><label>Métodos de pago (separados por coma)<input value={f.payment_methods} onChange={e=>setF({...f,payment_methods:e.target.value})}/></label><label>Plantillas de comunicación (JSON)<textarea value={f.templates} onChange={e=>setF({...f,templates:e.target.value})}/></label></div></section>
 {role==='owner'&&<section><div className="sectionhead"><div><h2>Mis clubes</h2><small>Un owner puede archivar clubes que administra. El club activo debe cambiarse antes de eliminarlo.</small></div></div><Table head={['Club','Estado','Acción']} rows={ownedClubs.map((c:Row)=>[c.name,c.active?'Activo':'Inactivo',c.id===s.club_id?<span className="muted">Club activo · cambia de club para eliminarlo</span>:<button onClick={()=>deleteClub(c)}>Eliminar club</button>])}/></section>}
 <section><div className="sectionhead"><div><h2>Usuarios y roles</h2><small>Crear usuarios y asignar permisos del club.</small></div></div><div className="formgrid"><label>Nombre<input value={u.full_name} onChange={e=>setU({...u,full_name:e.target.value})}/></label><label>Correo<input type="email" value={u.email} onChange={e=>setU({...u,email:e.target.value})}/></label><label>Contraseña temporal (mín. 8 caracteres)<input type="password" value={u.password} onChange={e=>setU({...u,password:e.target.value})}/></label><Select label="Rol" value={u.role} set={(v:string)=>setU({...u,role:v})} options={[['staff','Staff'],['admin','Administrador'],['owner','Owner']]}/><button onClick={create}>Crear usuario</button>{umsg&&<div className="error">{umsg}</div>}</div><Table head={['Nombre','Correo','Rol','Último acceso']} rows={users.map((x:Row)=>[x.full_name||'—',x.email||'—',<select value={x.role} onChange={e=>changeRole(x.id,e.target.value)}><option value="staff">Staff</option><option value="admin">Admin</option><option value="owner">Owner</option></select>,x.last_sign_in_at?.slice(0,10)||'Nunca'])}/></section></>
}

function PlatformBilling({data,load}:any){
 const [editing,setEditing]=useState<Row|null>(null)
 const [editingClub,setEditingClub]=useState<Row|null>(null)
 const [payment,setPayment]=useState<Row|null>(null)
 const [saving,setSaving]=useState(false)
 const [msg,setMsg]=useState('')
 const [receipt,setReceipt]=useState<Row|null>(null)
 const clubs=data.clubs||[]
 const subs=data.saasSubscriptions||[]
 const payments=data.saasPayments||[]
 const statusLabel=(s:string)=>({trial:'Prueba',active:'Activo',past_due:'Vencido',suspended:'Suspendido',cancelled:'Cancelado'}[s]||s)
 const days=(s:string)=>daysLeft(s)
 const saveClub=async()=>{
  if(!editingClub)return
  setSaving(true);setMsg('')
  const r=await supabase.rpc('rename_club',{p_club_id:editingClub.id,p_name:String(editingClub.name||'').trim(),p_slug:String(editingClub.slug||'').trim(),p_active:editingClub.active!==false})
  setSaving(false)
  if(r.error){setMsg(r.error.message);return}
  setEditingClub(null);load()
 }
 const save=async()=>{
  if(!editing)return
  setSaving(true);setMsg('')
  const r=await supabase.from('saas_subscriptions').update({
   monthly_price:Number(editing.monthly_price||0),
   billing_cycle:editing.billing_cycle||'monthly',
   current_period_start:editing.current_period_start,
   current_period_end:editing.current_period_end,
   status:editing.status||'active',
   auto_renew:editing.auto_renew!==false,
   notes:editing.notes||null,
   updated_at:new Date().toISOString()
  }).eq('club_id',editing.club_id)
  setSaving(false)
  if(r.error){setMsg(r.error.message);return}
  setEditing(null);load()
 }
 const recordPayment=async()=>{
  if(!payment)return
  const amount=Number(payment.amount||0)
  if(amount<=0)return setMsg('El valor del pago debe ser mayor que cero.')
  setSaving(true);setMsg('')
  const r=await supabase.from('saas_payments').insert({
   club_id:payment.club_id,
   subscription_period_start:payment.subscription_period_start,
   subscription_period_end:payment.subscription_period_end,
   amount,
   paid_at:payment.paid_at||new Date().toISOString(),
   method:payment.method||'transfer',
   notes:payment.notes||null,
   created_by:(await supabase.auth.getUser()).data.user?.id
  })
  setSaving(false)
  if(r.error){setMsg(r.error.message);return}
  setPayment(null);load()
 }
 return <section>
  <div className="sectionhead"><div><h2>Suscripciones de clubes</h2><small>Control de cobro del software por cada club, independiente de la caja del club.</small></div></div>
  {msg&&<div className="error">{msg}</div>}
  <div className="stats three">
   <Card n={clubs.length} l="Clubes"/>
   <Card n={subs.filter((s:Row)=>s.status==='active').length} l="Suscripciones activas"/>
   <Card n={subs.filter((s:Row)=>s.current_period_end<today()||s.status==='past_due').length} l="Pendientes de cobro"/>
  </div>
  <Table head={['Club','Plan','Valor mensual','Periodo actual','Vence','Estado','Acciones']} rows={clubs.map((club:Row)=>{
   const s=subs.find((x:Row)=>x.club_id===club.id)
   if(!s)return [club.name,'—','—','—','—','Sin suscripción',<button onClick={()=>setEditing({club_id:club.id,monthly_price:100000,billing_cycle:'monthly',current_period_start:today(),current_period_end:addDays(today(),30),status:'active',auto_renew:true,notes:''})}>Configurar</button>]
   const d=days(s.current_period_end)
   const state=s.status==='active'&&d<0?'past_due':s.status
   return [club.name,'Mensual',money(s.monthly_price),s.current_period_start+' → '+s.current_period_end,<span className={d<=7?'warn':''}>{d<0?'Vencido':d===0?'Vence hoy':'Faltan '+d+' días'}</span>,statusLabel(state),<div className="actions"><button onClick={()=>setEditingClub({...club})}>Editar club</button><button onClick={()=>setEditing({...s})}>Editar suscripción</button><button onClick={async()=>{if(!confirm('¿Desactivar este club? Sus datos históricos se conservarán y su suscripción se cancelará.'))return;const r=await supabase.rpc('delete_club',{p_id:club.id});if(r.error)return alert(r.error.message);alert('Club desactivado');load()}}>Eliminar</button><button onClick={()=>setPayment({club_id:s.club_id,subscription_period_start:s.current_period_start,subscription_period_end:s.current_period_end,amount:String(s.monthly_price),method:'transfer',paid_at:new Date().toISOString().slice(0,16)})}>Registrar pago</button></div>]
  })}/>
  {editingClub&&<Modal title={'Editar club · '+(editingClub.name||'Club')} close={()=>setEditingClub(null)}><div className="formgrid">
   <label>Nombre del club<input value={editingClub.name||''} onChange={e=>setEditingClub({...editingClub,name:e.target.value})}/></label>
   <label>Slug<input value={editingClub.slug||''} onChange={e=>setEditingClub({...editingClub,slug:e.target.value})}/></label>
   <label>Estado<select value={String(editingClub.active!==false)} onChange={e=>setEditingClub({...editingClub,active:e.target.value==='true'})}><option value="true">Activo</option><option value="false">Inactivo</option></select></label>
   <small className="muted">El nombre se sincroniza con la configuración del club para evitar que aparezcan nombres diferentes en distintas partes del sistema.</small>
   <button disabled={saving} onClick={saveClub}>{saving?'Guardando…':'Guardar cambios del club'}</button>
  </div></Modal>}
  {editing&&<Modal title={'Configurar suscripción · '+(clubs.find((c:Row)=>c.id===editing.club_id)?.name||'Club')} close={()=>setEditing(null)}><div className="formgrid">
   <label>Valor mensual<input type="number" min="0" value={editing.monthly_price??''} onChange={e=>setEditing({...editing,monthly_price:e.target.value})}/></label>
   <Select label="Ciclo de cobro" value={editing.billing_cycle||'monthly'} set={(v:string)=>setEditing({...editing,billing_cycle:v})} options={[['monthly','Mensual'],['quarterly','Trimestral'],['annual','Anual']]}/>
   <label>Inicio del periodo<input type="date" value={editing.current_period_start||''} onChange={e=>setEditing({...editing,current_period_start:e.target.value})}/></label>
   <label>Fin del periodo<input type="date" value={editing.current_period_end||''} onChange={e=>setEditing({...editing,current_period_end:e.target.value})}/></label>
   <Select label="Estado" value={editing.status||'active'} set={(v:string)=>setEditing({...editing,status:v})} options={[['trial','Prueba'],['active','Activo'],['past_due','Vencido'],['suspended','Suspendido'],['cancelled','Cancelado']]}/>
   <label>Renovación automática<select value={String(editing.auto_renew!==false)} onChange={e=>setEditing({...editing,auto_renew:e.target.value==='true'})}><option value="true">Sí</option><option value="false">No</option></select></label>
   <label>Notas<textarea value={editing.notes||''} onChange={e=>setEditing({...editing,notes:e.target.value})}/></label>
   <button disabled={saving} onClick={save}>{saving?'Guardando…':'Guardar suscripción'}</button>
  </div></Modal>}
  {payment&&<Modal title={'Registrar pago · '+(clubs.find((c:Row)=>c.id===payment.club_id)?.name||'Club')} close={()=>setPayment(null)}><div className="formgrid">
   <label>Periodo<input value={payment.subscription_period_start+' → '+payment.subscription_period_end} readOnly/></label>
   <label>Valor recibido<input type="number" min="0.01" value={payment.amount??''} onChange={e=>setPayment({...payment,amount:e.target.value})}/></label>
   <label>Fecha de pago<input type="datetime-local" value={payment.paid_at||''} onChange={e=>setPayment({...payment,paid_at:e.target.value})}/></label>
   <Select label="Método" value={payment.method||'transfer'} set={(v:string)=>setPayment({...payment,method:v})} options={methods}/>
   
   <label>Notas<textarea value={payment.notes||''} onChange={e=>setPayment({...payment,notes:e.target.value})}/></label>
   <button disabled={saving} onClick={recordPayment}>{saving?'Registrando…':'Registrar pago'}</button>
  </div></Modal>}
  <section><h2>Historial de pagos del software</h2><Table head={['Fecha','Club','Periodo','Valor','Método','Referencia','Comprobante']} rows={payments.map((p:Row)=>[p.paid_at?.slice(0,10),clubs.find((c:Row)=>c.id===p.club_id)?.name||'—',p.subscription_period_start+' → '+p.subscription_period_end,money(p.amount),p.method||'—',p.reference||'—',<button onClick={()=>setReceipt({record:p,party:clubs.find((c:Row)=>c.id===p.club_id)?.name,concept:'Suscripción SaaS NEXOSPORT CLUB',period:p.subscription_period_start+' → '+p.subscription_period_end,club:'NEXOSPORT CLUB'})}>Recibo</button>])}/></section>
  {receipt&&<Receipt {...receipt} onClose={()=>setReceipt(null)}/>} 
 </section>
}

function ClubSwitcher({onSwitched}:{onSwitched:()=>void}){const [clubs,setClubs]=useState<Row[]>([]),[active,setActive]=useState('');useEffect(()=>{(async()=>{const u=await supabase.auth.getUser();const p=await supabase.from('profiles').select('active_club_id').eq('id',u.data.user?.id||'').maybeSingle();setActive(p.data?.active_club_id||'');const m=await supabase.from('club_memberships').select('club_id').eq('user_id',u.data.user?.id||'').eq('active',true);const ids=(m.data||[]).map((x:Row)=>x.club_id);if(ids.length){const cs=await supabase.from('clubs').select('id,name').in('id',ids);setClubs(cs.data||[])}})()},[]);if(!clubs.length)return null;const change=async(id:string)=>{if(id===active)return;const r=await supabase.rpc('switch_club',{p_club_id:id});if(r.error)return alert(r.error.message);setActive(id);onSwitched();location.reload()};return <select aria-label="Club activo" value={active} onChange={e=>change(e.target.value)}>{clubs.map((c:Row)=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}

