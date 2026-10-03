import type {Setup,StoredEntry,Audit} from '../shared/types';
export class Repository {
 private db:D1DatabaseSession;
 constructor(db:D1Database){this.db=db.withSession('first-primary');}
 async getSetup(officeId:number):Promise<Setup|null>{const s=await this.db.prepare('SELECT start_date,version FROM office_setup WHERE office_id=?').bind(officeId).first<{start_date:string;version:number}>();if(!s)return null;const b=await this.db.prepare('SELECT service_id,service,complaints,field FROM initial_balances WHERE office_id=? ORDER BY service_id').bind(officeId).all<{service_id:number;service:number;complaints:number;field:number}>();return {officeId,startDate:s.start_date,version:s.version,balances:b.results.map(v=>({serviceId:v.service_id,opening:{service:v.service,complaints:v.complaints,field:v.field}}))};}
 async getEntries(officeId?:number):Promise<StoredEntry[]>{const s=officeId?this.db.prepare('SELECT data FROM daily_entries WHERE office_id=? ORDER BY reporting_date').bind(officeId):this.db.prepare('SELECT data FROM daily_entries ORDER BY reporting_date');return (await s.all<{data:string}>()).results.map(v=>JSON.parse(v.data));}
 async getSetups(){const result:Setup[]=[];for(let i=1;i<=6;i++){const s=await this.getSetup(i);if(s)result.push(s);}return result;}
 async getAudit(officeId?:number):Promise<Audit[]>{const sql='SELECT id,office_id AS officeId,actor,at,action,reason,before_data AS before,after_data AS after FROM audit_events';return (await (officeId?this.db.prepare(sql+' WHERE office_id=? ORDER BY at DESC LIMIT 200').bind(officeId):this.db.prepare(sql+' ORDER BY at DESC LIMIT 200')).all<Audit>()).results;}
}
