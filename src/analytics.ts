import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {PluginData,PluginHTTP} from '@webdock/plugin-sdk/contracts';
export const websiteID=(projectID:string)=>{const h=createHash('sha256').update('webdock:managed-analytics:v1:'+projectID).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const domain=z.string().max(253).regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/);
const provision=z.strictObject({name:z.string().trim().min(1).max(100),domain});
const range=z.strictObject({start_at:z.number().int().nonnegative(),end_at:z.number().int().nonnegative()}).refine(v=>v.end_at>v.start_at&&v.end_at-v.start_at<=366*86400000);
const empty=z.strictObject({});
type Context={data:PluginData;http:PluginHTTP};
type Site={websiteID:string;name:string;domain:string};
const key='analytics-site';
export async function analyticsAction(ctx:Context,action:string,input:unknown,scope:{projectID:string;origin:string;trackingOrigin?:string}){
 const tracking=scope.trackingOrigin?new URL(scope.trackingOrigin):undefined;if(tracking&&(tracking.protocol!=='https:'||tracking.username||tracking.password||tracking.pathname!=='/'||tracking.search||tracking.hash))throw Error('Invalid tracking origin');
 const id=websiteID(scope.projectID);const origin=new URL(scope.origin);if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Invalid analytics origin');
 if(action==='analytics.provision'){
  const desired=provision.parse(input);const current=await ctx.data.read(key);
  if(current.value){const site=current.value as Site;if(site.websiteID!==id||site.domain!==desired.domain||site.name!==desired.name)throw Error('Analytics is already configured with different settings');return configuration(site,origin.origin,tracking?.origin);}
  // Umami returns 401 for an unknown website to a non-admin user. Create with
  // a deterministic ID first; reconcile an existing/lost create through GET.
  let result;
  try { result=await ctx.http.request({binding:'analytics',method:'POST',path:'/api/websites',body:{id,...desired}}); }
  catch { result=await ctx.http.request({binding:'analytics',method:'GET',path:`/api/websites/${id}`}); }
  if(result.status!==200&&result.status!==201)result=await ctx.http.request({binding:'analytics',method:'GET',path:`/api/websites/${id}`});
  const website=result.body as any;if(result.status!==200&&result.status!==201||website?.id!==id||website.domain!==desired.domain||website.name!==desired.name)throw Error('Provider website identity mismatch');
  const site={websiteID:id,...desired};
  try{await ctx.data.write({key,value:site,expectedRevision:null,idempotencyKey:'provision-site-v1'});}catch(error){const read=await ctx.data.read(key);if(JSON.stringify(read.value)!==JSON.stringify(site))throw error;}
  return configuration(site,origin.origin,tracking?.origin);
 }
 const current=await ctx.data.read(key);const site=current.value as Site|null;if(!site||site.websiteID!==id)throw Error('Enable analytics for this project first');
 if(action==='analytics.configuration'){empty.parse(input);return configuration(site,origin.origin,tracking?.origin);}
 if(action==='analytics.stats'){
  const r=range.parse(input);const response=await ctx.http.request({binding:'analytics',method:'GET',path:`/api/websites/${id}/stats?startAt=${r.start_at}&endAt=${r.end_at}`});if(response.status!==200)throw Error('Statistics unavailable');return response.body;
 }
 throw Error('Unknown analytics action');
}
function configuration(site:Site,origin:string,trackingOrigin=origin){return {...site,scriptURL:trackingOrigin+'/script.js',dashboardURL:origin+'/websites/'+site.websiteID,trackingDomain:new URL(trackingOrigin).hostname};}
