(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const photoInput = $('photoInput'), referenceInput = $('referenceInput');
  const preview = $('preview'), previewWrap = $('previewWrap'), emptyState = $('emptyState');
  const canvas = $('workCanvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  let currentImage = null, referenceImage = null, currentResult = null, referenceResult = null, lastSpoken = '';

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('Vui lòng chọn một tệp hình ảnh hợp lệ.'));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không thể mở ảnh này. Hãy thử JPG hoặc PNG khác.')); };
      img.src = url;
    });
  }
  function sampleImage(img) {
    const scale = Math.min(1, 900 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    canvas.width = w; canvas.height = h; ctx.clearRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
    const radius = Math.max(2, Math.floor(Math.min(w, h) * .045));
    const x = Math.max(0, cx - radius), y = Math.max(0, cy - radius);
    const data = ctx.getImageData(x, y, Math.min(w - x, radius * 2 + 1), Math.min(h - y, radius * 2 + 1)).data;
    const channels = [[], [], []];
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 180) {
      channels[0].push(data[i]); channels[1].push(data[i + 1]); channels[2].push(data[i + 2]);
    }
    if (!channels[0].length) throw new Error('Không đọc được vùng màu trung tâm của ảnh.');
    const median = arr => { arr.sort((a,b) => a-b); const m = Math.floor(arr.length / 2); return arr.length % 2 ? arr[m] : Math.round((arr[m-1] + arr[m]) / 2); };
    const rgb = channels.map(median), hex = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
    return { rgb, hex, name: colorName(...rgb), lab: rgbToLab(...rgb) };
  }
  function colorName(r,g,b) {
    const max = Math.max(r,g,b), min = Math.min(r,g,b), delta = max-min, v=max/255;
    if (v < .19) return 'Tối / gần đen';
    if (delta < 24) return v > .82 ? 'Trắng / rất nhạt' : v < .42 ? 'Xám đậm' : 'Xám trung tính';
    let h;
    if (max===r) h=60*(((g-b)/delta)%6); else if(max===g) h=60*((b-r)/delta+2); else h=60*((r-g)/delta+4);
    if(h<0)h+=360;
    if(h<15||h>=345)return 'Đỏ'; if(h<38)return 'Cam'; if(h<68)return 'Vàng'; if(h<165)return 'Xanh lục'; if(h<195)return 'Xanh ngọc'; if(h<255)return 'Xanh lam'; if(h<290)return 'Tím'; return 'Hồng / tím đỏ';
  }
  function rgbToLab(r,g,b) {
    const linear = v => { v/=255; return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4); };
    let R=linear(r),G=linear(g),B=linear(b);
    let x=(R*.4124+G*.3576+B*.1805)/.95047, y=R*.2126+G*.7152+B*.0722, z=(R*.0193+G*.1192+B*.9505)/1.08883;
    const f=v=>v>.008856?Math.cbrt(v):7.787*v+16/116;
    const fx=f(x),fy=f(y),fz=f(z); return [116*fy-16,500*(fx-fy),200*(fy-fz)];
  }
  function deltaE(a,b) { return Math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2); }
  function setImageStatus(text, error=false) { $('fileStatus').textContent=text; $('fileStatus').style.color=error?'#a33b35':''; }
  function renderResult(result) {
    $('colorSwatch').style.background=result.hex; $('colorSwatch').innerHTML='';
    $('colorName').textContent=result.name; $('colorHex').textContent=`HEX ${result.hex.toUpperCase()}`;
    ['redValue','greenValue','blueValue'].forEach((id,i)=>$(id).textContent=result.rgb[i]);
    $('resultState').textContent='ĐÃ ĐỌC MÀU';
    lastSpoken=`Màu ghi nhận là ${result.name}. Mã màu ${result.hex}. Giá trị đỏ ${result.rgb[0]}, xanh lá ${result.rgb[1]}, xanh dương ${result.rgb[2]}. Đây chỉ là mô tả màu ảnh, không xác định độ tươi hoặc độ an toàn thực phẩm.`;
    $('plainDescription').textContent=`Ảnh có màu ${result.name.toLowerCase()}, mã HEX ${result.hex.toUpperCase()}. Đây là kết quả đo màu vùng trung tâm, không phải kết luận về chất lượng thực phẩm.`;
    $('downloadBtn').disabled=false;
    renderComparison();
  }
  function renderComparison() {
    const box=$('compareResult');
    if(!currentResult || !referenceResult) { box.innerHTML='<span class="compare-icon">↔</span><div><strong>Chưa có phép so sánh</strong><p>Thêm ảnh tham chiếu để xem mức chênh lệch màu giữa hai ảnh.</p></div>'; return; }
    const d=deltaE(currentResult.lab,referenceResult.lab);
    box.innerHTML=`<span class="compare-icon">Δ</span><div><strong>Độ chênh màu CIE76: ${d.toFixed(1)}</strong><p>So với ảnh tham chiếu (${referenceResult.hex.toUpperCase()}). Chỉ là khác biệt màu ảnh, không phải ngưỡng độ tươi.</p></div>`;
    lastSpoken += ` Độ chênh màu so với ảnh tham chiếu là ${d.toFixed(1)} theo công thức CIE76.`;
  }
  $('choosePhoto').addEventListener('click',()=>photoInput.click());
  photoInput.addEventListener('change',async()=>{
    const file=photoInput.files?.[0]; if(!file)return;
    try { currentImage=await loadImage(file); preview.src=URL.createObjectURL(file); preview.onload=()=>URL.revokeObjectURL(preview.src); previewWrap.hidden=false; emptyState.hidden=true; $('analyzeBtn').disabled=false; $('clearBtn').disabled=false; currentResult=null; $('resultState').textContent='CHỜ PHÂN TÍCH'; setImageStatus(`Đã tải: ${file.name}. Nhấn “Phân tích vùng màu” để tiếp tục.`); }
    catch(e){setImageStatus(e.message,true);}
  });
  $('analyzeBtn').addEventListener('click',()=>{
    if(!currentImage)return;
    try { currentResult=sampleImage(currentImage); renderResult(currentResult); setImageStatus('Đã phân tích vùng trung tâm bằng giá trị trung vị RGB.'); }
    catch(e){setImageStatus(e.message,true);}
  });
  referenceInput.addEventListener('change',async()=>{
    const file=referenceInput.files?.[0]; if(!file)return;
    try {referenceImage=await loadImage(file);referenceResult=sampleImage(referenceImage);$('referenceStatus').textContent=`Đã thêm ảnh tham chiếu · ${referenceResult.name} · ${referenceResult.hex.toUpperCase()}`;renderComparison();}
    catch(e){$('referenceStatus').textContent=e.message;}
  });
  $('clearBtn').addEventListener('click',()=>{
    photoInput.value='';currentImage=null;currentResult=null;preview.removeAttribute('src');previewWrap.hidden=true;emptyState.hidden=false;$('analyzeBtn').disabled=true;$('clearBtn').disabled=true;
    $('colorSwatch').style.background='#e9ede7';$('colorSwatch').innerHTML='<span>—</span>';$('colorName').textContent='Chưa có dữ liệu';$('colorHex').textContent='HEX — — —';['redValue','greenValue','blueValue'].forEach(id=>$(id).textContent='—');$('resultState').textContent='ĐANG CHỜ ẢNH';$('plainDescription').textContent='Kết quả màu sẽ được diễn giải tại đây, không chỉ thể hiện bằng ô màu.';$('downloadBtn').disabled=true;lastSpoken='Chưa có kết quả.';renderComparison();setImageStatus('Chưa có ảnh. Đặt vùng chỉ thị gần tâm ảnh, tránh bóng và ánh sáng màu.');
  });
  $('speakBtn').addEventListener('click',()=>{
    if(!('speechSynthesis' in window)){setImageStatus('Trình duyệt chưa hỗ trợ đọc thành tiếng.',true);return;}
    speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(lastSpoken||'Chưa có kết quả phân tích.');utterance.lang='vi-VN';speechSynthesis.speak(utterance);
  });
  $('stopSpeakBtn').addEventListener('click',()=>{if('speechSynthesis'in window)speechSynthesis.cancel();});
  $('downloadBtn').addEventListener('click',()=>{
    if(!currentResult)return;
    const report={project:'FreshTag 2.0 — The Edible SmartBio-Film',createdAt:new Date().toISOString(),measurement:{colorName:currentResult.name,hex:currentResult.hex,rgb:{red:currentResult.rgb[0],green:currentResult.rgb[1],blue:currentResult.rgb[2]},sampling:'Median RGB from central image region'},reference:referenceResult?{colorName:referenceResult.name,hex:referenceResult.hex,deltaE_CIE76:Number(deltaE(currentResult.lab,referenceResult.lab).toFixed(2))}:null,limitation:'Image color analysis only. Not a freshness, spoilage, or food-safety determination.'};
    const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='freshtag-color-report.json';a.click();URL.revokeObjectURL(url);
  });
  const zone=$('dropZone');['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.style.borderColor='#66845f';}));['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.style.borderColor='';}));
  zone.addEventListener('drop',e=>{const f=e.dataTransfer?.files?.[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);photoInput.files=dt.files;photoInput.dispatchEvent(new Event('change'));});
})();
