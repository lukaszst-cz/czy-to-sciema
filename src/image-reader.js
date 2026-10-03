import jsQR from 'jsqr';
import { createWorker } from 'tesseract.js';

export async function imageCanvas(file) {
  if (file.size > 15 * 1024 * 1024) throw new Error('Obraz jest za duży. Wybierz plik do 15 MB.');
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/bmp'].includes(file.type)) throw new Error('Wybierz zdjęcie PNG, JPG, WebP lub BMP. HEIC zapisz najpierw jako JPG.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Nie udało się odczytać obrazu. Wybierz inny plik.'));});
    if (image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Obraz ma zbyt wiele pikseli. Przytnij go do samej wiadomości.');
    const scale = Math.min(1, 2600 / Math.max(image.naturalWidth,image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}
export function readQR(canvas) {
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  return jsQR(pixels.data,pixels.width,pixels.height,{inversionAttempts:'attemptBoth'})?.data || null;
}
export async function readText(canvas, onProgress, onWorker) {
  const base = new URL('./ocr/',document.baseURI).href;
  const worker=await createWorker('pol+eng',1,{workerPath:base+'worker.min.js',corePath:base+'core/',langPath:base+'lang',cacheMethod:'none',workerBlobURL:false,logger:m=>onProgress(m)});
  onWorker(worker);
  try {
    const {data}=await worker.recognize(canvas);
    return {text:data.text.trim(),confidence:data.confidence};
  } finally { await worker.terminate(); onWorker(null); }
}
