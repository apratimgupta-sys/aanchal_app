import {describe,it,expect} from 'vitest';
import {applyActivity,deriveEntryViews,validateEntry,parseMoney,summarizePeriod} from '../../src/domain/ledger';
const activity={received:2,completed:4,slaWithinTime:4,amountPaise:0,complaintsReceived:1,complaintsResolved:2,fieldReceived:0,fieldCompleted:1};
const entry={...activity,id:'a',officeId:1,version:1,reportingDate:'2026-10-01',serviceId:1,ward:'1',avgDisposalDays:2,remarks:'',createdAt:'',updatedAt:''};
describe('ledger',()=>{
 it('carries all three balances',()=>expect(applyActivity({service:10,complaints:3,field:5},activity)).toEqual({service:8,complaints:2,field:4}));
 it('recalculates through skipped dates and rejects negative later balance',()=>{
 const next={...entry,id:'b',reportingDate:'2026-10-03',received:0,completed:8,slaWithinTime:0,complaintsResolved:0,fieldCompleted:0};
 expect(deriveEntryViews({service:10,complaints:3,field:5},[entry,next])[1].opening.service).toBe(8);
 expect(()=>deriveEntryViews({service:10,complaints:3,field:5},[{...entry,completed:5},next])).toThrow('2026-10-03');
 });
 it.each([{completed:1},{received:1.2},{amountPaise:-1},{reportingDate:'2026-02-30'},{reportingDate:'2026-10-04'},{ward:''}])('rejects invalid input %j',patch=>expect(validateEntry({...entry,...patch},'2026-10-03')).not.toBeNull());
 it('parses paise exactly',()=>{expect(parseMoney('1.01')).toBe(101);expect(()=>parseMoney('1.001')).toThrow();});
 it('totals flows but takes closing stocks and handles no denominator',()=>{
 const setup={officeId:1,startDate:'2026-10-01',version:1,balances:Array.from({length:25},(_,i)=>({serviceId:i+1,opening:{service:i===0?10:0,complaints:i===0?3:0,field:i===0?5:0}}))};
 const rows=summarizePeriod([setup],[entry],{from:'2026-10-01',to:'2026-10-03'},'2026-10-03');
 expect(rows[0]).toMatchObject({pending:8,disposalPct:200,submitted:1,expected:75});
 expect(rows[1].disposalPct).toBeNull();
 expect(rows[1].expected).toBe(0);
 });
});
