import {Elysia,t} from 'elysia';
import {timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createPluginContext,verifyInvocation} from '@webdock/plugin-sdk/server';
import {analyticsAction} from './analytics';
const id='managed-analytics';
const credential=process.env.WEBDOCK_PLUGIN_RUNTIME_TOKEN;
const hostOrigin=process.env.WEBDOCK_PLUGIN_HOST_URL;
const publicKey=process.env.WEBDOCK_PLUGIN_HOST_PUBLIC_KEY;
const generation=Number(process.env.WEBDOCK_PLUGIN_GENERATION);
if(!credential||credential.length<32||!hostOrigin||!publicKey||!Number.isSafeInteger(generation)||generation<1)throw Error('Plugin runtime configuration required');
const app=new Elysia({aot:true})
 .get('/healthz',()=>({ok:true,pluginID:id,version:'0.1.0-alpha.1',generation,protocolVersion:1}))
 .post('/actions/:action',async({request,params,body,status})=>{
  const received=Buffer.from(request.headers.get('authorization')??'');const expected=Buffer.from('Bearer '+credential);
  if(received.length!==expected.length||!timingSafeEqual(received,expected))return status(401,{error:'Unauthorized runtime'});
  const token=request.headers.get('x-plugin-invocation')??'';
  try{
   const claims=verifyInvocation(token,{publicKey,pluginID:id,generation});if(claims.action!==params.action||body.hostOrigin!==hostOrigin)throw Error('Invocation mismatch');
   const context=createPluginContext({hostURL:hostOrigin,token:()=>token,runtimeCredential:credential});
   return await analyticsAction(context,params.action,body.input,{projectID:claims.projectID,origin:body.configuration.analytics_origin});
  }catch{return status(400,{error:'Analytics action failed; check configuration and project access'});}
 },{body:t.Object({input:t.Unknown(),configuration:t.Object({analytics_origin:t.String()}),hostOrigin:t.String()})});
const cert=process.env.WEBDOCK_PLUGIN_TLS_CERT;const key=process.env.WEBDOCK_PLUGIN_TLS_KEY;if(!cert||!key)throw Error('Private runtime TLS certificate required');
app.listen({hostname:'0.0.0.0',port:3443,tls:{cert:readFileSync(cert),key:readFileSync(key)},maxRequestBodySize:65536});

const ui=new Elysia().get('/ui/analytics',()=>new Response(readFileSync(new URL('../ui/analytics.html',import.meta.url)),{headers:{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; frame-ancestors https://console.webdock.dev; base-uri 'none'; form-action 'none'",'x-content-type-options':'nosniff'}})).get('/ui/analytics.js',()=>new Response(readFileSync(new URL('../ui/analytics.js',import.meta.url)),{headers:{'content-type':'application/javascript; charset=utf-8','x-content-type-options':'nosniff'}})).get('/ui/analytics.css',()=>new Response(readFileSync(new URL('../ui/analytics.css',import.meta.url)),{headers:{'content-type':'text/css; charset=utf-8','x-content-type-options':'nosniff'}}));
ui.listen({hostname:'0.0.0.0',port:3444});
