import { clamp, expo, ramp } from './ease.js';
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
/** Real selectable type lives above the canvas, outside every postprocessing effect. */
export class Memory {
    constructor(rooms,nodes) {
        this.rooms=rooms;this.nodes=nodes;this.host=document.getElementById('memory');this.current=-1;this.stages=[];
    }
    assemble(index) {
        this.current=index;this.host.replaceChildren();this.stages=[];this.metrics=[];this.media=[];
        const room=this.rooms[index];this.host.dataset.theme=room.theme||'study';
        const add=(node,start)=>{this.host.append(node);this.stages.push({node,start});return node;};
        const header=el('header');header.append(el('span',String(index+1).padStart(2,'0')+' / '+String(this.rooms.length).padStart(2,'0'),'memory-index'),el('span','A MOMENT, PRESERVED','memory-kicker'));
        this.title=el('h1',room.title);header.append(this.title);add(header,0);
        add(el('p',[room.year,room.place].filter(Boolean).join(' · '),'memory-place'),.6);
        add(el('p',room.description,'memory-description'),1.2);
        const metrics=el('dl',undefined,'memory-metrics');
        for(const metric of room.metrics){const item=el('div'),value=el('dd'),label=el('dt',metric.label);item.append(value,label);metrics.append(item);this.metrics.push({value,metric});}
        if(room.metrics.length)add(metrics,1.8);
        if(room.video||room.images.length) {
            const media=el('figure',undefined,'memory-media');
            if(room.video) {const v=el('video');v.muted=true;v.playsInline=true;v.preload='metadata';v.src=room.video;v.setAttribute('aria-label',room.title+' — silent project demonstration');v.onerror=()=>{v.hidden=true;};media.append(v);this.media.push(v);}
            for(const src of room.images){const image=el('img');image.alt=room.title+' — supporting work';image.loading='lazy';image.src=src;image.onerror=()=>{image.hidden=true;};media.append(image);}
            add(media,2.4);
        }
        const achievements=el('ul',undefined,'memory-achievements');for(const text of room.achievements||[])achievements.append(el('li',text));if(achievements.childElementCount)add(achievements,3);
        const tech=el('ul',undefined,'memory-tech');for(const text of room.techStack)tech.append(el('li',text));if(tech.childElementCount)add(tech,3.6);
        const links=el('nav',undefined,'memory-links');links.setAttribute('aria-label',room.title+' links');
        for(const link of room.links){const a=el('a',link.label+' ↗');a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}if(links.childElementCount)add(links,4.2);
        this.host.scrollTop=0;
    }
    update(s,camera) {
        const visible=s.archive&&s.r<0&&!this.rooms[s.room].empty&&s.reveal>0;
        if(visible&&this.current!==s.room)this.assemble(s.room);
        this.host.hidden=!visible;
        if(!visible)return;
        const anchor=this.nodes[s.room].position.clone().project(camera);
        const departure=1-ramp(s.rt,14,18.9),opacity=ramp(s.reveal,0,.65)*departure;
        this.host.style.opacity=String(opacity);
        this.host.style.setProperty('--anchor-x',`${clamp(anchor.x*innerWidth*.05,-30,30)}px`);
        this.host.style.setProperty('--anchor-y',`${clamp(-anchor.y*innerHeight*.05,-20,20)}px`);
        this.host.inert=opacity<.2;
        for(const {node,start} of this.stages) {
            const p=expo(clamp((s.reveal-start)/.6));node.style.opacity=String(p);
            node.style.transform=`translateY(${(1-p)*8}px)`;node.style.visibility=p>.001?'visible':'hidden';
        }
        const room=this.rooms[s.room];this.title.textContent=room.title.slice(0,Math.ceil(clamp(s.reveal/(room.title.length*.03))*room.title.length));
        for(const {value,metric} of this.metrics) {
            const p=expo(clamp((s.reveal-1.8)/1.2));
            value.textContent=(typeof metric.value==='number'?(metric.value*p).toLocaleString(undefined,{maximumFractionDigits:Number.isInteger(metric.value)?0:2}):metric.value)+(metric.suffix||'');
        }
        for(const media of this.media)if(Number.isFinite(media.duration)&&media.duration>0) {
            const t=Math.max(0,s.reveal-2.4)%media.duration;
            if(!media.seeking&&Math.abs(media.currentTime-t)>.08)media.currentTime=t;
        }
    }
}
