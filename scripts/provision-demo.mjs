import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID,pbkdf2Sync} from 'node:crypto';
const remote=process.argv.includes('--remote');
const password=process.env.RMC_DEMO_PASSWORD;
if(!password||password.length<12)throw Error('Set RMC_DEMO_PASSWORD (12+ characters) before provisioning.');
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const services=JSON.parse(await fs.readFile('src/shared/services.json','utf8'));
const sql=services.map(s=>`INSERT INTO services(id,name) VALUES(${s.id},${quote(s.name)}) ON CONFLICT(id) DO UPDATE SET name=excluded.name;`);
for(const name of ['anchal1','anchal2','anchal3','anchal4','anchal5','anchal6','commissioner']){
 const salt=randomUUID();const hash=pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex');const office=name.startsWith('anchal')?Number(name.at(-1)):null;
 sql.push(`INSERT INTO users VALUES(${quote(name)},${quote(name)},${quote(office?'office':'commissioner')},${office??'NULL'},${quote(salt+':'+hash)}) ON CONFLICT(username) DO NOTHING;`);
}
await fs.mkdir('.wrangler',{recursive:true});const file='.wrangler/provision.sql';await fs.writeFile(file,sql.join('\n'),{mode:0o600});
try{execFileSync('node',['node_modules/wrangler/bin/wrangler.js','d1','execute','rmc-monitoring',remote?'--remote':'--local','--file',file],{stdio:'inherit',env:{...process.env,WRANGLER_LOG_PATH:'.wrangler/logs'}});}finally{await fs.unlink(file);}
console.log('Provisioned 25 services and office accounts. Existing account passwords were not changed.');
