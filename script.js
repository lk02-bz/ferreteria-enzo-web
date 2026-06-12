/* ==========================================================================
   DISTRIBUIDORA ENZO — script.js
   Versión optimizada: caché sessionStorage, DOMContentLoaded unificado,
   sistema VIP por aprobación de admin.
   ========================================================================== */

/* ==========================================================================
   1. CONEXIÓN CON FIREBASE
   ========================================================================== */
if (!firebase.apps.length) {
    firebase.initializeApp({
        apiKey: "AIzaSyCpHfuDBdLueGKbuurVsbMmIT7hyJauReI",
        authDomain: "distribuidora-enzo.firebaseapp.com",
        projectId: "distribuidora-enzo",
        storageBucket: "distribuidora-enzo.firebasestorage.app",
        messagingSenderId: "305386158303",
        appId: "1:305386158303:web:dac815f46d5f6d35d5116a"
    });
}

const db      = firebase.firestore();
const auth    = firebase.auth();
const storage = firebase.storage();

/* ==========================================================================
   2. ESTADO GLOBAL
   ========================================================================== */
let inventario    = [];
let usuarioEsVIP  = false; // false por defecto — se activa solo si admin aprueba

/* Escapa texto antes de inyectarlo con innerHTML (previene XSS) */
function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Constante centralizada: monto mínimo para envío gratis ──────────────
   Cambiar SOLO AQUÍ — se aplica automáticamente en la barra del carrito
   y en cualquier otro lugar que la referencie.
   ──────────────────────────────────────────────────────────────────────── */
const META_ENVIO_GRATIS = 150000;
let usuarioActual = null;  // objeto del usuario logueado

let estado = {
    paginaActual:       1,
    productosPorPagina: 24,
    categoria:          'all',
    precioMin:          0,
    precioMax:          99999999,
    soloOfertas:        false,
    busqueda:           '',
    productosFiltrados: []
};

let carrito = (() => {
    try {
        return JSON.parse(localStorage.getItem('carritoEnzo')) || [];
    } catch(e) {
        // JSON corrupto en localStorage — limpiar y arrancar con carrito vacío
        localStorage.removeItem('carritoEnzo');
        return [];
    }
})();


// ── Estado global del selector de variantes (tarjeta + detalle) ──────────────
window._vsState = {};  // { prodId: { dim1, dim2 } }

function initVsState(prod) {
    if (_vsState[prod.id]) return;
    const v0 = prod.variantes && (prod.variantes.find(v => v.varDim1 || v.varDim2) || prod.variantes[0]);
    // Si solo tiene varDim2 (varDim1=null), usarla como dimension primaria
    const d1 = v0?.varDim1 || v0?.varDim2 || null;
    const d2 = v0?.varDim1 ? (v0?.varDim2 || null) : null;
    _vsState[prod.id] = { dim1: d1, dim2: d2 };
}

function getSelectedVariante(prod) {
    if (!prod.tieneVariantes || !prod.variantes || !prod.variantes.length) return null;
    const state = _vsState[prod.id] || {};
    return prod.variantes.find(v => {
        // dim1 puede estar en varDim1 o en varDim2 (productos importados con varDim1=null)
        const vd1 = (v.varDim1 || v.varDim2 || '').trim();
        const d1ok = !state.dim1 || vd1 === state.dim1.trim();
        // dim2 solo aplica si la variante tiene varDim1 Y varDim2 separados
        const d2ok = !state.dim2 || (v.varDim1 && (v.varDim2 || '').trim() === state.dim2.trim());
        return d1ok && d2ok;
    }) || prod.variantes[0];
}

// Construye el HTML interior del selector embebido en la tarjeta
function buildVsInnerHTML(prod) {
    initVsState(prod);
    const state  = _vsState[prod.id];
    const varSel = getSelectedVariante(prod);
    const lbl1   = prod.labelDim1 || 'Presentación';
    const lbl2   = prod.labelDim2 || 'Medida';
    const esc    = s => String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const btnB   = 'padding:3px 10px;border-radius:12px;font-size:0.72rem;font-weight:700;cursor:pointer;transition:all .12s;';

    const dim1Vals = [...new Set(prod.variantes.map(v => ((v.varDim1 || v.varDim2) || '').trim()).filter(Boolean))];
    const dim2Vals = [...new Set(
        prod.variantes.filter(v => !state.dim1 || v.varDim1 === state.dim1).map(v => v.varDim2).filter(Boolean)
    )];

    let html = '';

    if (dim1Vals.length > 0) {
        html += `<div style="margin-bottom:5px;"><span style="font-size:0.7rem;font-weight:700;color:#4A5568;text-transform:uppercase;">${lbl1}:</span><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px;">`;
        dim1Vals.forEach(d1 => {
            const on = state.dim1 === d1;
            html += `<button onclick="event.stopPropagation();vsD1('${prod.id}','${esc(d1)}')" style="${btnB}border:1.5px solid ${on?'#3182CE':'#CBD5E0'};background:${on?'#3182CE':'white'};color:${on?'white':'#4A5568'};">${d1}</button>`;
        });
        html += `</div></div>`;
    }

    if (prod.tiene2Dims && dim2Vals.length > 0) {
        html += `<div style="margin-bottom:5px;"><span style="font-size:0.7rem;font-weight:700;color:#4A5568;text-transform:uppercase;">${lbl2}:</span><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:3px;">`;
        dim2Vals.forEach(d2 => {
            const on = state.dim2 === d2;
            html += `<button onclick="event.stopPropagation();vsD2('${prod.id}','${esc(d2)}')" style="${btnB}border:1.5px solid ${on?'#3182CE':'#CBD5E0'};background:${on?'#3182CE':'white'};color:${on?'white':'#4A5568'};">${d2}</button>`;
        });
        html += `</div></div>`;
    }

    if (varSel) {
        const ok = varSel.stock > 0;
        html += `<div style="margin-top:3px;padding:3px 8px;background:${ok?'#F0FFF4':'#FFF5F5'};border:1px solid ${ok?'#9AE6B4':'#FEB2B2'};border-radius:5px;font-size:0.71rem;line-height:1.4;"><strong style="color:#2D3748;">${varSel.etiqueta}</strong><span style="color:#718096;margin-left:5px;">· Cód: ${varSel.codigo||'S/C'}</span><span style="color:${ok?'#38A169':'#E53E3E'};font-weight:700;margin-left:5px;">${ok?`Stock: ${varSel.stock}`:'Sin stock'}</span></div>`;
    }
    return html;
}

window.vsD1 = function(prodId, dim1) {
    const prod = inventario.find(p => p.id === prodId);
    if (!prod) return;
    if (!_vsState[prodId]) initVsState(prod);
    _vsState[prodId].dim1 = dim1;
    if (prod.tiene2Dims) {
        const disp = prod.variantes.filter(v => v.varDim1 === dim1).map(v => v.varDim2);
        if (!disp.includes(_vsState[prodId].dim2)) _vsState[prodId].dim2 = disp[0] || null;
    }
    const area = document.getElementById('vs-' + prodId);
    if (area) area.innerHTML = buildVsInnerHTML(prod);
};

window.vsD2 = function(prodId, dim2) {
    const prod = inventario.find(p => p.id === prodId);
    if (!prod) return;
    if (!_vsState[prodId]) initVsState(prod);
    _vsState[prodId].dim2 = dim2;
    const area = document.getElementById('vs-' + prodId);
    if (area) area.innerHTML = buildVsInnerHTML(prod);
};

// ── MODAL DE VARIANTES (Opción B) ────────────────────────────────────────────
let _vsmProdId = null;

function _vsCrearModal() {
    if (document.getElementById('vs-modal')) return;
    const el = document.createElement('div');
    el.id = 'vs-modal';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;align-items:center;justify-content:center;padding:16px;';
    el.innerHTML = `
        <div style="background:white;border-radius:20px;width:100%;max-width:480px;box-shadow:0 24px 70px rgba(0,0,0,0.3);overflow:hidden;position:relative;">
            <button onclick="vsModalCerrar()" style="position:absolute;top:12px;right:12px;background:#EDF2F7;border:none;border-radius:50%;width:32px;height:32px;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#4A5568;z-index:1;">✕</button>

            <div style="display:flex;gap:18px;padding:24px 24px 18px;border-bottom:1px solid #E2E8F0;align-items:flex-start;">
                <img id="vsm-img" src="" alt="" style="width:90px;height:90px;object-fit:contain;border-radius:12px;border:1px solid #E2E8F0;background:#F7FAFC;flex-shrink:0;">
                <div>
                    <div id="vsm-marca" style="font-size:0.72rem;font-weight:700;color:#718096;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;"></div>
                    <div id="vsm-nombre" style="font-size:1rem;font-weight:900;color:#2D3748;line-height:1.2;margin-bottom:6px;"></div>
                    <div id="vsm-precio" style="font-size:1.1rem;font-weight:900;color:var(--primary-dark,#1A365D);"></div>
                </div>
            </div>

            <div style="padding:20px 24px 24px;">
                <div id="vsm-selector"></div>

                <div id="vsm-info" style="display:none;margin-top:10px;padding:8px 12px;border-radius:8px;font-size:0.82rem;"></div>

                <div style="display:flex;align-items:center;gap:10px;margin-top:16px;">
                    <div style="display:flex;align-items:center;border:1.5px solid #E2E8F0;border-radius:8px;overflow:hidden;">
                        <button onclick="vsModalCant(-1)" style="width:36px;height:38px;border:none;background:#F7FAFC;color:#4A5568;font-size:1.2rem;cursor:pointer;font-weight:700;">-</button>
                        <input type="number" id="vsm-cant" value="1" min="1" style="width:44px;height:38px;border:none;text-align:center;font-size:1rem;font-weight:700;color:#2D3748;outline:none;">
                        <button onclick="vsModalCant(1)" style="width:36px;height:38px;border:none;background:#F7FAFC;color:#4A5568;font-size:1.2rem;cursor:pointer;font-weight:700;">+</button>
                    </div>
                    <button id="vsm-btn" onclick="vsModalConfirmar()" style="flex:1;height:38px;background:#3182CE;color:white;border:none;border-radius:8px;font-size:0.95rem;font-weight:700;cursor:pointer;transition:background .15s;">
                        AGREGAR AL CARRITO
                    </button>
                </div>
            </div>
        </div>`;
    el.addEventListener('click', function(e){ if(e.target === el) vsModalCerrar(); });
    document.body.appendChild(el);
}

function _vsmRenderSelector() {
    const prod = inventario.find(p => p.id === _vsmProdId);
    if (!prod) return;
    initVsState(prod);
    const state   = _vsState[prod.id];
    const varSel  = getSelectedVariante(prod);
    const lbl1    = prod.labelDim1 || 'Presentación';
    const lbl2    = prod.labelDim2 || 'Medida';
    const esc     = s => String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const bOn     = 'padding:7px 16px;border-radius:20px;font-size:0.88rem;font-weight:700;cursor:pointer;transition:all .12s;border:2px solid #3182CE;background:#3182CE;color:white;';
    const bOff    = 'padding:7px 16px;border-radius:20px;font-size:0.88rem;font-weight:700;cursor:pointer;transition:all .12s;border:2px solid #CBD5E0;background:white;color:#4A5568;';

    const dim1Vals = [...new Set(prod.variantes.map(v => ((v.varDim1 || v.varDim2) || '').trim()).filter(Boolean))];
    const dim2Vals = [...new Set(
        prod.variantes.filter(v => !state.dim1 || v.varDim1 === state.dim1).map(v => v.varDim2).filter(Boolean)
    )];

    let html = '<div style="display:flex;flex-direction:column;gap:12px;">';

    if (dim1Vals.length > 0) {
        html += `<div><div style="font-size:0.75rem;font-weight:700;color:#4A5568;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">${lbl1}:</div><div style="display:flex;flex-wrap:wrap;gap:6px;">`;
        dim1Vals.forEach(d1 => {
            html += `<button onclick="vsModalD1('${esc(d1)}')" style="${state.dim1===d1?bOn:bOff}">${d1}</button>`;
        });
        html += '</div></div>';
    }

    if (prod.tiene2Dims && dim2Vals.length > 0) {
        html += `<div><div style="font-size:0.75rem;font-weight:700;color:#4A5568;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">${lbl2}:</div><div style="display:flex;flex-wrap:wrap;gap:6px;">`;
        dim2Vals.forEach(d2 => {
            html += `<button onclick="vsModalD2('${esc(d2)}')" style="${state.dim2===d2?bOn:bOff}">${d2}</button>`;
        });
        html += '</div></div>';
    }

    html += '</div>';
    document.getElementById('vsm-selector').innerHTML = html;

    // Info de la variante seleccionada
    const infoEl = document.getElementById('vsm-info');
    const btnEl  = document.getElementById('vsm-btn');
    const cantEl = document.getElementById('vsm-cant');
    const precioEl = document.getElementById('vsm-precio');

    if (varSel) {
        const ok = varSel.stock > 0;
        infoEl.style.display = 'block';
        infoEl.style.background = ok ? '#F0FFF4' : '#FFF5F5';
        infoEl.style.border = `1px solid ${ok ? '#9AE6B4' : '#FEB2B2'}`;
        infoEl.innerHTML = `<strong style="color:#2D3748;">${varSel.etiqueta}</strong>
            <span style="color:#718096;margin:0 6px;">·</span>
            <span style="color:#718096;">Cód: ${varSel.codigo || 'S/C'}</span>
            <span style="color:#718096;margin:0 6px;">·</span>
            <strong style="color:${ok?'#38A169':'#E53E3E'};">${ok?`Stock: ${varSel.stock} u.`:'Sin stock'}</strong>`;

        if (usuarioEsVIP) {
            precioEl.textContent = `$${parseInt(varSel.precio).toLocaleString('es-AR')} c/u`;
        }

        if (ok) {
            btnEl.disabled = false;
            btnEl.style.background = '#3182CE';
            btnEl.style.cursor = 'pointer';
            btnEl.textContent = 'AGREGAR AL CARRITO';
            const maxCant = parseInt(cantEl?.value || 1);
            if (maxCant > varSel.stock) cantEl.value = varSel.stock;
        } else {
            btnEl.disabled = true;
            btnEl.style.background = '#A0AEC0';
            btnEl.style.cursor = 'not-allowed';
            btnEl.textContent = 'SIN STOCK';
        }
    } else {
        infoEl.style.display = 'none';
    }
}

window.vsAbrirModal = function(prodId) {
    _vsCrearModal();
    _vsmProdId = prodId;
    const prod = inventario.find(p => p.id === prodId);
    if (!prod) return;

    initVsState(prod);

    document.getElementById('vsm-img').src         = prod.imagen || '';
    document.getElementById('vsm-marca').textContent = prod.marca || '';
    document.getElementById('vsm-nombre').textContent = prod.nombre || '';
    document.getElementById('vsm-cant').value        = 1;

    if (usuarioEsVIP) {
        document.getElementById('vsm-precio').textContent = `$${parseInt(prod.precio).toLocaleString('es-AR')} c/u`;
    } else {
        document.getElementById('vsm-precio').innerHTML = '<span style="color:#718096;font-size:0.9rem;">Precio VIP</span>';
    }

    _vsmRenderSelector();

    const modal = document.getElementById('vs-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.vsModalCerrar = function() {
    const modal = document.getElementById('vs-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
};

window.vsModalD1 = function(dim1) {
    if (!_vsmProdId) return;
    const prod = inventario.find(p => p.id === _vsmProdId);
    if (!prod) return;
    if (!_vsState[_vsmProdId]) initVsState(prod);
    _vsState[_vsmProdId].dim1 = dim1;
    if (prod.tiene2Dims) {
        const disp = prod.variantes.filter(v => v.varDim1 === dim1).map(v => v.varDim2);
        if (!disp.includes(_vsState[_vsmProdId].dim2)) _vsState[_vsmProdId].dim2 = disp[0] || null;
    }
    _vsmRenderSelector();
};

window.vsModalD2 = function(dim2) {
    if (!_vsmProdId) return;
    if (!_vsState[_vsmProdId]) return;
    _vsState[_vsmProdId].dim2 = dim2;
    _vsmRenderSelector();
};

window.vsModalCant = function(delta) {
    const input   = document.getElementById('vsm-cant');
    const prod    = inventario.find(p => p.id === _vsmProdId);
    const varSel  = prod ? getSelectedVariante(prod) : null;
    const maxStock = varSel ? varSel.stock : 99;
    let val = (parseInt(input.value) || 1) + delta;
    if (val < 1) val = 1;
    if (val > maxStock) val = maxStock;
    input.value = val;
};

window.vsModalConfirmar = function() {
    const prod   = inventario.find(p => p.id === _vsmProdId);
    if (!prod) return;
    const varSel = getSelectedVariante(prod);
    if (!varSel || varSel.stock <= 0) { mostrarNotificacion('Seleccioná una variante con stock.'); return; }

    const cantidad = parseInt(document.getElementById('vsm-cant')?.value) || 1;
    if (cantidad > varSel.stock) { mostrarNotificacion(`Solo hay ${varSel.stock} unidades disponibles.`); return; }

    const itemId    = `${prod.id}_VAR_${varSel.codigo || varSel.id}`;
    const existente = carrito.find(i => i.id === itemId);

    if (existente) {
        const nueva = existente.cantidad + cantidad;
        if (nueva > varSel.stock) { mostrarNotificacion(`Máximo ${varSel.stock} unidades disponibles.`); return; }
        existente.cantidad = nueva;
    } else {
        carrito.push({
            id:         itemId,
            idPadre:    prod.id,
            codigoVar:  varSel.codigo || varSel.id,
            codigo:     varSel.codigo || prod.codigo,
            nombre:     varSel.nombre,
            marca:      prod.marca   || '',
            precio:     varSel.precio,
            cantidad,
            imagen:     varSel.imagen || prod.imagen,
            esVariante: true
        });
    }

    guardarCarrito();
    actualizarBadgeCarrito();
    renderizarCarrito();
    vsModalCerrar();
    mostrarNotificacion(`"${varSel.etiqueta}" agregado al carrito ✓`);
};

// ── Selector embebido para la PÁGINA DE DETALLE ───────────────────────────────

function _renderizarSelectorEmbebido(prod, container) {
    if (!_vsState[prod.id]) initVsState(prod); // solo inicializa si no existe estado
    const state = _vsState[prod.id];
    const lbl1  = prod.labelDim1 || 'Presentación';
    const lbl2  = prod.labelDim2 || 'Medida';
    const esc   = s => String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const bS    = on => `padding:7px 18px;border-radius:20px;font-size:0.88rem;font-weight:700;cursor:pointer;transition:all .15s;border:2px solid ${on?'var(--primary-blue,#2B6CB0)':'#CBD5E0'};background:${on?'var(--primary-blue,#2B6CB0)':'white'};color:${on?'white':'var(--primary-blue,#2B6CB0)'};`;

    const dim1Vals = [...new Set(prod.variantes.map(v => ((v.varDim1 || v.varDim2) || '').trim()).filter(Boolean))];
    const dim2Vals = [...new Set(
        prod.variantes.filter(v => !state.dim1 || v.varDim1 === state.dim1).map(v => v.varDim2).filter(Boolean)
    )];

    let html = '<div style="display:flex;flex-direction:column;gap:14px;">';

    if (dim1Vals.length > 0) {
        html += `<div><div style="font-size:0.78rem;font-weight:700;color:#4A5568;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">${lbl1}:</div><div style="display:flex;flex-wrap:wrap;gap:8px;">`;
        dim1Vals.forEach(d1 => {
            html += `<button data-dim1="${d1}" onclick="vsDetD1('${prod.id}','${esc(d1)}')" style="${bS(state.dim1===d1)}">${d1}</button>`;
        });
        html += '</div></div>';
    }

    if (prod.tiene2Dims && dim2Vals.length > 0) {
        html += `<div><div style="font-size:0.78rem;font-weight:700;color:#4A5568;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">${lbl2}:</div><div style="display:flex;flex-wrap:wrap;gap:8px;">`;
        dim2Vals.forEach(d2 => {
            html += `<button data-dim2="${d2}" onclick="vsDetD2('${prod.id}','${esc(d2)}')" style="${bS(state.dim2===d2)}">${d2}</button>`;
        });
        html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;
    container.style.display = 'block';
}

function _actualizarDetalleVarianteEmbebida(prod) {
    const varSel = getSelectedVariante(prod);
    if (!varSel) return;
    prod._varianteActiva = varSel;

    const stockBox = document.getElementById('detalle-stock-box');
    if (stockBox) {
        const ok = varSel.stock > 0;
        stockBox.innerHTML = `<span class="material-icons" style="font-size:1.2rem;color:${ok?'#38A169':'#E53E3E'}">inventory_2</span><span>Stock Disponible: <strong style="color:${ok?'#38A169':'#E53E3E'};font-size:1.1rem;">${varSel.stock} u.</strong></span>`;
    }

    const precioEl = document.getElementById('detail-price');
    if (precioEl && usuarioEsVIP) {
        precioEl.innerHTML = `<div style="color:var(--primary-dark);font-size:2.2rem;font-weight:900;">$${parseInt(varSel.precio).toLocaleString('es-AR')}</div>`;
    }

    if (varSel.imagen) {
        const imgEl = document.getElementById('detail-image');
        if (imgEl) { imgEl.style.opacity='0'; imgEl.style.transition='opacity .2s'; setTimeout(()=>{ imgEl.src=varSel.imagen; imgEl.style.opacity='1'; },200); }
    }

    const nameEl = document.getElementById('detail-name');
    if (nameEl && varSel.nombre) nameEl.textContent = varSel.nombre;

    const skuEl = document.getElementById('detalle-sku');
    if (skuEl) {
        // varSel.codigo || varSel.id : igual que el modal (la segunda es el id del variant)
        const _varCode  = (varSel.codigo || varSel.id || '').trim();
        const _codigoVar = (() => {
            // Si el variant tiene codigo/id distinto al del padre, usarlo directo
            if (_varCode && _varCode !== (prod.codigo || '').trim()) return _varCode;
            // Fallback: construir PADRE-DIM1[-DIM2]
            const base  = (prod.codigo || '').trim();
            const parts = [varSel.varDim1, varSel.varDim2]
                .filter(Boolean)
                .map(d => d.trim().replace(/\s+/g, '-').toUpperCase());
            return parts.length
                ? (base ? base + '-' + parts.join('-') : parts.join('-'))
                : (_varCode || base || 'S/C');
        })();
        skuEl.innerHTML = `<span class="material-icons" style="font-size:1rem;margin-right:5px;">qr_code_2</span> CÓD: ${_codigoVar}`;
    }

    // Actualizar descripcion
    const descElVar = document.getElementById('detail-desc');
    if (descElVar) {
        const descTexto = varSel.descripcion || prod.descripcion || 'Sin descripción.';
        descElVar.textContent = descTexto;
    }

    const btnAdd   = document.getElementById('detail-add-btn');
    const inputQty = document.querySelector('.big-selector input');
    if (btnAdd) {
        if (varSel.stock <= 0) {
            btnAdd.textContent = "SIN STOCK"; btnAdd.style.backgroundColor = "#ccc"; btnAdd.disabled = true;
        } else {
            btnAdd.textContent = "AGREGAR AL CARRITO"; btnAdd.style.backgroundColor = ""; btnAdd.disabled = false;
            btnAdd.onclick = () => {
                const qty = parseInt(inputQty?.value || '1');
                const productoConVar = { ...prod, nombre: varSel.nombre, precio: varSel.precio, imagen: varSel.imagen || prod.imagen, codigo: varSel.codigo, id: `${prod.id}_VAR_${varSel.codigo||varSel.id}`, idPadre: prod.id, codigoVar: varSel.codigo||varSel.id, esVariante: true };
                agregarObjetoAlCarrito(productoConVar, qty);
            };
        }
    }
}

window.vsDetD1 = function(prodId, dim1) {
    const prod = inventario.find(p => p.id === prodId) || window._detalleProductoActual;
    if (!prod) return;
    if (!_vsState[prodId]) initVsState(prod);
    _vsState[prodId].dim1 = dim1;
    if (prod.tiene2Dims) {
        const disp = prod.variantes.filter(v => v.varDim1 === dim1).map(v => v.varDim2);
        if (!disp.includes(_vsState[prodId].dim2)) _vsState[prodId].dim2 = disp[0] || null;
    }
    const container = document.getElementById('variantes-selector-container');
    if (container) _renderizarSelectorEmbebido(prod, container);
    _actualizarDetalleVarianteEmbebida(prod);
    // Update directo: garantiza que el SKU se actualice aunque falle la cadena
    (function() {
        const skuEl = document.getElementById('detalle-sku');
        if (!skuEl) return;
        const varSel = getSelectedVariante(prod);
        if (!varSel) return;
        const vCode = (varSel.codigo || varSel.id || '').trim();
        const pCode = (prod.codigo || '').trim();
        const parts = [varSel.varDim1, varSel.varDim2].filter(Boolean)
            .map(d => d.trim().replace(/\s+/g,'-').toUpperCase());
        const disp = (vCode && vCode !== pCode) ? vCode
            : (parts.length ? (pCode ? pCode+'-'+parts.join('-') : parts.join('-')) : (vCode||pCode||'S/C'));
        skuEl.innerHTML = `<span class="material-icons" style="font-size:1rem;margin-right:5px;">qr_code_2</span> CÓD: ${disp}`;
    })();
};

window.vsDetD2 = function(prodId, dim2) {
    const prod = inventario.find(p => p.id === prodId) || window._detalleProductoActual;
    if (!prod) return;
    if (!_vsState[prodId]) initVsState(prod);
    _vsState[prodId].dim2 = dim2;
    const container = document.getElementById('variantes-selector-container');
    if (container) {
        container.querySelectorAll('[data-dim2]').forEach(btn => {
            const on = btn.dataset.dim2 === dim2;
            btn.style.background  = on ? 'var(--primary-blue,#2B6CB0)' : 'white';
            btn.style.color       = on ? 'white' : 'var(--primary-blue,#2B6CB0)';
            btn.style.borderColor = on ? 'var(--primary-blue,#2B6CB0)' : '#CBD5E0';
        });
    }
    _actualizarDetalleVarianteEmbebida(prod);
    (function() {
        const skuEl = document.getElementById('detalle-sku');
        if (!skuEl) return;
        const varSel = getSelectedVariante(prod);
        if (!varSel) return;
        const vCode = (varSel.codigo || varSel.id || '').trim();
        const pCode = (prod.codigo || '').trim();
        const parts = [varSel.varDim1, varSel.varDim2].filter(Boolean)
            .map(d => d.trim().replace(/\s+/g,'-').toUpperCase());
        const disp = (vCode && vCode !== pCode) ? vCode
            : (parts.length ? (pCode ? pCode+'-'+parts.join('-') : parts.join('-')) : (vCode||pCode||'S/C'));
        skuEl.innerHTML = `<span class="material-icons" style="font-size:1rem;margin-right:5px;">qr_code_2</span> CÓD: ${disp}`;
    })();
};


/* ==========================================================================
   3. CACHÉ DE INVENTARIO (sessionStorage)
   Evita ir a Firebase en cada página si el catálogo ya se descargó.
   TTL: 10 minutos. Se invalida al hacer cambios desde el admin.
   ========================================================================== */
const CACHE_KEY = 'enzoInvCache_v4'; // v4: fuerza recarga para orden correcto
const CACHE_TTL = 1 * 60 * 1000; // 1 minuto — productos con variantes se ven actualizados rápido

function guardarCacheInventario(data) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            ts: Date.now(),
            data: data
        }));
    } catch (e) {
        // sessionStorage lleno (ej: 500+ productos con imágenes base64) — ignoramos silenciosamente
        console.warn('Cache no disponible:', e.message);
    }
}

function leerCacheInventario() {
    try {
        // Si URL tiene ?nocache o ?t= forzar recarga (útil al volver del admin)
        if (window.location.search.includes('nocache')) {
            sessionStorage.removeItem(CACHE_KEY);
            return null;
        }
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        if (Date.now() - cache.ts > CACHE_TTL) {
            sessionStorage.removeItem(CACHE_KEY);
            return null;
        }
        return cache.data;
    } catch (e) {
        return null;
    }
}

function invalidarCacheInventario() {
    sessionStorage.removeItem(CACHE_KEY);
}

/* ==========================================================================
   4. CARGA DE PRODUCTOS DESDE FIREBASE (CON CACHÉ)
   ========================================================================== */
async function cargarProductosDesdeFirebase() {
    // 1. Intentar desde caché primero
    const cached = leerCacheInventario();
    if (cached && cached.length > 0) {
        inventario = cached;
    inventario.sort((a, b) => {
        const getCod = p => {
            if (p.tieneVariantes && p.variantes && p.variantes.length > 0) {
                const v = p.variantes[0];
                return (v.codigo || v.id || p.codigo || '').toLowerCase();
            }
            return (p.codigo || '\uFFFF').toLowerCase();
        };
        return getCod(a).localeCompare(getCod(b), 'es', { numeric: true });
    });
        console.log(`Inventario desde caché: ${inventario.length} productos`);
        renderizarSegunPagina();
        return;
    }

    // 2. Sin caché: ir a Firebase
    try {
        const snapshot = await db.collection("productos").get();
        inventario = [];
        snapshot.forEach(doc => {
            inventario.push({ id: doc.id, ...doc.data() });
        });
        console.log(`Inventario desde Firebase: ${inventario.length} productos`);
    inventario.sort((a, b) => {
        const getCod = p => {
            if (p.tieneVariantes && p.variantes && p.variantes.length > 0) {
                const v = p.variantes[0];
                return (v.codigo || v.id || p.codigo || '').toLowerCase();
            }
            return (p.codigo || '\uFFFF').toLowerCase();
        };
        return getCod(a).localeCompare(getCod(b), 'es', { numeric: true });
    });
        guardarCacheInventario(inventario);
        renderizarSegunPagina();
    } catch (error) {
        console.error("Error cargando productos:", error);
    }
}

// Renderiza el contenido correcto según la página actual
function renderizarSegunPagina() {
    const contenedorOfertas  = document.getElementById('contenedor-ofertas');
    const contenedorNuevos   = document.getElementById('contenedor-nuevos');
    const contenedorProductos = document.getElementById('contenedor-productos');
    const detailContainer    = document.getElementById('detail-container');

    if (contenedorOfertas) {
        const ofertas = deduplicarGrupos(inventario.filter(p => p.enOferta === true));
        renderizarGrid(ofertas, contenedorOfertas);
    }

    if (contenedorNuevos) {
        const nuevos = deduplicarGrupos(inventario.filter(p => p.nuevo === true)).slice(-12).reverse();
        renderizarGrid(nuevos, contenedorNuevos);
    }

    if (contenedorProductos) {
        const params  = new URLSearchParams(window.location.search);
        const urlCat  = params.get('category');
        const urlSearch = params.get('search');
        const titulo  = document.getElementById('titulo-catalogo');

        if (params.get('filter') === 'ofertas') {
            estado.soloOfertas = true;
            actualizarBotonOfertaVisualmente();
            if (titulo) titulo.textContent = "Ofertas Especiales";
        }

        if (urlCat) {
            estado.categoria = urlCat;
            if (titulo) titulo.textContent = "Categoría: " + urlCat.toUpperCase();
        }

        // Soporte para búsqueda por URL (?search=término)
        if (urlSearch && urlSearch.trim().length > 0) {
            estado.busqueda = urlSearch.trim().toLowerCase();
            if (titulo) titulo.textContent = `Resultados para: "${urlSearch}"`;
        }

        // Restaurar filtros SOLO si venimos del detalle (_fromDetail presente)
        const _savedE = sessionStorage.getItem('_catEstado');
        const _fromDet = sessionStorage.getItem('_fromDetail');
        if (_fromDet && _savedE) { try {
            const _e = JSON.parse(_savedE);
            if (_e.categoria)    estado.categoria    = _e.categoria;
            if (_e.paginaActual) estado.paginaActual = _e.paginaActual;
            if (_e.busqueda)     estado.busqueda     = _e.busqueda;
            estado.soloOfertas   = _e.soloOfertas   || false;
            estado.soloVariantes = _e.soloVariantes || false;
            estado.soloNuevos    = _e.soloNuevos    || false;
        } catch(e) {} }
        aplicarFiltrosGlobales();
    }

    if (detailContainer) {
        cargarDetalleProducto();
        setTimeout(() => detailContainer.classList.add('visible'), 50);
    }
}

/* ==========================================================================
   5. INICIALIZACIÓN UNIFICADA (UN SOLO DOMContentLoaded)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', function () {

    // A. Cargar inventario en paralelo (no bloquea el setup de UI)
    cargarProductosDesdeFirebase(); // sin await: renderizarSegunPagina() se llama sola al terminar

    // B. Verificar sesión del usuario
    verificarSesionUsuario();

    // C. Interfaz común
    actualizarBadgeCarrito();
    iniciarInterfaz();
    configurarEventosCarrito();
    activarDragCarruseles();
    configurarModalsServicios();
    configurarCheckout();

    // D. Sidebar y skeleton inicial (solo en catálogo)
    if (document.getElementById('contenedor-productos')) {
        mostrarSkeletons(document.getElementById('contenedor-productos'), 6);
        configurarListenersSidebar();
    }

    // E. Carruseles de home
    inicializarFlechasCarruseles();

    // F. Botón "seguir comprando"
    const btnKeepShopping = document.getElementById('btn-keep-shopping');
    if (btnKeepShopping) {
        btnKeepShopping.addEventListener('click', () => {
            cerrarCarrito();
        });
    }

    // G. Formulario de solicitud de acceso (cuenta.html)
    configurarFormularioSolicitud();

    console.log("Sistema cargado correctamente.");
});

/* ==========================================================================
   6. VERIFICACIÓN DE SESIÓN Y LÓGICA VIP POR APROBACIÓN
   ========================================================================== */
function verificarSesionUsuario() {
    const ADMIN_EMAIL = 'distribuidoraenzo28@gmail.com';

    auth.onAuthStateChanged(async (user) => {
        usuarioActual = user;

        const btnCuentaPC   = document.querySelector('.btn-outline.desktop-only');
        const authForms     = document.getElementById('auth-forms');
        const userDashboard = document.getElementById('user-dashboard');
        const solicitudBox  = document.getElementById('solicitud-box');

        if (user) {
            // Mostrar skeleton inmediato en cuenta.html
            const _skel = document.getElementById('auth-skeleton');
            const _af   = document.getElementById('auth-forms');
            const _ud   = document.getElementById('user-dashboard');
            if (_skel && _af && _ud && !_af.classList.contains('hidden')) {
                _af.classList.add('hidden');
                _skel.style.display = 'block';
            }

            // Si el admin llega a cuenta.html: cerrar su sesion para poder entrar como cliente
            if (user.email === ADMIN_EMAIL && window.location.pathname.includes('cuenta')) {
                const _af  = document.getElementById('auth-forms');
                const _sk  = document.getElementById('auth-skeleton');
                const _ud  = document.getElementById('user-dashboard');
                if (_sk)  _sk.style.display = 'none';
                if (_ud)  _ud.classList.add('hidden');
                if (_af)  _af.classList.remove('hidden');
                sessionStorage.removeItem('perfil_' + user.uid);
                auth.signOut();
                return;
            }

            // Verificar si el admin aprobó este usuario en Firestore
            let aprobado = false;
            let nombre   = user.displayName ? user.displayName.split(' ')[0] : 'Usuario';
            let foto     = user.photoURL;

            const _ck = 'perfil_' + user.uid;
            try { const _c = sessionStorage.getItem(_ck);
                if (_c) { const _d = JSON.parse(_c);
                    if (_d.aprobado) { aprobado = true; window._perfilUsuario = _d; window._perfilUsuarioId = user.uid; }
                    if (_d.nombre) nombre = _d.nombre.split(' ')[0];
                    if (_d.foto) foto = _d.foto; }
            } catch(e) {}
            try {
                const docUsuario = await db.collection("usuarios").doc(user.uid).get();
                if (docUsuario.exists) {
                    const data = docUsuario.data();
                    aprobado   = data.aprobado === true;
                    if (data.foto)   foto   = data.foto;
                    if (data.nombre) nombre = data.nombre.split(' ')[0];
                    sessionStorage.setItem(_ck, JSON.stringify(data));
                    // Guardar perfil para pre-llenar checkout
                    if (aprobado) {
                        window._perfilUsuario  = data;
                        window._perfilUsuarioId = docUsuario.id;
                        cargarSetFavoritos(user.uid);
                    }

                    // Actualizar nombre completo en dashboard
                    const profileName = document.getElementById('profile-name');
                    if (profileName && data.nombre) profileName.textContent = data.nombre;
                }
            } catch (err) {
                console.warn("No se pudo leer perfil:", err);
            }

            usuarioEsVIP = aprobado;
            actualizarBtnCheckoutPorVIP(); // Sincronizar botón del carrito

            // Header — pastilla de cuenta
            if (btnCuentaPC) {
                btnCuentaPC.classList.add('vip-active');
                const avatarHtml = foto
                    ? `<img src="${foto}" class="header-avatar" alt="Avatar">`
                    : `<div class="header-avatar" style="background:#2D3748;display:flex;align-items:center;justify-content:center;color:#F6E05E;"><span class="material-icons" style="font-size:1.2rem;">star</span></div>`;
                btnCuentaPC.innerHTML = `${avatarHtml}<div class="header-user-info"><span class="header-vip-tag">${aprobado ? 'VIP' : 'PENDIENTE'}</span><span class="header-username">${nombre}</span></div>`;
                btnCuentaPC.onclick = (e) => { e.preventDefault(); window.location.href = 'cuenta.html'; };
            }

            // Dashboard en cuenta.html
            if (userDashboard && authForms) {
                authForms.classList.add('hidden');
                if (solicitudBox) solicitudBox.classList.add('hidden');
                userDashboard.classList.remove('hidden');
                const _skelEl = document.getElementById('auth-skeleton');
                if (_skelEl) _skelEl.style.display = 'none';

                const profileEmail = document.getElementById('profile-email');
                if (profileEmail) profileEmail.textContent = user.email;

                // Mostrar foto de perfil en dashboard
                const avImg = document.getElementById('profile-avatar-img');
                const avIco = document.getElementById('profile-avatar-icon');
                if (avImg && foto) { avImg.src = foto; avImg.style.display = 'block'; }
                if (avIco && foto) avIco.style.display = 'none';

                const previewEdit = document.getElementById('preview-edit-perfil');
                if (previewEdit && foto) previewEdit.src = foto;

                // Mostrar advertencia si está pendiente de aprobación
                const pendienteBox = document.getElementById('pendiente-aprobacion-box');
                if (pendienteBox) {
                    pendienteBox.style.display = aprobado ? 'none' : 'block';
                }
            }

        } else {
            // No logueado
            usuarioEsVIP = false;
            actualizarBtnCheckoutPorVIP(); // Sincronizar botón del carrito

            if (btnCuentaPC) {
                btnCuentaPC.classList.remove('vip-active');
                btnCuentaPC.textContent = "CUENTA";
                btnCuentaPC.setAttribute('style', '');
                btnCuentaPC.onclick = () => window.location.href = 'cuenta.html';
            }

            if (userDashboard && authForms) {
                authForms.classList.remove('hidden');
                userDashboard.classList.add('hidden');
            }
        }

        // Recalcular precios tras conocer el estado VIP
        const contenedorProductos = document.getElementById('contenedor-productos');
        if (contenedorProductos && inventario.length > 0) aplicarFiltrosGlobales();

        const contenedorOfertas = document.getElementById('contenedor-ofertas');
        if (contenedorOfertas && inventario.length > 0) {
            renderizarGrid(deduplicarGrupos(inventario.filter(p => p.enOferta === true)), contenedorOfertas);
        }

        // Re-renderizar carrusel de Últimos Ingresos con precios VIP
        const contenedorNuevos = document.getElementById('contenedor-nuevos');
        if (contenedorNuevos && inventario.length > 0) {
            const nuevos = deduplicarGrupos(inventario.filter(p => p.nuevo === true)).slice(-12).reverse();
            renderizarGrid(nuevos, contenedorNuevos);
        }

        const detailContainer = document.getElementById('detail-container');
        // Siempre re-renderizar detalle al conocer el estado VIP (puede haber cargado antes que Auth)
        if (detailContainer && inventario.length > 0) cargarDetalleProducto();
    });
}

/* ==========================================================================
   7. FORMULARIO DE SOLICITUD DE ACCESO (cuenta.html)
   El usuario que no tiene cuenta llena este form en lugar de registrarse.
   ========================================================================== */
function configurarFormularioSolicitud() {
    const form = document.getElementById('form-solicitud-acceso');
    if (!form) return;

    /* Usamos onclick en el botón como método principal para evitar
       problemas con el evento submit en paneles ocultos/mostrados dinámicamente */
    const btnSubmit = form.querySelector('button[type="submit"]');
    if (btnSubmit) {
        btnSubmit.addEventListener('click', (e) => {
            e.preventDefault();
            enviarSolicitudAcceso();
        });
    }
    /* También escuchamos submit como respaldo */
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        enviarSolicitudAcceso();
    });
}

async function enviarSolicitudAcceso() {
    const form    = document.getElementById('form-solicitud-acceso');
    const btnSubmit = form ? form.querySelector('button[type="submit"]') : null;
    const errDiv  = document.getElementById('solicitud-error-msg');

    if (!form) return;

    /* Leer campos */
    const nombre    = document.getElementById('sol-nombre')?.value.trim()    || '';
    const dni       = document.getElementById('sol-dni')?.value.trim()       || '';
    const telefono  = document.getElementById('sol-telefono')?.value.trim()  || '';
    const negocio   = document.getElementById('sol-negocio')?.value.trim()   || '';
    const cuit      = document.getElementById('sol-cuit')?.value.trim()      || '';
    const ciudad    = document.getElementById('sol-ciudad')?.value.trim()    || '';
    const direccion = document.getElementById('sol-direccion')?.value.trim() || '';
    const email     = document.getElementById('sol-email')?.value.trim()     || '';

    /* Validar — DNI es obligatorio */
    if (!nombre || !dni || !telefono || !negocio || !cuit || !ciudad || !direccion) {
        if (errDiv) {
            errDiv.textContent = '⚠️ Por favor completá todos los campos obligatorios (*).';
            errDiv.style.display = 'block';
        }
        return;
    }
    if (dni.length < 7 || dni.length > 8) {
        if (errDiv) {
            errDiv.textContent = '⚠️ El DNI debe tener 7 u 8 dígitos sin puntos.';
            errDiv.style.display = 'block';
        }
        return;
    }
    if (errDiv) errDiv.style.display = 'none';

    const datos = {
        nombre, dni, negocio, telefono, cuit, ciudad, direccion, email,
        fecha:    new Date(),
        estado:   'pendiente',
        aprobado: false
    };

    if (btnSubmit) {
        btnSubmit.innerHTML = '<span class="material-icons" style="vertical-align:middle;font-size:1rem;animation:spin 1s linear infinite;">autorenew</span> Enviando...';
        btnSubmit.disabled  = true;
    }

    try {
        await db.collection('solicitudes_acceso').add(datos);

        /* Éxito — reemplazar el contenido del panel con mensaje */
        const panel = document.getElementById('panel-solicitud');
        if (panel) {
            panel.innerHTML = `
                <div style="text-align:center;padding:40px 20px;">
                    <span class="material-icons" style="font-size:4rem;color:#38A169;">check_circle</span>
                    <h3 style="margin:16px 0 10px;color:#22543D;font-size:1.4rem;">¡Solicitud enviada!</h3>
                    <p style="color:#4A5568;font-size:0.95rem;line-height:1.7;max-width:340px;margin:0 auto;">
                        Recibimos tus datos. Enzo revisará tu solicitud y te contactará por
                        <strong>WhatsApp</strong> para confirmar tu acceso.<br>
                        Normalmente respondemos en menos de 24 horas.
                    </p>
                    <a href="index.html"
                       style="display:inline-flex;align-items:center;gap:6px;margin-top:24px;
                              background:var(--primary-blue,#2B6CB0);color:white;padding:12px 24px;
                              border-radius:10px;font-weight:700;text-decoration:none;font-size:0.95rem;">
                        <span class="material-icons" style="font-size:1.1rem;">arrow_back</span>
                        Volver a la tienda
                    </a>
                </div>`;
        }
    } catch (error) {
        console.error('Error al enviar solicitud:', error);
        if (errDiv) {
            errDiv.textContent = '❌ Error de conexión (' + (error.code || error.message) + '). Intentá de nuevo.';
            errDiv.style.display = 'block';
        }
        if (btnSubmit) {
            btnSubmit.innerHTML = '<span class="material-icons" style="vertical-align:middle;font-size:1.1rem;">send</span> ENVIAR SOLICITUD';
            btnSubmit.disabled  = false;
        }
    }
}

/* ==========================================================================
   8. LOGIN (cuenta.html)
   ========================================================================== */
// Login con email
const authContainer = document.getElementById('auth-forms');
if (authContainer) {

    // Login — acepta teléfono O email
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn      = formLogin.querySelector('button[type="submit"]');
            const input    = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-pass').value;
            const errDiv   = document.getElementById('login-error-msg');

            if (!input || !password) {
                if (errDiv) { errDiv.textContent = '⚠️ Completá el usuario y la contraseña.'; errDiv.style.display = 'block'; }
                return;
            }
            if (errDiv) errDiv.style.display = 'none';

            btn.textContent = "Ingresando...";
            btn.disabled    = true;

            try {
                let emailParaLogin = input;

                /* ── Si no tiene "@" → es un DNI → buscar email en Firestore ── */
                const esEmail = input.includes('@');
                if (!esEmail) {
                    const dniNorm = input.replace(/\D/g, ''); // solo dígitos

                    if (dniNorm.length < 7 || dniNorm.length > 8) {
                        if (errDiv) {
                            errDiv.textContent = '❌ Formato incorrecto. Ingresá tu DNI (7-8 dígitos) o tu email completo.';
                            errDiv.style.display = 'block';
                        }
                        btn.textContent = 'INGRESAR';
                        btn.disabled    = false;
                        return;
                    }

                    // Buscar en "login_index" — colección pública (lectura sin auth)
                    // El usuario no está autenticado todavía, por eso no podemos
                    // leer "usuarios" directamente (reglas lo bloquean).
                    // "login_index" solo tiene {email} por DNI — sin datos sensibles.
                    const loginDoc = await db.collection('login_index').doc(dniNorm).get();

                    if (!loginDoc.exists || !loginDoc.data().email) {
                        if (errDiv) {
                            errDiv.textContent = '❌ No encontramos una cuenta con ese DNI. Verificá el número o ingresá con tu email.';
                            errDiv.style.display = 'block';
                        }
                        btn.textContent = 'INGRESAR';
                        btn.disabled    = false;
                        return;
                    }
                    emailParaLogin = loginDoc.data().email;
                }

                /* ── Login con Firebase Auth ── */
                const cred = await auth.signInWithEmailAndPassword(emailParaLogin, password);
                mostrarNotificacion(`¡Hola de nuevo, ${cred.user.displayName || 'Usuario'}!`);
                setTimeout(() => window.location.href = "index.html", 1000);

            } catch (error) {
                console.error("Error de login:", error);
                let msg = 'Error al ingresar. Intentá de nuevo.';
                if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                    msg = '❌ Contraseña incorrecta. Verificá tus datos o usá "Olvidaste tu contraseña".';
                } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
                    msg = '❌ No encontramos una cuenta con ese email. Verificá o solicitá acceso.';
                } else if (error.code === 'auth/too-many-requests') {
                    msg = '⚠️ Demasiados intentos. Esperá unos minutos o recuperá tu contraseña.';
                }
                if (errDiv) { errDiv.textContent = msg; errDiv.style.display = 'block'; }
                btn.textContent = "INGRESAR";
                btn.disabled    = false;
            }
        });
    }

    /* La edición de perfil (abrirEditarPerfil + submit de #form-editar-perfil)
       vive en el script inline de cuenta.html — acá había una versión vieja
       duplicada que apuntaba a IDs inexistentes y rompía el guardado. */
}

// Auxiliar base64
const imagenATexto = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload  = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
});

// Cerrar sesión global
window.cerrarSesionTotal = function () {
    if (confirm("¿Seguro que quieres salir?")) {
        const _so_uid = auth.currentUser ? auth.currentUser.uid : null;
        if (_so_uid) sessionStorage.removeItem('perfil_' + _so_uid);
        auth.signOut().then(() => window.location.reload());
    }
};

/* ==========================================================================
   9. FILTROS (SIDEBAR)
   ========================================================================== */
function configurarListenersSidebar() {
    const titulo = document.getElementById('titulo-catalogo');

    document.querySelectorAll('.btn-cat').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const cat = btn.getAttribute('data-category');
            estado.categoria = cat;

            if (cat === 'all') {
                estado.soloOfertas = false;
                estado.precioMin   = 0;
                estado.precioMax   = 99999999;
                actualizarBotonOfertaVisualmente();
                resetearBotonesPrecio();
                if (titulo) titulo.textContent = "Catálogo Completo";
            } else {
                if (titulo) {
                    const padre     = btn.closest('.main-cat-item');
                    const linkPadre = padre ? padre.querySelector('.main-cat-link') : null;
                    if (linkPadre) {
                        titulo.textContent = `${linkPadre.firstChild.textContent.trim()} / ${btn.innerText}`;
                    } else {
                        titulo.textContent = btn.innerText.replace('more_horiz', '').trim();
                    }
                }
            }
            estado.paginaActual = 1;
            aplicarFiltrosGlobales();
            cerrarSidebarMovil();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    document.querySelectorAll('.btn-precio').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const minClic = Number(btn.getAttribute('data-min'));
            const maxClic = Number(btn.getAttribute('data-max'));

            if (estado.precioMin === minClic && estado.precioMax === maxClic) {
                estado.precioMin = 0;
                estado.precioMax = 99999999;
                btn.style.fontWeight = 'normal';
                btn.style.color = '';
            } else {
                resetearBotonesPrecio();
                btn.style.fontWeight = 'bold';
                btn.style.color = '#FF6600';
                estado.precioMin = minClic;
                estado.precioMax = maxClic;
            }
            estado.paginaActual = 1;
            aplicarFiltrosGlobales();
            cerrarSidebarMovil();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    const btnNuevoIngreso = document.getElementById('btn-filtro-nuevo');
    if (btnNuevoIngreso) {
        btnNuevoIngreso.addEventListener('click', (e) => {
            e.preventDefault();
            estado.soloNuevos = !estado.soloNuevos;
            btnNuevoIngreso.style.color      = estado.soloNuevos ? '#38A169' : '';
            btnNuevoIngreso.style.fontWeight = estado.soloNuevos ? 'bold' : '';
            estado.paginaActual = 1;
            aplicarFiltrosGlobales();
            cerrarSidebarMovil();
        });
    }

    const btnVariantesFiltro = document.getElementById('btn-filtro-variantes');
    if (btnVariantesFiltro) {
        btnVariantesFiltro.addEventListener('click', (e) => {
            e.preventDefault();
            estado.soloVariantes = !estado.soloVariantes;
            btnVariantesFiltro.style.color = estado.soloVariantes ? '#2B6CB0' : '';
            btnVariantesFiltro.style.fontWeight = estado.soloVariantes ? 'bold' : '';
            estado.paginaActual = 1;
            aplicarFiltrosGlobales();
            cerrarSidebarMovil();
        });
    }

    const btnOferta = document.getElementById('btn-filtro-ofertas');
    if (btnOferta) {
        btnOferta.addEventListener('click', (e) => {
            e.preventDefault();
            estado.soloOfertas = !estado.soloOfertas;
            actualizarBotonOfertaVisualmente();
            if (titulo) titulo.textContent = estado.soloOfertas ? "Ofertas Especiales" : (estado.categoria === 'all' ? "Catálogo Completo" : titulo.textContent);
            estado.paginaActual = 1;
            aplicarFiltrosGlobales();
            cerrarSidebarMovil();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

function actualizarBotonOfertaVisualmente() {
    const btn = document.getElementById('btn-filtro-ofertas');
    if (!btn) return;
    if (estado.soloOfertas) {
        btn.style.color = "#FF6600";
        btn.innerHTML = '<span class="material-icons">check_box</span> Ofertas Activadas';
    } else {
        btn.style.color = "";
        btn.innerHTML = '<span class="material-icons">local_offer</span> Ver Solo Ofertas';
    }
}

function resetearBotonesPrecio() {
    document.querySelectorAll('.btn-precio').forEach(b => {
        b.style.fontWeight = 'normal';
        b.style.color = '';
    });
}

// Mapa de prefijos para filtrado por categoría padre (desde banners del home u otros links)
const CATEGORIAS_PADRE = {
    'griferias':    ['griferia-bano','griferia-cocina','griferia-jardin','griferia-repuestos','griferia-accesorios'],
    'herramientas': ['electricas','manuales','inalambricas','herr-accesorios','herr-cajas','herr-tanzas'],
    'iluminacion':  ['ilum-led','ilum-especiales','ilum-plafones','ilum-reflectores','ilum-tubos','ilum-apliques','ilum-colgantes','ilum-exterior'],
    'pintureria':   ['pintura-interior','pintura-pinceles','pintura-lijas','pintura-disolventes','pintura-imper','pintura-aerosol'],
    'electricidad': ['cables','protecciones','elec-termicas','tomas e interruptores','elec-fichas','elec-tableros','cintas'],
    'buloneria':    ['tornillos','tuercas y arandelas','bulones','tarugos y fijaciones','clavos','remaches'],
    'seguridad':    ['seguridad-cerraduras','seguridad-camaras','seguridad-alarmas','seguridad-guantes','seguridad-epp','seguridad-matafuegos'],
    'hogar':        ['hogar-electrodomesticos','hogar-muebles','hogar-camaras','hogar-organizadores','productos de limpieza','hogar-tanzas']
};

// =================================================================
// RESTAURAR POSICION DEL CATALOGO AL VOLVER DEL DETALLE
//
// IMPORTANTE: solo guardamos estado cuando el usuario navega
// ESPECIFICAMENTE a detalle.html. El pagehide no se usa porque
// dispara en cualquier navegacion (ej: "Ver catalogo completo")
// y rompe los filtros al volver.
// =================================================================

function guardarPosicionCatalogo(prodId) {
    try {
        sessionStorage.setItem('_catEstado', JSON.stringify({
            categoria:     estado.categoria,
            busqueda:      estado.busqueda,
            paginaActual:  estado.paginaActual,
            soloOfertas:   estado.soloOfertas,
            soloVariantes: estado.soloVariantes,
            soloNuevos:    estado.soloNuevos,
        }));
        if (prodId) sessionStorage.setItem('_catProdId', prodId);
        sessionStorage.setItem('_fromDetail', '1');
    } catch(e) {}
}

function restaurarPosicionCatalogo() {
    if (!sessionStorage.getItem('_fromDetail')) return;
    const prodId = sessionStorage.getItem('_catProdId');
    sessionStorage.removeItem('_catEstado');
    sessionStorage.removeItem('_catProdId');
    sessionStorage.removeItem('_fromDetail');
    if (!prodId) return;
    // Polling: buscar la tarjeta cada 100ms hasta que aparezca (max 3s)
    var _intentos = 0;
    var _timer = setInterval(function() {
        _intentos++;
        if (_intentos > 30) { clearInterval(_timer); return; } // max 3s
        var card = document.querySelector('[data-prod-id="' + prodId + '"]');
        if (card) {
            clearInterval(_timer);
            // Calcular posicion y scrollear la ventana directamente
            var rect = card.getBoundingClientRect();
            var scrollTop = window.pageYOffset + rect.top - (window.innerHeight / 2) + (rect.height / 2);
            window.scrollTo({ top: Math.max(0, scrollTop), behavior: 'instant' });
        }
    }, 100);
}

// Interceptar clicks que navegan a detalle.html (capture phase = antes del onclick)
document.addEventListener('click', function(e) {
    if (!document.getElementById('contenedor-productos')) return;
    // Skip: card action buttons (fav, share, add-to-cart)
    if (e.target.closest('.card-fav-btn, .card-share-btn, .add-to-cart-btn, .btn-add, .vs-btn')) return;
    // Buscar el article padre con data-prod-id (forma mas confiable)
    const art = e.target.closest('[data-prod-id]');
    if (!art) return;
    const prodId = art.dataset.prodId;
    if (!prodId) return;
    // Solo guardar si el click va a navegar a detalle (no si abre modal o agrega al carrito)
    const target = e.target.closest('a[href*="detalle.html"]');
    const isDetailNav = target || 
        (e.target.closest('[onclick*="detalle.html"]'));
    // Tambien guardar si el click es en la imagen o nombre del producto (dentro del <a>)
    const inLink = e.target.closest('a[href]');
    const linkHref = inLink && inLink.getAttribute('href') || '';
    if (isDetailNav || linkHref.includes('detalle.html')) {
        guardarPosicionCatalogo(prodId);
    }
}, true);

function aplicarFiltrosGlobales() {
    restaurarPosicionCatalogo(); // inicia el polling si venimos del detalle
    const resultado = inventario.filter(prod => {
        let pasaCat;
        if (estado.categoria === 'all') {
            pasaCat = true;
        } else if (CATEGORIAS_PADRE[estado.categoria]) {
            // Filtrado por categoría padre: incluye todos sus sub-items
            pasaCat = CATEGORIAS_PADRE[estado.categoria].includes(prod.categoria);
        } else {
            pasaCat = (prod.categoria === estado.categoria);
        }
        const pasaPrecio = prod.precio >= estado.precioMin && prod.precio <= estado.precioMax;
        const pasaOferta    = estado.soloOfertas  ? prod.enOferta === true : true;
        const pasaVariantes = estado.soloVariantes ? prod.tieneVariantes === true : true;
        const pasaNuevo     = estado.soloNuevos     ? prod.nuevo === true : true;
        const pasaBusqueda = !estado.busqueda || (
            (prod.nombre   || '').toLowerCase().includes(estado.busqueda) ||
            (prod.marca    || '').toLowerCase().includes(estado.busqueda) ||
            (prod.categoria || '').toLowerCase().includes(estado.busqueda) ||
            (prod.id       || '').toLowerCase().includes(estado.busqueda)
        );
        return pasaCat && pasaPrecio && pasaOferta && pasaVariantes && pasaNuevo && pasaBusqueda;
    });
    // Mostrar solo UN producto por grupoId en el catálogo (el representante)
    estado.productosFiltrados = deduplicarGrupos(resultado);

    // Recuperar preferencia de cantidad guardada (solo la primera vez)
    if (!window._pppCargado) {
        try {
            const guardado = localStorage.getItem('enzoPPP');
            if (guardado) {
                estado.productosPorPagina = guardado === 'todos'
                    ? estado.productosFiltrados.length || 9999
                    : parseInt(guardado);
            }
        } catch(e) {}
        window._pppCargado = true;
    }

    gestionarPaginacion();
}

function deduplicarGrupos(lista) {
    const gruposVistos = new Set();
    return lista.filter(prod => {
        if (!prod.grupoId) return true;             // sin grupo → siempre visible
        if (gruposVistos.has(prod.grupoId)) return false; // ya hay representante
        gruposVistos.add(prod.grupoId);
        return true;                                // primer SKU del grupo → representante
    });
}

/* ==========================================================================
   10. PAGINACIÓN Y RENDERIZADO
   ========================================================================== */
function gestionarPaginacion() {
    const contenedor           = document.getElementById('contenedor-productos');
    const contenedorPaginacion = document.querySelector('.pagination-container');

    const inicio            = (estado.paginaActual - 1) * estado.productosPorPagina;
    const fin               = inicio + estado.productosPorPagina;
    const productosPagina   = estado.productosFiltrados.slice(inicio, fin);

    renderizarGrid(productosPagina, contenedor);

    const totalPaginas = Math.ceil(estado.productosFiltrados.length / estado.productosPorPagina);
    let htmlBotones = '';

    if (totalPaginas > 1) {
        if (estado.paginaActual > 1)
            htmlBotones += `<button class="page-btn" onclick="cambiarPagina(${estado.paginaActual - 1})">&laquo;</button>`;

        let maxBotones = 7;
        let startPage  = Math.max(1, estado.paginaActual - Math.floor(maxBotones / 2));
        let endPage    = startPage + maxBotones - 1;
        if (endPage > totalPaginas) { endPage = totalPaginas; startPage = Math.max(1, endPage - maxBotones + 1); }

        for (let i = startPage; i <= endPage; i++) {
            htmlBotones += `<button class="page-btn ${i === estado.paginaActual ? 'active' : ''}" onclick="cambiarPagina(${i})">${i}</button>`;
        }
        if (endPage < totalPaginas) {
            htmlBotones += `<span style="padding:10px;color:#718096;font-weight:bold;">...</span>`;
            htmlBotones += `<button class="page-btn" onclick="cambiarPagina(${totalPaginas})">${totalPaginas}</button>`;
        }
        if (estado.paginaActual < totalPaginas)
            htmlBotones += `<button class="page-btn" onclick="cambiarPagina(${estado.paginaActual + 1})">&raquo;</button>`;
    }

    // ── Selector PPP — barra superior sobre el grid ─────────────────────────────
    if (contenedor) {
        const total     = estado.productosFiltrados.length;
        const pppActual = estado.productosPorPagina;
        const opcionesPPP = [24, 48, 100];

        let barraId = 'enzo-ppp-bar';
        let barra   = document.getElementById(barraId);
        if (!barra) {
            barra = document.createElement('div');
            barra.id = barraId;
            contenedor.parentNode.insertBefore(barra, contenedor);
        }

        let btns = opcionesPPP.map(n => {
            const on = pppActual === n;
            return `<button onclick="cambiarProductosPorPagina(${n})"
                style="padding:6px 14px;border-radius:20px;font-size:0.82rem;font-weight:700;cursor:pointer;
                border:1.5px solid ${on?'#3182CE':'#CBD5E0'};
                background:${on?'#3182CE':'white'};
                color:${on?'white':'#4A5568'};
                transition:all .15s;">${n}</button>`;
        }).join('');

        if (total > 100 && total <= 500) {
            const on = pppActual >= total;
            btns += `<button onclick="cambiarProductosPorPagina('todos')"
                style="padding:6px 14px;border-radius:20px;font-size:0.82rem;font-weight:700;cursor:pointer;
                border:1.5px solid ${on?'#3182CE':'#CBD5E0'};
                background:${on?'#3182CE':'white'};
                color:${on?'white':'#4A5568'};
                transition:all .15s;">Todos</button>`;
        }

        barra.innerHTML = `
            <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;
                        gap:10px;padding:10px 14px;margin-bottom:16px;
                        background:white;border-radius:10px;border:1px solid #E2E8F0;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:0.82rem;font-weight:700;color:#718096;white-space:nowrap;">Ver por página:</span>
                    <div style="display:flex;gap:6px;">${btns}</div>
                </div>
                <span style="font-size:0.82rem;color:#A0AEC0;white-space:nowrap;">
                    ${total} producto${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}
                </span>
            </div>`;
    }

    // ── Paginación inferior — solo los botones de página ─────────────────────
    if (contenedorPaginacion) {
        contenedorPaginacion.innerHTML = htmlBotones
            ? `<div style="display:flex;gap:4px;align-items:center;justify-content:center;">${htmlBotones}</div>`
            : '';
    }
}

window.cambiarPagina = function (num) {
    const contenedor = document.getElementById('contenedor-productos');
    contenedor.classList.add('loading');
    setTimeout(() => {
        estado.paginaActual = num;
        gestionarPaginacion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => contenedor.classList.remove('loading'), 50);
    }, 300);
};

window.cambiarProductosPorPagina = function(valor) {
    estado.productosPorPagina = valor === 'todos'
        ? estado.productosFiltrados.length || 9999
        : parseInt(valor);
    estado.paginaActual = 1;
    try { localStorage.setItem('enzoPPP', valor); } catch(e) {}
    gestionarPaginacion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

/* ==========================================================================
   10B. VARIANTES DE PRODUCTO — selector en detalle.html
   ========================================================================== */

function renderizarVariantes(producto) {
    const container = document.getElementById('variantes-selector-container');
    if (!container) return;

    // Sistema B antiguo: SKUs separados con grupoId — navega entre páginas
    if (producto.grupoId && !producto.tieneVariantes) {
        renderizarGrupo(producto);
        return;
    }

    // Sin variantes
    if (!producto.tieneVariantes || !producto.variantes || producto.variantes.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Nuevo sistema: variantes embebidas con varDim1/varDim2 → selector 2D en página
    if (producto.variantes.some(v => v.varDim1)) {
        _renderizarSelectorEmbebido(producto, container);
        _actualizarDetalleVarianteEmbebida(producto);
        return;
    }

    // Sistema A antiguo: variantes simples con solo etiqueta (sin dims) — sin cambios
    const label = producto.variantesLabel || 'Variante';
    let html = `
        <div style="margin-bottom:6px;">
            <span style="font-size:0.8rem;font-weight:700;color:#4A5568;text-transform:uppercase;letter-spacing:.04em;">
                Seleccioná el ${label}:
            </span>
        </div>
        <div id="variantes-botones" style="display:flex;flex-wrap:wrap;gap:8px;">`;
    producto.variantes.forEach((v, idx) => {
        const esActivo = idx === 0;
        html += `<button
                id="var-btn-${v.id}"
                onclick="seleccionarVariante('${producto.id}', '${v.id}')"
                style="
                    padding: 7px 18px;
                    border-radius: 20px;
                    font-size: 0.88rem;
                    font-weight: 700;
                    cursor: pointer;
                    border: 2px solid var(--primary-blue, #2B6CB0);
                    background: ${esActivo ? 'var(--primary-blue, #2B6CB0)' : 'white'};
                    color: ${esActivo ? 'white' : 'var(--primary-blue, #2B6CB0)'};
                    transition: all .15s;
                ">
                ${v.etiqueta}
            </button>`;
    });
    html += '</div>';
    container.innerHTML = html;
    container.style.display = 'block';
    seleccionarVariante(producto.id, producto.variantes[0].id, false);
}


/* ── SISTEMA B: Grupos — cada variante tiene SKU propio en Firestore ────── */
async function renderizarGrupo(productoActual) {
    const container = document.getElementById('variantes-selector-container');
    if (!container || !productoActual.grupoId) return;

    const grupoProductos = inventario.filter(p => p.grupoId === productoActual.grupoId);
    if (grupoProductos.length <= 1) { container.style.display = 'none'; return; }

    // Ordenar variantes: numérico si el valor contiene un número al inicio, sino alfabético
    const ordenarVariantes = arr => [...arr].sort((a, b) => {
        const nA = parseFloat(String(a).replace(',', '.'));
        const nB = parseFloat(String(b).replace(',', '.'));
        if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
        return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' });
    });

    const dim1s = ordenarVariantes([...new Set(grupoProductos.map(p => p.varDim1).filter(Boolean))]);
    const dim2s = ordenarVariantes([...new Set(grupoProductos.map(p => p.varDim2).filter(Boolean))]);
    const tiene2dims = dim2s.length > 0;
    const labelDim1  = productoActual.labelDim1 || 'Opción';
    const labelDim2  = productoActual.labelDim2 || 'Medida';
    const dim1Activa = productoActual.varDim1;
    const dim2Activa = productoActual.varDim2;

    // Helper: escapa comillas dobles en valores usados dentro de atributos HTML onclick
    const esc = s => String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');

    let html = '<div style="display:flex;flex-direction:column;gap:14px;">';

    // Fila Dim 1
    html += `<div>
        <div style="font-size:0.78rem;font-weight:700;color:#4A5568;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">${labelDim1}:</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">`;
    dim1s.forEach(dim1 => {
        const activo  = dim1 === dim1Activa;
        const onclick = tiene2dims
            ? `navegarAVariante('${esc(productoActual.grupoId)}','${esc(dim1)}','${esc(dim2Activa || dim2s[0])}')`
            : `navegarAVarianteDim1('${esc(productoActual.grupoId)}','${esc(dim1)}')`;
        html += `<button onclick="${onclick}"
            style="padding:7px 18px;border-radius:20px;font-size:0.88rem;font-weight:700;cursor:pointer;
                   border:2px solid var(--primary-blue,#2B6CB0);transition:all .15s;
                   background:${activo ? 'var(--primary-blue,#2B6CB0)' : 'white'};
                   color:${activo ? 'white' : 'var(--primary-blue,#2B6CB0)'};">${dim1}</button>`;
    });
    html += '</div></div>';

    // Fila Dim 2 (si existe)
    if (tiene2dims) {
        const dim2sDisp = [...new Set(grupoProductos.filter(p => p.varDim1 === dim1Activa).map(p => p.varDim2).filter(Boolean))];
        html += `<div>
            <div style="font-size:0.78rem;font-weight:700;color:#4A5568;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">${labelDim2}:</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">`;
        dim2s.forEach(dim2 => {
            const activo     = dim2 === dim2Activa;
            const disponible = dim2sDisp.includes(dim2);
            html += `<button onclick="navegarAVariante('${esc(productoActual.grupoId)}','${esc(dim1Activa)}','${esc(dim2)}')"
                ${!disponible ? 'disabled title="No disponible"' : ''}
                style="padding:7px 18px;border-radius:20px;font-size:0.88rem;font-weight:700;
                       cursor:${disponible ? 'pointer' : 'not-allowed'};transition:all .15s;
                       border:2px solid ${activo ? 'var(--primary-blue,#2B6CB0)' : disponible ? '#CBD5E0' : '#EDF2F7'};
                       background:${activo ? 'var(--primary-blue,#2B6CB0)' : 'white'};
                       color:${activo ? 'white' : disponible ? '#4A5568' : '#CBD5E0'};">${dim2}</button>`;
        });
        html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;
    container.style.display = 'block';
}

window.navegarAVariante = function(grupoId, dim1, dim2) {
    // Buscar la combinación exacta
    let destino = inventario.find(p => p.grupoId === grupoId && p.varDim1 === dim1 && p.varDim2 === dim2);
    // Si no existe (ej: "Tripolar 16A" no tiene ese amperaje), ir al primer disponible de esa dim1
    if (!destino) {
        destino = inventario.find(p => p.grupoId === grupoId && p.varDim1 === dim1);
    }
    if (destino) window.location.href = `detalle.html?id=${destino.id}`;
};

window.navegarAVarianteDim1 = function(grupoId, dim1) {
    const destino = inventario.find(p => p.grupoId === grupoId && p.varDim1 === dim1);
    if (destino) window.location.href = `detalle.html?id=${destino.id}`;
};

window.seleccionarVariante = function(productoId, varianteId, animarImagen = true) {
    const producto = inventario.find(p => p.id == productoId);
    if (!producto || !producto.variantes) return;

    const variante = producto.variantes.find(v => v.id === varianteId);
    if (!variante) return;

    // Actualizar botones activos
    producto.variantes.forEach(v => {
        const btn = document.getElementById(`var-btn-${v.id}`);
        if (!btn) return;
        const activo = v.id === varianteId;
        btn.style.background = activo ? 'var(--primary-blue, #2B6CB0)' : 'white';
        btn.style.color      = activo ? 'white' : 'var(--primary-blue, #2B6CB0)';
    });

    // Actualizar imagen
    const imgEl = document.getElementById('detail-image');
    if (imgEl && variante.imagen) {
        if (animarImagen) {
            imgEl.style.opacity = '0';
            imgEl.style.transition = 'opacity .2s';
            setTimeout(() => {
                imgEl.src = variante.imagen;
                imgEl.style.opacity = '1';
            }, 200);
        } else {
            imgEl.src = variante.imagen;
        }
    }

    // Actualizar nombre
    const nameEl = document.getElementById('detail-name');
    if (nameEl && variante.nombre) nameEl.textContent = variante.nombre;

    // Actualizar descripción
    const descEl = document.getElementById('detail-desc');
    if (descEl && variante.descripcion) descEl.textContent = variante.descripcion;

    // Actualizar stock
    const stockBox = document.getElementById('detalle-stock-box');
    if (stockBox) {
        const hayStock = variante.stock > 0;
        stockBox.innerHTML = `
            <span class="material-icons" style="font-size:1.2rem;color:${hayStock ? '#38A169' : '#E53E3E'}">inventory_2</span>
            <span>Stock Disponible: <strong style="color:${hayStock ? '#38A169' : '#E53E3E'};font-size:1.1rem;">${variante.stock} u.</strong></span>`;
    }

    // Actualizar precio
    const precioEl = document.getElementById('detail-price');
    if (precioEl) {
        if (usuarioEsVIP) {
            precioEl.textContent = `$${parseInt(variante.precio).toLocaleString('es-AR')}`;
        }
        // Si no es VIP el precio ya está oculto con candado — no hacer nada
    }

    // Actualizar codigo / SKU
    const skuElS = document.getElementById('detalle-sku');
    if (skuElS) {
        const vCode  = (variante.codigo || variante.id || '').trim();
        const pCode  = (producto.codigo  || '').trim();
        const parts  = [variante.varDim1, variante.varDim2].filter(Boolean)
            .map(d => d.trim().replace(/\s+/g,'-').toUpperCase());
        const disp = (vCode && vCode !== pCode)
            ? vCode
            : (parts.length ? (pCode ? pCode+'-'+parts.join('-') : parts.join('-')) : (vCode||pCode||'S/C'));
        skuElS.innerHTML = `<span class="material-icons" style="font-size:1rem;margin-right:5px;">qr_code_2</span> CÓD: ${disp}`;
    }

    // Guardar variante activa en el producto (para que el carrito la use)
    producto._varianteActiva = variante;
};

/* ==========================================================================
   11. RENDERIZAR GRID DE PRODUCTOS
   ========================================================================== */
function mostrarSkeletons(contenedor, cantidad = 6) {
    if (!contenedor) return;
    const skeletonHTML = Array.from({ length: cantidad }).map(() => `
        <div class="product-card skeleton-card">
            <div class="skeleton-img skeleton-anim"></div>
            <div class="skeleton-body">
                <div class="skeleton-line short skeleton-anim"></div>
                <div class="skeleton-line skeleton-anim"></div>
                <div class="skeleton-line medium skeleton-anim"></div>
                <div class="skeleton-btn skeleton-anim"></div>
            </div>
        </div>`).join('');
    contenedor.innerHTML = skeletonHTML;

    /* Inyectar CSS de skeletons si no existe aún */
    if (!document.getElementById('skeleton-styles')) {
        const style = document.createElement('style');
        style.id = 'skeleton-styles';
        style.textContent = `
            .skeleton-card { pointer-events: none; }
            .skeleton-anim { background: linear-gradient(90deg, #EDF2F7 25%, #E2E8F0 50%, #EDF2F7 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 6px; }
            @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
            .skeleton-img { height: 180px; width: 100%; margin-bottom: 12px; border-radius: 8px; }
            .skeleton-body { padding: 0 10px 10px; }
            .skeleton-line { height: 13px; margin-bottom: 8px; border-radius: 4px; }
            .skeleton-line.short  { width: 40%; }
            .skeleton-line.medium { width: 60%; }
            .skeleton-btn { height: 38px; width: 100%; margin-top: 10px; border-radius: 8px; }`;
        document.head.appendChild(style);
    }
}

function renderizarGrid(lista, contenedor) {
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (lista.length === 0) {
        contenedor.innerHTML = '<div style="width:100%;text-align:center;padding:50px;"><h3>No se encontraron productos.</h3><p>Intenta quitar algunos filtros.</p></div>';
        return;
    }

    lista.forEach(prod => {
        // ¿Es producto padre con variantes embebidas (nuevo sistema)?
        const esVariantePadre = prod.tieneVariantes === true && prod.variantes && prod.variantes.length > 0;

        const stock         = prod.stock !== undefined ? parseInt(prod.stock) : 100;
        const precioMostrar = prod.precio;

        const link           = `detalle.html?id=${prod.id}`;
        const inputId        = `qty-${prod.id}`;
        const hayStock       = stock > 0;
        const esOferta       = prod.enOferta === true;
        const codigoProducto = (esVariantePadre && prod.variantes[0] && prod.variantes[0].codigo)
            ? prod.variantes[0].codigo
            : (prod.codigo || 'S/C');

        let badgeHtml = '';
        if (!hayStock)        badgeHtml = '<span class="card-badge agotado" style="background-color:#2D3748;color:white;">AGOTADO</span>';
        else if (prod.nuevo)  badgeHtml = '<span class="card-badge nuevo"   style="background-color:#38bdf8;color:#0a192f;">NUEVO</span>';
        else if (esOferta)    badgeHtml = '<span class="card-badge oferta"  style="background-color:#E53E3E;color:white;">OFERTA</span>';

        // Badge VARIANTES: nuevo sistema (esVariantePadre) y Sistema B antiguo (grupoId)
        const varBadge = (esVariantePadre || prod.grupoId)
            ? `<span style="position:absolute;bottom:10px;right:10px;background:rgba(43,108,176,0.92);color:white;font-size:0.65rem;font-weight:700;padding:2px 8px;border-radius:10px;letter-spacing:.04em;">⚡ VARIANTES</span>`
            : '';

        let precioHtml = '';
        if (usuarioEsVIP) {
            let cartelCajaHtml = '';
            if (prod.vendePorCaja) {
                cartelCajaHtml = `<div style="font-size:0.75rem;color:#38A169;font-weight:800;margin-bottom:5px;display:flex;align-items:center;gap:4px;">
                    <span class="material-icons" style="font-size:0.95rem;">local_shipping</span> OPCIÓN CAJA CERRADA x${prod.unidadesPorCaja}
                </div>`;
            }
            let precioFinalHtml = '';
            precioFinalHtml = `<div class="price" style="font-size:1.3rem;color:var(--primary-dark);font-weight:900;display:flex;align-items:baseline;gap:4px;">
                $${parseInt(precioMostrar).toLocaleString('es-AR')}
                <span style="font-size:0.8rem;color:#718096;font-weight:normal;">c/u</span>
            </div>`;
            precioHtml = cartelCajaHtml + precioFinalHtml;
        } else {
            precioHtml = `<div class="price" style="font-size:1rem;color:#718096;display:flex;align-items:center;gap:5px;">
                <span class="material-icons" style="font-size:1.1rem;">lock</span> Consultar Precio
            </div>`;
        }

        const btnClase    = hayStock ? "add-btn" : "add-btn disabled";
        const btnDisabled = hayStock ? "" : "disabled";
        const estiloBoton = hayStock ? "" : "background-color:#ccc;cursor:not-allowed;";
        const btnTexto    = hayStock
            ? (esVariantePadre ? "VER OPCIONES" : (usuarioEsVIP ? "AGREGAR" : "CONSULTAR"))
            : "SIN STOCK";
        let btnOnclick = '';
        if (hayStock) {
            btnOnclick = esVariantePadre
                ? `vsAbrirModal('${prod.id}')`
                : `agregarDesdeTarjeta('${prod.id}','${inputId}')`;
        }

        const cantVariantes = esVariantePadre ? prod.variantes.length : 0;
        const stockDisplay = esVariantePadre
            ? `<span style="color:#3182CE;font-weight:700;font-size:0.8rem;">${cantVariantes} variante${cantVariantes !== 1 ? 's' : ''}</span>`
            : `<span>Stock: <strong style="color:${hayStock?'#38A169':'#E53E3E'}">${stock}</strong></span>`;

        const vsSection = '';

        const card = document.createElement('article');
        card.className = 'product-card';
        card.dataset.prodId = prod.id; // para scroll restoration
        card.dataset.nombre = prod.nombre || '';
        card.innerHTML = `
            <a href="${link}" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;flex-grow:1;">
                <div class="card-image">
                    <img src="${prod.imagen}" alt="${escHtml(prod.nombre)}" loading="lazy" width="300" height="300">
                    ${badgeHtml}
                    ${varBadge}
                    <button class="card-share-btn" data-share-id="${prod.id}" onclick="event.preventDefault();event.stopPropagation();mostrarSharePopover(this)" title="Compartir producto"><span class="material-icons">share</span></button>
                    <button class="card-fav-btn ${window._misFavs && window._misFavs.has(prod.id) ? 'is-fav' : ''}" data-fav-id="${prod.id}" onclick="event.preventDefault();event.stopPropagation();toggleFavorito('${prod.id}',this)" title="Guardar en favoritos"><span class="material-icons">${window._misFavs && window._misFavs.has(prod.id) ? 'favorite' : 'favorite_border'}</span></button>
                </div>
                <div class="card-info" style="display:flex;flex-direction:column;flex-grow:1;">
                    <span class="brand">${escHtml(prod.marca)}</span>
                    <h3 style="margin-bottom:5px;">${escHtml(prod.nombre)}</h3>
                    <div>
                        <span class="product-sku" style="display:inline-flex;align-items:center;background-color:#EDF2F7;color:#4A5568;padding:3px 8px;border-radius:6px;font-size:0.75rem;font-family:monospace;font-weight:bold;border:1px solid #E2E8F0;margin-bottom:10px;">
                            <span class="material-icons" style="font-size:0.85rem;margin-right:3px;">qr_code_2</span> CÓD: ${codigoProducto}
                        </span>
                    </div>
                    <div class="product-price-box" style="margin-top:auto;display:flex;flex-direction:column;">
                        <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;padding-bottom:5px;border-bottom:1px dashed #E2E8F0;margin-bottom:8px;">
                            <span style="color:#718096;display:flex;align-items:center;gap:3px;">
                                <span class="material-icons" style="font-size:1rem;">inventory_2</span> Empaque: ${prod.unidadesPorCaja || 1} u.
                            </span>
                            ${stockDisplay}
                        </div>
                        <div class="price-display">${precioHtml}</div>
                    </div>
                </div>
            </a>
            ${vsSection}
            <div class="card-info">
                <div class="card-actions">
                    ${esVariantePadre ? '' : `
                    <div class="quantity-selector">
                        <button onclick="modificarCantidadTarjeta('${inputId}', -1)" ${btnDisabled}>-</button>
                        <input type="text" id="${inputId}" value="1" readonly>
                        <button onclick="modificarCantidadTarjeta('${inputId}', 1)" ${btnDisabled}>+</button>
                    </div>`}
                    <button class="${btnClase}" onclick="${btnOnclick}" style="${estiloBoton};${esVariantePadre?'width:100%;padding:10px 0;font-size:0.95rem;letter-spacing:.04em;':''}" ${btnDisabled}>${btnTexto}</button>
                </div>
            </div>`;
        contenedor.appendChild(card);
    });
}

function modificarCantidadTarjeta(inputId, cambio) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const nuevo = parseInt(input.value) + cambio;
    if (nuevo < 1) return;
    // inputId = "qty-<prodId>" — validar contra el stock del producto
    const prodId = inputId.replace(/^qty-/, '');
    const prod   = inventario.find(p => p.id === prodId);
    const stockMax = (prod && prod.stock !== undefined && !isNaN(parseInt(prod.stock)))
        ? parseInt(prod.stock) : Infinity;
    if (nuevo > stockMax) {
        mostrarNotificacion(`⚠️ Solo hay ${stockMax} unidades disponibles.`);
        return;
    }
    input.value = nuevo;
}

function agregarDesdeTarjeta(idProducto, inputId) {
    const input    = document.getElementById(inputId);
    const cantidad = input ? parseInt(input.value) : 1;
    agregarAlCarrito(idProducto, cantidad);
}

/* ==========================================================================
   12. DETALLE DEL PRODUCTO
   ========================================================================== */
// FAVORITOS
window._misFavs = new Set();

async function cargarSetFavoritos(uid) {
    try {
        const snap = await db.collection('usuarios').doc(uid).collection('favoritos').get();
        window._misFavs = new Set(snap.docs.map(d => d.id));
        document.querySelectorAll('[data-fav-id]').forEach(btn => {
            const filled = window._misFavs.has(btn.dataset.favId);
            btn.querySelector('.material-icons').textContent = filled ? 'favorite' : 'favorite_border';
            btn.style.color = filled ? '#E53E3E' : '#A0AEC0';
        });
    } catch(e) {}
}

async function toggleFavorito(prodId, btn) {
    if (!usuarioEsVIP || !auth.currentUser) {
        mostrarNotificacion('Inicia sesion para guardar favoritos');
        return;
    }
    const uid   = auth.currentUser.uid;
    const ref   = db.collection('usuarios').doc(uid).collection('favoritos').doc(prodId);
    const isFav = window._misFavs.has(prodId);
    const icon  = btn ? btn.querySelector('.material-icons') : null;
    try {
        if (isFav) {
            await ref.delete();
            window._misFavs.delete(prodId);
            if (btn) btn.classList.remove('is-fav');
            if (icon) icon.textContent = 'favorite_border';
            mostrarNotificacion('Quitado de favoritos');
        } else {
            const prod = inventario.find(p => p.id === prodId) || {};
            await ref.set({ nombre: prod.nombre || '', imagen: prod.imagen || '', fecha: new Date() });
            window._misFavs.add(prodId);
            if (btn) btn.classList.add('is-fav');
            if (icon) icon.textContent = 'favorite';
            mostrarNotificacion('❤ Guardado');
        }
        // Sync todos los botones con el mismo prodId
        document.querySelectorAll(`[data-fav-id="${prodId}"]`).forEach(b => {
            b.classList.toggle('is-fav', window._misFavs.has(prodId));
            const ic = b.querySelector('.material-icons');
            if (ic) ic.textContent = window._misFavs.has(prodId) ? 'favorite' : 'favorite_border';
        });
    } catch(e) { mostrarNotificacion('Error al guardar'); }
}

function mostrarSharePopover(btn) {
    var prodId = btn.dataset.shareId;
    if (!prodId) return;
    var prod   = inventario.find(function(p){ return p.id === prodId; }) || {};
    var nombre = prod.nombre || 'Producto';
    var url    = 'https://enzodistribuciones.com/detalle.html?id=' + prodId;

    var old = document.getElementById('share-popover');
    if (old) { old.remove(); return; }

    var waMsg = encodeURIComponent(
        'Mira este producto de Enzo Distribuciones!\n\n' +
        nombre + '\n\nConsulta precio y stock mayorista:\n' + url
    );
    var fbUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);

    var pop = document.createElement('div');
    pop.id = 'share-popover';
    pop.innerHTML =
        '<a class="sp-item" href="https://wa.me/?text=' + waMsg + '" target="_blank" rel="noopener">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366" style="flex-shrink:0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
            'WhatsApp' +
        '</a>' +
        '<a class="sp-item" href="' + fbUrl + '" target="_blank" rel="noopener">' +
            '<span class="material-icons" style="font-size:16px;color:#1877F2;flex-shrink:0">facebook</span>Facebook' +
        '</a>' +
        '<button class="sp-item sp-copy" id="sp-copy-btn">' +
            '<span class="material-icons" style="font-size:16px;flex-shrink:0">link</span>Copiar link' +
        '</button>';

    document.body.appendChild(pop);

    document.getElementById('sp-copy-btn').addEventListener('click', function() {
        navigator.clipboard.writeText(url).then(function() {
            var t = document.getElementById('sp-copy-btn');
            if (t) t.innerHTML = '<span class="material-icons" style="font-size:16px;color:#38A169;flex-shrink:0">check</span>Copiado!';
            setTimeout(function() {
                var p = document.getElementById('share-popover');
                if (p) p.remove();
            }, 1200);
        });
    });

    var rect = btn.getBoundingClientRect();
    pop.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
    pop.style.left = Math.min(rect.left + window.scrollX, window.innerWidth - 190) + 'px';

    setTimeout(function() {
        document.addEventListener('click', function closePop(e) {
            if (!pop.contains(e.target) && e.target !== btn) {
                pop.remove();
                document.removeEventListener('click', closePop);
            }
        });
    }, 50);
}

// =================================================================
// COMPARTIR PRODUCTO
// =================================================================
function compartirProducto(via, prodId) {
    const prod = prodId
        ? (inventario.find(p => p.id === prodId) || {})
        : (window._detalleProductoActual || {});
    const nombre = prod.nombre || 'Producto';
    const url    = prodId
        ? `https://enzodistribuciones.com/detalle.html?id=${prodId}`
        : window.location.href;
    const msg    = `\u00a1Mir\u00e1 este producto de Enzo Distribuciones!\n\n*${nombre}*\n\nConsult\u00e1 precio y stock mayorista:\n${url}`;

    if (via === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    } else if (via === 'facebook') {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
    } else if (via === 'copy') {
        navigator.clipboard.writeText(url).then(() => {
            const btn = document.getElementById('copy-link-txt');
            if (btn) { btn.textContent = '\u2713 Copiado'; setTimeout(() => btn.textContent = 'Copiar link', 2000); }
            mostrarNotificacion('\u00a1Link copiado al portapapeles!');
        });
    } else if (via === 'native' && navigator.share) {
        navigator.share({ title: nombre, text: `Mir\u00e1 este producto: ${nombre}`, url });
    }
}

function cargarDetalleProducto() {
    const params   = new URLSearchParams(window.location.search);
    const idParam  = params.get('id');
    const producto = inventario.find(p => p.id == idParam);

    if (!producto) return;
    window._detalleProductoActual = producto; // fallback para vsDetD1/vsDetD2

    document.getElementById('detail-name').textContent  = producto.nombre;
    document.getElementById('detail-image').src         = producto.imagen;
    document.getElementById('detail-brand').textContent = producto.marca;

    const imgContainer = document.getElementById('detail-image').parentElement;
    const oldBadge     = imgContainer.querySelector('.card-badge');
    if (oldBadge) oldBadge.remove();
    imgContainer.style.position = 'relative';

    const stockActual = producto.stock !== undefined ? parseInt(producto.stock) : 100;
    const tieneStock  = stockActual > 0;

    if (!tieneStock)
        imgContainer.insertAdjacentHTML('beforeend', '<span class="card-badge agotado" style="background-color:#2D3748;color:white;position:absolute;top:15px;left:15px;padding:5px 10px;border-radius:4px;font-weight:bold;font-size:0.8rem;z-index:10;">AGOTADO</span>');
    else if (producto.nuevo)
        imgContainer.insertAdjacentHTML('beforeend', '<span class="card-badge nuevo" style="background-color:#38bdf8;color:#0a192f;position:absolute;top:15px;left:15px;padding:5px 10px;border-radius:4px;font-weight:bold;font-size:0.8rem;z-index:10;">NUEVO</span>');
    else if (producto.enOferta)
        imgContainer.insertAdjacentHTML('beforeend', '<span class="card-badge oferta" style="background-color:#E53E3E;color:white;position:absolute;top:15px;left:15px;padding:5px 10px;border-radius:4px;font-weight:bold;font-size:0.8rem;z-index:10;">OFERTA</span>');

    // SKU
    const codigoDetalle = (producto.tieneVariantes && producto.variantes && producto.variantes[0] && producto.variantes[0].codigo)
        ? producto.variantes[0].codigo
        : (producto.codigo || "S/C");
    let skuElem = document.getElementById('detalle-sku');
    if (!skuElem) {
        const titleElem = document.getElementById('detail-name');
        skuElem = document.createElement('div');
        skuElem.id = 'detalle-sku';
        skuElem.style.cssText = 'display:inline-flex;align-items:center;background-color:#EDF2F7;color:#4A5568;padding:4px 10px;border-radius:6px;font-size:0.85rem;font-family:monospace;font-weight:bold;margin-top:8px;margin-bottom:15px;border:1px solid #E2E8F0;';
        titleElem.parentNode.insertBefore(skuElem, titleElem.nextSibling);
    }
    skuElem.innerHTML = `<span class="material-icons" style="font-size:1rem;margin-right:5px;">qr_code_2</span> CÓD: ${codigoDetalle}`;

    const stock    = producto.stock !== undefined ? parseInt(producto.stock) : 100;
    const hayStock = stock > 0;

    const stockHtml = `
        <div id="detalle-stock-box" style="display:flex;align-items:center;gap:8px;font-size:1rem;color:#4A5568;padding-bottom:15px;border-bottom:1px dashed #E2E8F0;width:100%;">
            <span class="material-icons" style="font-size:1.2rem;color:${hayStock ? '#38A169' : '#E53E3E'}">inventory_2</span>
            <span>Stock Disponible: <strong style="color:${hayStock ? '#38A169' : '#E53E3E'};font-size:1.1rem;">${stock} u.</strong></span>
        </div>`;

    const precioElem         = document.getElementById('detail-price');
    const opcionesContainer  = document.getElementById('opciones-compra-container');
    let modoCompraActual     = 'unidad';
    let precioActual         = producto.precio;

    if (usuarioEsVIP) {
        let precioMostrar = '';
            precioMostrar = `<div style="color:var(--primary-dark);font-size:2.2rem;font-weight:900;">$${parseInt(producto.precio).toLocaleString('es-AR')}</div>`;
        precioElem.innerHTML   = precioMostrar;
        precioElem.style.color = "";
        precioElem.style.fontSize = "";

        if (producto.vendePorCaja && opcionesContainer) {
            opcionesContainer.style.display = 'block';
            opcionesContainer.innerHTML = `
                <div style="font-weight:bold;margin-bottom:10px;color:var(--primary-dark);">Opciones de compra:</div>
                <div style="display:flex;gap:10px;">
                    <button id="btn-opt-unidad" style="flex:1;padding:12px;border:2px solid var(--primary-blue);background:var(--primary-blue);color:white;border-radius:8px;font-weight:bold;cursor:pointer;">
                        Por Unidad<br><small style="font-weight:normal;">$${parseInt(producto.precio).toLocaleString('es-AR')}</small>
                    </button>
                    <button id="btn-opt-caja" style="flex:1;padding:12px;border:2px solid #E2E8F0;background:white;color:var(--text-dark);border-radius:8px;font-weight:bold;cursor:pointer;">
                        Caja Cerrada (x${producto.unidadesPorCaja})<br>
                        <small style="font-weight:normal;color:#38A169;">$${parseInt(producto.precioCaja).toLocaleString('es-AR')} total</small>
                    </button>
                </div>`;

            const inputQty = document.querySelector('.big-selector input');
            document.getElementById('btn-opt-unidad').onclick = () => {
                modoCompraActual = 'unidad'; precioActual = producto.precio;
                precioElem.innerHTML = precioMostrar;
                document.getElementById('btn-opt-unidad').style.cssText = 'flex:1;padding:12px;border:2px solid var(--primary-blue);background:var(--primary-blue);color:white;border-radius:8px;font-weight:bold;cursor:pointer;';
                document.getElementById('btn-opt-caja').style.cssText   = 'flex:1;padding:12px;border:2px solid #E2E8F0;background:white;color:var(--text-dark);border-radius:8px;font-weight:bold;cursor:pointer;';
                if (inputQty) inputQty.value = 1;
            };
            document.getElementById('btn-opt-caja').onclick = () => {
                modoCompraActual = 'caja'; precioActual = producto.precioCaja;
                precioElem.innerHTML = `<div style="color:#38A169;font-size:2.2rem;font-weight:900;">$${parseInt(producto.precioCaja).toLocaleString('es-AR')} <span style="font-size:1.2rem;color:#718096;font-weight:normal;">/ Caja</span></div>`;
                document.getElementById('btn-opt-caja').style.cssText   = 'flex:1;padding:12px;border:2px solid #68D391;background:#F0FFF4;color:#22543D;border-radius:8px;font-weight:bold;cursor:pointer;';
                document.getElementById('btn-opt-unidad').style.cssText = 'flex:1;padding:12px;border:2px solid #E2E8F0;background:white;color:var(--text-dark);border-radius:8px;font-weight:bold;cursor:pointer;';
                if (inputQty) inputQty.value = 1;
            };
        } else if (opcionesContainer) {
            opcionesContainer.style.display = 'none';
        }
    } else {
        if (precioElem) {
            precioElem.innerHTML   = `<span class="material-icons" style="font-size:1.5rem;vertical-align:middle;">lock</span> Consultar Precio`;
            precioElem.style.color = "#718096";
            precioElem.style.fontSize = "1.5rem";
        }
        if (opcionesContainer) opcionesContainer.style.display = 'none';
    }

    // Stock box
    const prevStock = document.getElementById('detalle-stock-box');
    if (prevStock) prevStock.remove();
    if (precioElem) precioElem.insertAdjacentHTML('beforebegin', stockHtml);

    document.getElementById('detail-desc').textContent = producto.descripcion || "Sin descripción.";

    // ── Variantes ──────────────────────────────────────────────────────────
    renderizarVariantes(producto);

    // Ficha técnica
    const specs = document.getElementById('specs-container');
    if (producto.ficha && specs) {
        let html = '<table class="specs-table"><tbody>';
        for (const [k, v] of Object.entries(producto.ficha)) {
            html += `<tr><td>${k}</td><td>${v}</td></tr>`;
        }
        html += '</tbody></table>';
        specs.innerHTML = html;
    }

    // Botón agregar
    const btnAdd   = document.getElementById('detail-add-btn');
    const inputQty = document.querySelector('.big-selector input');

    if (!hayStock) {
        if (btnAdd)   { btnAdd.textContent = "SIN STOCK"; btnAdd.style.backgroundColor = "#ccc"; btnAdd.disabled = true; }
        if (inputQty) inputQty.disabled = true;
    } else {
        if (btnAdd)   { btnAdd.textContent = "AGREGAR AL CARRITO"; btnAdd.style.backgroundColor = ""; btnAdd.disabled = false; }
        if (inputQty) inputQty.disabled = false;

        const btnMinus = document.querySelector('.big-selector button:first-child');
        const btnPlus  = document.querySelector('.big-selector button:last-child');
        if (btnMinus) btnMinus.onclick = () => { if (inputQty.value > 1) inputQty.value--; };
        if (btnPlus)  btnPlus.onclick  = () => {
            const maxPermitido = modoCompraActual === 'caja' && producto.unidadesPorCaja
                ? Math.floor(stock / producto.unidadesPorCaja)
                : stock;
            if (parseInt(inputQty.value) < maxPermitido) inputQty.value++;
            else alert(`Límite de stock. Solo puedes llevar ${maxPermitido} ${modoCompraActual === 'caja' ? 'caja(s)' : 'unidades'}.`);
        };
        if (btnAdd) btnAdd.onclick = () => {
            const qty = parseInt(inputQty.value) || 1;
            if (modoCompraActual === 'caja') {
                const productoCaja = { ...producto, id: producto.id + "_CAJA", nombre: `📦 CAJA CERRADA x${producto.unidadesPorCaja} - ${producto.nombre}`, precio: producto.precioCaja };
                agregarObjetoAlCarrito(productoCaja, qty);
            } else if (producto._varianteActiva) {
                // Usar datos de la variante seleccionada
                const v = producto._varianteActiva;
                const productoConVar = {
                    ...producto,
                    nombre: v.nombre || producto.nombre,
                    precio: v.precio,
                    imagen: v.imagen || producto.imagen,
                    id:     producto.id + '_VAR_' + v.id
                };
                agregarObjetoAlCarrito(productoConVar, qty);
            } else {
                agregarAlCarrito(producto.id, qty);
            }
        };
    }

    // Similares
    const seccionSimilares   = document.getElementById('seccion-similares');
    const contenedorSimilares = document.getElementById('contenedor-similares');
    if (seccionSimilares && contenedorSimilares) {
        // Excluir el producto actual Y todos los SKUs del mismo grupo (ya se muestran como botones de variante)
        const mismoGrupo = producto.grupoId || null;
        const candidatos = inventario.filter(p => {
            if (p.id === producto.id) return false;                        // mismo producto
            if (mismoGrupo && p.grupoId === mismoGrupo) return false;      // misma familia de variantes
            return p.categoria === producto.categoria;
        });
        // Deduplicar: si hay varias variantes de otro grupo, mostrar solo el representante
        const similares = deduplicarGrupos(candidatos).slice(0, 8);
        seccionSimilares.style.display = similares.length > 0 ? 'block' : 'none';
        if (similares.length > 0) renderizarGrid(similares, contenedorSimilares);
    }

    document.title = producto.nombre + " | Ferretería Mayorista Oberá";
}

/* ==========================================================================
   13. CARRITO
   ========================================================================== */
function agregarAlCarrito(id, cantidad = 1) {
    const producto      = inventario.find(p => p.id == id);
    const itemEnCarrito = carrito.find(p => p.id == id);
    if (!producto) { console.error("Producto no encontrado:", id); return; }

    // No permitir superar el stock contando lo que ya hay en el carrito
    const stockMax = (producto.stock !== undefined && !isNaN(parseInt(producto.stock)))
        ? parseInt(producto.stock) : Infinity;
    const yaEnCarrito = itemEnCarrito ? itemEnCarrito.cantidad : 0;
    if (yaEnCarrito + cantidad > stockMax) {
        mostrarNotificacion(`⚠️ Stock máximo: ${stockMax} u.${yaEnCarrito ? ` (ya tenés ${yaEnCarrito} en el carrito)` : ''}`);
        return;
    }

    if (itemEnCarrito) itemEnCarrito.cantidad += cantidad;
    else carrito.push({ ...producto, cantidad });

    guardarCarrito();
    actualizarBadgeCarrito();
    renderizarCarrito();
    mostrarNotificacion(`¡${producto.nombre} agregado al carrito! 🛒`);
}

function agregarObjetoAlCarrito(productoPersonalizado, cantidad = 1) {
    const itemEnCarrito = carrito.find(p => p.id === productoPersonalizado.id);
    if (itemEnCarrito) itemEnCarrito.cantidad += cantidad;
    else carrito.push({ ...productoPersonalizado, cantidad });
    guardarCarrito();
    actualizarBadgeCarrito();
    renderizarCarrito();
    mostrarNotificacion(`¡${productoPersonalizado.nombre || 'Producto'} agregado al carrito! 🛒`);
}

function eliminarDelCarrito(id) {
    carrito = carrito.filter(p => p.id !== id);
    guardarCarrito();
    renderizarCarrito();
    actualizarBadgeCarrito();
}

function cambiarCantidadCarrito(id, operacion) {
    const item = carrito.find(p => p.id === id);
    if (!item) return;

    if (operacion === 'sumar') {
        if (String(id).includes('_VAR_')) {
            // Variante embebida: validar contra el stock de esa variante
            const padreId = String(id).split('_VAR_')[0];
            const varCode = String(id).split('_VAR_').slice(1).join('_VAR_');
            const padre   = inventario.find(p => p.id === padreId);
            const v       = padre && (padre.variantes || []).find(v => (v.codigo || v.id) === varCode);
            if (v && item.cantidad + 1 > (parseInt(v.stock) || 0)) {
                alert(`⚠️ Stock insuficiente. Solo quedan ${v.stock || 0} unidades.`);
                return;
            }
        } else {
            const idReal       = String(id).replace('_CAJA', '');
            const prodOriginal = inventario.find(p => p.id == idReal);
            if (prodOriginal) {
                let unidades = item.cantidad + 1;
                if (String(id).includes('_CAJA') && item.unidadesPorCaja) unidades = (item.cantidad + 1) * parseInt(item.unidadesPorCaja);
                if (unidades > (parseInt(prodOriginal.stock) || 0)) {
                    alert(`⚠️ Stock insuficiente. Solo quedan ${prodOriginal.stock} unidades.`);
                    return;
                }
            }
        }
        item.cantidad++;
    }
    if (operacion === 'restar' && item.cantidad > 1) item.cantidad--;

    guardarCarrito();
    renderizarCarrito();
    actualizarBadgeCarrito();
}

function vaciarCarrito() {
    carrito = [];
    guardarCarrito();
    renderizarCarrito();
    actualizarBadgeCarrito();
}

function guardarCarrito() { localStorage.setItem('carritoEnzo', JSON.stringify(carrito)); }

function actualizarBadgeCarrito() {
    // FAB mobile
    const fab = document.getElementById('cart-fab');
    const fabBadge = document.getElementById('fab-badge');
    const _fabTotal = carrito.reduce((s, i) => s + i.cantidad, 0);
    if (fab) fab.classList.toggle('has-items', _fabTotal > 0);
    if (fabBadge) { fabBadge.textContent = _fabTotal; fabBadge.style.display = _fabTotal > 0 ? "flex" : "none"; }
    // (badge original sigue abajo)

    const total = carrito.reduce((acc, item) => acc + item.cantidad, 0);
    document.querySelectorAll('.badge').forEach(b => b.textContent = total);
}

function renderizarCarrito() {
    const contenedor = document.getElementById('cart-items-container');
    const totalEl    = document.getElementById('cart-total-price');
    const countEl    = document.getElementById('cart-count-header');
    if (!contenedor) return;

    contenedor.innerHTML = '';
    let totalItems = 0, totalDinero = 0;

    if (carrito.length === 0) {
        contenedor.innerHTML = '<div style="text-align:center;padding:20px;color:#999;"><span class="material-icons" style="font-size:3rem;">shopping_cart_off</span><p>Tu carrito está vacío</p></div>';
    } else {
        carrito.forEach(item => {
            totalItems += item.cantidad;
            const subtotalItem  = item.precio * item.cantidad;
            totalDinero        += subtotalItem;
            const idParaFuncion = typeof item.id === 'string' ? `'${item.id}'` : item.id;

            // Precios: visibles solo para VIP — invitados ven "Precio a confirmar"
            const precioUnitHtml = usuarioEsVIP
                ? `<div style="font-size:0.8rem;color:#718096;margin-bottom:8px;">$${parseInt(item.precio).toLocaleString('es-AR')} c/u</div>`
                : `<div style="font-size:0.78rem;color:#A0AEC0;margin-bottom:8px;display:flex;align-items:center;gap:4px;">
                       <span class="material-icons" style="font-size:0.9rem;">lock</span> Precio a confirmar
                   </div>`;

            const subtotalHtml = usuarioEsVIP
                ? `<span class="cart-item-price">$${parseInt(subtotalItem).toLocaleString('es-AR')}</span>`
                : ``;

            contenedor.innerHTML += `
                <div class="cart-item">
                    <img src="${item.imagen}" alt="${escHtml(item.nombre)}">
                    <div class="cart-item-info">
                        <div class="cart-item-title" style="font-size:0.9rem;margin-bottom:2px;">${escHtml(item.nombre)}</div>
                        ${precioUnitHtml}
                        <div class="cart-item-controls">
                            <div class="cart-qty-box">
                                <button onclick="cambiarCantidadCarrito(${idParaFuncion}, 'restar')">-</button>
                                <span>${item.cantidad}</span>
                                <button onclick="cambiarCantidadCarrito(${idParaFuncion}, 'sumar')">+</button>
                            </div>
                            <div style="display:flex;align-items:center;gap:10px;">
                                ${subtotalHtml}
                                <span class="material-icons btn-remove" onclick="eliminarDelCarrito(${idParaFuncion})">delete</span>
                            </div>
                        </div>
                    </div>
                </div>`;
        });
    }

    // Total: visible solo para VIP
    if (totalEl) {
        totalEl.textContent = usuarioEsVIP
            ? `$${parseInt(totalDinero).toLocaleString('es-AR')}`
            : 'A cotizar';
        totalEl.style.color = usuarioEsVIP ? '' : '#A0AEC0';
        totalEl.style.fontSize = usuarioEsVIP ? '' : '1rem';
    }
    if (countEl) countEl.textContent = `(${totalItems})`;

    // Barra de envío gratis — solo para VIP (invitados no ven precios)
    const metaEnvioGratis = META_ENVIO_GRATIS;
    let barra = document.getElementById('barra-envio-gratis');
    if (!barra && contenedor) {
        barra = document.createElement('div');
        barra.id = 'barra-envio-gratis';
        contenedor.parentNode.insertBefore(barra, contenedor);
    }
    if (barra && carrito.length > 0 && usuarioEsVIP) {
        if (totalDinero >= metaEnvioGratis) {
            barra.innerHTML = `<div style="background:#C6F6D5;color:#22543D;padding:12px;border-radius:8px;text-align:center;font-size:0.95rem;font-weight:bold;margin-bottom:15px;border:1px solid #9AE6B4;">🎉 ¡Felicidades! Tienes <strong>Envío Gratis</strong>.</div>`;
        } else {
            const falta      = metaEnvioGratis - totalDinero;
            const porcentaje = Math.min((totalDinero / metaEnvioGratis) * 100, 100);
            barra.innerHTML  = `<div style="background:#EBF8FF;color:#2B6CB0;padding:12px;border-radius:8px;margin-bottom:15px;font-size:0.9rem;border:1px solid #90CDF4;">
                Agrega <strong>$${falta.toLocaleString('es-AR')}</strong> más para <strong>Envío Gratis</strong> 🚚
                <div style="width:100%;background:#BEE3F8;height:8px;border-radius:4px;margin-top:8px;overflow:hidden;">
                    <div style="width:${porcentaje}%;background:#3182CE;height:100%;transition:width 0.5s ease-in-out;"></div>
                </div>
            </div>`;
        }
    } else if (barra) {
        barra.innerHTML = '';
    }
}

function configurarEventosCarrito() {
    document.querySelectorAll('.cart-icon').forEach(icon => {
        icon.addEventListener('click', () => { renderizarCarrito(); abrirCarrito(); });
    });
    const closeBtn = document.getElementById('close-cart-btn');
    const clearBtn = document.getElementById('btn-clear-cart');
    const overlay  = document.getElementById('cart-overlay');
    if (closeBtn) closeBtn.addEventListener('click', cerrarCarrito);
    if (overlay)  overlay.addEventListener('click', cerrarCarrito);
    if (clearBtn) clearBtn.addEventListener('click', vaciarCarrito);
}

function abrirCarrito()  {
    window._scrollYCarrito = window.scrollY || window.pageYOffset;
    document.getElementById('cart-drawer').classList.add('active');
    document.getElementById('cart-overlay').classList.add('active');
    // Pre-llenar el formulario con datos del perfil VIP
    preLlenarCheckout();
}
function cerrarCarrito() {
    document.getElementById('cart-drawer').classList.remove('active');
    document.getElementById('cart-overlay').classList.remove('active');
    if (window._scrollYCarrito !== undefined) {
        requestAnimationFrame(() => window.scrollTo({ top: window._scrollYCarrito, behavior: 'instant' }));
    }
}

function mostrarNotificacion(msj) {
    const toast = document.getElementById('toast');
    const msg   = document.getElementById('toast-message');
    if (toast && msg) { msg.textContent = msj; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
}

/* ==========================================================================
   14. ANIMACIONES SCROLL
   ========================================================================== */
function inicializarAnimacionesScroll() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // anima solo la primera vez
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.slide-from-left, .slide-from-right').forEach(el => observer.observe(el));
}

/* ==========================================================================
   15. INTERFAZ COMÚN
   ========================================================================== */
function iniciarInterfaz() {
    const btnMenu = document.getElementById('mobile-menu-btn');
    const nav     = document.getElementById('main-nav');
    if (btnMenu) btnMenu.addEventListener('click', () => nav.classList.toggle('active'));

    const btnFilter = document.getElementById('filter-btn');
    const sidebar   = document.getElementById('sidebar-filters');
    const btnClose  = document.getElementById('close-filter-btn');
    if (btnFilter) btnFilter.addEventListener('click', () => sidebar.classList.add('active'));
    if (btnClose)  btnClose.addEventListener('click', () => sidebar.classList.remove('active'));

    document.querySelectorAll('.main-cat-link').forEach(header => {
        header.addEventListener('click', function () {
            if (this.classList.contains('btn-cat')) return;
            const sub = this.nextElementSibling;
            if (sub && sub.classList.contains('sub-category-list')) {
                sub.classList.toggle('open');
                const arrow = this.querySelector('.material-icons');
                if (arrow) arrow.classList.toggle('rotate-icon');
            }
        });
    });

    configurarCheckout();
    inicializarAnimacionesScroll();
}

function cerrarSidebarMovil() {
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar-filters');
        if (sidebar) sidebar.classList.remove('active');
    }
}

/* ==========================================================================
   16. BUSCADOR PREDICTIVO (con soporte para ir a productos.html?search=)
   ========================================================================== */
const searchInput   = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const searchForm    = document.getElementById('search-form');

if (searchInput) {
    searchInput.addEventListener('input', function (e) {
        const q = e.target.value.toLowerCase().trim();
        if (q.length === 0) { searchResults.classList.remove('active'); searchResults.innerHTML = ''; return; }

        const resultadosRaw = inventario.filter(prod => {
            const nombre    = (prod.nombre   || '').toLowerCase();
            const marca     = (prod.marca    || '').toLowerCase();
            let categoria   = (prod.categoria || '').toLowerCase();
            if (categoria === 'sin categoria') categoria = 'otros varios';
            const codigo = (prod.id || '').toLowerCase();
            return nombre.includes(q) || marca.includes(q) || categoria.includes(q) || codigo.includes(q);
        });
        // Deduplicar: mostrar un solo resultado por grupo (el representante)
        const resultados = deduplicarGrupos(resultadosRaw);
        mostrarResultadosBusqueda(resultados);
    });

    document.addEventListener('click', function (e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('active');
        }
    });
}

function mostrarResultadosBusqueda(lista) {
    searchResults.innerHTML = '';
    if (lista.length > 0) {
        searchResults.classList.add('active');
        lista.slice(0, 6).forEach(prod => {
            const item = document.createElement('a');
            item.classList.add('search-item');
            item.href = `detalle.html?id=${prod.id}`;
            item.innerHTML = `
                <div class="search-img-box"><img src="${prod.imagen}" alt="${escHtml(prod.nombre)}"></div>
                <div class="search-info"><h4>${escHtml(prod.nombre)}</h4><span class="search-brand">${escHtml(prod.marca)}</span></div>
                <div class="search-action">Ver <span class="material-icons" style="font-size:1rem;">chevron_right</span></div>`;
            searchResults.appendChild(item);
        });

        if (lista.length > 6) {
            const masResultados = document.createElement('div');
            masResultados.classList.add('search-item');
            Object.assign(masResultados.style, { justifyContent: 'center', background: '#f9f9f9', color: 'var(--primary-blue)', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' });
            masResultados.textContent = `Ver los ${lista.length} resultados...`;
            masResultados.onclick = () => {
                window.location.href = `productos.html?search=${encodeURIComponent(searchInput.value.trim())}`;
            };
            searchResults.appendChild(masResultados);
        }
    } else {
        searchResults.classList.add('active');
        searchResults.innerHTML = `<div class="no-results">No encontramos productos 😢</div>`;
    }
}

if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const q = searchInput.value.trim();
        if (q.length > 0) {
            window.location.href = `productos.html?search=${encodeURIComponent(q)}`;
        }
    });
}

/* ==========================================================================
   17. MODALS DE SERVICIOS (HOME)
   ========================================================================== */
function configurarModalsServicios() {
    const cardEnvios        = document.getElementById('card-envios');
    const cardPagos         = document.getElementById('card-pagos');
    const cardAsesoramiento = document.getElementById('card-asesoramiento');
    const overlay           = document.getElementById('modal-overlay');
    const modalEnvios       = document.getElementById('modal-envios');
    const modalPagos        = document.getElementById('modal-pagos');

    if (cardEnvios)        cardEnvios.addEventListener('click', () => abrirModal(modalEnvios));
    if (cardPagos)         cardPagos.addEventListener('click', () => abrirModal(modalPagos));
    if (cardAsesoramiento) cardAsesoramiento.addEventListener('click', () => {
        window.open(`https://wa.me/5493755503213?text=${encodeURIComponent("Hola Ferretería Enzo, necesito asesoramiento técnico sobre un producto.")}`, '_blank');
    });
    if (overlay) overlay.addEventListener('click', cerrarModals);
}

/* Datos bancarios — separados del HTML para evitar exposición en código fuente */
const _datosBancarios = {
    cbu:    atob('MDA3MDE2NDQyMDAwMDAwMTAxNjIzMQ=='),
    alias:  atob('RW56by5WaWVyYS5HYWxpY2lh'),
    nombre: 'Enzo Daniel Viera',
    banco:  'Banco de Galicia'
};

function abrirModal(modal) {
    const overlay = document.getElementById('modal-overlay');
    if (!modal || !overlay) return;

    /* Si es el modal de pagos, inyectar los datos bancarios en el placeholder */
    if (modal.id === 'modal-pagos') {
        const placeholder = document.getElementById('bank-info-placeholder');
        if (placeholder && !placeholder.dataset.cargado) {
            placeholder.innerHTML = `
                <strong style="color: var(--primary-dark); display: block; margin-bottom: 5px;">Datos Bancarios</strong>
                <span style="display: block; font-family: monospace; color: var(--text-light); font-size: 0.9rem;">
                    CBU: ${_datosBancarios.cbu}<br>
                    Alias: ${_datosBancarios.alias}<br><br>
                    Nombre: ${_datosBancarios.nombre}<br>
                    Banco: ${_datosBancarios.banco}
                </span>`;
            placeholder.dataset.cargado = '1';
        }
    }

    overlay.classList.add('active');
    modal.classList.add('active');
}

function cerrarModals() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('active');
    document.querySelectorAll('.modal-window.active').forEach(m => m.classList.remove('active'));
}

/* ==========================================================================
   18. CHECKOUT EN 3 PASOS
   ========================================================================== */
// Helper: actualizar data-step del cart-drawer (para CSS de layout)
function _setCartStep(n) {
    const d = document.getElementById('cart-drawer');
    if (d) d.setAttribute('data-step', String(n));
    pasoCheckoutActual = n;
    // Columna izquierda: visible solo en paso 1
    const colItems = document.querySelector('.cart-items-col');
    if (colItems) colItems.style.display = (n === 1) ? '' : 'none';
    // Columna derecha: ajustar ancho en paso 1 vs pasos de formulario
    const colSummary = document.querySelector('.cart-summary-col');
    if (colSummary) colSummary.style.width = (n === 1) ? '' : '100%';
    if (colSummary) colSummary.style.borderLeft = (n === 1) ? '' : 'none';
}


let pasoCheckoutActual = 1;

/* ── Actualiza el botón del carrito según el tipo de usuario ── */
function actualizarBtnCheckoutPorVIP() {
    const btnNext = document.getElementById('btn-next-step');
    if (!btnNext || pasoCheckoutActual !== 1) return;
    if (usuarioEsVIP) {
        btnNext.textContent = "CONTINUAR AL ENVÍO";
        btnNext.style.background = "var(--primary-blue)";
    } else {
        btnNext.textContent = "ARMAR PRESUPUESTO →";
        btnNext.style.background = "var(--primary-blue)";
    }
}

function configurarCheckout() {
    const btnNext  = document.getElementById('btn-next-step');
    const btnPrev  = document.getElementById('btn-prev-step');
    const btnClear = document.getElementById('btn-clear-cart');
    const title    = document.getElementById('cart-title-step');
    if (!btnNext) return;

    reiniciarCheckout();

    btnNext.onclick = () => {
        if (carrito.length === 0) { mostrarNotificacion("Tu carrito está vacío 🛒"); return; }

        /* ══════════════════════════════════════
           FLUJO VISITANTE — 2 pasos
        ══════════════════════════════════════ */
        if (!usuarioEsVIP) {
            if (pasoCheckoutActual === 1) {
                document.getElementById('checkout-step-1').style.display = 'none';
                document.getElementById('checkout-step-presupuesto').style.display = 'block';
                title.innerHTML = 'Tus datos de contacto';
                btnNext.textContent = "ENVIAR PRESUPUESTO POR WHATSAPP";
                btnNext.style.background = "#25D366";
                btnPrev.style.display = 'inline-block';
                if (btnClear) btnClear.style.display = 'none';
                _setCartStep(2);
            } else if (pasoCheckoutActual === 2) {
                const nom = document.getElementById('pres-nombre')?.value.trim();
                const tel = document.getElementById('pres-telefono')?.value.trim();
                const neg = document.getElementById('pres-negocio')?.value.trim();
                const terminos = document.getElementById('pres-terminos');
                if (!nom || !tel || !neg) { alert("Por favor completá tu nombre, WhatsApp y negocio."); return; }
                if (!terminos?.checked) { alert("⚠️ Debés aceptar los Términos y Condiciones para continuar."); return; }
                procesarPresupuesto({ nombre: nom, telefono: tel, negocio: neg });
            }
            return;
        }

        /* ══════════════════════════════════════
           FLUJO VIP — 3 pasos
        ══════════════════════════════════════ */
        if (pasoCheckoutActual === 1) {
            document.getElementById('checkout-step-1').style.display = 'none';
            document.getElementById('checkout-step-2').style.display = 'block';
            title.innerHTML = 'Paso 2 de 3: Datos';
            btnNext.textContent = "IR A LOGÍSTICA";
            btnPrev.style.display = 'inline-block';
            if (btnClear) btnClear.style.display = 'none';
            _setCartStep(2);
        } else if (pasoCheckoutActual === 2) {
            const nom = document.getElementById('chk-nombre')?.value.trim();
            const tel = document.getElementById('chk-telefono')?.value.trim();
            const dir = document.getElementById('chk-direccion')?.value.trim();
            if (!nom || !tel || !dir) { alert("Por favor, completá tu Nombre, Teléfono y Dirección."); return; }
            document.getElementById('checkout-step-2').style.display = 'none';
            document.getElementById('checkout-step-3').style.display = 'block';
            title.innerHTML = 'Paso 3 de 3: Finalizar';
            btnNext.textContent = "CONFIRMAR PEDIDO";
            btnNext.style.background = "#38A169";
            _setCartStep(3);
        } else if (pasoCheckoutActual === 3) {
            const chkTerminos = document.getElementById('chk-terminos');
            if (!chkTerminos) { alert("⚠️ Error de sincronización. Actualizá la página (F5)."); return; }
            if (!chkTerminos.checked) { alert("⚠️ Para continuar, debes aceptar los Términos y Condiciones."); return; }
            procesarPedidoB2B();
        }
    };

    btnPrev.onclick = () => {
        if (pasoCheckoutActual === 2) reiniciarCheckout();
        else if (pasoCheckoutActual === 3) {
            document.getElementById('checkout-step-3').style.display = 'none';
            document.getElementById('checkout-step-2').style.display = 'block';
            title.innerHTML = 'Paso 2 de 3: Datos';
            btnNext.textContent = "IR A LOGÍSTICA";
            btnNext.style.background = "var(--primary-blue)";
            _setCartStep(2);
        }
    };
}

// =================================================================
// PRE-LLENADO DEL CHECKOUT CON DATOS DEL PERFIL VIP
// =================================================================
function preLlenarCheckout() {
    const perfil = window._perfilUsuario;
    if (!perfil || !usuarioEsVIP) return;

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && val) el.value = val;
    };

    // Nombre del negocio > nombre personal > email
    set('chk-nombre',    perfil.negocio    || perfil.nombre || '');
    set('chk-telefono',  perfil.telefono   || '');
    set('chk-direccion', perfil.direccion  || '');
    set('chk-localidad', perfil.localidad  || '');
    set('chk-cp',        perfil.cp         || '');

    // Indicador visual debajo del formulario
    const indicador = document.getElementById('chk-prefill-badge');
    if (indicador) indicador.style.display = 'flex';
}

// Actualizar perfil en Firestore con los datos que el usuario ingresó
async function actualizarPerfilDesdeCheckout(datosCliente) {
    const uid = window._perfilUsuarioId;
    if (!uid || !usuarioEsVIP) return;
    try {
        const cambios = {};
        const perfil  = window._perfilUsuario || {};
        if (datosCliente.nombre    && datosCliente.nombre    !== (perfil.negocio || perfil.nombre)) cambios.negocio   = datosCliente.nombre;
        if (datosCliente.telefono  && datosCliente.telefono  !== perfil.telefono)  cambios.telefono  = datosCliente.telefono;
        if (datosCliente.direccion && datosCliente.direccion !== perfil.direccion) cambios.direccion = datosCliente.direccion;
        if (datosCliente.localidad && datosCliente.localidad !== perfil.localidad) cambios.localidad = datosCliente.localidad;
        if (datosCliente.cp        && datosCliente.cp        !== perfil.cp)        cambios.cp        = datosCliente.cp;
        if (Object.keys(cambios).length > 0) {
            await db.collection('usuarios').doc(uid).update(cambios);
            // Actualizar caché local
            window._perfilUsuario = { ...perfil, ...cambios };
        }
    } catch(e) {
        console.warn('No se pudo actualizar el perfil:', e);
    }
}

function reiniciarCheckout() {
    _setCartStep(1);
    const title = document.getElementById('cart-title-step');
    const count = document.getElementById('cart-count-header');
    const step1 = document.getElementById('checkout-step-1');
    if (step1) {
        step1.style.display = 'block';
        document.getElementById('checkout-step-2').style.display          = 'none';
        document.getElementById('checkout-step-3').style.display          = 'none';
        document.getElementById('checkout-step-presupuesto').style.display = 'none';
        if (title && count) { title.innerHTML = 'Tu Carrito '; title.appendChild(count); }
        const btnNext = document.getElementById('btn-next-step');
        if (btnNext) {
            btnNext.style.background = "var(--primary-blue)";
            actualizarBtnCheckoutPorVIP();
        }
        const btnPrev  = document.getElementById('btn-prev-step');
        const btnClear = document.getElementById('btn-clear-cart');
        if (btnPrev)  btnPrev.style.display = 'none';
        if (btnClear) btnClear.style.display = 'inline-block';
    }
}

/* ==========================================================================
   19A. PROCESAMIENTO DE PRESUPUESTO (visitantes sin VIP)
   Sin descuento de stock — solo registra la consulta y abre WhatsApp.
   ========================================================================== */
async function procesarPresupuesto(datos) {
    const btn = document.getElementById('btn-next-step');
    btn.textContent = "Enviando...";
    btn.disabled    = true;

    try {
        // Guardar en Firestore con tipo="presupuesto"
        const idDoc = await db.collection("pedidos").add({
            tipo:        "presupuesto",
            estado:      "nuevo",
            fecha:       new Date(),
            fechaString: new Date().toLocaleString(),
            cliente:     datos.nombre,
            negocio:     datos.negocio,
            datosContacto: {
                nombre:   datos.nombre,
                telefono: datos.telefono,
                negocio:  datos.negocio
            },
            items: carrito.map(i => ({
                id:       i.id,
                codigo:   i.codigo   || '',
                nombre:   i.nombre   || '',
                marca:    i.marca    || '',
                cantidad: i.cantidad || 1,
                varDim1:  i.varDim1  || null,
                varDim2:  i.varDim2  || null,
            })),
            total: 0,  // Sin precio — es un presupuesto
            emailUsuario:  "visitante",
            nombreUsuario: datos.nombre
        });

        const idCorto = idDoc.id.slice(0, 6).toUpperCase();

        // Armar mensaje WhatsApp claro y limpio
        const lineasProductos = carrito.map(i => `▪️ *${i.cantidad}x* ${i.nombre} (${i.marca || ''})`).join('\n');
        const msj = `🔍 *SOLICITUD DE PRESUPUESTO #${idCorto}*

` +
                    `Hola Enzo! Me gustaría recibir un presupuesto.

` +
                    `👤 *${datos.nombre}*
` +
                    `🏪 ${datos.negocio}
` +
                    `📞 ${datos.telefono}

` +
                    `*📋 PRODUCTOS CONSULTADOS:*
${lineasProductos}

` +
                    `Quedo a la espera de tu respuesta. ¡Gracias!`;

        vaciarCarrito();
        cerrarCarrito();
        reiniciarCheckout();

        alert(`✅ ¡Presupuesto #${idCorto} generado!\n\nTe llevamos a WhatsApp para enviárselo a Enzo.`);

        const wa = window.open(`https://wa.me/5493755503213?text=${encodeURIComponent(msj)}`, '_blank');
        if (!wa || wa.closed) window.location.href = `https://wa.me/5493755503213?text=${encodeURIComponent(msj)}`;

    } catch (error) {
        console.error("Error al enviar presupuesto:", error);
        alert("Hubo un error de conexión. Intentá de nuevo.");
    } finally {
        btn.textContent = "ENVIAR PRESUPUESTO POR WHATSAPP";
        btn.disabled    = false;
        btn.style.background = "#25D366";
    }
}

/* ==========================================================================
   19. PROCESAMIENTO DE PEDIDO B2B
   ========================================================================== */
async function procesarPedidoB2B() {
    const btn          = document.getElementById('btn-next-step');
    const textoOriginal = btn.textContent;

    if (!navigator.onLine) { alert("⚠️ Sin conexión a internet. Revisá tu red e intentá de nuevo."); return; }

    btn.textContent = "Enviando...";
    btn.disabled    = true;

    try {
// ═══════════════════════════════════════════════════════════════
        // VERIFICAR STOCK + CAPTURAR PRECIOS REALES DESDE FIRESTORE
        // (El precio del carrito no se usa — el total se arma con datos
        //  leídos directamente de la base de datos para evitar manipulación)
        // ═══════════════════════════════════════════════════════════════
        const preciosVerificados = {}; // { itemId: precioReal }

        for (let item of carrito) {
            if (item.id.includes('_VAR_')) {
                // ── Variante embebida ──
                const padreId  = item.id.split('_VAR_')[0];
                const varCode  = item.id.split('_VAR_').slice(1).join('_VAR_');
                const docPadre = await db.collection("productos").doc(padreId).get();
                if (!docPadre.exists) {
                    alert(`⚠️ "${item.nombre}" ya no está disponible.`);
                    btn.textContent = textoOriginal; btn.disabled = false; return;
                }
                const v = (docPadre.data().variantes || []).find(v => (v.codigo || v.id) === varCode);
                if (!v) {
                    alert(`⚠️ La variante "${item.nombre}" ya no está disponible.`);
                    btn.textContent = textoOriginal; btn.disabled = false; return;
                }
                if ((parseInt(v.stock) || 0) < item.cantidad) {
                    alert(`⚠️ Solo quedan ${v.stock || 0} unidades de "${item.nombre}".`);
                    btn.textContent = textoOriginal; btn.disabled = false; return;
                }
                // Capturar precio real de la variante
                preciosVerificados[item.id] = parseFloat(v.precio) || 0;

            } else {
                // ── Producto regular o CAJA ──
                const idReal   = String(item.id).replace('_CAJA', '');
                const docRef   = await db.collection("productos").doc(idReal).get();
                if (!docRef.exists) {
                    alert(`⚠️ "${item.nombre}" ya no está disponible.`);
                    btn.textContent = textoOriginal; btn.disabled = false; return;
                }
                const prodReal = docRef.data();
                let cantLlevar = item.cantidad;
                if (String(item.id).includes('_CAJA') && item.unidadesPorCaja)
                    cantLlevar = item.cantidad * parseInt(item.unidadesPorCaja);
                if ((parseInt(prodReal.stock) || 0) < cantLlevar) {
                    alert(`⚠️ Solo quedan ${prodReal.stock || 0} unidades de "${item.nombre}".`);
                    btn.textContent = textoOriginal; btn.disabled = false; return;
                }
                // Capturar precio real: precioCaja si es caja, precio si es suelto
                if (String(item.id).includes('_CAJA')) {
                    preciosVerificados[item.id] = parseFloat(prodReal.precioCaja) || 0;
                } else {
                    preciosVerificados[item.id] = parseFloat(prodReal.precio) || 0;
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // TOTAL CALCULADO CON PRECIOS DE FIRESTORE (no del cliente)
        // ═══════════════════════════════════════════════════════════════
        const totalOrden = carrito.reduce((acc, item) => {
            const precioReal = preciosVerificados[item.id] || 0;
            return acc + (precioReal * item.cantidad);
        }, 0);

        const datosCliente = {
            nombre:       document.getElementById('chk-nombre').value.trim(),
            telefono:     document.getElementById('chk-telefono').value.trim(),
            direccion:    document.getElementById('chk-direccion').value.trim(),
            localidad:    document.getElementById('chk-localidad').value.trim(),
            cp:           document.getElementById('chk-cp').value.trim(),
            metodoEnvio:  document.getElementById('chk-envio').value,
            metodoPago:   document.getElementById('chk-pago').value,
            notas:        document.getElementById('chk-notas').value.trim()
        };

        const nuevoPedido = {
            fecha:         new Date(),
            fechaString:   new Date().toLocaleString(),
            estado:        "pendiente",
            items: carrito.map(i => ({
                id:         i.id,
                idPadre:    i.idPadre    || null,
                codigo:     i.codigo     || '',
                nombre:     i.nombre     || '',
                marca:      i.marca      || '',
                precio:     preciosVerificados[i.id] || 0,   // ← precio REAL, no del cliente
                cantidad:   i.cantidad   || 1,
                esVariante: i.esVariante || false,
                varDim1:    i.varDim1    || null,
                varDim2:    i.varDim2    || null,
            })),
            total:         totalOrden,
            cliente:       datosCliente.nombre,
            datosLogistica: datosCliente,
            tipoCliente:   usuarioEsVIP ? "VIP" : "Invitado",
            emailUsuario:  auth.currentUser ? auth.currentUser.email : "Anonimo",
            nombreUsuario: auth.currentUser ? auth.currentUser.displayName : datosCliente.nombre
        };

// ═══════════════════════════════════════════════════════════════
        // DESCONTAR STOCK CON TRANSACCIONES ATÓMICAS
        // Si dos pedidos simultáneos compiten por el mismo producto,
        // la transacción re-valida el stock real y rechaza si no alcanza.
        // El pedido se crea DESPUÉS — si el stock falla, no queda basura.
        // ═══════════════════════════════════════════════════════════════

        const itemsVar    = carrito.filter(i => i.id.includes('_VAR_'));
        const itemsNormal = carrito.filter(i => !i.id.includes('_VAR_'));

        // 1) Agrupar ítems normales por producto real (sueltos + cajas del mismo prod)
        const stockPorProducto = {};
        itemsNormal.forEach(item => {
            const idReal = String(item.id).replace('_CAJA', '');
            let cantidad = item.cantidad;
            if (String(item.id).includes('_CAJA') && item.unidadesPorCaja)
                cantidad = item.cantidad * parseInt(item.unidadesPorCaja);
            stockPorProducto[idReal] = (stockPorProducto[idReal] || 0) + cantidad;
        });

        // Registro de descuentos ya aplicados — si algo falla a mitad de camino,
        // se devuelven para no dejar stock fantasma.
        const descuentosNormales  = []; // [idReal, cantidad]
        const descuentosVariantes = []; // items _VAR_ ya descontados

        async function revertirDescuentos() {
            for (const [idReal, cant] of descuentosNormales) {
                try {
                    await db.collection('productos').doc(idReal)
                        .update({ stock: firebase.firestore.FieldValue.increment(cant) });
                } catch (e) { console.error('No se pudo revertir stock de', idReal, e); }
            }
            for (const item of descuentosVariantes) {
                const padreId = item.id.split('_VAR_')[0];
                const varCode = item.id.split('_VAR_').slice(1).join('_VAR_');
                try {
                    await db.runTransaction(async (t) => {
                        const ref = db.collection('productos').doc(padreId);
                        const doc = await t.get(ref);
                        if (!doc.exists) return;
                        const variantes = [...(doc.data().variantes || [])];
                        const idx = variantes.findIndex(v => (v.codigo || v.id) === varCode);
                        if (idx === -1) return;
                        variantes[idx] = { ...variantes[idx], stock: (parseInt(variantes[idx].stock) || 0) + item.cantidad };
                        t.update(ref, { variantes, stock: firebase.firestore.FieldValue.increment(item.cantidad) });
                    });
                } catch (e) { console.error('No se pudo revertir stock de variante', item.id, e); }
            }
        }

        let docRef;
        try {
            // 2) Descontar normales — transacción por producto
            for (const [idReal, cantTotal] of Object.entries(stockPorProducto)) {
                await db.runTransaction(async (t) => {
                    const ref = db.collection("productos").doc(idReal);
                    const doc = await t.get(ref);
                    if (!doc.exists) throw new Error(`El producto ya no existe.`);
                    const stockActual = parseInt(doc.data().stock) || 0;
                    if (stockActual < cantTotal) {
                        throw new Error(`Stock insuficiente para "${doc.data().nombre || idReal}": quedan ${stockActual} unidades, se necesitan ${cantTotal}.`);
                    }
                    t.update(ref, { stock: firebase.firestore.FieldValue.increment(-cantTotal) });
                });
                descuentosNormales.push([idReal, cantTotal]);
            }

            // 3) Descontar variantes — transacción que actualiza array + stock total
            for (const item of itemsVar) {
                const padreId = item.id.split('_VAR_')[0];
                const varCode = item.id.split('_VAR_').slice(1).join('_VAR_');
                await db.runTransaction(async (t) => {
                    const ref = db.collection('productos').doc(padreId);
                    const doc = await t.get(ref);
                    if (!doc.exists) throw new Error(`El producto padre ya no existe.`);
                    const variantes = [...(doc.data().variantes || [])];
                    const idx = variantes.findIndex(v => (v.codigo || v.id) === varCode);
                    if (idx === -1) throw new Error(`La variante ya no existe.`);
                    const stockVar = parseInt(variantes[idx].stock) || 0;
                    if (stockVar < item.cantidad) {
                        throw new Error(`Stock insuficiente para "${item.nombre}": quedan ${stockVar}, se necesitan ${item.cantidad}.`);
                    }
                    variantes[idx] = { ...variantes[idx], stock: stockVar - item.cantidad };
                    t.update(ref, { variantes, stock: firebase.firestore.FieldValue.increment(-item.cantidad) });
                });
                descuentosVariantes.push(item);
            }

            // 4) Stock OK → recién ahora crear el pedido
            docRef = await db.collection("pedidos").add(nuevoPedido);
        } catch (errorStock) {
            await revertirDescuentos();
            throw errorStock;
        }
        actualizarPerfilDesdeCheckout(datosCliente); // sync perfil silencioso
        const idPedido = docRef.id.slice(0, 6).toUpperCase();

        // 5) Invalidar caché
        invalidarCacheInventario();

        // Armar mensaje WhatsApp
        const telefono = "5493755503213";
        let msj = usuarioEsVIP
            ? `*NUEVO PEDIDO CONFIRMADO (#${idPedido})* 🚀\n\nHola Enzo! Soy *${datosCliente.nombre}*.\n\n*📦 LOGÍSTICA*\n📞 ${datosCliente.telefono}\n📍 ${datosCliente.direccion}, ${datosCliente.localidad} (CP: ${datosCliente.cp})\n🚚 ${datosCliente.metodoEnvio}\n💳 ${datosCliente.metodoPago}\n${datosCliente.notas ? '📝 ' + datosCliente.notas + '\n' : ''}\n*🛒 PRODUCTOS*\n${carrito.map(i => `▪️ *${i.cantidad}x* ${i.nombre}`).join('\n')}\n\n💰 *TOTAL: $${totalOrden.toLocaleString('es-AR')}*`
            : `*COTIZACIÓN (#${idPedido})* 🚀\n\n👤 ${datosCliente.nombre}\n📞 ${datosCliente.telefono}\n📍 ${datosCliente.localidad} (CP: ${datosCliente.cp})\n🚚 ${datosCliente.metodoEnvio}\n💳 ${datosCliente.metodoPago}\n\n${carrito.map(i => `▪️ *${i.cantidad}x* ${i.nombre}`).join('\n')}\n\n💰 Total Estimado: $${totalOrden.toLocaleString('es-AR')}`;

        vaciarCarrito();
        cerrarCarrito();
        reiniciarCheckout();

        alert(`✅ ¡Pedido #${idPedido} generado!\n\nTe llevamos a WhatsApp para enviar los detalles a Enzo.`);

        const nuevaPestana = window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(msj)}`, '_blank');
        if (!nuevaPestana || nuevaPestana.closed) window.location.href = `https://wa.me/${telefono}?text=${encodeURIComponent(msj)}`;

    } catch (error) {
        console.error("Error al enviar pedido:", error);
        alert(error && error.message && !error.code
            ? `⚠️ ${error.message}`
            : "Hubo un error al conectar. Intentá de nuevo.");
    } finally {
        btn.textContent = textoOriginal;
        btn.disabled    = false;
        btn.style.backgroundColor = "#38A169";
    }
}

/* ==========================================================================
   20. DRAG CARRUSELES
   ========================================================================== */
function activarDragCarruseles() {
    document.querySelectorAll('.product-carousel, .carousel-b2b-track').forEach(track => {
        let isDown = false, startX, scrollLeft, isDragging = false;
        track.addEventListener('dragstart', e => e.preventDefault());
        track.addEventListener('mousedown', e => {
            isDown = true; isDragging = false;
            track.style.scrollSnapType = 'none'; track.style.scrollBehavior = 'auto'; track.style.cursor = 'grabbing';
            startX = e.pageX - track.offsetLeft; scrollLeft = track.scrollLeft;
        });
        track.addEventListener('mouseleave', () => { if (!isDown) return; isDown = false; track.style.scrollSnapType = 'x mandatory'; track.style.scrollBehavior = 'smooth'; track.style.cursor = 'grab'; });
        track.addEventListener('mouseup', () => { isDown = false; track.style.scrollSnapType = 'x mandatory'; track.style.scrollBehavior = 'smooth'; track.style.cursor = 'grab'; });
        track.addEventListener('mousemove', e => {
            if (!isDown) return; e.preventDefault();
            const walk = (e.pageX - track.offsetLeft - startX) * 2;
            if (Math.abs(walk) > 5) isDragging = true;
            track.scrollLeft = scrollLeft - walk;
        });
        track.addEventListener('click', e => { if (isDragging) { e.preventDefault(); e.stopPropagation(); } }, true);
    });
}

/* ==========================================================================
   21. FLECHAS DE CARRUSELES
   ========================================================================== */
function inicializarFlechasCarruseles() {
    function moverCarrusel(id, dir) {
        const track = document.getElementById(id);
        if (!track) return;
        track.style.scrollSnapType = 'none';
        track.scrollBy({ left: 310 * dir, behavior: 'smooth' });
        setTimeout(() => track.style.scrollSnapType = 'x mandatory', 500);
    }

    [['btn-nuevos-prev','contenedor-nuevos',-1], ['btn-nuevos-next','contenedor-nuevos',1],
     ['btn-ofertas-prev','contenedor-ofertas',-1], ['btn-ofertas-next','contenedor-ofertas',1],
     ['btn-similares-prev','contenedor-similares',-1], ['btn-similares-next','contenedor-similares',1]
    ].forEach(([btnId, trackId, dir]) => {
        const btn = document.getElementById(btnId);
        if (btn) btn.addEventListener('click', () => moverCarrusel(trackId, dir));
    });

    const track   = document.getElementById('track-categorias');
    const btnPrev = document.getElementById('btn-cat-prev');
    const btnNext = document.getElementById('btn-cat-next');
    if (track && btnPrev && btnNext) {
        btnNext.addEventListener('click', () => track.scrollBy({ left: 280, behavior: 'smooth' }));
        btnPrev.addEventListener('click', () => track.scrollBy({ left: -280, behavior: 'smooth' }));
    }
}

/* ==========================================================================
   22. FEEDBACK / REPORTES
   ========================================================================== */
window.abrirModalFeedback = function (e) {
    if (e) e.preventDefault();
    abrirModal(document.getElementById('modal-feedback'));
};

window.cerrarModalFeedback = function () {
    document.getElementById('modal-feedback')?.classList.remove('active');
    document.getElementById('modal-overlay')?.classList.remove('active');
};

const formFeedback = document.getElementById('form-feedback');
if (formFeedback) {
    formFeedback.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn     = formFeedback.querySelector('button');
        const tipo    = document.getElementById('fb-tipo').value;
        const mensaje = document.getElementById('fb-mensaje').value.trim();
        const remitente = auth.currentUser ? auth.currentUser.email : "Usuario Anónimo";
        if (mensaje.length < 10) { alert("Por favor, danos más detalle (mínimo 10 letras)."); return; }
        try {
            btn.textContent = "Enviando..."; btn.disabled = true;
            await db.collection("reportes").add({ tipo, mensaje, remitente, fecha: new Date(), fechaString: new Date().toLocaleString(), leido: false });
            alert("¡Gracias por tu mensaje! Lo revisaremos pronto.");
            formFeedback.reset();
            cerrarModalFeedback();
        } catch (error) {
            alert("Error de conexión. Intenta de nuevo.");
        } finally {
            btn.textContent = "ENVIAR MENSAJE"; btn.disabled = false;
        }
    });
}