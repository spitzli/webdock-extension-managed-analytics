import {randomBytes,createHash} from 'node:crypto';
import {resolveCname,resolveTxt} from 'node:dns/promises';
export type DomainRequest={projectID:string;domain:string;providerHost:string;token:string};
function hostname(value:string){const host=value.toLowerCase();if(host!==value||host.length>253||!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){2,}[a-z]{2,63}$/.test(host)||/\.(local|internal|invalid|test)$/.test(host))throw Error('Use a public tracking subdomain');return host;}
export function requestDomain(projectID:string,domain:string,providerHost:string):DomainRequest{
 if(!/^[0-9]{1,20}$/.test(projectID))throw Error('Invalid project');hostname(domain);hostname(providerHost);if(domain===providerHost)throw Error('Choose a custom subdomain');return {projectID,domain,providerHost,token:randomBytes(32).toString('base64url')};
}
export async function verifyDomain(request:DomainRequest,dns={resolveCname,resolveTxt}){
 hostname(request.domain);hostname(request.providerHost);if(!/^[A-Za-z0-9_-]{43}$/.test(request.token)||!/^[0-9]{1,20}$/.test(request.projectID))throw Error('Invalid verification request');
 const [cnames,txt]=await Promise.all([dns.resolveCname(request.domain),dns.resolveTxt('_webdock-analytics.'+request.domain)]);
 if(!cnames.some(n=>n.toLowerCase().replace(/\.$/,'')===request.providerHost)||!txt.some(parts=>parts.join('')===`webdock-analytics=${request.projectID}:${request.token}`))throw Error('DNS ownership proof and provider CNAME are required');
 return {verified:true,domain:request.domain,projectID:request.projectID,tracking_origin:'https://'+request.domain};
}
export function trackingIngress(request:DomainRequest,target:{namespace:string;service:string;port:number;issuer:string}){
 hostname(request.domain);for(const name of [target.namespace,target.service,target.issuer])if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name))throw Error('Invalid infrastructure binding');if(!Number.isInteger(target.port)||target.port<1024||target.port>65535)throw Error('Invalid port');
 const name='tracking-'+createHash('sha256').update(request.domain).digest('hex').slice(0,20);
 return {apiVersion:'networking.k8s.io/v1',kind:'Ingress',metadata:{name,namespace:target.namespace,labels:{'app.kubernetes.io/managed-by':'managed-analytics','webdock.dev/project-id':request.projectID},annotations:{'cert-manager.io/issuer':target.issuer,'traefik.ingress.kubernetes.io/router.entrypoints':'websecure'}},spec:{ingressClassName:'traefik',tls:[{hosts:[request.domain],secretName:name+'-tls'}],rules:[{host:request.domain,http:{paths:['/script.js','/api/send'].map(path=>({path,pathType:'Exact',backend:{service:{name:target.service,port:{number:target.port}}}}))}}]}};
}
export function assertDomainAvailable(request:DomainRequest,ingresses:Array<any>){
 for(const ingress of ingresses){if(ingress.spec?.rules?.some((r:any)=>r.host===request.domain)&&(ingress.metadata?.labels?.['webdock.dev/project-id']!==request.projectID||ingress.metadata?.labels?.['app.kubernetes.io/managed-by']!=='managed-analytics'))throw Error('Tracking domain is already bound to another resource');}
}
if(import.meta.main){
 const [command,...args]=process.argv.slice(2);
 if(command==='request')console.log(JSON.stringify(requestDomain(args[0],args[1],args[2]),null,2));
 else if(command==='verify'){const input=await Bun.file(args[0]).json();console.log(JSON.stringify(await verifyDomain(input),null,2));}
 else if(command==='plan'){const request=await Bun.file(args[0]).json();await verifyDomain(request);const target=await Bun.file(args[1]).json();const existing=await Bun.file(args[2]).json();assertDomainAvailable(request,existing.items);console.log(JSON.stringify(trackingIngress(request,target),null,2));}
 else throw Error('Use request PROJECT DOMAIN PROVIDER, verify REQUEST.json, or plan REQUEST.json TARGET.json INGRESS-INVENTORY.json');
}
