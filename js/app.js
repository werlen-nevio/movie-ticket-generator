"use strict";

$(function () {
  // --- Utility ---
  const $canvas = $('#canvas');
  const GRID = 10;           // snap grid for move while Shift
  const ROT_SNAP = 15;       // degrees snapping while Shift

  let selected = null;
  let shift = false;

  $(document).on('keydown', e => { if (e.key === 'Shift') { shift = true; $('#snapHint').stop(true, true).fadeIn(80); } });
  $(document).on('keyup', e => { if (e.key === 'Shift') { shift = false; $('#snapHint').fadeOut(120); } });

  function deselect() { $('.el').removeClass('selected'); selected = null; }

  // click blank canvas to deselect
  $canvas.on('mousedown', e => { if (e.target === $canvas[0]) deselect(); });

  // --- Factory: create element wrappers with handles ---
  function createEl($node) {
    $node.addClass('el').append(`
      <div class="handles">
        <div class="rotate" title="Drehen"></div>
        <div class="resize br" title="Größe ändern"></div>
      </div>
    `);

    // Draggable (with optional grid when shift)
    $node.draggable({
      containment: '#canvas', snap: false, start() { select($node) }, drag(ev, ui) {
        if (shift) { ui.position.left = Math.round(ui.position.left / GRID) * GRID; ui.position.top = Math.round(ui.position.top / GRID) * GRID; }
      }
    });

    // Resizable via our custom single handle
    const $rh = $node.find('.resize.br');
    let resStart = null;
    $rh.on('mousedown', e => {
      e.preventDefault(); e.stopPropagation(); select($node);
      const rect = $node[0].getBoundingClientRect();
      resStart = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
      $(document).on('mousemove.resize', em => {
        const dx = em.clientX - resStart.x; const dy = em.clientY - resStart.y;
        let nw = resStart.w + dx; let nh = resStart.h + dy;
        nw = Math.max(40, nw); nh = Math.max(24, nh);
        if (shift) { // keep aspect while shift during resize
          const ratio = resStart.w / resStart.h; if (Math.abs(dx) > Math.abs(dy)) nh = nw / ratio; else nw = nh * ratio;
          nw = Math.round(nw / GRID) * GRID; nh = Math.round(nh / GRID) * GRID;
        }
        $node.css({ width: nw + 'px', height: nh + 'px' });
      });
      $(document).one('mouseup', () => $(document).off('mousemove.resize'));
    });

    // Rotate via handle (with snapping when Shift)
    const $rot = $node.find('.rotate');
    let rotStart = null;
    $rot.on('mousedown', e => {
      e.preventDefault(); e.stopPropagation(); select($node);
      const r = $node[0].getBoundingClientRect();
      const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
      rotStart = { cx, cy, a: getRotation($node) };
      $rot.css('cursor', 'grabbing');
      $(document).on('mousemove.rotate', em => {
        const ang = Math.atan2(em.clientY - rotStart.cy, em.clientX - rotStart.cx) * 180 / Math.PI + 90; // 0° top
        let a = ang;
        if (shift) { a = Math.round(a / ROT_SNAP) * ROT_SNAP; }
        setRotation($node, a);
      });
      $(document).one('mouseup', () => { $(document).off('mousemove.rotate'); $rot.css('cursor', 'grab'); });
    });

    // Select on click
    $node.on('mousedown', e => { select($node); e.stopPropagation(); });
    return $node.appendTo($canvas);
  }

  function select($node) { deselect(); $node.addClass('selected'); selected = $node; syncInspector(); }

  function getRotation($el) {
    const tr = $el.css('transform'); if (tr === 'none') return 0;
    const m = tr.match(/matrix\(([^)]+)\)/); if (!m) return 0;
    const a = m[1].split(',').map(parseFloat);
    const angle = Math.round(Math.atan2(a[1], a[0]) * 180 / Math.PI);
    return angle;
  }
  function setRotation($el, a) { $el.css('transform', `rotate(${a}deg)`); }

  // --- Adders ---
  function addText(contents = 'Doppelklick zum Bearbeiten') {
    const $n = createEl($('<div contenteditable="true"/>').text(contents).css({ left: 40, top: 40, width: 220, height: 'auto', background: 'transparent', padding: '4px 6px' }));
    $n.on('dblclick', () => { document.execCommand('selectAll', false, null) });
  }

  function addLabelValue() {
    const $wrap = $('<div/>').css({ left: 60, top: 80, width: 260, height: 'auto', background: 'transparent' });
    $wrap.append('<div class="label">Label</div>');
    $wrap.append('<div class="value" contenteditable="true">Wert</div>');
    createEl($wrap);
  }

  function addShape(kind) {
    const $s = $('<div class="shape"/>').toggleClass('round', kind === 'round').toggleClass('circle', kind === 'circle').css({ left: 80, top: 120, width: 160, height: 90 });
    createEl($s);
  }

  function addImageFromFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const $img = $('<img/>').attr('src', e.target.result).css({ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' });
      const $wrap = $('<div/>').css({ left: 120, top: 120, width: 200, height: 140, background: 'transparent' });
      $wrap.append($img);
      createEl($wrap);
    };
    reader.readAsDataURL(file);
  }

  // --- Inspector bindings ---
  function syncInspector() {
    const $n = selected; if (!$n) return;
    const col = rgb2hex($n.css('color')) || '#e5e7eb';
    const bg = rgb2hex($n.css('background-color')) || '#1f2937';
    const borderCol = rgb2hex($n.css('border-color')) || '#7c3aed';
    $('#textColor').val(col); $('#fillColor').val(bg); $('#strokeColor').val(borderCol);
    $('#strokeWidth').val(parseInt($n.css('border-width')) || 0);
    const br = parseInt($n.css('border-radius')) || 0; $('#radius').val(br);
  }

  function applyStyle() {
    if (!selected) return; const $n = selected;
    $n.css('color', $('#textColor').val());
    $n.css('background', $('#fillColor').val());
    $n.css({
      borderColor: $('#strokeColor').val(),
      borderWidth: parseInt($('#strokeWidth').val()) + 'px',
      borderStyle: parseInt($('#strokeWidth').val()) > 0 ? 'solid' : 'none',
      borderRadius: parseInt($('#radius').val()) + 'px'
    });
  }
  $('#textColor,#fillColor,#strokeColor,#strokeWidth,#radius').on('input change', applyStyle);

  // Z-Order / duplicate / delete
  $('#bringFront').on('click', () => { if (selected) selected.appendTo($canvas); });
  $('#sendBack').on('click', () => { if (selected) selected.prependTo($canvas); });
  $('#dup').on('click', () => {
    if (!selected) return;
    const $c = selected.clone(true, true);
    createEl($c.removeClass('selected')).css({ left: selected.position().left + 20, top: selected.position().top + 20 });
  });
  $('#del').on('click', () => { if (selected) { selected.remove(); selected = null; } });

  // Tools events
  $('#addText').on('click', () => addText());
  $('#addLabelValue').on('click', addLabelValue);
  $('#addRect').on('click', () => addShape('rect'));
  $('#addCircle').on('click', () => addShape('circle'));
  $('#imgInput').on('change', e => { if (e.target.files[0]) addImageFromFile(e.target.files[0]); e.target.value = ''; });

  // Insert placeholder into focused editable within selected element
  $('#insertPh').on('click', () => {
    const ph = $('#phSelect').val();
    if (selected) {
      const editable = selected.find('[contenteditable="true"]').get(0) || (selected.attr('contenteditable') === 'true' ? selected.get(0) : null);
      if (editable) { insertAtCursor(editable, `\u00A0<span class="ph">${ph}</span>\u00A0`); editable.focus(); }
      else { // if not editable, create a new text child
        const $t = $('<div contenteditable="true"/>').html(`<span class="ph">${ph}</span>`).css({ padding: '4px 6px' }); selected.append($t);
      }
    }
  });

  // Background controls
  $('#bgColor').on('input', e => { $canvas.css('background', e.target.value) });
  $('#bgImg').on('change', e => {
    if (e.target.files[0]) {
      const r = new FileReader();
      r.onload = ev => { $canvas.css({ background: `center/cover no-repeat url('${ev.target.result}')` }); };
      r.readAsDataURL(e.target.files[0]);
    }
  });

  // Preset reset
  $('#presetClean').on('click', () => { $('#preset').remove(); $('.badge').text('Kino Ticket'); $canvas.css('background', '#111827'); });

  // --- Export to minimal HTML (preserve placeholders like {{REFNR}}) ---
  $('#exportHtml').on('click', () => {
    deselect();
    const html = buildExportHtml();
    $('#exportOut').val(html);
    downloadFile('ticket-template.html', html);
  });

  function buildExportHtml() {
    // clone canvas and strip editor-only UI
    const $clone = $canvas.clone();
    $clone.find('.handles,.ui-resizable-handle,.badge').remove();
    $clone.find('.ph').each(function () { $(this).replaceWith($(this).text()) });
    $clone.find('.el').removeClass('selected');

    const style = `
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ticket</title>
<style>
  body{margin:0;display:grid;place-items:center;min-height:100vh;background:#111827;font-family:Inter,system-ui,Segoe UI,Roboto,Arial}
  .ticket{position:relative;width:${$clone.width()}px;height:${$clone.height()}px;border-radius:16px;box-shadow:0 20px 60px #0006}
  .ticket *{box-sizing:border-box}
</style>
</head>
<body>
<div class="ticket" style="${inlineBgFrom($clone)}">${innerHtmlOf($clone)}</div>
</body>
</html>`;
    return style;
  }

  function innerHtmlOf($clone) {
    // unwrap outer container (id="canvas") and keep its children
    const tmp = $('<div/>').append($clone.contents().not('#snapHint'));
    return tmp.html();
  }

  function inlineBgFrom($el) {
    const bg = $el.css('background');
    return `background:${bg};`;
  }

  function downloadFile(name, content) {
    const blob = new Blob([content], { type: 'text/html' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }

  // --- Helpers ---
  function rgb2hex(rgb) { if (!rgb) return null; const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i); if (!m) return null; return '#' + [m[1], m[2], m[3]].map(x => ('0' + parseInt(x).toString(16)).slice(-2)).join(''); }

  function insertAtCursor(el, html) {
    el.focus();
    if (window.getSelection) {
      const sel = window.getSelection(); if (!sel.rangeCount) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); }
      const range = sel.getRangeAt(0); range.deleteContents();
      const frag = range.createContextualFragment(html); range.insertNode(frag);
      range.collapse(false);
    }
  }

  // Make initial preset elements draggable/selectable
  $('#preset .card, #preset .value').each(function () {
    if (!$(this).hasClass('el')) createEl($(this));
  });

  // Public API (optional expose for console)
  window.KinoTicketDesigner = { addText, addLabelValue, addShape };
});
