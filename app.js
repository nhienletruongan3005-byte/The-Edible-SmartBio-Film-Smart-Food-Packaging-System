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
    renderInterpretation();
  }
  function renderComparison() {
    const box=$('compareResult');
    if(!currentResult || !referenceResult) { box.innerHTML='<span class="compare-icon">↔</span><div><strong>Chưa có phép so sánh</strong><p>Thêm ảnh tham chiếu để xem mức chênh lệch màu giữa hai ảnh.</p></div>'; return; }
    const d=deltaE(currentResult.lab,referenceResult.lab);
    box.innerHTML=`<span class="compare-icon">Δ</span><div><strong>Độ chênh màu CIE76: ${d.toFixed(1)}</strong><p>So với ảnh tham chiếu (${referenceResult.hex.toUpperCase()}). Chỉ là khác biệt màu ảnh, không phải ngưỡng độ tươi.</p></div>`;
    lastSpoken += ` Độ chênh màu so với ảnh tham chiếu là ${d.toFixed(1)} theo công thức CIE76.`;
  }
  function selectedMode() { return document.querySelector('input[name="analysisMode"]:checked')?.value || 'calibrated'; }
  function hexToRgb(value) {
    const match = /^#?([0-9a-f]{6})$/i.exec((value || '').trim());
    if (!match) return null;
    const n = parseInt(match[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function interpretationMarkup(level, title, detail, delta, source) {
    const deltaText = Number.isFinite(delta) ? `Độ lệch màu ΔE (CIE76): ${delta.toFixed(1)}.` : '';
    const sourceText = source === 'demo' ? ' Đây là kịch bản mô phỏng, không dựa trên ảnh tag.' : ' Đây là phân loại độ lệch màu theo thông số người dùng nhập.';
    $('interpretationOutput').dataset.level = level;
    $('interpretationOutput').innerHTML = `<span class="interpretation-icon">${level === 'reference' ? '✓' : level === 'changed' ? '!' : '↗'}</span><div><strong>${title}</strong><p>${detail} ${deltaText}${sourceText} Không phải kết luận về độ tươi hoặc an toàn thực phẩm.</p></div>`;
    const food = $('foodType')?.value || 'thực phẩm';
    lastSpoken += ` Diễn giải FreshTag cho nhóm ${food}: ${title}. ${detail} Đây không phải kết luận an toàn thực phẩm.`;
    return {level, title, detail, deltaE: Number.isFinite(delta) ? Number(delta.toFixed(2)) : null, source};
  }
  let latestInterpretation = null;
  function renderInterpretation() {
    if (!currentResult) {
      $('interpretationOutput').dataset.level = '';
      $('interpretationOutput').innerHTML = '<span class="interpretation-icon">i</span><div><strong>Chưa có dữ liệu diễn giải</strong><p>Chọn chế độ và phân tích ảnh tag để xem kết quả đối chiếu.</p></div>';
      latestInterpretation = null;
      return;
    }
    if (selectedMode() === 'demo') { runDemoScenario(); return; }
    const baseline = hexToRgb($('baselineHex').value);
    const t1 = Number($('thresholdOne').value), t2 = Number($('thresholdTwo').value);
    if (!baseline) {
      latestInterpretation = interpretationMarkup('changed','Màu mốc không hợp lệ','Hãy nhập mã HEX gồm 6 ký tự, ví dụ #9C719B.',NaN,'calibrated');
      renderRecommendation(); return;
    }
    if (!(t1 > 0 && t2 > t1)) {
      latestInterpretation = interpretationMarkup('changed','Ngưỡng chưa hợp lệ','Ngưỡng thay đổi mạnh phải lớn hơn ngưỡng thay đổi nhẹ và cả hai phải lớn hơn 0.',NaN,'calibrated');
      renderRecommendation(); return;
    }
    const d = deltaE(currentResult.lab, rgbToLab(...baseline));
    if (d <= t1) latestInterpretation = interpretationMarkup('reference','Tín hiệu gần màu mốc tham chiếu',`Màu đo được nằm trong ngưỡng ΔE ≤ ${t1}.` ,d,'calibrated');
    else if (d <= t2) latestInterpretation = interpretationMarkup('changed','Tín hiệu có thay đổi màu',`Màu đo được vượt ngưỡng nhẹ ${t1} nhưng chưa vượt ngưỡng mạnh ${t2}.`,d,'calibrated');
    else latestInterpretation = interpretationMarkup('strong','Tín hiệu thay đổi màu mạnh',`Màu đo được vượt ngưỡng ΔE ${t2}; cần kiểm tra lại điều kiện chụp và đối chiếu thực nghiệm.`,d,'calibrated');
    renderRecommendation();
  }
  function renderRecommendation() {
    const out = $('recommendationOutput'); if (!out) return;
    if (!currentResult || !latestInterpretation) { out.innerHTML='<strong>CHƯA ĐỦ CƠ SỞ ĐÁNH GIÁ</strong><p>Hãy phân tích màu tag để xem đánh giá tín hiệu. Chưa thể xác nhận thực phẩm phù hợp để sử dụng.</p>'; return; }
    const validated = $('validationStatus')?.value === 'validated';
    const level = latestInterpretation.level;
    const food = $('foodType')?.value || 'thực phẩm';
    if (!validated) {
      out.innerHTML=`<strong>CHƯA ĐỦ CƠ SỞ XÁC NHẬN PHÙ HỢP ĐỂ SỬ DỤNG</strong><p>Với nhóm ${food.toLowerCase()}, FreshTag ghi nhận: <b>${latestInterpretation.title}</b>. Tuy nhiên, ngưỡng hiện tại chưa được xác nhận bằng kiểm nghiệm độc lập. Không dùng kết quả này để quyết định ăn hay bỏ thực phẩm.</p>`;
    } else if (level === 'reference') {
      out.innerHTML=`<strong>TÍN HIỆU NẰM TRONG KHOẢNG THAM CHIẾU ĐÃ KIỂM NGHIỆM</strong><p>Đối với nhóm ${food.toLowerCase()}, màu tag nằm trong khoảng tham chiếu đã được nhóm nghiên cứu xác nhận. Đây chỉ là kết quả sàng lọc trong phạm vi quy trình kiểm nghiệm; không phải bảo đảm thực phẩm an toàn tuyệt đối.</p>`;
    } else {
      out.innerHTML=`<strong>CHƯA NÊN KẾT LUẬN PHÙ HỢP ĐỂ SỬ DỤNG</strong><p>Tín hiệu màu của nhóm ${food.toLowerCase()} đã thay đổi so với mốc tham chiếu. Cần kiểm tra lại mẫu và đối chiếu các chỉ tiêu kiểm nghiệm; không nên dựa vào riêng kết quả màu để xác nhận sử dụng.</p>`;
    }
  }
  function runDemoScenario() {
    const scenario = $('demoScenario').value;
    const demo = {
      reference: {level:'reference',title:'Mô phỏng: tín hiệu gần màu mốc',detail:'Kịch bản minh họa mức lệch màu thấp.',delta:2},
      changed: {level:'changed',title:'Mô phỏng: tín hiệu thay đổi vừa',detail:'Kịch bản minh họa mức lệch màu trung bình.',delta:11},
      strong: {level:'strong',title:'Mô phỏng: tín hiệu thay đổi mạnh',detail:'Kịch bản minh họa mức lệch màu cao.',delta:24}
    }[scenario];
    latestInterpretation = interpretationMarkup(demo.level,demo.title,demo.detail,demo.delta,'demo');
    renderRecommendation();
  }
  document.querySelectorAll('input[name="analysisMode"]').forEach(input => input.addEventListener('change', () => {
    const demo = selectedMode() === 'demo';
    $('calibrationControls').hidden = demo;
    $('demoControls').hidden = !demo;
    $('runDemoBtn').hidden = !demo;
    if (currentResult) renderInterpretation();
  }));
  ['foodType','baselineHex','thresholdOne','thresholdTwo'].forEach(id => $(id).addEventListener('change', () => { if (currentResult && selectedMode() === 'calibrated') renderInterpretation(); }));
  $('validationStatus').addEventListener('change', renderRecommendation);
  $('demoScenario').addEventListener('change', () => { if (selectedMode() === 'demo') runDemoScenario(); });
  $('runDemoBtn').addEventListener('click', () => { document.querySelector('input[name="analysisMode"][value="demo"]').checked = true; $('calibrationControls').hidden = true; $('demoControls').hidden = false; runDemoScenario(); });
  $('resetCalibrationBtn').addEventListener('click', () => { $('baselineHex').value='#9C719B'; $('thresholdOne').value='8'; $('thresholdTwo').value='18'; if(currentResult && selectedMode()==='calibrated')renderInterpretation(); });

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
    const report={project:'FreshTag 2.2 — The Edible SmartBio-Film',createdAt:new Date().toISOString(),measurement:{colorName:currentResult.name,hex:currentResult.hex,rgb:{red:currentResult.rgb[0],green:currentResult.rgb[1],blue:currentResult.rgb[2]},sampling:'Median RGB from central image region'},reference:referenceResult?{colorName:referenceResult.name,hex:referenceResult.hex,deltaE_CIE76:Number(deltaE(currentResult.lab,referenceResult.lab).toFixed(2))}:null,interpretation:{mode:selectedMode(),foodType:$('foodType').value,baselineHex:$('baselineHex').value,thresholdOne:Number($('thresholdOne').value),thresholdTwo:Number($('thresholdTwo').value),result:latestInterpretation},useSuitability:{validationStatus:$('validationStatus').value,recommendation:$('recommendationOutput').innerText,warning:'This screening result does not guarantee food safety and must not replace independent laboratory testing or safe handling guidance.'},limitation:'Image color analysis is a screening signal only. It cannot detect all pathogens or independently establish whether food is safe to eat.'};
    const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='freshtag-color-report.json';a.click();URL.revokeObjectURL(url);
  });
  const zone=$('dropZone');['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.style.borderColor='#66845f';}));['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.style.borderColor='';}));
  zone.addEventListener('drop',e=>{const f=e.dataTransfer?.files?.[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);photoInput.files=dt.files;photoInput.dispatchEvent(new Event('change'));});
})();
