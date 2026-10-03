import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
function crc(buffer){let n=0xffffffff;for(const b of buffer){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;}
function chunk(type,data){const tag=Buffer.from(type);const size=Buffer.alloc(4);size.writeUInt32BE(data.length);const c=Buffer.alloc(4);c.writeUInt32BE(crc(Buffer.concat([tag,data])));return Buffer.concat([size,tag,data,c]);}
function inside(x,y,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [xi,yi]=polygon[i],[xj,yj]=polygon[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit;}return hit;}
function distance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1];const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
for(const size of [192,512]){
  const data=Buffer.alloc((size*4+1)*size);const shape=[[48,17],[72,26],[72,46],[65,60],[48,78],[31,60],[24,46],[24,26]];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const px=x*96/size,py=y*96/size;const border=shape.some((p,i)=>distance(px,py,p,shape[(i+1)%shape.length])<2);
    const tick=distance(px,py,[37,46],[45,54])<2.5||distance(px,py,[45,54],[60,36])<2.5;
    const color=border||tick?[255,255,255]:[22,61,224];const offset=y*(size*4+1)+1+x*4;
    data[offset]=color[0];data[offset+1]=color[1];data[offset+2]=color[2];data[offset+3]=255;
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  writeFileSync(`public/icon-${size}.png`,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(data)),chunk('IEND',Buffer.alloc(0))]));
}
