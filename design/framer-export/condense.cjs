const fs=require('fs');
const KEEP=/^(name|type|id|component|htmlTag|elementId|layout|stackDirection|stackDistribution|stackAlignment|stackWrap|gap|rowGap|columnGap|gridColumns|gridRows|gridColumnWidth|gridRowHeight|gridAlignment|gridDistribution|padding.*|width|height|minWidth|maxWidth|minHeight|maxHeight|position|top|left|right|bottom|centerX|centerY|zIndex|fill.*|backgroundColor|backgroundImage.*|border.*|radius.*|squircle|shadow.*|boxShadow|opacity|overflow|blur|backdropBlur|rotation|scale|text|textStylePreset|textColor|textAlignment|fontName|fontSize|fontWeight|lineHeight|letterSpacing|font.*|link.*|appearEffect.*|hoverEffect.*|loopEffect.*|scrollVariantEffect.*|styleTransformEffect.*|parallaxEffect.*|pressEffect.*|transition.*|scrollTargetEnabled|visible|aspectRatio|\$control__.*|variant.*|\$variants|\$breakpoints|componentPreset.*|tag|set|cursor|clip|interaction.*|onClick.*|onHover.*|onTap.*|gestures.*|currentVariant|initialVariant|variantIds)$/;
function strip(n){
  const out={id:n.id,type:n.type};
  if(n.name)out.name=n.name;
  if(n.component)out.component=n.component;
  if(n.$componentDisplayName)out.componentName=n.$componentDisplayName;
  if(n.$variants)out.$variants=n.$variants;
  if(n.$breakpoints)out.$breakpoints=n.$breakpoints;
  if(n.variables)out.variables=n.variables;
  const a={};
  for(const [k,v] of Object.entries(n.attributes||{})){ if(KEEP.test(k)) a[k]=v; }
  if(Object.keys(a).length)out.a=a;
  for(const k of Object.keys(n)){ if(!['id','type','name','component','attributes','children','$componentDisplayName','$variants','$breakpoints','variables'].includes(k) && !k.startsWith('$')) out[k]=n[k]; }
  if(n.children&&n.children.length)out.children=n.children.map(strip);
  return out;
}
// diff a breakpoint copy against desktop by stripped suffix id
function index(n,prefix,map){ const key=n.id.startsWith(prefix)?n.id.slice(prefix.length):n.id; map[key]=n; for(const c of n.children||[])index(c,prefix,map); }
function diff(desk,other,prefix){
  const d={},o={}; index(desk,'',d); index(other,prefix,o);
  const changes=[];
  for(const [k,node] of Object.entries(o)){
    const base=d[k]; if(!base){changes.push({id:node.id,added:true,node:strip(node)});continue;}
    const ba=base.attributes||{}, oa=node.attributes||{}; const delta={};
    for(const [ak,av] of Object.entries(oa)){ if(KEEP.test(ak)&&JSON.stringify(ba[ak])!==JSON.stringify(av)) delta[ak]=av; }
    for(const ak of Object.keys(ba)){ if(KEEP.test(ak)&&!(ak in oa)) delta[ak]=null; }
    const bc=(base.children||[]).map(c=>c.id).join(','), oc=(node.children||[]).map(c=>c.id.startsWith(prefix)?c.id.slice(prefix.length):c.id).join(',');
    if(bc!==oc) delta.$childOrder=(node.children||[]).map(c=>c.id);
    if(Object.keys(delta).length) changes.push({id:node.id,base:k,name:node.name,delta});
  }
  for(const k of Object.keys(d)){ if(!o[k]) changes.push({base:k,removed:true}); }
  return changes;
}
const page=JSON.parse(fs.readFileSync('page-home.json','utf8'));
const [desk,tab,phone]=page.children;
const out={page:{id:page.id,a:Object.fromEntries(Object.entries(page.attributes||{}).filter(([k])=>KEEP.test(k)||k.startsWith('metadata')))},desktop:strip(desk),tablet_diff:diff(desk,tab,'PQb5vKiTZ'),phone_diff:diff(desk,phone,'AqyDhCxuA')};
fs.mkdirSync('condensed',{recursive:true});
fs.writeFileSync('condensed/page-home.condensed.json',JSON.stringify(out,null,1));
// per-section desktop files
for(const sec of desk.children[0].children){ fs.writeFileSync(`condensed/section-${(sec.name||sec.id).replace(/[^a-z0-9]+/gi,'_')}.json`,JSON.stringify(strip(sec),null,1)); }
for(const f of fs.readdirSync('components')){ const c=JSON.parse(fs.readFileSync('components/'+f,'utf8')); fs.writeFileSync('condensed/component-'+f,JSON.stringify(strip(c),null,1)); }
const lt=JSON.parse(fs.readFileSync('layout-template.json','utf8')); fs.writeFileSync('condensed/layout-template.json',JSON.stringify(strip(lt),null,1));
console.log('tablet changes',out.tablet_diff.length,'phone changes',out.phone_diff.length);
