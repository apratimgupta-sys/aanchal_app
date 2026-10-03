import {DurableObject} from 'cloudflare:workers';
import type {RevisionEvent} from '../shared/types';
export class DashboardHub extends DurableObject<Env>{
 async fetch(request:Request){if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});const [client,server]=Object.values(new WebSocketPair());server.serializeAttachment({tokenHash:request.headers.get('x-session-hash')});this.ctx.acceptWebSocket(server);await this.ctx.storage.setAlarm(Date.now()+30000);return new Response(null,{status:101,webSocket:client});}
 private async valid(ws:WebSocket){const attachment=ws.deserializeAttachment() as {tokenHash:string};const row=await this.env.DB.prepare('SELECT token_hash FROM sessions WHERE token_hash=? AND expires_at>?').bind(attachment.tokenHash,Date.now()).first();if(!row){ws.close(1008,'Session expired');return false;}return true;}
 async publish(event:RevisionEvent){for(const ws of this.ctx.getWebSockets()){if(await this.valid(ws)){try{ws.send(JSON.stringify(event));}catch{ws.close(1011,'Reconnect');}}}}
 async webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){if(await this.valid(ws)&&message==='ping')ws.send('pong');}
 async alarm(){for(const ws of this.ctx.getWebSockets())await this.valid(ws);if(this.ctx.getWebSockets().length)await this.ctx.storage.setAlarm(Date.now()+30000);}
 webSocketClose(ws:WebSocket,code:number,reason:string){ws.close(code,reason);}
 webSocketError(ws:WebSocket){ws.close(1011,'Reconnect');}
}
