/* ==========================================================================
   PANEL DE ADMINISTRACIÓN - FERRETERÍA ENZO
   ========================================================================== */

// 1. CONFIGURACIÓN FIREBASE (PEGAR LO MISMO QUE EN SCRIPT.JS)
// Your web app's Firebase configuration
// 1. CONFIGURACIÓN FIREBASE (VERSIÓN BLINDADA ANTI-ERRORES)
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

const db   = firebase.firestore();
const auth = firebase.auth();

/* ── Toast de notificación local (independiente de script.js) ── */
function mostrarNotificacionAdmin(msg) {
    let toast = document.getElementById('admin-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'admin-toast';
        toast.style.cssText = `
            position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
            background:#1A365D; color:white; padding:12px 24px; border-radius:10px;
            font-size:0.9rem; font-weight:600; z-index:99999; opacity:0;
            transition:opacity .3s ease; pointer-events:none; white-space:nowrap;
            box-shadow:0 4px 16px rgba(0,0,0,0.3);`;
        document.body.appendChild(toast);
        // Agregar keyframe shimmer para skeleton loaders (solo 1 vez)
        if (!document.getElementById('skel-style')) {
            const s = document.createElement('style');
            s.id = 'skel-style';
            s.textContent = '@keyframes skel-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
            document.head.appendChild(s);
        }
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2800);
}

/* ── Modal de confirmación personalizado (reemplaza window.confirm) ── */
let _confirmResolve = null;
window.confirmarAccion = function(opts) {
    return new Promise(resolve => {
        _confirmResolve = resolve;
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-icon-txt').textContent  = opts.icono   || '⚠️';
        document.getElementById('confirm-title-txt').textContent = opts.titulo  || 'Confirmar';
        document.getElementById('confirm-msg-txt').textContent   = opts.mensaje || '';
        const okBtn = document.getElementById('confirm-ok-btn');
        okBtn.textContent = opts.textoBtn || 'Confirmar';
        okBtn.style.background = opts.colorBtn || '#E53E3E';
        modal.style.display = 'flex';
    });
};
window.resolverConfirm = function(resultado) {
    document.getElementById('confirm-modal').style.display = 'none';
    if (_confirmResolve) { _confirmResolve(resultado); _confirmResolve = null; }
};

/* Instancia secundaria: permite crear cuentas de Auth sin cerrar la sesión del admin */
const secondaryApp  = firebase.apps.find(a => a.name === 'secondary')
    || firebase.initializeApp(firebase.app().options, 'secondary');
const secondaryAuth = secondaryApp.auth();

// Variables DOM
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const tableBody = document.getElementById('admin-table-body');
const modal = document.getElementById('product-modal');
const form = document.getElementById('product-form');

// Memoria para la tabla inteligente
let productosAdmin = [];
let ordenActual = { columna: '', ascendente: true };

// 2. VERIFICAR SI ESTÁ LOGUEADO (CON CANDADO DE SEGURIDAD)
auth.onAuthStateChanged(user => {
    
    // 👇 ESCRIBE AQUÍ EL CORREO EXACTO QUE CREASTE PARA ENZO 👇
    const correoAdministrador = "distribuidoraenzo28@gmail.com"; 

    if (user) {
        // ¿Es el jefe?
        if (user.email === correoAdministrador) {
            // Usuario logueado y ES el administrador: Mostrar Panel
            loginScreen.style.display = 'none';
            dashboardScreen.style.display = 'block';
            document.getElementById('user-email-display').textContent = user.email;
            
            cargarProductosAdmin();
            cargarPedidos(); 
            iniciarTableroJefe(); // <--- AÑADE ESTA LÍNEA AQUÍ
            cargarReportes(); // <--- NUEVO: Carga el buzón

        } else {
            // Es un cliente normal intentando entrar al admin
            alert("Acceso denegado. Esta área es solo para administración.");
            auth.signOut(); // Lo expulsamos
            window.location.href = "index.html"; // Lo mandamos a la tienda
        }
    } else {
        // Nadie logueado: Mostrar Login
        loginScreen.style.display = 'flex';
        dashboardScreen.style.display = 'none';
    }
});

// 3. FUNCIÓN LOGIN
document.getElementById('admin-login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-pass').value;
    const errorMsg = document.getElementById('login-error');

    auth.signInWithEmailAndPassword(email, pass)
        .catch(error => {
            errorMsg.style.display = 'block';
            errorMsg.textContent = "Error: " + error.message;
        });
});

function logout() {
    auth.signOut();
}

// 4. CARGAR TABLA DE PRODUCTOS (¡AHORA EN TIEMPO REAL!)
function cargarProductosAdmin() {
    const skelRow = `<tr>${Array(9).fill('<td><div style="height:14px;background:linear-gradient(90deg,#EDF2F7 25%,#E2E8F0 50%,#EDF2F7 75%);background-size:200% 100%;border-radius:4px;animation:skel-shimmer 1.2s infinite;"></div></td>').join('')}</tr>`;
    tableBody.innerHTML = skelRow.repeat(6);
    
    // onSnapshot es el radar que escucha los cambios en vivo
    db.collection("productos").onSnapshot(snapshot => {
        productosAdmin = []; // Vaciamos la memoria RAM
        let _total = 0, _agotados = 0;
        snapshot.forEach(doc => {
            const d = { id: doc.id, ...doc.data() };
            productosAdmin.push(d);
            _total++;
            if (!d.stock || d.stock <= 0) _agotados++;
        });
        // Actualizar stats del tablero (fusionado — evita listener duplicado)
        const _sp = document.getElementById('stat-productos');
        const _sa = document.getElementById('stat-agotados');
        if (_sp) _sp.textContent = _total;
        if (_sa) _sa.textContent = _agotados;
        // Disparamos el filtro y dibujamos la tabla automáticamente
        filtrarTabla(); 
    }, error => {
        console.error("Error al cargar productos en tiempo real:", error);
        alert("Hubo un error al conectar con la base de datos.");
    });
}
// --- VARIABLES DE PAGINACIÓN ---
let paginaActual = 1;
const productosPorPagina = 50; // Muestra 50 productos por pantalla
let datosActuales = []; // Guarda la lista actual para paginarla

// 4.1 EL DIBUJANTE DE LA TABLA INTELIGENTE (CON PAGINACIÓN)
function renderTable(data) {
    datosActuales = data; 
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">No se encontraron productos.</td></tr>';
        actualizarTextosPaginacion(0, 0, 0);
        return;
    }

    // --- MATEMÁTICA DE PAGINACIÓN ---
    const totalItems = data.length;
    const totalPaginas = Math.ceil(totalItems / productosPorPagina);
    
    if (paginaActual > totalPaginas) paginaActual = 1; // Seguro anti-bugs

    const inicio = (paginaActual - 1) * productosPorPagina;
    const fin = inicio + productosPorPagina;
    const productosPagina = data.slice(inicio, fin); // Cortamos solo los 50 que tocan

    productosPagina.forEach(prod => {
        let indicadores = '';
        if (prod.enOferta) indicadores += '<span class="material-icons" style="color: #E53E3E; font-size: 1.1rem; vertical-align: middle; margin-left:4px;" title="En Oferta">local_fire_department</span>';
        if (prod.nuevo) indicadores += '<span class="material-icons" style="color: #38bdf8; font-size: 1.1rem; vertical-align: middle; margin-left:4px;" title="Nuevo Ingreso">new_releases</span>';
        if (prod.vendePorCaja) indicadores += '<span class="material-icons" style="color: #38A169; font-size: 1.1rem; vertical-align: middle; margin-left:4px;" title="Vende por Caja">inventory_2</span>';

        // 🔥 NUEVO: SEMÁFORO VISUAL PARA CATEGORÍAS 🔥
        let categoriaVisual = '';
        if (!prod.categoria || prod.categoria.toLowerCase() === 'sin categoria') {
            // Si no tiene categoría o dice "sin categoria", pinta el cartel rojo de advertencia
            categoriaVisual = '<span style="background: #FFF5F5; color: #E53E3E; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 0.8rem; border: 1px solid #FEB2B2; display: inline-flex; align-items: center; gap: 4px;"><span class="material-icons" style="font-size: 1rem;">warning</span> SIN CATEGORÍA</span>';
        } else {
            // Si está todo bien, lo pinta gris normal
            categoriaVisual = `<span style="text-transform: uppercase; font-size: 0.85rem; color: #4A5568; font-weight: bold;">${prod.categoria}</span>`;
        }

        const isChecked = productosSeleccionados.has(prod.id) ? 'checked' : '';
        const tr = document.createElement('tr');
        
        // Fíjate que aquí abajo, donde antes decía <td>${prod.categoria}</td>, ahora dice <td>${categoriaVisual}</td>
        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="row-checkbox" value="${prod.id}" onchange="toggleSeleccion(this)" ${isChecked} style="transform: scale(1.3); cursor: pointer;">
            </td>
            <td><img src="${prod.imagen || 'https://via.placeholder.com/50'}" style="width:50px; height:50px; object-fit:cover; border-radius:6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"></td>
            <td style="font-family: monospace; font-weight: bold; color: #4A5568;">${prod.codigo || '<span style="color:#A0AEC0;">S/C</span>'}</td>
            <td><span style="background: #EDF2F7; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; color: #4A5568;">${prod.marca || '-'}</span></td>
            <td><strong style="color: var(--primary-dark);">${prod.nombre}</strong> ${indicadores}</td>
            <td style="font-weight: 900; color: #2D3748;">$${parseInt(prod.precio).toLocaleString('es-AR')}</td>
            <td>
                <span style="color: ${prod.stock > 0 ? '#38A169' : '#E53E3E'}; font-weight: bold; font-size: 1.1rem;">
                    ${prod.stock !== undefined ? prod.stock : 0}
                </span>
            </td>
            <td>${categoriaVisual}</td>
            <td style="white-space: nowrap;">
                <button class="btn-outline" onclick="editarProducto('${prod.id}')" style="padding: 6px 10px; margin-right: 5px;" title="Editar"><span class="material-icons" style="font-size: 1.2rem;">edit</span></button>
                <button class="btn-outline" onclick="eliminarProducto('${prod.id}', '${prod.nombre}')" style="padding: 6px 10px; color: #E53E3E; border-color: #E53E3E;" title="Eliminar"><span class="material-icons" style="font-size: 1.2rem;">delete</span></button>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    actualizarTextosPaginacion(inicio + 1, Math.min(fin, totalItems), totalItems);
}

// 4.2 EL CEREBRO DEL BUSCADOR (RESETEA LA PÁGINA)
window.filtrarTabla = function() {
    const searchInput = document.getElementById('admin-search');
    if (!searchInput) {
        paginaActual = 1;
        renderTable(productosAdmin);
        return;
    }
    
    const texto = searchInput.value.toLowerCase().trim();
    if (texto === '') {
        paginaActual = 1;
        renderTable(productosAdmin);
        return;
    }

    const categoriaFiltro = (document.getElementById('admin-cat-filter')?.value || 'all');
    const resultados = productosAdmin.filter(prod => {
        const nombre = (prod.nombre || '').toLowerCase();
        const codigo = (prod.codigo || '').toLowerCase();
        const marca = (prod.marca || '').toLowerCase();
        const pasaTexto = nombre.includes(texto) || codigo.includes(texto) || marca.includes(texto);
        const pasaCat = categoriaFiltro === 'all' || (prod.categoria || 'sin categoria') === categoriaFiltro;
        return pasaTexto && pasaCat;
    });

    paginaActual = 1; 
    renderTable(resultados);
};

// 4.3 EL CEREBRO DEL ORDENAMIENTO
window.ordenarTabla = function(columna, nombreColumna) {
    if (ordenActual.columna === columna) {
        ordenActual.ascendente = !ordenActual.ascendente; 
    } else {
        ordenActual.columna = columna;
        ordenActual.ascendente = true; 
    }

    const todosLosIconos = ['codigo', 'marca', 'nombre', 'precio', 'stock', 'categoria'];
    todosLosIconos.forEach(id => {
        const icono = document.getElementById(`icon-${id}`);
        if (icono) {
            icono.textContent = 'unfold_more';
            icono.style.color = '#A0AEC0'; 
        }
    });

    const iconoActivo = document.getElementById(`icon-${columna}`);
    if (iconoActivo) {
        iconoActivo.textContent = ordenActual.ascendente ? 'arrow_upward' : 'arrow_downward';
        iconoActivo.style.color = '#3182CE'; 
    }

    const infoOrden = document.getElementById('info-orden');
    if (infoOrden) {
        let mensajeOrden = ordenActual.ascendente ? "Menor a Mayor (A-Z) ⬆️" : "Mayor a Menor (Z-A) ⬇️";
        infoOrden.innerHTML = `Orden actual: <strong style="color: #2D3748;">${nombreColumna}</strong> ➔ ${mensajeOrden}`;
    }

    productosAdmin.sort((a, b) => {
        let valA = a[columna] || '';
        let valB = b[columna] || '';

        if (columna === 'precio' || columna === 'stock') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
            return ordenActual.ascendente ? valA - valB : valB - valA;
        } 
        
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
        if (valA < valB) return ordenActual.ascendente ? -1 : 1;
        if (valA > valB) return ordenActual.ascendente ? 1 : -1;
        return 0;
    });

    paginaActual = 1; 
    filtrarTabla();
};

// 4.4 CONTROLADORES DE LOS BOTONES DE PÁGINA
window.cambiarPagina = function(direccion) {
    const totalItems = datosActuales.length;
    const totalPaginas = Math.ceil(totalItems / productosPorPagina);
    let nuevaPagina = paginaActual + direccion;
    
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
        paginaActual = nuevaPagina;
        renderTable(datosActuales); 
        window.scrollTo({ top: document.getElementById('seccion-productos').offsetTop, behavior: 'smooth' }); // Sube la pantalla al cambiar
    }
};

function actualizarTextosPaginacion(inicio, fin, total) {
    const spanInicio = document.getElementById('pag-info-inicio');
    const spanFin = document.getElementById('pag-info-fin');
    const spanTotal = document.getElementById('pag-info-total');
    const btnAnt = document.getElementById('btn-pag-ant');
    const btnSig = document.getElementById('btn-pag-sig');

    if(spanInicio) spanInicio.textContent = inicio;
    if(spanFin) spanFin.textContent = fin;
    if(spanTotal) spanTotal.textContent = total;

    if(btnAnt) btnAnt.disabled = (paginaActual === 1);
    if(btnSig) btnSig.disabled = (fin >= total);
}

// 5. AGREGAR / EDITAR PRODUCTO
function abrirFormulario() {
    form.reset();
    document.getElementById('edit-id').value = ""; // Limpiar ID (Modo crear)
    document.getElementById('modal-title').textContent = "Nuevo Producto";
    modal.style.display = 'flex';
}

/* ══════════════════════════════════════════════════════════════════
   VARIANTES — Editor en el formulario de producto
   ══════════════════════════════════════════════════════════════════ */

window.toggleVariantes = function(activo) {
    const editor = document.getElementById('variantes-editor');
    if (editor) editor.style.display = activo ? 'block' : 'none';
    if (!activo) {
        const lista = document.getElementById('variantes-lista');
        if (lista) lista.innerHTML = '';
        // Limpiar etiquetas también
        const l1 = document.getElementById('p-label-dim1');
        const l2 = document.getElementById('p-label-dim2');
        if (l1) l1.value = '';
        if (l2) l2.value = '';
    }
    // Sincronizar encabezados de columna con los labels escritos
    ['p-label-dim1','p-label-dim2'].forEach((id, i) => {
        const inp = document.getElementById(id);
        const col = document.getElementById(i === 0 ? 'col-header-dim1' : 'col-header-dim2');
        if (inp && col) {
            inp.addEventListener('input', () => {
                col.textContent = inp.value || (i === 0 ? 'Valor DIM 1' : 'Valor DIM 2 (opcional)');
            });
        }
    });
};

window.agregarFilaVariante = function(datos = {}) {
    const lista = document.getElementById('variantes-lista');
    if (!lista) return;

    // Backward compat: si llega con solo etiqueta (sistema viejo), mapearlo a varDim1
    const dim1Val = datos.varDim1 || datos.etiqueta || '';
    const dim2Val = datos.varDim2 || '';

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-variante-row', '1');
    const isEven = lista.children.length % 2 === 0;
    wrapper.style.cssText = `display:grid;grid-template-columns:1fr 1fr 100px 80px 1fr 36px;gap:6px;align-items:center;padding:8px 10px;background:${isEven?'white':'#FAFAFA'};border-bottom:1px solid #EDF2F7;transition:background .15s;`;
    wrapper.onmouseover = function(){ this.style.background='#EBF8FF'; };
    wrapper.onmouseout  = function(){ this.style.background = (Array.from(lista.children).indexOf(this) % 2 === 0) ? 'white' : '#FAFAFA'; };

    const inp = (cls, ph, val, extra='') => `<input type="text" class="${cls}" placeholder="${ph}" value="${val}" style="width:100%;padding:7px 8px;border:1.5px solid #E2E8F0;border-radius:6px;font-size:0.85rem;box-sizing:border-box;transition:border-color .15s;" onfocus="this.style.borderColor='#3182CE'" onblur="this.style.borderColor='#E2E8F0'" ${extra}>`;
    const num = (cls, ph, val) => `<input type="number" class="${cls}" placeholder="${ph}" value="${val}" style="width:100%;padding:7px 8px;border:1.5px solid #E2E8F0;border-radius:6px;font-size:0.85rem;text-align:center;box-sizing:border-box;transition:border-color .15s;" onfocus="this.style.borderColor='#3182CE'" onblur="this.style.borderColor='#E2E8F0'">`;

    wrapper.innerHTML = `
        ${inp('var-dim1', 'Ej: Redonda', dim1Val, 'title="Primera dimensión"')}
        ${inp('var-dim2', 'Ej: 2mm', dim2Val, 'title="Segunda dimensión (opcional)"')}
        ${num('var-precio', 'Precio', datos.precio || '')}
        ${num('var-stock', 'Stock', datos.stock !== undefined ? datos.stock : '')}
        ${inp('var-imagen', 'https://...', datos.imagen || '', 'title="URL imagen propia (opcional)"')}
        <button type="button" onclick="this.closest('[data-variante-row]').remove()"
                style="width:30px;height:30px;background:#FED7D7;color:#C53030;border:none;border-radius:6px;cursor:pointer;font-size:1rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;" title="Quitar fila">✕</button>
    `;
    lista.appendChild(wrapper);
};

function leerVariantesDelFormulario() {
    const lista = document.getElementById('variantes-lista');
    if (!lista || !document.getElementById('p-tiene-variantes')?.checked) return [];

    const nombrePadre = document.getElementById('p-nombre')?.value.trim() || '';

    const variantes = [];
    lista.querySelectorAll('[data-variante-row]').forEach(wrapper => {
        const dim1   = wrapper.querySelector('.var-dim1')?.value.trim()  || '';
        const dim2   = wrapper.querySelector('.var-dim2')?.value.trim()  || '';
        const precio = Number(wrapper.querySelector('.var-precio')?.value || 0);
        const stock  = Number(wrapper.querySelector('.var-stock')?.value  || 0);
        const imagen = wrapper.querySelector('.var-imagen')?.value.trim() || '';

        if (!dim1) return; // Fila vacía — ignorar

        // Etiqueta = "Redonda 2mm" o solo "Redonda" si no hay dim2
        const etiqueta = [dim1, dim2].filter(Boolean).join(' ');

        // Nombre completo para el carrito: "TANZA GRILON - Redonda 2mm"
        const nombre = etiqueta ? `${nombrePadre} - ${etiqueta}` : nombrePadre;

        // Código de la variante = GRUPO_ID + etiqueta simplificada
        const codigoBase = (document.getElementById('p-codigo')?.value.trim() || '').toUpperCase();
        const codigoVar  = codigoBase
            ? `${codigoBase}-${etiqueta.replace(/\s+/g,'-').toUpperCase()}`
            : etiqueta.replace(/\s+/g,'-').toUpperCase();

        variantes.push({
            id:       codigoVar || etiqueta,
            codigo:   codigoVar,
            etiqueta,
            varDim1:  dim1 || null,
            varDim2:  dim2 || null,
            precio,
            stock,
            imagen:   imagen || null,
            nombre
        });
    });
    return variantes;
}

function cerrarFormulario() {
    modal.style.display = 'none';
}

// --- FUNCIÓN PARA SUBIR IMAGEN A FIREBASE STORAGE ---
async function subirImagen(archivo) {
    const ref = firebase.storage().ref();
    // Creamos una carpeta "productos" y usamos la fecha para que el nombre sea único
    const nombreArchivo = `productos/${Date.now()}_${archivo.name}`;
    const metaData = { contentType: archivo.type };
    
    const task = ref.child(nombreArchivo).put(archivo, metaData);
    
    // Esperamos a que termine de subir
    await task;
    
    // Pedimos la URL pública de descarga
    const url = await task.snapshot.ref.getDownloadURL();
    return url;
}

// --- AL ENVIAR EL FORMULARIO (GUARDAR HÍBRIDO) ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnGuardar = form.querySelector('button[type="submit"]');
    const msgProgreso = document.getElementById('upload-progress');
    const archivoInput = document.getElementById('p-archivo-imagen');
    const urlManualInput = document.getElementById('p-imagen-url-manual'); // <--- NUEVO CAMPO
    
    btnGuardar.disabled = true;
    btnGuardar.textContent = "Procesando...";
    
    try {
        // 1. Empezamos con la imagen que ya tenía (si estamos editando)
        let urlImagen = document.getElementById('p-imagen-url-actual').value; 

        // 2. LÓGICA DE DECISIÓN:
        
        // CASO A: ¿El usuario pegó un LINK MANUAL? -> GANA EL LINK
        if (urlManualInput && urlManualInput.value.trim() !== "") {
            urlImagen = urlManualInput.value.trim();
        } 
        // CASO B: ¿No hay link, pero SÍ seleccionó un ARCHIVO? -> INTENTAR SUBIR
        else if (archivoInput.files.length > 0) {
            try {
                if(msgProgreso) msgProgreso.style.display = 'block';
                const archivo = archivoInput.files[0];
                urlImagen = await subirImagen(archivo); // Intentamos subir a Firebase
            } catch (errStorage) {
                console.warn("Fallo subida:", errStorage);
                // Si falla (porque no hay tarjeta/storage), avisamos pero NO rompemos todo
                alert("⚠️ El sistema de archivos (Storage) no está activo en Firebase.\n\nPor favor, busca la imagen en Google, copia su dirección y pégala en el campo de texto.");
                btnGuardar.disabled = false;
                btnGuardar.textContent = "GUARDAR";
                if(msgProgreso) msgProgreso.style.display = 'none';
                return; // Cortamos aquí para que el usuario ponga el link
            }
        }
        
        // Si al final no tenemos ni link nuevo, ni archivo nuevo, ni imagen vieja...
        if (!urlImagen) {
            urlImagen = "https://placehold.co/300x300/EEE/3182CE?text=Sin+Imagen"; 
        }

        // 3. Armamos el objeto Producto
        const producto = {
            // AGREGAMOS ESTA LÍNEA AL PRINCIPIO:
            codigo: document.getElementById('p-codigo').value.trim() || "S/C", 
            
            nombre: document.getElementById('p-nombre').value,
            marca: document.getElementById('p-marca').value,
            categoria: document.getElementById('p-categoria').value,
            precio: Number(document.getElementById('p-precio').value),
            stock: Number(document.getElementById('p-stock').value),
            imagen: urlImagen, // Aquí va la URL ganadora
            descripcion: document.getElementById('p-desc').value,
            enOferta: document.getElementById('p-oferta').checked,
            nuevo: document.getElementById('p-nuevo').checked,
            fechaActualizacion: new Date(),

            // --- NUEVOS CAMPOS DE CAJA ---
            vendePorCaja: document.getElementById('p-por-caja').checked,
            unidadesPorCaja: document.getElementById('p-por-caja').checked ? Number(document.getElementById('p-unidades-caja').value) : 0,
            precioCaja: document.getElementById('p-por-caja').checked ? Number(document.getElementById('p-precio-caja').value) : 0,

            // ── Variantes ──────────────────────────────────────────────────
            tieneVariantes: document.getElementById('p-tiene-variantes')?.checked || false,
            variantes: leerVariantesDelFormulario()
        };

        // Calcular campos del sistema de variantes 2D
        if (producto.tieneVariantes) {
            const labelDim1  = document.getElementById('p-label-dim1')?.value.trim() || 'Presentación';
            const labelDim2  = document.getElementById('p-label-dim2')?.value.trim() || '';
            const tiene2Dims = producto.variantes.some(v => v.varDim2);

            producto.labelDim1     = labelDim1;
            producto.labelDim2     = labelDim2 || 'Medida';
            producto.tiene2Dims    = tiene2Dims;
            producto.variantesLabel = labelDim1 + (tiene2Dims && labelDim2 ? ' / ' + labelDim2 : '');
        } else {
            // Limpiar campos de variantes si se desactivó
            producto.labelDim1     = null;
            producto.labelDim2     = null;
            producto.tiene2Dims    = false;
            producto.variantesLabel = '';
        }

        // Advertir si se marcó "tiene variantes" pero no se agregó ninguna fila
        if (producto.tieneVariantes && producto.variantes.length === 0) {
            const ok = await confirmarAccion({
                icono: '⚡', titulo: 'Variantes vacías',
                mensaje: 'Activaste variantes pero no agregaste ninguna fila. ¿Guardar igual?',
                textoBtn: 'Sí, guardar', colorBtn: '#DD6B20'
            });
            if (!ok) { btnGuardar.textContent = 'GUARDAR'; btnGuardar.disabled = false; return; }
        }

        if (producto.tieneVariantes && producto.variantes.length > 0) {
            // Stock del padre = suma de stocks de todas las variantes
            producto.stock  = producto.variantes.reduce((s, v) => s + (v.stock || 0), 0);
            // Precio del padre = primera variante (referencia para el catálogo)
            const v0 = producto.variantes[0];
            if (v0.precio) producto.precio = v0.precio;
            // Imagen del padre = primera variante que tenga imagen, o la del form
            const vConImg = producto.variantes.find(v => v.imagen);
            if (vConImg) producto.imagen = vConImg.imagen;
        }

        const id = document.getElementById('edit-id').value;

        if (id) {
            await db.collection("productos").doc(id).update(producto);
            mostrarNotificacionAdmin("Producto actualizado ✓");
        } else {
            const newId = Date.now().toString(); 
            await db.collection("productos").doc(newId).set({id: newId, ...producto});
            mostrarNotificacionAdmin("Producto creado ✓");
        }

        cerrarFormulario();
        cargarProductosAdmin();

    } catch (error) {
        console.error(error);
        alert("Error al guardar: " + error.message);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = "GUARDAR";
        if(msgProgreso) msgProgreso.style.display = 'none';
    }
});

// --- AL ABRIR PARA EDITAR ---
window.editarProducto = async function(id) {
   const doc = await db.collection("productos").doc(id).get();
    const p = doc.data();

    // Llenar formulario
    document.getElementById('edit-id').value = id;
    
    // AGREGAMOS ESTA LÍNEA:
    document.getElementById('p-codigo').value = p.codigo || ""; // Carga el código o vacío
    
    document.getElementById('p-imagen-url-actual').value = p.imagen; 
    document.getElementById('p-nombre').value = p.nombre;
    document.getElementById('p-marca').value = p.marca;
    document.getElementById('p-categoria').value = p.categoria;
    document.getElementById('p-precio').value = p.precio;
    document.getElementById('p-stock').value = p.stock || 0; // Cargamos el STOCK (o 0 si no tiene)
    document.getElementById('p-desc').value = p.descripcion || "";
    document.getElementById('p-oferta').checked = p.enOferta;
    document.getElementById('p-nuevo').checked = p.nuevo || false;
    document.getElementById('p-por-caja').checked = p.vendePorCaja || false;
    document.getElementById('p-unidades-caja').value = p.unidadesPorCaja || "";
    document.getElementById('p-precio-caja').value = p.precioCaja || "";
    
    // Disparamos manualmente el evento para que se muestre u oculte el bloque azul
    const eventoChange = new Event('change');
    document.getElementById('p-por-caja').dispatchEvent(eventoChange);

    // Mostrar preview de la imagen actual
    const preview = document.getElementById('preview-img');
    const previewContainer = document.getElementById('preview-img-container');
    if(p.imagen) {
        preview.src = p.imagen;
        previewContainer.style.display = 'block';
    } else {
        previewContainer.style.display = 'none';
    }

    // Limpiar el input de archivo (no se puede setear valor a un input file)
    document.getElementById('p-archivo-imagen').value = "";

    document.getElementById('modal-title').textContent = "Editar Producto";
    modal.style.display = 'flex';

    // Limpiar el input de URL manual
    if(document.getElementById('p-imagen-url-manual')) {
        document.getElementById('p-imagen-url-manual').value = ""; 
    }

    // ── Cargar variantes DESPUÉS de abrir el modal ──────────────────────────
    setTimeout(() => {
        const tieneVar = p.tieneVariantes || false;
        const chkVar   = document.getElementById('p-tiene-variantes');
        if (!chkVar) return;
        chkVar.checked = tieneVar;
        toggleVariantes(tieneVar);
        if (tieneVar) {
            // Cargar etiquetas de dimensión (nuevo sistema 2D)
            const l1 = document.getElementById('p-label-dim1');
            const l2 = document.getElementById('p-label-dim2');
            if (l1) l1.value = p.labelDim1 || (p.variantesLabel ? p.variantesLabel.split(' / ')[0] : '') || '';
            if (l2) l2.value = p.labelDim2 || (p.variantesLabel ? (p.variantesLabel.split(' / ')[1] || '') : '') || '';

            // Actualizar headers de columna
            const h1 = document.getElementById('col-header-dim1');
            const h2 = document.getElementById('col-header-dim2');
            if (h1 && l1) h1.textContent = l1.value || 'Valor DIM 1';
            if (h2 && l2) h2.textContent = l2.value || 'Valor DIM 2 (opcional)';

            // Cargar filas de variantes
            const lista = document.getElementById('variantes-lista');
            if (lista) {
                lista.innerHTML = '';
                (p.variantes || []).forEach(v => agregarFilaVariante(v));
            }
        }
    }, 200);

}

// 6. ELIMINAR
window.eliminarProducto = async function(id, nombre) {
    const ok = await confirmarAccion({
        icono: '🗑️', titulo: 'Eliminar producto',
        mensaje: `¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`,
        textoBtn: 'Sí, eliminar', colorBtn: '#E53E3E'
    });
    if (ok) {
        await db.collection("productos").doc(id).delete();
        mostrarNotificacionAdmin('Producto eliminado ✓');
    }
}

/* ==========================================================================
   📦 GESTIÓN DE PEDIDOS (VERSIÓN BLINDADA ANTI-ERRORES)
   ========================================================================== */

// --- 1. Cambiar de Pestaña Seguro (VERSIÓN BLINDADA) ---
window.mostrarSeccion = function(seccion) {
    // 1. Ocultar todas las secciones
    document.getElementById('seccion-productos').style.display = 'none';
    document.getElementById('seccion-pedidos').style.display = 'none';
    document.getElementById('seccion-reportes').style.display = 'none'; 
    
    // 2. Apagar el color azul de todos los botones
    document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
    
    // 3. Mostrar solo la sección que el usuario clickeó
    const seccionSeleccionada = document.getElementById('seccion-' + seccion);
    if (seccionSeleccionada) {
        seccionSeleccionada.style.display = 'block';
    }
    
    // 4. Iluminar de azul la pestaña correcta (Método anti-choques)
    document.querySelectorAll('.btn-tab').forEach(b => {
        const accionClic = b.getAttribute('onclick') || "";
        if (accionClic.includes(seccion)) {
            b.classList.add('active');
        }
    });

    // 5. 🔥 LA SOLUCIÓN AL BUG: Forzar la carga de la base de datos de esa sección
    if (seccion === 'pedidos') cargarPedidos();
    if (seccion === 'reportes') cargarReportes();
    if (seccion === 'productos') {
        if (typeof filtrarTabla === 'function') {
            filtrarTabla(); // Esto asegura que reaparezcan los botones masivos y se dibuje la tabla
        }
    }
}

// --- 2. Cargar Pedidos Anti-Crash (AHORA EN TIEMPO REAL) ---
function cargarPedidos() {
    const tabla = document.getElementById('pedidos-table-body');     
    if(!tabla) return;

    if(document.getElementById('seccion-pedidos').style.display !== 'none') {
        tabla.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Cargando pedidos...</td></tr>';
    }

    // Usamos onSnapshot (Radar en vivo) — filtramos solo pedidos reales (excluye presupuestos)
    db.collection("pedidos").onSnapshot((snapshot) => {
        let pedidosArray = [];
        let contadorPendientes = 0;
        let _ingresos = 0;

        // Extraemos solo pedidos reales (tipo == "pedido" o sin campo tipo = legados)
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.tipo === 'presupuesto') return; // excluir presupuestos de esta tabla
            pedidosArray.push({ id: doc.id, ...data });
            if (data.estado === 'pendiente') contadorPendientes++;
            if (data.estado === 'completado') _ingresos += (parseFloat(data.total) || 0);
        });
        // Actualizar stats del tablero (fusionado — evita listener duplicado)
        const _spi = document.getElementById('stat-pendientes');
        const _sii = document.getElementById('stat-ingresos');
        if (_spi) _spi.textContent = contadorPendientes;
        if (_sii) _sii.textContent = '$' + parseInt(_ingresos).toLocaleString('es-AR');

        if (pedidosArray.length === 0) {
            tabla.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No hay pedidos aún.</td></tr>';
            actualizarBadge(0);
            return;
        }

        // Ordenamos localmente por fecha (Del más nuevo al más viejo)
        pedidosArray.sort((a, b) => {
            const dateA = a.fecha && a.fecha.seconds ? a.fecha.seconds : 0;
            const dateB = b.fecha && b.fecha.seconds ? b.fecha.seconds : 0;
            return dateB - dateA; 
        });

        let htmlFilas = ''; 

        // Dibujamos la tabla
        pedidosArray.forEach(pedido => {
            // 🔥 PROTECCIÓN EXTREMA DE FECHA 🔥
            let fechaTexto = "Fecha desconocida";
            if (pedido.fecha && pedido.fecha.seconds) {
                const d = new Date(pedido.fecha.seconds * 1000);
                fechaTexto = `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}`;
            }

            const claseEstado = pedido.estado === 'completado' ? 'completado' : (pedido.estado === 'cancelado' ? 'cancelado' : 'pendiente');

            htmlFilas += `
                <tr>
                    <td>${fechaTexto}</td>
                    <td style="font-weight:bold;">#${pedido.id.slice(0,6).toUpperCase()}</td>
                    <td>${pedido.cliente || pedido.nombreUsuario || "Invitado"}</td>
                    <td style="color:var(--primary-blue); font-weight:bold;">$${pedido.total ? parseInt(pedido.total).toLocaleString('es-AR') : '0'}</td>
                    <td>
                        <select onchange="cambiarEstadoPedido('${pedido.id}', this)" data-estado-anterior="${pedido.estado || 'pendiente'}" class="status-select ${claseEstado}">
                            <option value="pendiente" ${pedido.estado === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                            <option value="completado" ${pedido.estado === 'completado' ? 'selected' : ''}>✅ Completado</option>
                            <option value="cancelado" ${pedido.estado === 'cancelado' ? 'selected' : ''}>🚫 Cancelado</option>
                        </select>
                    </td>
                    <td style="display:flex; gap:5px;">

                        <button class="btn-icon" onclick="descargarExcelPedido('${pedido.id}')" title="Descargar Excel" style="color:#38A169;">
                            <span class="material-icons">description</span>
                        </button>
                        <button class="btn-icon" onclick="imprimirRemito('${pedido.id}')" title="Imprimir Comprobante PDF" style="color:#D69E2E; background: #FEFCBF;">
                            <span class="material-icons">print</span>
                        </button>
                        <button class="btn-icon" onclick="descargarRemitoPDF('${pedido.id}')" title="Descargar Comprobante PDF" style="color:#3182CE; background: #EBF8FF;">
                            <span class="material-icons">download</span>
                        </button>
                        <button class="btn-icon" onclick="verDetallePedido('${pedido.id}')" title="Ver / Editar en pantalla">
                            <span class="material-icons">visibility</span>
                        </button>
                        <button class="btn-icon delete" onclick="borrarPedido('${pedido.id}')" title="Eliminar">
                            <span class="material-icons">delete</span>
                        </button>
                    </td>
                </tr>
            `;
        });

        tabla.innerHTML = htmlFilas;
        actualizarBadge(contadorPendientes);

    }, (error) => {
        // Si hay un error real de red, ahora sí lo atrapará y lo mostrará en pantalla
        console.error("Error al cargar pedidos en vivo:", error);
        tabla.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #E53E3E; padding: 20px;">Hubo un error de conexión: ${error.message}</td></tr>`;
    });
}

// --- 2B. Tabs internos: Pedidos / Presupuestos ---
function switchPedidosTab(tab) {
    const btnPedidos       = document.getElementById('tab-pedidos-btn');
    const btnPresupuestos  = document.getElementById('tab-presupuestos-btn');
    const panelPedidos     = document.getElementById('panel-pedidos-reales');
    const panelPresupuestos = document.getElementById('panel-presupuestos');
    if (!btnPedidos) return;

    if (tab === 'pedidos') {
        panelPedidos.style.display      = 'block';
        panelPresupuestos.style.display = 'none';
        btnPedidos.style.color          = 'var(--primary-blue)';
        btnPedidos.style.borderBottomColor = 'var(--primary-blue)';
        btnPresupuestos.style.color     = '#718096';
        btnPresupuestos.style.borderBottomColor = 'transparent';
    } else {
        panelPedidos.style.display      = 'none';
        panelPresupuestos.style.display = 'block';
        btnPresupuestos.style.color     = 'var(--primary-blue)';
        btnPresupuestos.style.borderBottomColor = 'var(--primary-blue)';
        btnPedidos.style.color          = '#718096';
        btnPedidos.style.borderBottomColor = 'transparent';
        cargarPresupuestos();
    }
}

function cargarPresupuestos() {
    const tabla = document.getElementById('presupuestos-table-body');
    if (!tabla) return;
    tabla.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Cargando...</td></tr>';

    db.collection('pedidos').where('tipo', '==', 'presupuesto')
        .orderBy('fecha', 'desc')
        .onSnapshot((snapshot) => {
            const badge = document.getElementById('badge-presupuestos');
            let nuevos = 0;

            if (snapshot.empty) {
                tabla.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #718096;">No hay presupuestos todavía.</td></tr>';
                if (badge) badge.style.display = 'none';
                return;
            }

            let html = '';
            snapshot.forEach(doc => {
                const p = doc.data();
                if (p.estado === 'nuevo') nuevos++;

                let fechaTexto = '—';
                if (p.fecha && p.fecha.seconds) {
                    const d = new Date(p.fecha.seconds * 1000);
                    fechaTexto = `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})}`;
                }

                const estadoColor = {
                    nuevo:      '#744210|#FEFCBF',
                    respondido: '#22543D|#C6F6D5',
                    cerrado:    '#4A5568|#E2E8F0'
                }[p.estado] || '#4A5568|#E2E8F0';
                const [textColor, bgColor] = estadoColor.split('|');

                const productos = (p.items || []).slice(0, 3).map(i => `${i.cantidad}x ${i.nombre}`).join(', ');
                const masProductos = (p.items || []).length > 3 ? ` +${(p.items||[]).length - 3} más` : '';

                const tel = (p.datosContacto?.telefono || '').replace(/\D/g, '');
                const telWA = tel.startsWith('54') ? tel : '54' + tel;
                const msgWA = encodeURIComponent(
                    `Hola ${p.datosContacto?.nombre || p.cliente}! Te respondo tu presupuesto #${doc.id.slice(0,6).toUpperCase()} 📋\n\n`
                );

                html += `
                    <tr>
                        <td>${fechaTexto}</td>
                        <td style="font-weight:bold; color: #D69E2E;">#${doc.id.slice(0,6).toUpperCase()} <span style="font-size:0.7rem; background:#FEFCBF; color:#744210; padding:1px 5px; border-radius:4px; font-weight:800;">PRESUPUESTO</span></td>
                        <td>
                            <strong>${p.datosContacto?.nombre || p.cliente || '—'}</strong><br>
                            <span style="font-size:0.8rem; color:#718096;">🏪 ${p.datosContacto?.negocio || '—'}</span><br>
                            <span style="font-size:0.8rem; color:#718096;">📞 ${p.datosContacto?.telefono || '—'}</span>
                        </td>
                        <td style="font-size:0.85rem; color:#4A5568; max-width:220px;">${productos}${masProductos}</td>
                        <td>
                            <select onchange="cambiarEstadoPresupuesto('${doc.id}', this)"
                                style="padding:6px 10px; border-radius:6px; border:1px solid #E2E8F0; background:${bgColor}; color:${textColor}; font-weight:700; font-size:0.82rem; cursor:pointer;">
                                <option value="nuevo"      ${p.estado==='nuevo'      ? 'selected':''}>🔔 Nuevo</option>
                                <option value="respondido" ${p.estado==='respondido' ? 'selected':''}>💬 Respondido</option>
                                <option value="cerrado"    ${p.estado==='cerrado'    ? 'selected':''}>✅ Cerrado</option>
                            </select>
                        </td>
                        <td style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
                            <a href="https://wa.me/${telWA}?text=${msgWA}" target="_blank"
                               style="display:inline-flex; align-items:center; gap:4px; background:#25D366; color:white; padding:6px 10px; border-radius:6px; font-size:0.82rem; font-weight:700; text-decoration:none;">
                                <span class="material-icons" style="font-size:1rem;">chat</span> Responder
                            </a>
                            <button class="btn-icon" onclick="descargarExcelPresupuesto('${doc.id}')" title="Descargar cotización Excel" style="color:#38A169;">
                                <span class="material-icons">description</span>
                            </button>
                            <button class="btn-icon delete" onclick="borrarPedido('${doc.id}')" title="Eliminar presupuesto">
                                <span class="material-icons">delete</span>
                            </button>
                        </td>
                    </tr>`;
            });

            tabla.innerHTML = html;
            if (badge) {
                badge.textContent  = nuevos;
                badge.style.display = nuevos > 0 ? 'inline-block' : 'none';
            }
        }, (err) => {
            tabla.innerHTML = `<tr><td colspan="6" style="color:#E53E3E; text-align:center; padding:20px;">Error: ${err.message}</td></tr>`;
        });
}

window.cambiarEstadoPresupuesto = async function(id, select) {
    const nuevoEstado = select.value;
    try {
        await db.collection('pedidos').doc(id).update({ estado: nuevoEstado });
    } catch (err) {
        alert('Error al actualizar estado: ' + err.message);
        console.error(err);
    }
};

// --- 3. Funciones de Control de Pedidos ---
function actualizarBadge(cantidad) {
    const badge = document.getElementById('badge-pedidos');
    if (badge) {
        badge.textContent = cantidad;
        badge.style.display = cantidad > 0 ? 'inline-block' : 'none';
    }
}

window.cambiarEstadoPedido = async function(id, selectElement) {
    const nuevoEstado = selectElement.value;
    const estadoAnterior = selectElement.getAttribute('data-estado-anterior');
    
    if (nuevoEstado === estadoAnterior) return;

    // BARRERA 1: PREGUNTAR AL CANCELAR
    if (nuevoEstado === 'cancelado') {
        const ok = await confirmarAccion({
            icono: '🚫', titulo: 'Cancelar pedido',
            mensaje: 'Se devolverán todas las unidades al stock del catálogo automáticamente.',
            textoBtn: 'Sí, cancelar', colorBtn: '#E53E3E'
        });
        if (!ok) { selectElement.value = estadoAnterior; return; }
    }

    // BARRERA 2: PREGUNTAR AL DES-CANCELAR (Reactivar)
    if (estadoAnterior === 'cancelado' && (nuevoEstado === 'pendiente' || nuevoEstado === 'completado')) {
        const ok = await confirmarAccion({
            icono: '♻️', titulo: 'Reactivar pedido cancelado',
            mensaje: 'Las unidades serán descontadas del stock nuevamente. ¿Continuar?',
            textoBtn: 'Sí, reactivar', colorBtn: '#DD6B20'
        });
        if (!ok) { selectElement.value = estadoAnterior; return; }
    }

    try {
        selectElement.className = `status-select ${nuevoEstado}`;
        
        const batch = db.batch();
        const refPedido = db.collection("pedidos").doc(id);
        batch.update(refPedido, { estado: nuevoEstado });

        // LÓGICA MAGISTRAL DE STOCK (Devolver o Quitar)
        const docPedido = await refPedido.get();
        const dataPedido = docPedido.data();
        const items = dataPedido.items || [];

        const productosProcesados = {}; 

        // Sumamos cajas y unidades sueltas
        items.forEach(item => {
            const idReal = String(item.id).replace('_CAJA', '');
            const mult = String(item.id).includes('_CAJA') ? (parseInt(item.unidadesPorCaja) || 1) : 1;
            const totalUnidades = item.cantidad * mult;

            if (!productosProcesados[idReal]) productosProcesados[idReal] = 0;
            productosProcesados[idReal] += totalUnidades;
        });

        // Ejecutamos la matemática contra Firebase
        for (const idReal in productosProcesados) {
            const refProducto = db.collection("productos").doc(idReal);
            
            if (nuevoEstado === 'cancelado') {
                // DEVUELVE AL STOCK (+)
                batch.update(refProducto, { stock: firebase.firestore.FieldValue.increment(productosProcesados[idReal]) });
            } else if (estadoAnterior === 'cancelado') {
                // QUITA DEL STOCK OTRA VEZ (-)
                batch.update(refProducto, { stock: firebase.firestore.FieldValue.increment(-productosProcesados[idReal]) });
            }
        }

        await batch.commit(); // Disparo simultáneo y seguro
        selectElement.setAttribute('data-estado-anterior', nuevoEstado);

    } catch (error) {
        console.error("Error actualizando estado:", error);
        alert("Fallo de conexión. El estado y el stock no se modificaron.");
        selectElement.value = estadoAnterior;
    }
}

window.borrarPedido = async function(id) {
    const ok = await confirmarAccion({
        icono: '🗑️', titulo: 'Eliminar del historial',
        mensaje: 'Este pedido será eliminado definitivamente del sistema.',
        textoBtn: 'Sí, eliminar', colorBtn: '#E53E3E'
    });
    if (ok) {
        try {
            await db.collection("pedidos").doc(id).delete();
            mostrarNotificacionAdmin('Pedido eliminado ✓');
        } catch (e) {
            console.error(e);
            mostrarNotificacionAdmin('Error al eliminar — revisar conexión');
        }
    }
}

// --- FUNCIÓN DEL OJO: VER DETALLE DEL PEDIDO EN PANTALLA ---
// Función para cerrar el modal
window.cerrarModalPedido = function() {
    const modal = document.getElementById('pedido-modal');
    if (modal) modal.style.display = 'none';
}

window.descargarExcelPedido = async function(idPedido) {
    try {
        const doc = await db.collection("pedidos").doc(idPedido).get();
        const data = doc.data();
        const items = data.items || [];

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "CÓDIGO EAN;Producto;Marca;Cantidad;Precio Unitario;Subtotal\n";

        items.forEach(item => {
            const nombreLimpio = item.nombre ? item.nombre.replace(/;/g, " ").replace(/,/g, " ") : "Sin nombre";
            const subtotal = item.precio * item.cantidad;
            const codigoReal = item.codigo ? item.codigo : item.id;

            const fila = [
                codigoReal,
                nombreLimpio,
                item.marca || "",
                item.cantidad,
                item.precio,
                subtotal
            ].join(";");
            csvContent += fila + "\n";
        });

        csvContent += `;;;TOTAL;;${data.total || data.totalEstimado || 0}`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Pedido_Enzo_${idPedido.slice(0,6)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error(error);
        alert("Error al generar Excel");
    }
}
/* ==========================================================================
   DESCARGA EXCEL DE PRESUPUESTO — XLSX con formato profesional
   ========================================================================== */
window.descargarExcelPresupuesto = async function(idPresupuesto) {
    const btn = event.currentTarget;
    const iconoOriginal = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons" style="animation:spin 1s linear infinite;">autorenew</span>';
    btn.disabled = true;

    try {
        // 1. Obtener presupuesto
        const doc   = await db.collection('pedidos').doc(idPresupuesto).get();
        const data  = doc.data();
        const items = data.items || [];
        const cli   = data.datosContacto || {};
        const fecha = data.fecha && data.fecha.seconds
            ? new Date(data.fecha.seconds * 1000).toLocaleDateString('es-AR')
            : new Date().toLocaleDateString('es-AR');

        // 2. Buscar precios actuales en colección "productos"
        const itemsConPrecios = await Promise.all(items.map(async (item) => {
            try {
                const idReal  = String(item.id).replace('_CAJA','');
                const prodDoc = await db.collection('productos').doc(idReal).get();
                if (prodDoc.exists) {
                    const p = prodDoc.data();
                    return { ...item, precioActual: p.precio || 0, codigo: p.codigo || idReal, stock: p.stock || 0 };
                }
            } catch {}
            return { ...item, precioActual: 0, codigo: item.id, stock: 0 };
        }));

        const total = itemsConPrecios.reduce((a, i) => a + i.precioActual * i.cantidad, 0);

        // ── Estilos reutilizables ──────────────────────────────────────────
        const AZUL_BG   = { fgColor: { rgb: '1A365D' } };
        const VERDE_BG  = { fgColor: { rgb: '22543D' } };
        const GRIS_BG   = { fgColor: { rgb: 'EDF2F7' } };
        const TOTAL_BG  = { fgColor: { rgb: 'C6F6D5' } };
        const BLANCO    = { fgColor: { rgb: 'FFFFFF' } };

        const fBold     = { bold: true };
        const fWhite    = { bold: true, color: { rgb: 'FFFFFF' } };
        const fDark     = { bold: true, color: { rgb: '1A365D' } };
        const fGris     = { color: { rgb: '718096' } };
        const fVerde    = { bold: true, color: { rgb: '22543D' } };

        const aCenter   = { horizontal: 'center', vertical: 'center' };
        const aLeft     = { horizontal: 'left',   vertical: 'center' };
        const aRight    = { horizontal: 'right',  vertical: 'center' };

        const borderThin = {
            top:    { style: 'thin', color: { rgb: 'CBD5E0' } },
            bottom: { style: 'thin', color: { rgb: 'CBD5E0' } },
            left:   { style: 'thin', color: { rgb: 'CBD5E0' } },
            right:  { style: 'thin', color: { rgb: 'CBD5E0' } }
        };
        const borderMedium = {
            top:    { style: 'medium', color: { rgb: '2D3748' } },
            bottom: { style: 'medium', color: { rgb: '2D3748' } },
            left:   { style: 'medium', color: { rgb: '2D3748' } },
            right:  { style: 'medium', color: { rgb: '2D3748' } }
        };

        const cell = (v, font, fill, alignment, border, fmt) => ({
            v, t: typeof v === 'number' ? 'n' : 's',
            s: {
                font:      font      || {},
                fill:      fill      ? { patternType: 'solid', ...fill } : { patternType: 'none' },
                alignment: alignment || aLeft,
                border:    border    || {},
                numFmt:    fmt       || ''
            }
        });

        const empty = () => cell('');

        // ── Construir filas ───────────────────────────────────────────────
        const rows = [];

        // Fila 1: Título principal (azul oscuro)
        rows.push([
            cell('DISTRIBUCIONES ENZO — COTIZACIÓN DE PRECIOS', fWhite, AZUL_BG, aCenter, borderMedium),
            cell('', fWhite, AZUL_BG, aCenter, borderMedium),
            cell('', fWhite, AZUL_BG, aCenter, borderMedium),
            cell('', fWhite, AZUL_BG, aCenter, borderMedium),
            cell('', fWhite, AZUL_BG, aCenter, borderMedium),
            cell('', fWhite, AZUL_BG, aCenter, borderMedium),
        ]);

        // Fila 2: N° y fecha
        rows.push([
            cell(`N° Consulta: #${idPresupuesto.slice(0,6).toUpperCase()}`, fDark, GRIS_BG, aLeft, borderThin),
            cell('', null, GRIS_BG, aLeft, borderThin),
            cell('', null, GRIS_BG, aLeft, borderThin),
            cell(`Fecha: ${fecha}`, fDark, GRIS_BG, aRight, borderThin),
            cell('', null, GRIS_BG, aRight, borderThin),
            cell('', null, GRIS_BG, aRight, borderThin),
        ]);

        rows.push([ empty(), empty(), empty(), empty(), empty(), empty() ]);

        // Fila 4: Título datos del cliente
        rows.push([
            cell('DATOS DEL CLIENTE', fWhite, AZUL_BG, aLeft, borderThin),
            cell('', null, AZUL_BG, aLeft, borderThin),
            cell('', null, AZUL_BG, aLeft, borderThin),
            cell('', null, AZUL_BG, aLeft, borderThin),
            cell('', null, AZUL_BG, aLeft, borderThin),
            cell('', null, AZUL_BG, aLeft, borderThin),
        ]);

        // Datos del cliente
        const clienteData = [
            ['Nombre',   cli.nombre   || data.cliente || '—'],
            ['Negocio',  cli.negocio  || '—'],
            ['Teléfono', cli.telefono || '—'],
        ];
        clienteData.forEach(([lbl, val]) => {
            rows.push([
                cell(lbl, fBold, GRIS_BG, aLeft, borderThin),
                cell(val, null, null, aLeft, borderThin),
                empty(), empty(), empty(), empty()
            ]);
        });

        rows.push([ empty(), empty(), empty(), empty(), empty(), empty() ]);

        // Encabezado tabla productos
        const colHeaders = ['CÓDIGO', 'PRODUCTO', 'MARCA', 'CANT.', 'PRECIO UNIT.', 'SUBTOTAL'];
        rows.push(colHeaders.map(h =>
            cell(h, fWhite, VERDE_BG, aCenter, borderMedium)
        ));

        // Filas de productos (alternando fondo)
        itemsConPrecios.forEach((item, idx) => {
            const bg      = idx % 2 === 0 ? null : { fgColor: { rgb: 'F7FAFC' } };
            const subtotal = item.precioActual * item.cantidad;
            rows.push([
                cell(item.codigo || '',                      null,  bg, aCenter, borderThin),
                cell((item.nombre || '').slice(0,60),        null,  bg, aLeft,   borderThin),
                cell(item.marca  || '',                      fGris, bg, aCenter, borderThin),
                cell(item.cantidad,                          null,  bg, aCenter, borderThin, '0'),
                cell(item.precioActual,                      null,  bg, aRight,  borderThin, '"$"#,##0'),
                cell(subtotal,                               null,  bg, aRight,  borderThin, '"$"#,##0'),
            ]);
        });

        // Fila total
        rows.push([
            cell('', null, TOTAL_BG, aLeft, borderMedium),
            cell('', null, TOTAL_BG, aLeft, borderMedium),
            cell('', null, TOTAL_BG, aLeft, borderMedium),
            cell('', null, TOTAL_BG, aLeft, borderMedium),
            cell('TOTAL COTIZACIÓN', fVerde, TOTAL_BG, aRight, borderMedium),
            cell(total,              fVerde, TOTAL_BG, aRight, borderMedium, '"$"#,##0'),
        ]);

        rows.push([ empty(), empty(), empty(), empty(), empty(), empty() ]);

        // Notas al pie
        const notas = [
            '* Precios expresados en pesos argentinos (ARS). Válidos al momento de la cotización.',
            '* Sujetos a disponibilidad de stock. Consultá por descuentos abonando en efectivo.',
            '* Para confirmar tu pedido respondé este presupuesto por WhatsApp.'
        ];
        notas.forEach(nota => {
            rows.push([
                cell(nota, fGris, null, aLeft, {}),
                empty(), empty(), empty(), empty(), empty()
            ]);
        });

        // ── Crear workbook ────────────────────────────────────────────────
        const XLSXs = window.XLSXStyle || window.XLSX;

        // Si la librería no cargó, caer a CSV como respaldo
        if (!XLSXs || !XLSXs.utils) {
            console.warn('xlsx-js-style no disponible, generando CSV de respaldo...');
            let csv = '﻿';
            csv += `COTIZACIÓN #${idPresupuesto.slice(0,6).toUpperCase()} — DISTRIBUCIONES ENZO
`;
            csv += `Fecha;${fecha}
`;
            csv += `Cliente;${cli.nombre || ''}
Negocio;${cli.negocio || ''}
Teléfono;${cli.telefono || ''}

`;
            csv += `CÓDIGO;PRODUCTO;MARCA;CANTIDAD;PRECIO UNIT.;SUBTOTAL
`;
            itemsConPrecios.forEach(i => {
                csv += `${i.codigo};${(i.nombre||'').replace(/;/g,' ')};${i.marca||''};${i.cantidad};${i.precioActual};${i.precioActual*i.cantidad}
`;
            });
            csv += `;;;;TOTAL;${total}
`;
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = `Cotizacion_Enzo_${idPresupuesto.slice(0,6).toUpperCase()}.csv`;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a); URL.revokeObjectURL(url);
            return;
        }

        const wb = XLSXs.utils.book_new();
        const ws = XLSXs.utils.aoa_to_sheet(rows);

        // Anchos de columna
        ws['!cols'] = [
            { wch: 14 },  // Código
            { wch: 40 },  // Producto
            { wch: 14 },  // Marca
            { wch: 8  },  // Cant.
            { wch: 16 },  // Precio Unit.
            { wch: 16 },  // Subtotal
        ];

        // Altura de filas clave
        ws['!rows'] = [{ hpt: 28 }]; // Fila 1 (título) más alta

        // Merge: título en fila 1 ocupa todas las columnas
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },   // Título principal
            { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },   // N° consulta
            { s: { r: 1, c: 3 }, e: { r: 1, c: 5 } },   // Fecha
            { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } },   // "DATOS DEL CLIENTE"
            // Notas al pie
            { s: { r: rows.length - 3, c: 0 }, e: { r: rows.length - 3, c: 5 } },
            { s: { r: rows.length - 2, c: 0 }, e: { r: rows.length - 2, c: 5 } },
            { s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 5 } },
        ];
        // Merge celdas de datos de cliente (col 1 a 5)
        clienteData.forEach((_, i) => {
            const r = 4 + i;
            ws['!merges'].push({ s: { r, c: 1 }, e: { r, c: 5 } });
        });

        const nombreArchivo = `Cotizacion_Enzo_${idPresupuesto.slice(0,6).toUpperCase()}_${(cli.negocio || 'cliente').replace(/\s+/g,'_').slice(0,20)}.xlsx`;
        XLSXs.utils.book_append_sheet(wb, ws, 'Cotización');
        XLSXs.writeFile(wb, nombreArchivo);

    } catch (error) {
        console.error('Error generando cotización:', error);
        alert('Error al generar la cotización: ' + error.message);
    } finally {
        btn.innerHTML = iconoOriginal;
        btn.disabled  = false;
    }
};


/* ==========================================================================
   🚀 CEREBRO DEL BOTÓN MÁGICO: IMPORTACIÓN MASIVA (UPSERT Y VALIDACIÓN)
   ========================================================================== */
document.getElementById('csv-file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // 🔥 DICCIONARIO OFICIAL DE CATEGORÍAS (Escudo anti-errores de tipeo)
    const categoriasOficiales = [
        "electricas", "manuales", "inalambricas", "jardineria", "medicion",
        "interior/latex", "exterior/imper", "esmaltes sinteticos", "rodillos",
        "caños y tubos", "griferia", "bombas de agua", "accesorios",
        "cables", "iluminacion", "tomas e interruptores", "protecciones", "cintas",
        "tornillos", "tuercas y arandelas", "tarugos y fijaciones", "clavos",
        "utencilios de cocina", "organizadores y almacenaje", "productos de limpieza", "decoracion de hogar"
    ];

    // 1. Despertamos la barra de progreso
    const progressContainer = document.getElementById('csv-progress-container');
    const progressText = document.getElementById('csv-progress-text');
    const progressIcon = document.getElementById('csv-progress-icon');
    
    progressContainer.style.display = 'flex';
    progressText.innerHTML = 'Leyendo archivo CSV... <span style="font-size:0.8rem; color:#718096;">(Esto puede tardar unos segundos)</span>';
    progressIcon.textContent = 'hourglass_empty';
    progressIcon.style.color = '#3182CE'; 

    // 2. PapaParse lee el archivo
    Papa.parse(file, {
        header: true, 
        skipEmptyLines: true,
        complete: async function(results) {
            const data = results.data;
            progressText.textContent = `Analizando ${data.length} filas. Cruzando datos con tu Tienda...`;
            progressIcon.textContent = 'sync';

            try {
                // 3. Descargamos el mapa actual de la base de datos
                const snapshot = await db.collection('productos').get();
                const mapaProductos = {};
                snapshot.forEach(doc => {
                    const prod = doc.data();
                    if(prod.codigo) {
                        mapaProductos[prod.codigo.toString().trim().toUpperCase()] = doc.id;
                    }
                });

                let batch = db.batch();
                let count = 0;
                let creados = 0;
                let actualizados = 0;
                let ignorados = 0;
                let advertenciasCat = 0; // ⚠️ NUEVO: Contador de errores de tipeo

/* ==========================================================================
   INSTRUCCIÓN DE INSTALACIÓN — admin.js
   ==========================================================================
   
   BUSCA esta línea en admin.js (aprox. línea 1359):
   
       // 5. EVALUACIÓN FILA POR FILA (BLINDADA)
       for (let fila of data) {
   
   Seleccioná TODO el bloque desde esa línea hasta (e incluyendo):
   
       if (count > 0) {
           await batch.commit();
       }
   
   Y REEMPLAZÁ todo ese bloque con el código de abajo.
   
   ========================================================================== */


                // ── Helpers internos ────────────────────────────────────────────────────────
                const normCat = (cat) => {
                    const c = (cat || '').toString().trim().toLowerCase();
                    if (!categoriasOficiales.includes(c)) { advertenciasCat++; return 'sin categoria'; }
                    return c;
                };
                const limpiarPrecio = (v) => {
                    const s = (v || '0').toString().replace('$','').replace(/\./g,'').replace(',','.').trim();
                    return parseFloat(s) || 0;
                };
                const ordenarVars = arr => [...arr].sort((a, b) => {
                    const nA = parseFloat(String(a).replace(',','.')), nB = parseFloat(String(b).replace(',','.'));
                    if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
                    return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' });
                });

                // ── Paso A: Separar filas con GRUPO_ID de las simples ───────────────────────
                const filasSinGrupo = [];
                const mapaGrupos = {}; // grupoId → [filas]

                for (let fila of data) {
                    const codCSV    = (fila['CODIGO'] || fila['Codigo'] || fila['CÓDIGO'] || fila['Código'] || '').toString().trim();
                    const nombreCSV = (fila['NOMBRE'] || fila['Nombre'] || fila['nombre'] || '').toString().trim();
                    const precioCSV = fila['PRECIO'] || fila['Precio'] || fila['precio'] || '';
                    if (!codCSV || !nombreCSV || !precioCSV) { ignorados++; continue; }

                    const grupoId = (fila['GRUPO_ID'] || fila['Grupo_Id'] || fila['grupo_id'] || '').toString().trim().toUpperCase();
                    if (grupoId) {
                        if (!mapaGrupos[grupoId]) mapaGrupos[grupoId] = [];
                        mapaGrupos[grupoId].push(fila);
                    } else {
                        filasSinGrupo.push(fila);
                    }
                }

                // ── Paso B: Procesar filas SIN GRUPO (comportamiento anterior exacto) ────────
                for (let fila of filasSinGrupo) {
                    const codCSV         = (fila['CODIGO'] || fila['Codigo'] || fila['CÓDIGO'] || fila['Código'] || '').toString().trim();
                    const nombreCSV      = (fila['NOMBRE'] || fila['Nombre'] || fila['nombre'] || '').toString().trim();
                    const codLimpio      = codCSV.toUpperCase();
                    const precioUnitario = limpiarPrecio(fila['PRECIO'] || fila['Precio'] || fila['precio'] || '0');
                    if (isNaN(precioUnitario) || precioUnitario <= 0) { ignorados++; continue; }

                    let precioCaja       = limpiarPrecio(fila['PRECIO_CAJA'] || fila['Precio_Caja'] || '0');
                    if (precioCaja < 0) precioCaja = 0;
                    let stockReal        = Math.abs(parseInt(fila['STOCK'] || fila['Stock']) || 0);
                    let unidadesCajaReal = Math.abs(parseInt(fila['UNIDADES_CAJA'] || fila['Unidades_Caja']) || 0);

                    const vendePorCaja = (fila['VENDE_POR_CAJA'] || '').toString().trim().toUpperCase() === 'SI';
                    const esOferta     = (fila['OFERTA'] || '').toString().trim().toUpperCase() === 'SI';
                    const esNuevo      = (fila['NUEVO']  || '').toString().trim().toUpperCase() === 'SI';

                    const productoLimpio = {
                        codigo:          codCSV,
                        nombre:          nombreCSV,
                        marca:           (fila['MARCA'] || fila['Marca'] || '').toString().trim(),
                        categoria:       normCat(fila['CATEGORIA'] || fila['Categoria'] || ''),
                        precio:          precioUnitario,
                        stock:           stockReal,
                        vendePorCaja,
                        unidadesPorCaja: vendePorCaja ? unidadesCajaReal : 0,
                        precioCaja:      vendePorCaja ? precioCaja : 0,
                        enOferta:        esOferta,
                        nuevo:           esNuevo,
                        imagen:          (fila['IMAGEN_URL'] || fila['Imagen_url'] || '').toString().trim() || null,
                        descripcion:     (fila['DESCRIPCION'] || fila['Descripcion'] || '').toString().trim(),
                        fechaActualizacion: new Date()
                    };
                    if (!productoLimpio.imagen) delete productoLimpio.imagen;

                    if (mapaProductos[codLimpio]) {
                        batch.update(db.collection('productos').doc(mapaProductos[codLimpio]), productoLimpio);
                        actualizados++;
                    } else {
                        const newId = Date.now().toString() + Math.floor(Math.random() * 1000);
                        productoLimpio.id = newId;
                        if (!productoLimpio.imagen) productoLimpio.imagen = 'https://placehold.co/300x300/EEE/3182CE?text=Sin+Imagen';
                        batch.set(db.collection('productos').doc(newId), productoLimpio);
                        creados++;
                    }
                    count++;
                    if (count >= 490) { await batch.commit(); batch = db.batch(); count = 0; }
                }

                // ── Paso C: Procesar GRUPOS → 1 documento padre con variantes[] embebidas ───
                for (const [grupoId, filas] of Object.entries(mapaGrupos)) {
                    const p1 = filas[0];

                    // Nombre del padre: GRUPO_ID con guiones reemplazados por espacios
                    // Ejemplo: "TANZA-GRILON" → "TANZA GRILON"
                    const nombreBase  = grupoId.replace(/-/g, ' ');
                    const marcaBase   = (p1['MARCA']       || '').toString().trim();
                    const catBase     = normCat(p1['CATEGORIA'] || p1['Categoria'] || '');
                    const descripBase = (p1['DESCRIPCION'] || p1['Descripcion'] || '').toString().trim();
                    const imagenBase  = (p1['IMAGEN_URL']  || p1['Imagen_url']  || '').toString().trim() || null;
                    const esOfertaBase = (p1['OFERTA'] || '').toString().trim().toUpperCase() === 'SI';
                    const esNuevoBase  = (p1['NUEVO']  || '').toString().trim().toUpperCase() === 'SI';
                    // Etiquetas opcionales (columnas VAR_LABEL1 / VAR_LABEL2 en el CSV — si no existen usa los valores por defecto)
                    const labelDim1   = (p1['VAR_LABEL1'] || '').toString().trim() || 'Presentación';
                    const labelDim2   = (p1['VAR_LABEL2'] || '').toString().trim() || 'Medida';

                    // ¿Alguna fila tiene segunda dimensión?
                    const tiene2Dims = filas.some(f => (f['VAR_DIM2'] || '').toString().trim() !== '');

                    // Valores únicos de DIM1 y DIM2 ordenados numérica/alfabéticamente
                    const dim1Vals = ordenarVars([...new Set(filas.map(f => (f['VAR_DIM1'] || '').toString().trim()).filter(Boolean))]);
                    const dim2Vals = tiene2Dims
                        ? ordenarVars([...new Set(filas.map(f => (f['VAR_DIM2'] || '').toString().trim()).filter(Boolean))])
                        : [];

                    // Reordenar filas según la matriz dim1 × dim2 para que el array quede ordenado
                    const filasOrd = [];
                    if (tiene2Dims) {
                        for (const d1 of dim1Vals)
                            for (const d2 of dim2Vals) {
                                const f = filas.find(f =>
                                    (f['VAR_DIM1'] || '').toString().trim() === d1 &&
                                    (f['VAR_DIM2'] || '').toString().trim() === d2
                                );
                                if (f) filasOrd.push(f);
                            }
                        // Agregar filas que no entraron en la matriz (combinaciones faltantes)
                        filas.forEach(f => { if (!filasOrd.includes(f)) filasOrd.push(f); });
                    } else {
                        for (const d1 of dim1Vals) {
                            const f = filas.find(f => (f['VAR_DIM1'] || '').toString().trim() === d1);
                            if (f) filasOrd.push(f);
                        }
                        filas.forEach(f => { if (!filasOrd.includes(f)) filasOrd.push(f); });
                    }

                    // Construir el array de variantes
                    const variantes = [];
                    let precioBase  = null;
                    const idsViejos = []; // docIds de SKUs individuales viejos a eliminar

                    for (let fila of filasOrd) {
                        const codFila  = (fila['CODIGO'] || fila['Codigo'] || '').toString().trim();
                        const codUpper = codFila.toUpperCase();
                        const precioVar = limpiarPrecio(fila['PRECIO'] || fila['Precio'] || '0');
                        if (precioBase === null) precioBase = precioVar;

                        const dim1    = (fila['VAR_DIM1'] || '').toString().trim();
                        const dim2    = (fila['VAR_DIM2'] || '').toString().trim();
                        const stockV  = Math.abs(parseInt(fila['STOCK'] || fila['Stock'] || '0') || 0);
                        const imgV    = (fila['IMAGEN_URL'] || fila['Imagen_url'] || '').toString().trim() || null;

                        // Etiqueta del selector: "Redonda 2mm" o solo "Redonda" si no hay dim2
                        const etiqueta = [dim1, dim2].filter(Boolean).join(' ');

                        // Nombre completo que aparece en el carrito y en el remito
                        // Ejemplo: "TANZA GRILON - Redonda 2mm"
                        const nombreCompleto = etiqueta
                            ? `${nombreBase} - ${etiqueta}`
                            : `${nombreBase} (${codFila})`;

                        variantes.push({
                            id:       codFila || (grupoId + '_' + variantes.length),
                            codigo:   codFila,
                            etiqueta: etiqueta || codFila,
                            varDim1:  dim1 || null,
                            varDim2:  dim2 || null,
                            precio:   precioVar,
                            stock:    stockV,
                            imagen:   imgV,   // null si comparte la imagen del padre
                            nombre:   nombreCompleto
                        });

                        // Si este SKU existía como documento individual, lo marcamos para borrar
                        if (codUpper && mapaProductos[codUpper]) {
                            idsViejos.push(mapaProductos[codUpper]);
                        }
                    }

                    const stockTotal  = variantes.reduce((s, v) => s + v.stock, 0);
                    const imagenPadre = imagenBase
                        || variantes.find(v => v.imagen)?.imagen
                        || 'https://placehold.co/300x300/EEE/3182CE?text=Sin+Imagen';

                    // Eliminar docs individuales viejos (SKUs que ahora son variantes del padre)
                    for (const docId of [...new Set(idsViejos)]) {
                        batch.delete(db.collection('productos').doc(docId));
                        count++;
                        if (count >= 490) { await batch.commit(); batch = db.batch(); count = 0; }
                    }

                    const productoGrupo = {
                        codigo:          grupoId,           // el GRUPO_ID funciona como código del padre
                        nombre:          nombreBase,
                        marca:           marcaBase,
                        categoria:       catBase,
                        precio:          precioBase || 0,   // precio de la primera variante (referencia)
                        stock:           stockTotal,         // suma de stocks de todas las variantes
                        imagen:          imagenPadre,
                        descripcion:     descripBase,
                        enOferta:        esOfertaBase,
                        nuevo:           esNuevoBase,
                        vendePorCaja:    false,
                        unidadesPorCaja: 0,
                        precioCaja:      0,
                        tieneVariantes:  true,
                        variantesLabel:  labelDim1 + (tiene2Dims ? ' / ' + labelDim2 : ''),
                        tiene2Dims,
                        labelDim1,
                        labelDim2,
                        variantes,       // array con todos los hijos embebidos
                        fechaActualizacion: new Date()
                    };

                    // Upsert: si ya existe el padre (buscado por su código = GRUPO_ID), actualizar; sino crear
                    const docPadreId = mapaProductos[grupoId];
                    if (docPadreId) {
                        batch.update(db.collection('productos').doc(docPadreId), productoGrupo);
                        actualizados++;
                    } else {
                        const newId = Date.now().toString() + Math.floor(Math.random() * 1000);
                        productoGrupo.id = newId;
                        batch.set(db.collection('productos').doc(newId), productoGrupo);
                        creados++;
                    }
                    count++;
                    if (count >= 490) { await batch.commit(); batch = db.batch(); count = 0; }
                }

                if (count > 0) { await batch.commit(); }

                // 8. EL REPORTE FINAL INTELIGENTE
                progressIcon.textContent = 'check_circle';
                progressIcon.style.color = '#38A169';
                
                // Preparamos el mensaje de alerta si hubo errores de categoría
                let alertaCategoria = '';
                if (advertenciasCat > 0) {
                    alertaCategoria = `
                        <div style="margin-top: 10px; padding: 10px; background: #FFF5F5; border-left: 4px solid #E53E3E; border-radius: 4px; color: #C53030; font-size: 0.85rem;">
                            ⚠️ <strong>ATENCIÓN:</strong> ${advertenciasCat} producto(s) se guardaron como <strong>"Sin Categoría"</strong> porque la palabra en el Excel estaba vacía o no coincide con la lista oficial. Búscalos en rojo en la tabla para corregirlos.
                        </div>`;
                }

                progressText.innerHTML = `
                    <div style="display:flex; flex-direction:column; width: 100%;">
                        <strong style="color:#22543D; margin-bottom:5px;">¡Base de datos sincronizada!</strong>
                        <span style="font-size:0.85rem; color:#4A5568;">
                            ✨ Creados: <strong>${creados}</strong> | 🔄 Actualizados: <strong>${actualizados}</strong> | ❌ Ignorados (Falta de datos): <strong>${ignorados}</strong>
                        </span>
                        ${alertaCategoria}
                    </div>
                `;
                
                document.getElementById('csv-file-input').value = "";

            } catch (error) {
                console.error("Error en importación masiva:", error);
                progressText.innerHTML = '<strong>Error de red:</strong> No se pudo sincronizar. Intenta de nuevo.';
                progressIcon.textContent = 'error';
                progressIcon.style.color = '#E53E3E';
            }
        },
        error: function(error) {
            progressText.textContent = 'No se pudo leer el archivo. Asegúrate de que sea formato .CSV.';
            progressIcon.textContent = 'error';
            progressIcon.style.color = '#E53E3E';
        }
    });
});
// ==========================================================================
// 🧹 MOTOR DE ACCIONES MASIVAS (CHECKBOXES)
// ==========================================================================
window.productosSeleccionados = new Set(); // Memoria que guarda los IDs tildados

// 1. Cuando haces clic en un solo cuadrito
window.toggleSeleccion = function(checkbox) {
    if (checkbox.checked) {
        productosSeleccionados.add(checkbox.value);
    } else {
        productosSeleccionados.delete(checkbox.value);
        document.getElementById('selectAllCheckbox').checked = false; // Destilda el maestro
    }
    actualizarToolbarMasivo();
};

// 2. Cuando haces clic en el cuadrito maestro (Seleccionar Todos)
window.toggleSelectAll = function(checkboxMaestro) {
    const todosLosCheckboxes = document.querySelectorAll('.row-checkbox');
    todosLosCheckboxes.forEach(cb => {
        cb.checked = checkboxMaestro.checked;
        if (checkboxMaestro.checked) {
            productosSeleccionados.add(cb.value);
        } else {
            productosSeleccionados.delete(cb.value);
        }
    });
    actualizarToolbarMasivo();
};

// 3. Mostrar/Ocultar la barra azul de herramientas
window.actualizarToolbarMasivo = function() {
    const toolbar = document.getElementById('bulk-actions-toolbar');
    const spanCant = document.getElementById('cant-seleccionados');
    
    if (toolbar && spanCant) {
        if (productosSeleccionados.size > 0) {
            toolbar.style.display = 'flex';
            spanCant.textContent = productosSeleccionados.size;
        } else {
            toolbar.style.display = 'none';
        }
    }
};

// 4. 🔥 BORRADO MASIVO EN FIREBASE
window.borrarSeleccionadosMasivo = async function() {
    if (productosSeleccionados.size === 0) return;
    
    const ok = await confirmarAccion({
        icono: '🗑️', titulo: `Eliminar ${productosSeleccionados.size} productos`,
        mensaje: 'Esta acción es irreversible. Los productos serán eliminados permanentemente.',
        textoBtn: 'Sí, eliminar todo', colorBtn: '#E53E3E'
    });
    if (ok) {
        try {
            const batch = db.batch();
            productosSeleccionados.forEach(id => {
                const ref = db.collection("productos").doc(id);
                batch.delete(ref);
            });
            await batch.commit();
            productosSeleccionados.clear();
            actualizarToolbarMasivo();
            document.getElementById('selectAllCheckbox').checked = false;
            mostrarNotificacionAdmin(`${ok ? productosSeleccionados.size || 'Productos' : ''} eliminados ✓`);
        } catch (error) {
            console.error(error);
            mostrarNotificacionAdmin('Error de red al eliminar — intentá de nuevo');
        }
    }
};

// 5. 🏷️ ETIQUETAS MASIVAS (OFERTA / NUEVO) EN FIREBASE
window.cambiarEstadoMasivo = async function(campoBD, esActivo) {
    if (productosSeleccionados.size === 0) return;
    
    const accion = esActivo ? "AGREGAR" : "QUITAR";
    const etiqueta = campoBD === 'enOferta' ? "OFERTA 🔥" : "NUEVO INGRESO ⭐";

    const ok = await confirmarAccion({
        icono: esActivo ? '🏷️' : '✂️',
        titulo: `${accion} ${etiqueta}`,
        mensaje: `Se modificarán ${productosSeleccionados.size} productos seleccionados.`,
        textoBtn: `Sí, ${accion.toLowerCase()}`, colorBtn: esActivo ? '#DD6B20' : '#718096'
    });
    if (ok) {
        try {
            const batch = db.batch();
            productosSeleccionados.forEach(id => {
                const ref = db.collection("productos").doc(id);
                batch.update(ref, { [campoBD]: esActivo });
            });
            await batch.commit();
            productosSeleccionados.clear();
            actualizarToolbarMasivo();
            document.querySelectorAll('.row-checkbox, #selectAllCheckbox').forEach(cb => cb.checked = false);
            mostrarNotificacionAdmin(`${etiqueta} actualizado en ${productosSeleccionados.size || 'los'} productos ✓`);
        } catch (error) {
            console.error(error);
            mostrarNotificacionAdmin('Error de red — intentá de nuevo');
        }
    }
};

// ==========================================================================
// 💾 MOTOR DE RESPALDO — Excel completo con todos los productos reales
// ==========================================================================
window.exportarInventarioCSV = async function(btn) {
    const textoOriginal = btn.innerHTML;
    try {
        btn.innerHTML = '<span class="material-icons" style="animation:spin 1s linear infinite">autorenew</span> Generando Excel...';
        btn.disabled = true;

        // ── 1. Leer todos los productos de Firestore ────────────────────────
        const snapshot = await db.collection("productos").get();
        const productos = [];
        snapshot.forEach(doc => productos.push(doc.data()));

        // Ordenar por código
        productos.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));

        // ── 2. Detectar librería disponible ────────────────────────────────
        // XLSXStyle = xlsx-js-style (con colores) | XLSX = SheetJS estándar (sin colores)
        const XLSXs      = window.XLSXStyle || window.XLSX;
        const tieneEstilos = !!window.XLSXStyle;
        if (!XLSXs || !XLSXs.utils) {
            _descargarRespaldoCSV(productos);
            mostrarNotificacionAdmin('Respaldo CSV descargado — recargá la página e intentá de nuevo para Excel');
            return;
        }

        // ── 3. Helpers de estilo ────────────────────────────────────────────
        const NAV = '1A365D', BLU_L = 'EBF8FF', GRN = '22543D', GRN_L = 'C6F6D5';
        const ORG_L = 'FEFCBF', PRP_L = 'E9D8FD', TEL_L = 'B2F5EA', WHT = 'FFFFFF';
        const GRY_L = 'F7FAFC';

        const COL_COLORS = [
            BLU_L, BLU_L, BLU_L, BLU_L,
            GRN_L, GRN_L, GRN_L, GRN_L, GRN_L,
            ORG_L, ORG_L,
            PRP_L, PRP_L,
            TEL_L, TEL_L, TEL_L
        ];
        const COL_HEADERS_BG = [
            NAV, NAV, NAV, NAV,
            GRN, GRN, GRN, GRN, GRN,
            'DD6B20', 'DD6B20',
            '44337A', '44337A',
            '065666', '065666', '065666'
        ];

        // Si tiene estilos (xlsx-js-style) devuelve celda con formato
        // Si no (SheetJS estándar) devuelve solo el valor — igual genera Excel válido
        const cell = (v, bold, bgHex, textColor, fontSize) => {
            const base = { v: v ?? '', t: typeof v === 'number' ? 'n' : 's' };
            if (!tieneEstilos) return base;
            return {
                ...base,
                s: {
                    font: { bold: !!bold, color: { rgb: textColor || '2D3748' }, sz: fontSize || 9, name: 'Arial' },
                    fill: bgHex ? { patternType: 'solid', fgColor: { rgb: bgHex } } : { patternType: 'none' },
                    alignment: { vertical: 'center', wrapText: false },
                    border: {
                        top:    { style: 'thin', color: { rgb: 'CBD5E0' } },
                        bottom: { style: 'thin', color: { rgb: 'CBD5E0' } },
                        left:   { style: 'thin', color: { rgb: 'CBD5E0' } },
                        right:  { style: 'thin', color: { rgb: 'CBD5E0' } }
                    }
                }
            };
        };

        const COLS = [
            'CODIGO','NOMBRE','MARCA','CATEGORIA','PRECIO','STOCK',
            'VENDE_POR_CAJA','UNIDADES_CAJA','PRECIO_CAJA',
            'OFERTA','NUEVO','IMAGEN_URL','DESCRIPCION',
            'GRUPO_ID','VAR_DIM1','VAR_DIM2'
        ];
        const COL_WIDTHS = [16,35,18,22,12,10,14,15,14,10,10,45,40,22,16,16];

        const fecha = new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' });

        // ── 4. Función para construir filas de productos ────────────────────
        function buildProductRows(colorear) {
            return productos.map((p, i) => {
                const bg = colorear ? (i % 2 === 0 ? WHT : GRY_L) : (i % 2 === 0 ? WHT : GRY_L);
                const vals = [
                    p.codigo || 'S/C',
                    p.nombre || '',
                    p.marca  || '',
                    p.categoria || '',
                    p.precio || 0,
                    p.stock  !== undefined ? p.stock : 0,
                    p.vendePorCaja    ? 'SI' : 'NO',
                    p.unidadesPorCaja || 0,
                    p.precioCaja      || 0,
                    p.enOferta ? 'SI' : 'NO',
                    p.nuevo    ? 'SI' : 'NO',
                    (p.imagen && !p.imagen.includes('placehold') && !p.imagen.includes('placeholder') ? p.imagen : ''),
                    p.descripcion || '',
                    p.grupoId  || '',
                    p.varDim1  || '',
                    p.varDim2  || ''
                ];
                return vals.map((v, j) => {
                    const colBg = colorear ? COL_COLORS[j] : null;
                    const rowBg = i % 2 === 0 ? WHT : GRY_L;
                    const finalBg = colorear && v !== '' && v !== 0 ? colBg : rowBg;
                    return cell(v, j === 0, finalBg, j === 0 ? NAV : '4A5568');
                });
            });
        }

        // ── 5. HOJA 1: PRODUCTOS (formateada con colores por sección) ───────
        const titleRow = COLS.map((_, j) =>
            cell('', false, COL_HEADERS_BG[j], WHT, 9)
        );
        // Fila título del documento (primera celda contiene el texto, resto vacío mismo estilo)
        const titleRow0 = COLS.map((_, j) =>
            cell(j === 0 ? `DISTRIBUCIONES ENZO — Respaldo Completo al ${fecha}` : '', true, NAV, WHT, 12)
        );
        const headerRow = COLS.map((col, j) =>
            cell(col, true, COL_HEADERS_BG[j], WHT, 9)
        );

        const rowsProductos = [titleRow0, headerRow, ...buildProductRows(true)];
        const wsProductos = XLSXs.utils.aoa_to_sheet(rowsProductos);
        wsProductos['!cols'] = COL_WIDTHS.map(w => ({ wch: w }));
        wsProductos['!rows'] = [{ hpt: 22 }, { hpt: 20 }];
        wsProductos['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }]; // título ocupa toda la fila

        // ── 6. HOJA 2: CARGA (simple, lista para exportar como CSV) ─────────
        const headerRowCarga = COLS.map((col, j) =>
            cell(col, true, NAV, WHT, 10)
        );
        const rowsCarga = [headerRowCarga, ...buildProductRows(false)];
        const wsCarga = XLSXs.utils.aoa_to_sheet(rowsCarga);
        wsCarga['!cols'] = COL_WIDTHS.map(w => ({ wch: w }));
        wsCarga['!rows'] = [{ hpt: 24 }];

        // ── 7. HOJA 3: INSTRUCCIONES (texto informativo) ─────────────────────
        const instrData = [
            [cell('DISTRIBUCIONES ENZO — Instrucciones de uso', true, NAV, WHT, 12), ...Array(3).fill(cell('',false,NAV,WHT,12))],
            [cell('', false, null, null)],
            [cell('¿CÓMO USAR ESTE ARCHIVO?', true, '2B6CB0', WHT, 10), ...Array(3).fill(cell('',false,'2B6CB0',WHT,10))],
            [cell('Hoja PRODUCTOS', true, null, '1A365D'), cell('Referencia visual completa con colores. Para revisar y archivar.', false, null, '4A5568'), cell(''), cell('')],
            [cell('Hoja CARGA', true, null, '1A365D'), cell('Simple, sin formato pesado. Exportarla como CSV para importar al admin.', false, null, '4A5568'), cell(''), cell('')],
            [cell(''), cell(''), cell(''), cell('')],
            [cell('PASOS PARA IMPORTAR', true, '22543D', WHT, 10), ...Array(3).fill(cell('',false,'22543D',WHT,10))],
            [cell('Paso 1', true, null, '22543D'), cell('Ir a la hoja CARGA y hacer los cambios necesarios.', false, null, '4A5568'), cell(''), cell('')],
            [cell('Paso 2', true, null, '22543D'), cell('Archivo → Descargar → Valores separados por coma (.csv)', false, null, '4A5568'), cell(''), cell('')],
            [cell('Paso 3', true, null, '22543D'), cell('En el Admin → SUBIR CSV → seleccionar el archivo descargado.', false, null, '4A5568'), cell(''), cell('')],
            [cell(''), cell(''), cell(''), cell('')],
            [cell('TOTAL DE PRODUCTOS EN ESTE RESPALDO', true, null, NAV), cell(productos.length, true, null, '22543D'), cell(''), cell('')],
            [cell('FECHA DE GENERACIÓN', true, null, NAV), cell(fecha, false, null, '4A5568'), cell(''), cell('')],
        ];
        const wsInstr = XLSXs.utils.aoa_to_sheet(instrData);
        wsInstr['!cols'] = [{ wch: 30 }, { wch: 60 }, { wch: 10 }, { wch: 10 }];
        wsInstr['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
            { s: { r: 6, c: 0 }, e: { r: 6, c: 3 } },
        ];

        // ── 8. Armar y descargar el workbook ─────────────────────────────────
        const wb = XLSXs.utils.book_new();
        XLSXs.utils.book_append_sheet(wb, wsProductos, 'Productos');
        XLSXs.utils.book_append_sheet(wb, wsCarga,     'Carga');
        XLSXs.utils.book_append_sheet(wb, wsInstr,     'Instrucciones');

        const fechaArchivo = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
        XLSXs.writeFile(wb, `RespaldoEnzo_${fechaArchivo}.xlsx`);
        mostrarNotificacionAdmin(`Respaldo descargado — ${productos.length} productos${tieneEstilos ? ' (con colores)' : ''} ✓`);

    } catch(e) {
        console.error('Error generando respaldo Excel:', e);
        mostrarNotificacionAdmin('Error al generar el respaldo — revisá la consola');
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
};

// Fallback CSV para browsers que bloqueen la librería xlsx (ej: Edge con Tracking Prevention)
function _descargarRespaldoCSV(productos) {
    const SEP = ';';
    const esc = v => {
        const s = String(v ?? '').replace(/"/g, '""');
        return s.includes(SEP) || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
    };
    const cols = ['CODIGO','NOMBRE','MARCA','CATEGORIA','PRECIO','STOCK',
        'VENDE_POR_CAJA','UNIDADES_CAJA','PRECIO_CAJA','OFERTA','NUEVO',
        'IMAGEN_URL','DESCRIPCION','GRUPO_ID','VAR_DIM1','VAR_DIM2'];
    let csv = '\uFEFF' + cols.join(SEP) + '\n';
    productos.forEach(p => {
        csv += [p.codigo||'S/C', p.nombre||'', p.marca||'', p.categoria||'',
            p.precio||0, p.stock||0,
            p.vendePorCaja?'SI':'NO', p.unidadesPorCaja||0, p.precioCaja||0,
            p.enOferta?'SI':'NO', p.nuevo?'SI':'NO',
            p.imagen||'', p.descripcion||'', p.grupoId||'', p.varDim1||'', p.varDim2||''
        ].map(esc).join(SEP) + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `RespaldoEnzo_${new Date().toLocaleDateString('es-AR').replace(/\//g,'-')}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
}

// --- 📊 MOTOR DEL TABLERO DEL JEFE (ESTADÍSTICAS EN VIVO) ---
// Las stats ahora se calculan dentro de cargarProductosAdmin() y cargarPedidos()
// para evitar listeners duplicados a las mismas colecciones de Firestore.
window.iniciarTableroJefe = function() { /* stats fusionadas — ver cargarProductosAdmin y cargarPedidos */ }

// ==========================================================================
// 💡 SISTEMA DE BANDEJA DE ENTRADA (REPORTES)
// ==========================================================================
function cargarReportes() {
    const tabla = document.getElementById('reportes-table-body');
    const badge = document.getElementById('badge-reportes');
    if(!tabla) return;

    db.collection("reportes").onSnapshot(snapshot => {
        let reportesArray = [];
        let noLeidos = 0;

        if (snapshot.empty) {
            tabla.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: #718096;">El buzón está vacío. ¡No hay reportes nuevos! 🎉</td></tr>';
            if (badge) badge.style.display = 'none';
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            reportesArray.push({ id: doc.id, ...data });
            if (!data.leido) noLeidos++;
        });

        // Ordenar: Más nuevos arriba
        reportesArray.sort((a, b) => {
            const dateA = a.fecha && a.fecha.seconds ? a.fecha.seconds : 0;
            const dateB = b.fecha && b.fecha.seconds ? b.fecha.seconds : 0;
            return dateB - dateA;
        });

        let html = '';
        reportesArray.forEach(rep => {
            // Lógica de colores según el tipo
            let iconTipo = 'lightbulb';
            let colorTipo = '#D69E2E'; // Amarillo (Idea)
            if (rep.tipo === 'Fallo') { iconTipo = 'bug_report'; colorTipo = '#E53E3E'; } // Rojo
            if (rep.tipo === 'Reseña') { iconTipo = 'star'; colorTipo = '#3182CE'; } // Azul

            // Si es nuevo, el fondo de la fila es verdecito claro para llamar la atención
            const bgRow = rep.leido ? 'transparent' : '#F0FFF4'; 
            const textoLeido = rep.leido ? 'Marcar No Leído' : 'Marcar Leído';
            const iconLeido = rep.leido ? 'mark_email_unread' : 'mark_email_read';

            html += `
                <tr style="background-color: ${bgRow}; transition: 0.3s;">
                    <td style="white-space: nowrap; font-size: 0.85rem; color: #718096;">${rep.fechaString || '-'}</td>
                    <td>
                        <span style="background: ${colorTipo}15; color: ${colorTipo}; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; display: inline-flex; align-items: center; gap: 5px;">
                            <span class="material-icons" style="font-size: 1.1rem;">${iconTipo}</span> ${rep.tipo || 'Mensaje'}
                        </span>
                    </td>
                    <td style="font-weight: bold; color: var(--primary-dark);">${rep.remitente || 'Anónimo'}</td>
                    <td style="color: #4A5568; font-size: 0.95rem; line-height: 1.4;"><em>"${rep.mensaje || ''}"</em></td>
                    <td>
                        ${rep.leido 
                            ? '<span style="color: #A0AEC0; font-weight: bold; font-size:0.85rem;"><span class="material-icons" style="font-size:1rem; vertical-align:middle;">done_all</span> Leído</span>' 
                            : '<span style="color: #38A169; font-weight: 900; font-size:0.85rem; letter-spacing:0.5px;">NUEVO</span>'}
                    </td>
                    <td style="white-space: nowrap;">
                        <button class="btn-icon" onclick="toggleLeidoReporte('${rep.id}', ${rep.leido})" title="${textoLeido}" style="color: #3182CE;">
                            <span class="material-icons">${iconLeido}</span>
                        </button>
                        <button class="btn-icon delete" onclick="borrarReporte('${rep.id}')" title="Eliminar definitivamente" style="color: #E53E3E;">
                            <span class="material-icons">delete_sweep</span>
                        </button>
                    </td>
                </tr>
            `;
        });

        tabla.innerHTML = html;

        // Actualizamos el número azul del botón de la pestaña
        if (badge) {
            badge.textContent = noLeidos;
            badge.style.display = noLeidos > 0 ? 'inline-block' : 'none';
        }
    });
}

// Botón para marcar leído / no leído
window.toggleLeidoReporte = async function(id, estadoActual) {
    try {
        await db.collection("reportes").doc(id).update({ leido: !estadoActual });
    } catch (error) {
        console.error("Error al actualizar reporte:", error);
    }
};

// Botón para eliminar basura
window.borrarReporte = async function(id) {
    const ok = await confirmarAccion({
        icono: '🗑️', titulo: 'Borrar mensaje',
        mensaje: 'Este mensaje del buzón no se podrá recuperar.',
        textoBtn: 'Sí, borrar', colorBtn: '#E53E3E'
    });
    if (ok) {
        try {
            await db.collection("reportes").doc(id).delete();
            mostrarNotificacionAdmin('Mensaje eliminado ✓');
        } catch (error) {
            console.error("Error al borrar reporte:", error);
        }
    }
};

// ==========================================================================
// 🛒 EDITOR DE PEDIDOS AVANZADO (CON STOCK MIXTO Y BARRERAS)
// ==========================================================================

// --- MEMORIAS GLOBALES ---
window.pedidoActualEditando = null;
window.pedidoOriginalIntacto = null; 

// --- 1. FUNCIÓN DEL OJO: VER Y EDITAR DETALLE ---
window.verDetallePedido = async function(id) {
    const modal = document.getElementById('pedido-modal');
    const titulo = document.getElementById('modal-pedido-title');
    const infoCliente = document.getElementById('pedido-cliente-info');
    const inputId = document.getElementById('pedido-edit-id');

    try {
        titulo.innerHTML = `<span class="material-icons" style="color: var(--primary-blue);">hourglass_empty</span> Cargando...`;
        document.getElementById('pedido-items-lista').innerHTML = '';
        inputId.value = id; 
        modal.style.display = 'flex';

        const doc = await db.collection("pedidos").doc(id).get();
        if (!doc.exists) {
            alert("El pedido ya no existe.");
            cerrarModalPedido();
            return;
        }

        const data = doc.data();
        window.pedidoActualEditando = data; 
        // Clonamos el original para saber cómo estaba la matemática antes
        window.pedidoOriginalIntacto = JSON.parse(JSON.stringify(data)); 

        titulo.innerHTML = `<span class="material-icons" style="color: var(--primary-blue);">receipt_long</span> Editar Pedido #${id.slice(0,6).toUpperCase()}`;

        const logistica = data.datosLogistica || {};
        const numLimpio = logistica.telefono ? logistica.telefono.replace(/\D/g, '') : '';
        const linkWa = numLimpio ? `<a href="https://wa.me/${numLimpio}" target="_blank" style="color:#38A169; text-decoration:none; font-weight:bold; margin-left:10px;"><span class="material-icons" style="font-size:1rem; vertical-align:middle;">chat</span> Chat</a>` : '';

        infoCliente.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                    <p style="margin: 0 0 5px 0;"><strong>👤 Cliente:</strong> ${data.cliente || data.nombreUsuario || 'Invitado'}</p>
                    <p style="margin: 0 0 5px 0;"><strong>📞 Tel:</strong> ${logistica.telefono || 'S/N'} ${linkWa}</p>
                    <p style="margin: 0 0 5px 0;"><strong>🚚 Envío:</strong> ${logistica.metodoEnvio || '-'}</p>
                </div>
                <div>
                    <p style="margin: 0 0 5px 0;"><strong>📍 Ubic:</strong> ${logistica.localidad || '-'} (CP: ${logistica.cp || '-'})</p>
                    <p style="margin: 0 0 5px 0;"><strong>🏠 Direc:</strong> ${logistica.direccion || '-'}</p>
                    <p style="margin: 0 0 5px 0;"><strong>💳 Pago:</strong> ${logistica.metodoPago || '-'}</p>
                </div>
            </div>
        `;

        // Llamamos al motor de dibujado
        window.renderizarFilasEditor();
        document.getElementById('pedido-total-precio').textContent = `$${data.total ? parseInt(data.total).toLocaleString('es-AR') : '0'}`;

    } catch (error) {
        console.error("Error al cargar detalles:", error);
        alert("Hubo un error al cargar el pedido.");
        cerrarModalPedido();
    }
}

// --- 2. MOTOR DE DIBUJADO (CON BLOQUEO TOTAL Y BOTÓN DE CAJAS) ---
window.renderizarFilasEditor = function() {
    const listaItems = document.getElementById('pedido-items-lista');
    let htmlItems = '';
    
    // 🔥 BARRERA 1: ¿El pedido está cancelado O completado?
    const estadoPedido = window.pedidoActualEditando.estado;
    const estaBloqueado = (estadoPedido === 'cancelado' || estadoPedido === 'completado');

    // 🔥 BARRERA 2: Bloquear el botón Guardar principal
    const btnGuardar = document.querySelector('button[onclick="guardarPedidoEditado()"]');
    if (btnGuardar) {
        btnGuardar.disabled = estaBloqueado;
        btnGuardar.style.opacity = estaBloqueado ? '0.5' : '1';
        btnGuardar.style.cursor = estaBloqueado ? 'not-allowed' : 'pointer';
    }

    window.pedidoActualEditando.items.forEach(item => {
        const idReal = String(item.id).replace('_CAJA', '');
        const prodGlobal = productosAdmin.find(p => p.id === idReal) || {};
        const stockRealDeposito = parseInt(prodGlobal.stock) || 0;
        const unidadesPorCaja = parseInt(prodGlobal.unidadesPorCaja) || 1;
        const esCaja = String(item.id).includes('_CAJA');

        let btnExtra = '';

        // Solo mostramos los botones de "+ Agregar" si NO está bloqueado
        if (!estaBloqueado) {
            if (esCaja) {
                // Si es caja, damos la opción de agregar sueltos
                const yaTieneSueltos = window.pedidoActualEditando.items.some(i => i.id === idReal);
                if (!yaTieneSueltos && prodGlobal.precio) {
                    btnExtra = `<button onclick="agregarSueltosAlPedido('${idReal}', ${prodGlobal.precio}, '${prodGlobal.nombre.replace(/'/g, "\\'")}', ${stockRealDeposito})" 
                                   style="font-size:0.75rem; background:#EBF8FF; color:#3182CE; border:1px solid #90CDF4; border-radius:4px; padding:3px 8px; cursor:pointer; margin-top:5px; font-weight:bold;">
                                   + Agregar unidades sueltas
                                  </button>`;
                }
            } else {
                // Si es suelto, damos la opción de agregar la CAJA
                if (prodGlobal.vendePorCaja) {
                    const yaTieneCaja = window.pedidoActualEditando.items.some(i => i.id === idReal + '_CAJA');
                    if (!yaTieneCaja && prodGlobal.precioCaja) {
                        btnExtra = `<button onclick="agregarCajaAlPedido('${idReal}', ${prodGlobal.precioCaja}, '${prodGlobal.nombre.replace(/'/g, "\\'")}', ${prodGlobal.unidadesPorCaja}, ${stockRealDeposito})" 
                                       style="font-size:0.75rem; background:#F0FFF4; color:#38A169; border:1px solid #9AE6B4; border-radius:4px; padding:3px 8px; cursor:pointer; margin-top:5px; font-weight:bold;">
                                       + Agregar CAJA cerrada (x${prodGlobal.unidadesPorCaja})
                                      </button>`;
                    }
                }
            }
        }

        const subtotal = item.precio * item.cantidad;
        
        // Bloqueo visual de inputs si está cancelado o completado
        const inputDisabled = estaBloqueado ? 'disabled' : '';
        const bgInput = estaBloqueado ? '#EDF2F7' : 'white';
        const colorBorde = estaBloqueado ? '#CBD5E0' : '#3182CE';

        htmlItems += `
            <tr style="border-bottom: 1px solid #edf2f7; transition: 0.2s;" id="row-${item.id}">
                <td style="padding: 10px 5px;">
                    <input type="number" id="cant-input-${item.id}" min="0" step="1" value="${item.cantidad}" 
                           style="width: 55px; padding: 6px; border: 2px solid ${colorBorde}; border-radius: 6px; font-weight: 900; text-align: center; color: var(--primary-dark); background: ${bgInput};"
                           onkeyup="recalcularFilaPedido('${item.id}', this.value, ${stockRealDeposito}, ${unidadesPorCaja})"
                           onchange="recalcularFilaPedido('${item.id}', this.value, ${stockRealDeposito}, ${unidadesPorCaja})" ${inputDisabled}>
                </td>
                <td style="padding: 10px; color: #2d3748; line-height: 1.4;">
                    <strong>${item.nombre}</strong> <br>
                    <small style="color: #a0aec0; font-family:monospace;">Cod: ${item.codigo || 'S/C'}</small>
                    ${esCaja ? `<span style="font-size:0.7rem; color:white; background:#38A169; padding:2px 6px; border-radius:10px; margin-left:5px;">CAJA x${unidadesPorCaja}</span>` : ''}
                    <br>
                    <div style="margin-top: 6px; display: flex; align-items: center; gap: 5px;">
                        <span style="font-size: 0.85rem; font-weight: bold; color: #718096;">Precio U: $</span>
                        <input type="number" id="precio-input-${item.id}" min="0" step="any" value="${item.precio}" 
                               style="width: 85px; padding: 4px; border: 1px solid #CBD5E0; border-radius: 4px; font-weight: bold; color: #D69E2E; background: ${bgInput};"
                               onchange="actualizarPrecioManual('${item.id}', this.value)"
                               onkeyup="if(event.key === 'Enter') actualizarPrecioManual('${item.id}', this.value)"
                               title="Editar Precio (Solo números)" ${inputDisabled}>
                    </div>
                    ${btnExtra}
                </td>
                <td style="padding: 10px 5px; text-align: right; font-weight: 900; color:var(--primary-dark);" id="subtotal-${item.id}">
                    $${parseInt(subtotal).toLocaleString('es-AR')}
                </td>
            </tr>
        `;
    });

    // 🔥 ADVERTENCIA VISUAL DINÁMICA
    if (estaBloqueado) {
        let mensajeAlerta = '';
        let colorFondo = '';
        let colorTexto = '';
        let colorBordeAlerta = '';

        if (estadoPedido === 'cancelado') {
            mensajeAlerta = "🚫 Este pedido está CANCELADO.<br>La edición está bloqueada para proteger el inventario devuelto.";
            colorFondo = '#FFF5F5'; colorTexto = '#C53030'; colorBordeAlerta = '#FEB2B2';
        } else {
            mensajeAlerta = "✅ Este pedido ya está COMPLETADO.<br>La edición está bloqueada porque la mercadería ya fue entregada y descontada.";
            colorFondo = '#F0FFF4'; colorTexto = '#276749'; colorBordeAlerta = '#9AE6B4';
        }

        htmlItems += `
            <tr>
                <td colspan="3" style="padding: 15px; text-align: center;">
                    <div style="background: ${colorFondo}; color: ${colorTexto}; padding: 12px; border-radius: 8px; border: 1px dashed ${colorBordeAlerta}; font-weight: bold; font-size: 0.9rem;">
                        ${mensajeAlerta}
                    </div>
                </td>
            </tr>
        `;
    }

    listaItems.innerHTML = htmlItems;
};

// --- 3. AGREGAR UNIDADES SUELTAS AL MISMO PEDIDO ---
window.agregarSueltosAlPedido = function(idReal, precioUnitario, nombreProd, stockReal) {
    window.pedidoActualEditando.items.push({
        id: idReal,
        nombre: nombreProd + " (Unidad Suelta)",
        precio: precioUnitario,
        cantidad: 1, 
        codigo: "MIXTO"
    });
    window.renderizarFilasEditor();
    recalcularFilaPedido(idReal, 1, stockReal, 1); 
};

// --- 3.1 NUEVO: AGREGAR CAJA AL MISMO PEDIDO ---
window.agregarCajaAlPedido = function(idReal, precioCaja, nombreProd, unidadesPorCaja, stockReal) {
    window.pedidoActualEditando.items.push({
        id: idReal + '_CAJA',
        nombre: "CAJA CERRADA x" + unidadesPorCaja + " - " + nombreProd,
        precio: precioCaja,
        cantidad: 1, 
        codigo: "MIXTO",
        unidadesPorCaja: unidadesPorCaja
    });
    window.renderizarFilasEditor();
    recalcularFilaPedido(idReal + '_CAJA', 1, stockReal, unidadesPorCaja); 
};

// --- NUEVA BARRERA: ACTUALIZAR PRECIO MANUALMENTE ---
window.actualizarPrecioManual = function(itemId, nuevoPrecio) {
    let precioLimpio = parseFloat(nuevoPrecio);
    
    // ESCUDO ANTI-LETRAS Y NEGATIVOS
    if (isNaN(precioLimpio) || precioLimpio < 0) {
        alert("⚠️ ERROR DE PRECIO:\n\nSolo se aceptan números positivos (Ej: 4500). No se permiten letras, símbolos ni números negativos.");
        
        // Revertir visualmente al precio que tenía antes del error
        const itemActual = window.pedidoActualEditando.items.find(i => i.id === itemId);
        document.getElementById(`precio-input-${itemId}`).value = itemActual ? itemActual.precio : 0;
        return;
    }

    // Si pasó el escudo, actualizamos la memoria
    const itemActual = window.pedidoActualEditando.items.find(i => i.id === itemId);
    if (itemActual) itemActual.precio = precioLimpio;
    
    // Forzamos a recalcular la suma total
    const cantActual = document.getElementById(`cant-input-${itemId}`).value;
    const idReal = String(itemId).replace('_CAJA', '');
    const prodGlobal = productosAdmin.find(p => p.id === idReal) || {};
    const stockRealDeposito = parseInt(prodGlobal.stock) || 0;
    const unidadesPorCaja = parseInt(prodGlobal.unidadesPorCaja) || 1;
    
    recalcularFilaPedido(itemId, cantActual, stockRealDeposito, unidadesPorCaja);
};

// --- 4. CÁLCULO ESTRICTO Y BARRERA ANTI-NEGATIVOS ---
window.recalcularFilaPedido = function(itemId, nuevaCantidad, stockRealDeposito, unidadesPorCaja) {
    if (!window.pedidoActualEditando) return;

    let cantLimpia = parseInt(nuevaCantidad);
    if (isNaN(cantLimpia) || cantLimpia < 0) cantLimpia = 0;

    const idReal = String(itemId).replace('_CAJA', '');
    let unidadesReservadasOriginalmente = 0;
    
    window.pedidoOriginalIntacto.items.forEach(viejo => {
        if (String(viejo.id).replace('_CAJA', '') === idReal) {
            const mult = String(viejo.id).includes('_CAJA') ? parseInt(unidadesPorCaja) : 1;
            unidadesReservadasOriginalmente += (viejo.cantidad * mult);
        }
    });

    const totalFisicoParaJugar = stockRealDeposito + unidadesReservadasOriginalmente;

    let unidadesIntentadasAhora = 0;
    window.pedidoActualEditando.items.forEach(item => {
        if (String(item.id).replace('_CAJA', '') === idReal) {
            const mult = String(item.id).includes('_CAJA') ? parseInt(unidadesPorCaja) : 1;
            const cant = (item.id === itemId) ? cantLimpia : item.cantidad;
            unidadesIntentadasAhora += (cant * mult);
        }
    });

    if (unidadesIntentadasAhora > totalFisicoParaJugar) {
        alert(`⚠️ ATENCIÓN: STOCK INSUFICIENTE.\n\nEnzo, solo tienes ${totalFisicoParaJugar} unidades totales disponibles de este producto (sumando lo reservado). No puedes exceder esa cantidad.`);
        const itemActual = window.pedidoActualEditando.items.find(i => i.id === itemId);
        cantLimpia = itemActual ? itemActual.cantidad : 0; 
        document.getElementById(`cant-input-${itemId}`).value = cantLimpia;
    } else {
        const inputElement = document.getElementById(`cant-input-${itemId}`);
        if (inputElement && inputElement.value !== cantLimpia.toString()) inputElement.value = cantLimpia;
    }

    let totalNuevo = 0;
    window.pedidoActualEditando.items.forEach(item => {
        if (item.id == itemId) item.cantidad = cantLimpia;
        
        const subtotal = item.precio * item.cantidad;
        const subEl = document.getElementById(`subtotal-${item.id}`);
        if (subEl) subEl.textContent = `$${parseInt(subtotal).toLocaleString('es-AR')}`;
        
        const fila = document.getElementById(`row-${item.id}`);
        if (fila) fila.style.opacity = item.cantidad === 0 ? '0.4' : '1';
        
        totalNuevo += subtotal;
    });

    window.pedidoActualEditando.total = totalNuevo;
    document.getElementById('pedido-total-precio').textContent = `$${parseInt(totalNuevo).toLocaleString('es-AR')}`;
};

// --- 5. GUARDAR Y SINCRONIZAR BASE DE DATOS ---
window.guardarPedidoEditado = async function() {
    const id = document.getElementById('pedido-edit-id').value;
    if(!id || !window.pedidoActualEditando || !window.pedidoOriginalIntacto) return;
    
    // Limpiamos los productos que quedaron en cantidad 0
    window.pedidoActualEditando.items = window.pedidoActualEditando.items.filter(i => i.cantidad > 0);

    try {
        const batch = db.batch();

        // COMPROBACIÓN DE STOCK PARA LA BASE DE DATOS (El Delta)
        // Revisamos producto por producto (por idReal)
        const productosProcesados = [];
        
        // Unimos todos los items viejos y nuevos para sacar la cuenta exacta
        const todosLosItems = [...window.pedidoOriginalIntacto.items, ...window.pedidoActualEditando.items];
        
        todosLosItems.forEach(item => {
            const idReal = String(item.id).replace('_CAJA', '');
            if(productosProcesados.includes(idReal)) return; // Ya lo calculamos
            productosProcesados.push(idReal);

            // ¿Cuántas unidades tenía antes en total (cajas + sueltos)?
            let cantVieja = 0;
            window.pedidoOriginalIntacto.items.forEach(v => {
                if(String(v.id).replace('_CAJA', '') === idReal) {
                    const mult = String(v.id).includes('_CAJA') ? (parseInt(v.unidadesPorCaja)||1) : 1;
                    cantVieja += (v.cantidad * mult);
                }
            });

            // ¿Cuántas unidades tiene AHORA en total (cajas + sueltos)?
            let cantNueva = 0;
            window.pedidoActualEditando.items.forEach(n => {
                if(String(n.id).replace('_CAJA', '') === idReal) {
                    const mult = String(n.id).includes('_CAJA') ? (parseInt(n.unidadesPorCaja)||1) : 1;
                    cantNueva += (n.cantidad * mult);
                }
            });

            const diferencia = cantNueva - cantVieja;

            if (diferencia !== 0) {
                // Actualizamos el stock real global restando la diferencia
                const refProducto = db.collection("productos").doc(idReal);
                batch.update(refProducto, {
                    stock: firebase.firestore.FieldValue.increment(-diferencia)
                });
            }
        });

        // Actualizamos el pedido
        const refPedido = db.collection("pedidos").doc(id);
        batch.update(refPedido, {
            items: window.pedidoActualEditando.items,
            total: window.pedidoActualEditando.total
        });

        await batch.commit();
        mostrarNotificacionAdmin("Pedido y stock actualizados ✓");
        cerrarModalPedido();
        
    } catch(e) {
        console.error(e);
        alert("Error de red al guardar los cambios y el stock.");
    }
};

window.guardarEImprimirPedido = async function() {
    await window.guardarPedidoEditado(); 
    const id = document.getElementById('pedido-edit-id').value;
    if(id) imprimirRemito(id); 
};

// ==========================================================================
// 🖨️ Y ⬇️ MOTOR DUAL: IMPRESIÓN Y DESCARGA PDF
// ==========================================================================

// 1. Rellena los datos en el Molde Oculto
window.prepararPlantillaPDF = async function(idPedido) {
    try {
        const doc = await db.collection("pedidos").doc(idPedido).get();
        if (!doc.exists) return false;
        
        const data = doc.data();
        const logistica = data.datosLogistica || {};

        document.getElementById('print-order-number').textContent = `#C-${idPedido.slice(0,4).toUpperCase()}`;
        
        let fechaLimpia = "Fecha desconocida";
        if (data.fecha && data.fecha.seconds) {
            const d = new Date(data.fecha.seconds * 1000);
            fechaLimpia = d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'});
        }
        document.getElementById('print-order-date').textContent = `Fecha: ${fechaLimpia}`;

        document.getElementById('print-client-name').textContent = data.cliente || 'Invitado';
        document.getElementById('print-client-address').textContent = logistica.direccion || 'S/D';
        document.getElementById('print-client-city').textContent = logistica.localidad || 'S/D';
        document.getElementById('print-client-cp').textContent = logistica.cp || '-';
        document.getElementById('print-client-phone').textContent = logistica.telefono || 'S/D';
        document.getElementById('print-client-shipping').textContent = logistica.metodoEnvio || '-';
        document.getElementById('print-client-payment').textContent = logistica.metodoPago || '-';

        const tbody = document.getElementById('print-items-body');
        let htmlFilas = '';
        let cantidadItemsTotales = 0;

        (data.items || []).forEach(item => {
            const subtotal = item.precio * item.cantidad;
            const esCaja = String(item.id).includes('_CAJA');
            const unidadesCaja = esCaja && item.unidadesPorCaja ? item.unidadesPorCaja : 1;
            
            let detalleExtra = '';
            if (esCaja) {
                detalleExtra = `<br><small style="color: #555;">(CAJA CERRADA x${unidadesCaja} unidades)</small>`;
                cantidadItemsTotales += (item.cantidad * unidadesCaja); 
            } else {
                cantidadItemsTotales += item.cantidad;
            }

            htmlFilas += `
                <tr>
                    <td style="font-weight: bold; text-align: center; border-bottom: 1px solid #eee;">${item.cantidad}x</td>
                    <td style="border-bottom: 1px solid #eee;">
                        <strong>${item.nombre}</strong>
                        <div style="font-size: 0.75rem; color: #666; font-family: monospace;">Cód: ${item.codigo || 'S/C'}</div>
                        ${detalleExtra}
                    </td>
                    <td style="text-align: right; border-bottom: 1px solid #eee;">$${parseInt(item.precio).toLocaleString('es-AR')}</td>
                    <td style="text-align: right; font-weight: bold; border-bottom: 1px solid #eee;">$${parseInt(subtotal).toLocaleString('es-AR')}</td>
                </tr>
            `;
        });

        tbody.innerHTML = htmlFilas;
        document.getElementById('print-items-count').textContent = `${data.items.length} Tipos de productos (Unid. Físicas: ${cantidadItemsTotales})`;
        document.getElementById('print-total-price').textContent = `$${parseInt(data.total).toLocaleString('es-AR')}`;

        return true;
    } catch (error) {
        console.error("Error al preparar PDF:", error);
        return false;
    }
};

// 2. ACCIÓN: Solo Imprimir (Abre ventana del navegador)
window.imprimirRemito = async function(idPedido) {
    const exito = await prepararPlantillaPDF(idPedido);
    if (exito) {
        // Dar tiempo al browser para renderizar antes de abrir el diálogo
        setTimeout(() => window.print(), 400);
    }
};

// 3. ACCIÓN: Descargar PDF — usa window.print() nativo del browser
// El usuario elige "Guardar como PDF" en el diálogo de impresión
window.descargarRemitoPDF = async function(idPedido) {
    const exito = await prepararPlantillaPDF(idPedido);
    if (!exito) {
        mostrarNotificacionAdmin('Error al cargar los datos del pedido');
        return;
    }
    mostrarNotificacionAdmin('En el diálogo de impresión elegí "Guardar como PDF"');
    setTimeout(() => window.print(), 400);
};

// 4. NUEVO: Evento para el botón dentro del "Ojo"
window.guardarEDescargarPedido = async function() {
    await window.guardarPedidoEditado(); 
    const id = document.getElementById('pedido-edit-id').value;
    if(id) descargarRemitoPDF(id); 
};
// ==========================================================================
// 📕 MOTOR DE CATÁLOGO PDF MAYORISTA (AGRUPADO Y CON ETIQUETAS)
// ==========================================================================

window.descargarCatalogoPDF = async function(btn) {
    if (productosAdmin.length === 0) {
        mostrarNotificacionAdmin('No hay productos en el inventario');
        return;
    }

    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons" style="animation:spin 1s linear infinite">autorenew</span> Preparando...';
    btn.disabled = true;

    try {
        // ── 1. Agrupar y ordenar productos ───────────────────────────────
        const grupos = {};
        productosAdmin.forEach(prod => {
            const cat = (prod.categoria || 'OTROS').toUpperCase();
            if (!grupos[cat]) grupos[cat] = [];
            grupos[cat].push(prod);
        });

        let htmlProductos = '';
        Object.keys(grupos).sort().forEach(cat => {

            htmlProductos += `<div class="cat-header">${cat}</div><div class="products-grid">`;

            grupos[cat]
                .sort((a, b) => ((a.marca||'')+(a.nombre||'')).localeCompare((b.marca||'')+(b.nombre||'')))
                .forEach(prod => {
                    const tieneImg = prod.imagen && prod.imagen.startsWith('http') && !prod.imagen.includes('placehold');
                    const precio   = prod.precio ? `$${parseInt(prod.precio).toLocaleString('es-AR')}` : 'Consultar';
                    const badge    = prod.enOferta
                        ? '<span class="badge oferta">OFERTA</span>'
                        : prod.nuevo ? '<span class="badge nuevo">NUEVO</span>' : '';
                    const caja = prod.vendePorCaja && prod.precioCaja
                        ? `<div class="precio-caja">Caja x${prod.unidadesPorCaja}: $${parseInt(prod.precioCaja).toLocaleString('es-AR')}</div>`
                        : '';

                    htmlProductos += `
                        <div class="product-card">
                            ${badge}
                            <div class="img-box">
                                ${tieneImg
                                    ? `<img src="${prod.imagen}" alt="${prod.nombre}" loading="eager">`
                                    : '<div class="no-img">Sin imagen</div>'}
                            </div>
                            <div class="marca">${prod.marca || ''}</div>
                            <div class="nombre">${prod.nombre || ''}</div>
                            <div class="codigo">CÓD: ${prod.codigo || 'S/C'}</div>
                            <div class="precio">${precio}</div>
                            ${caja}
                        </div>`;
                });

            htmlProductos += '</div>';
        });

        // ── 2. Construir HTML completo de la ventana de impresión ────────
        const fecha = new Date().toLocaleDateString('es-AR');
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Catálogo Distribuciones Enzo — ${fecha}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; font-size: 10px; background: white; padding: 15px; color: #2D3748; }
.header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 15px; border-bottom: 3px solid #2B6CB0; margin-bottom: 20px; }
.header img { max-height: 65px; }
.header-info h1 { font-size: 18px; color: #1A365D; text-transform: uppercase; letter-spacing: 1px; }
.header-info p { color: #718096; font-size: 9px; margin-top: 5px; line-height: 1.5; }
.cat-header { background: #2D3748; color: white; padding: 9px 14px; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; border-radius: 6px; margin: 22px 0 10px 0; page-break-after: avoid; }
.products-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.product-card { border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px; text-align: center; position: relative; page-break-inside: avoid; background: white; }
.badge { position: absolute; top: -5px; right: -5px; padding: 2px 5px; font-size: 7px; font-weight: bold; border-radius: 4px; z-index: 1; }
.badge.oferta { background: #E53E3E; color: white; }
.badge.nuevo  { background: #38bdf8; color: #0a192f; }
.img-box { height: 75px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; overflow: hidden; }
.img-box img { max-width: 100%; max-height: 75px; object-fit: contain; }
.no-img { color: #CBD5E0; font-size: 8px; font-style: italic; }
.marca { font-size: 7px; color: #718096; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
.nombre { font-size: 9px; color: #2D3748; font-weight: bold; margin-bottom: 4px; line-height: 1.3; min-height: 24px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.codigo { font-family: monospace; font-size: 7px; background: #EDF2F7; padding: 2px 4px; border-radius: 3px; color: #4A5568; margin-bottom: 5px; display: inline-block; }
.precio { color: #2B6CB0; font-size: 13px; font-weight: 900; }
.precio-caja { font-size: 7px; color: #38A169; margin-top: 2px; font-weight: bold; }
.footer { text-align: center; margin-top: 30px; padding: 15px; background: #EBF8FF; border-radius: 8px; border: 2px dashed #3182CE; page-break-inside: avoid; }
.footer h2 { color: #2B6CB0; font-size: 14px; margin-bottom: 6px; }
.footer p { color: #4A5568; font-size: 10px; }
@media print {
    @page { margin: 1cm; size: A4 portrait; }
    body { padding: 0; }
    .product-card { page-break-inside: avoid; }
    .cat-header { page-break-after: avoid; }
    .footer { page-break-inside: avoid; }
    .no-print { display: none !important; }
}
</style>
</head>
<body>

<div class="header">
    <img src="./EnzoDistribuidora.png" alt="Distribuciones Enzo"
         onerror="this.src='https://enzodistribuciones.com/EnzoDistribuidora.png'">
    <div class="header-info">
        <h1>Catálogo de Productos</h1>
        <p>Depósito: Ushuaia 331, Oberá, Misiones &nbsp;|&nbsp; WhatsApp: +54 9 3755 503213</p>
        <p>Lista de precios actualizada al: <strong>${fecha}</strong> &nbsp;|&nbsp; <strong>${productosAdmin.length} productos</strong></p>
    </div>
</div>

${htmlProductos}

<div class="footer">
    <h2>¿Listo para hacer tu pedido?</h2>
    <p>Ingresá a nuestra plataforma mayorista y armá tu carrito al instante.</p>
    <p style="margin-top:6px; font-weight:bold; color:#2B6CB0; font-size:12px;">https://enzodistribuciones.com/</p>
</div>

<script>
// Esperar que TODAS las imágenes terminen de cargar antes de imprimir
(function() {
    var imgs = document.querySelectorAll('img');
    var total = imgs.length;
    if (total === 0) { setTimeout(function(){ window.print(); }, 300); return; }
    var cargadas = 0;
    function check() {
        cargadas++;
        if (cargadas >= total) setTimeout(function(){ window.print(); }, 300);
    }
    imgs.forEach(function(img) {
        if (img.complete && img.naturalWidth > 0) { check(); }
        else { img.onload = img.onerror = check; }
    });
})();
<\/script>
</body>
</html>`;

        // ── 3. Abrir nueva ventana y disparar print ───────────────────────
        const ventana = window.open('', '_blank');
        if (!ventana) {
            mostrarNotificacionAdmin('Habilitá las ventanas emergentes para generar el catálogo');
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            return;
        }
        ventana.document.write(html);
        ventana.document.close();

    } catch (error) {
        console.error('Error al generar catálogo:', error);
        mostrarNotificacionAdmin('Error al preparar el catálogo — revisá la consola');
    } finally {
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
    }
};


// ==========================================================================
// 📄 MOTOR DE DESCARGA: PLANTILLA CSV MAESTRA (CON EJEMPLOS REALES)
// ==========================================================================
window.descargarPlantillaCSV = function() {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    
    // 1. La fila sagrada (Los 13 títulos exactos que leerá nuestro código)
    csvContent += "CODIGO,NOMBRE,MARCA,CATEGORIA,PRECIO,STOCK,VENDE_POR_CAJA,UNIDADES_CAJA,PRECIO_CAJA,OFERTA,NUEVO,IMAGEN_URL,DESCRIPCION,GRUPO_ID,VAR_DIM1,VAR_DIM2\n";
    
    // 2. Las 15 filas de ejemplo hiperrealistas para que Enzo entienda el formato
    // Columnas: CODIGO,NOMBRE,MARCA,CATEGORIA,PRECIO,STOCK,VENDE_POR_CAJA,UNIDADES_CAJA,
    //           PRECIO_CAJA,OFERTA,NUEVO,IMAGEN_URL,DESCRIPCION,GRUPO_ID,VAR_DIM1,VAR_DIM2
    // GRUPO_ID/VAR_DIM1/VAR_DIM2: solo completar para productos con variantes por SKU propio (Sistema B)
    // Si no tiene variantes dejar vacías las últimas 3 columnas
    const filasEjemplo = [
        // — Productos simples (sin grupo) —
        "AMOL-01,Amoladora Angular 115mm 820W,Black+Decker,electricas,45000,20,SI,4,170000,SI,NO,https://i.ibb.co/5h0RXMck/amolaadora.webp,Amoladora ideal para corte y desbaste en obra.,,, ",
        "TORN-T2,Tornillo Autoperforante T2 Hexagonal (x100),TEL,tornillos,3500,500,SI,20,60000,NO,NO,https://i.ibb.co/fw0QQ4F/auto-perforante.webp,Caja de 100 unidades de autoperforantes para chapa.,,, ",
        "SOLD-INV,Soldadora Inverter 150A,Lusqtoff,electricas,115000,8,NO,0,0,SI,NO,https://i.ibb.co/PzmnZCv0/soldador.webp,Inverter ultra portatil y potente para herreria.,,, ",
        "TAL-PER,Taladro Percutor 710W 13mm,Dewalt,electricas,65000,18,SI,4,250000,NO,NO,https://i.ibb.co/gM04RSjP/taladro.webp,Mandril de 13mm con velocidad variable y reversa.,,, ",
        "WD-40,Lubricante Multiuso WD-40 400ml,WD-40,productos de limpieza,6500,120,SI,12,72000,SI,NO,https://i.ibb.co/prL6Gq1B/wd-40.webp,Afloja piezas oxidadas y desplaza la humedad.,,, ",
        // — Productos con variantes por grupo (Sistema B) — GRUPO_ID + VAR_DIM1 + VAR_DIM2 —
        // Ejemplo: Cable unipolar por sección (1 dimensión: Medida)
        "DE-WIRE01,Cable Unipolar 1.5mm x 100m,WIRE,cables,18500,50,NO,0,0,NO,NO,,Cable unipolar IRAM.Rollo de 100m.,CABLE-UNIPOLAR-WIRE,1.5mm, ",
        "DE-WIRE02,Cable Unipolar 2.5mm x 100m,WIRE,cables,24000,50,NO,0,0,NO,NO,,Cable unipolar IRAM.Rollo de 100m.,CABLE-UNIPOLAR-WIRE,2.5mm, ",
        "DE-WIRE03,Cable Unipolar 4mm x 100m,WIRE,cables,35000,30,NO,0,0,NO,NO,,Cable unipolar IRAM.Rollo de 100m.,CABLE-UNIPOLAR-WIRE,4mm, ",
        // Ejemplo: Termicas por Polaridad x Amperaje (2 dimensiones)
        "DE-BAW49,Termica Unipolar 16A Corte B,BAW Electric,protecciones,4200,100,NO,0,0,NO,NO,,Disyuntor termomagnetico curva B.,TERMICA-BAW,Unipolar,16A",
        "DE-BAW50,Termica Unipolar 20A Corte B,BAW Electric,protecciones,4500,100,NO,0,0,NO,NO,,Disyuntor termomagnetico curva B.,TERMICA-BAW,Unipolar,20A",
        "DE-BAW51,Termica Bipolar 16A Corte B,BAW Electric,protecciones,7800,80,NO,0,0,NO,NO,,Disyuntor termomagnetico bipolar curva B.,TERMICA-BAW,Bipolar,16A",
        "DE-BAW52,Termica Bipolar 20A Corte B,BAW Electric,protecciones,8200,80,NO,0,0,NO,NO,,Disyuntor termomagnetico bipolar curva B.,TERMICA-BAW,Bipolar,20A"
    ];

    csvContent += filasEjemplo.join('\n') + '\n';

    // 3. Crear el archivo y forzar descarga
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Plantilla_Importacion_Enzo.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ==========================================================================
// 🏪 SISTEMA DE PUNTO DE VENTA MANUAL (CAJA REGISTRADORA)
// ==========================================================================

window.carritoPOS = []; // Memoria temporal del mini-carrito

window.abrirPuntoDeVenta = function() {
    window.carritoPOS = [];
    document.getElementById('pos-form').reset();
    document.getElementById('pos-tipo-venta').value = 'local';
    toggleCamposEnvioPOS();
    renderizarCarritoPOS();
    document.getElementById('pos-modal').style.display = 'flex';
    
    // 🔥 MAGIA: Apenas abre, carga todo el catálogo visual
    ejecutarBusquedaPOS(''); 
};

window.cerrarPuntoDeVenta = function() {
    document.getElementById('pos-modal').style.display = 'none';
};

window.toggleCamposEnvioPOS = function() {
    const tipo = document.getElementById('pos-tipo-venta').value;
    const divEnvio = document.getElementById('pos-campos-envio');
    const inputsEnvio = divEnvio.querySelectorAll('input');
    
    if (tipo === 'envio') {
        divEnvio.style.display = 'block';
        inputsEnvio.forEach(inp => inp.required = true); // Si es envío, obliga a llenar
    } else {
        divEnvio.style.display = 'none';
        inputsEnvio.forEach(inp => { inp.required = false; inp.value = ''; });
    }
};

// --- BUSCADOR INTELIGENTE Y CATÁLOGO VISUAL ---
window.ejecutarBusquedaPOS = function(query) {
    const box = document.getElementById('pos-resultados-busqueda');
    const q = query.toLowerCase().trim();
    
    let resultados = [];

    // Si no escribió nada, le mostramos el catálogo completo ordenado de la A a la Z
    if (q === '') {
        resultados = [...productosAdmin]
            .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
            .slice(0, 150); // Límite generoso para que no se trabe el navegador
    } else {
        // Si escribió algo, filtramos rápido
        resultados = productosAdmin.filter(p => 
            (p.nombre && p.nombre.toLowerCase().includes(q)) || 
            (p.codigo && p.codigo.toLowerCase().includes(q))
        ).slice(0, 50); 
    }

    if (resultados.length === 0) {
        box.innerHTML = '<div style="padding:15px; text-align:center; color:#E53E3E; font-weight:bold;">No se encontró ningún producto.</div>';
    } else {
        let html = '';
        resultados.forEach(p => {
            const stock = parseInt(p.stock) || 0;
            const esAgotado = stock <= 0;
            const colorStock = esAgotado ? '#E53E3E' : '#38A169';
            
            // 🔥 INYECTAMOS LA FOTO DEL PRODUCTO
            const imgUrl = p.imagen && p.imagen.includes('http') ? p.imagen : 'https://via.placeholder.com/50?text=S/Img';

            // Botones inteligentes
            let botonesHtml = '';
            if (esAgotado) {
                botonesHtml = `<span style="color: #E53E3E; font-weight:bold; font-size:0.85rem; padding-right:10px;">AGOTADO</span>`;
            } else {
                botonesHtml += `<button type="button" class="btn-outline" onclick="agregarProductoPOS('${p.id}', false)" style="padding: 4px 10px; font-size: 0.9rem; border-color:#3182CE; color:#3182CE; font-weight:bold;">+ Unidad</button>`;
                
                if (p.vendePorCaja && p.unidadesPorCaja > 0 && stock >= p.unidadesPorCaja) {
                    botonesHtml += `<button type="button" class="btn-auth" onclick="agregarProductoPOS('${p.id}', true)" style="padding: 4px 5px; font-size: 0.9rem; margin:0 0 0 5px; background:#38A169; border:none; font-weight:bold;">+ CAJA (x${p.unidadesPorCaja})</button>`;
                }
            }

            html += `
                <div style="padding: 10px 15px; border-bottom: 1px solid #EDF2F7; display: flex; justify-content: space-between; align-items: center; transition: 0.2s;" onmouseover="this.style.background='#F7FAFC'" onmouseout="this.style.background='white'">
                    
                    <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
                        <img src="${imgUrl}" style="width: 50px; height: 50px; object-fit: contain; border-radius: 6px; border: 1px solid #E2E8F0; background: white;">
                        
                        <div style="line-height: 1.3;">
                            <strong style="color: #2D3748; font-size: 1rem;">${p.nombre}</strong><br>
                            <small style="color: #718096; font-family: monospace;">Cód: ${p.codigo || 'S/C'}</small> | 
                            <span style="color: ${colorStock}; font-size: 0.85rem; font-weight: bold;">Stock: ${stock}</span>
                        </div>
                    </div>

                    <div style="display:flex; align-items:center;">
                        ${botonesHtml}
                    </div>
                </div>
            `;
        });
        box.innerHTML = html;
    }
    box.style.display = 'block';
};

// --- AGREGAR AL CARRITO INTERNO (CONTROL ESTRICTO DE STOCK) ---
window.agregarProductoPOS = function(idReal, esCaja) {
    const prodGlobal = productosAdmin.find(p => p.id === idReal);
    if (!prodGlobal) return;

    const idCarrito = esCaja ? `${idReal}_CAJA` : idReal;
    const multiplicadorStock = esCaja ? (parseInt(prodGlobal.unidadesPorCaja) || 1) : 1;
    
    // Calcular cuánto stock de este producto YA TENEMOS en el carrito (sumando cajas y sueltos)
    let stockYaEnCarrito = 0;
    window.carritoPOS.forEach(item => {
        const idBase = String(item.id).replace('_CAJA', '');
        if (idBase === idReal) {
            const mult = String(item.id).includes('_CAJA') ? (parseInt(item.unidadesPorCaja) || 1) : 1;
            stockYaEnCarrito += (item.cantidad * mult);
        }
    });

    const stockTotalBD = parseInt(prodGlobal.stock) || 0;

    // BARRERA: ¿Hay stock suficiente para sumar esto?
    if (stockYaEnCarrito + multiplicadorStock > stockTotalBD) {
        alert(`⚠️ STOCK INSUFICIENTE\n\nSolo quedan ${stockTotalBD} unidades físicas de este producto. Ya no puedes agregar más al ticket.`);
        return;
    }

    // Si pasó, lo agregamos o sumamos
    const itemExistente = window.carritoPOS.find(i => i.id === idCarrito);
    if (itemExistente) {
        itemExistente.cantidad++;
    } else {
        window.carritoPOS.push({
            id: idCarrito,
            codigo: prodGlobal.codigo || 'S/C',
            nombre: prodGlobal.nombre,
            precio: esCaja ? (parseFloat(prodGlobal.precioCaja) || 0) : (parseFloat(prodGlobal.precio) || 0),
            cantidad: 1,
            unidadesPorCaja: prodGlobal.unidadesPorCaja, // Solo sirve si es caja
            stockRealDisponible: stockTotalBD // Guardamos la referencia para el input
        });
    }

    // Limpiar buscador visualmente
    document.getElementById('pos-buscador').value = '';
    document.getElementById('pos-resultados-busqueda').style.display = 'none';
    
    renderizarCarritoPOS();
};

// --- DIBUJAR Y EDITAR EL CARRITO INTERNO ---
window.renderizarCarritoPOS = function() {
    const tbody = document.getElementById('pos-carrito-body');
    const spanTotal = document.getElementById('pos-total-precio');
    let html = '';
    let totalCuenta = 0;

    if (window.carritoPOS.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #A0AEC0; font-weight:bold;">El ticket está vacío.</td></tr>';
        spanTotal.textContent = '$0';
        return;
    }

    window.carritoPOS.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        totalCuenta += subtotal;
        const esCaja = String(item.id).includes('_CAJA');

        html += `
            <tr style="border-bottom: 1px solid #EDF2F7;">
                <td style="padding: 10px;">
                    <strong style="color: #2D3748;">${item.nombre}</strong>
                    ${esCaja ? `<br><span style="font-size:0.7rem; background:#38A169; color:white; padding:2px 6px; border-radius:10px;">CAJA x${item.unidadesPorCaja}</span>` : ''}
                </td>
                <td style="padding: 10px;">
                    <input type="number" min="1" step="1" value="${item.cantidad}" 
                           style="width: 50px; padding: 4px; border: 2px solid #3182CE; border-radius: 4px; text-align: center; font-weight: bold;"
                           onchange="modificarCantPOS(${index}, this.value)">
                </td>
                <td style="padding: 10px;">
                    <input type="number" min="0" step="any" value="${item.precio}" 
                           style="width: 80px; padding: 4px; border: 1px solid #CBD5E0; border-radius: 4px; text-align: right; color: #D69E2E; font-weight: bold;"
                           title="Editar Precio (Solo números positivos)"
                           onchange="modificarPrecioPOS(${index}, this.value)">
                </td>
                <td style="padding: 10px; text-align: right; font-weight: 900; color: #3182CE;">
                    $${parseInt(subtotal).toLocaleString('es-AR')}
                </td>
                <td style="padding: 10px; text-align: center;">
                    <button type="button" onclick="eliminarDelPOS(${index})" style="background: none; border: none; color: #E53E3E; cursor: pointer;" title="Quitar">
                        <span class="material-icons">delete</span>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    spanTotal.textContent = `$${parseInt(totalCuenta).toLocaleString('es-AR')}`;
};

window.modificarCantPOS = function(index, nuevaCant) {
    let cant = parseInt(nuevaCant);
    if (isNaN(cant) || cant < 1) cant = 1;

    const itemModificado = window.carritoPOS[index];
    const idReal = String(itemModificado.id).replace('_CAJA', '');
    
    // Verificamos stock cruzado
    let stockCalculado = 0;
    window.carritoPOS.forEach((it, i) => {
        const idBase = String(it.id).replace('_CAJA', '');
        if (idBase === idReal) {
            const c = (i === index) ? cant : it.cantidad; // Usamos la nueva cantidad solo para este item
            const mult = String(it.id).includes('_CAJA') ? (parseInt(it.unidadesPorCaja) || 1) : 1;
            stockCalculado += (c * mult);
        }
    });

    if (stockCalculado > itemModificado.stockRealDisponible) {
        alert("⚠️ Stock físico insuficiente para subir esa cantidad.");
    } else {
        window.carritoPOS[index].cantidad = cant;
    }
    renderizarCarritoPOS();
};

window.modificarPrecioPOS = function(index, nuevoPrecio) {
    let precio = parseFloat(nuevoPrecio);
    if (isNaN(precio) || precio < 0) {
        alert("⚠️ Solo números positivos permitidos para el precio.");
    } else {
        window.carritoPOS[index].precio = precio;
    }
    renderizarCarritoPOS();
};

window.eliminarDelPOS = function(index) {
    window.carritoPOS.splice(index, 1);
    renderizarCarritoPOS();
};

// --- EL GRAN CIERRE: CONFIRMAR VENTA MANUAL ---
window.confirmarVentaPOS = async function() {
    if (window.carritoPOS.length === 0) {
        alert("El carrito está vacío.");
        return;
    }

    const btn = document.getElementById('btn-confirmar-pos');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons" style="vertical-align: middle;">hourglass_empty</span> Procesando...';

    try {
        const tipoVenta = document.getElementById('pos-tipo-venta').value;
        let totalCuenta = 0;
        window.carritoPOS.forEach(i => totalCuenta += (i.precio * i.cantidad));

        // 1. Armar el objeto Pedido tal cual lo hace la página web
        const nuevoPedido = {
            cliente: document.getElementById('pos-cliente-nombre').value.trim(),
            estado: tipoVenta === 'local' ? 'completado' : 'pendiente', // Si es mostrador, ya está cobrado.
            fecha: new Date(),
            items: window.carritoPOS,
            total: totalCuenta,
            tipoOrigen: 'MANUAL_POS',
            datosLogistica: {
                metodoEnvio: tipoVenta === 'local' ? 'Retiro en Local' : 'Envío a Domicilio',
                metodoPago: 'Acordado en Local',
                direccion: document.getElementById('pos-cliente-direccion').value.trim() || 'S/D',
                localidad: document.getElementById('pos-cliente-localidad').value.trim() || 'S/D',
                cp: document.getElementById('pos-cliente-cp').value.trim() || 'S/D',
                telefono: document.getElementById('pos-cliente-tel').value.trim() || 'S/D'
            }
        };

        const batch = db.batch();
        
        // 2. Crear el documento del pedido
        const nuevoId = 'POS_' + Date.now().toString();
        const refPedido = db.collection("pedidos").doc(nuevoId);
        batch.set(refPedido, { id: nuevoId, ...nuevoPedido });

        // 3. Descontar el stock masivamente y seguro
        const productosProcesados = {};
        window.carritoPOS.forEach(item => {
            const idReal = String(item.id).replace('_CAJA', '');
            const mult = String(item.id).includes('_CAJA') ? (parseInt(item.unidadesPorCaja) || 1) : 1;
            const unidadesARestar = item.cantidad * mult;
            
            if (!productosProcesados[idReal]) productosProcesados[idReal] = 0;
            productosProcesados[idReal] += unidadesARestar;
        });

        for (const idReal in productosProcesados) {
            const refProducto = db.collection("productos").doc(idReal);
            batch.update(refProducto, { 
                stock: firebase.firestore.FieldValue.increment(-productosProcesados[idReal]) 
            });
        }

        // 4. ¡Disparar a Firebase!
        await batch.commit();

        mostrarNotificacionAdmin("Venta registrada y stock actualizado ✓");
        cerrarPuntoDeVenta();
        
        // Refrescamos la pestaña de pedidos para que lo vea enseguida
        if (typeof cargarPedidos === 'function') cargarPedidos();

    } catch (error) {
        console.error("Error al registrar venta manual:", error);
        alert("Hubo un error de conexión al procesar la venta.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons" style="vertical-align: middle;">check_circle</span> CONFIRMAR VENTA';
    }
};

/* ==========================================================================
   MÓDULO DE USUARIOS
   - Cargar solicitudes pendientes
   - Aprobar / Rechazar solicitudes
   - Cargar usuario manualmente (crea en Firebase Auth + Firestore)
   - Listar aprobados y rechazados
   ========================================================================== */

// ── Tabs internos del panel de usuarios ──────────────────────────────────────
window.switchUsrTab = function(tab) {
    ['pendientes','aprobados','rechazados'].forEach(t => {
        const btn   = document.getElementById('usr-tab-' + t);
        const panel = document.getElementById('usr-panel-' + t);
        if (btn)   { btn.style.borderBottomColor = t === tab ? '#E53E3E' : 'transparent'; btn.style.color = t === tab ? '#E53E3E' : '#718096'; }
        if (panel) panel.style.display = t === tab ? 'block' : 'none';
    });
    if (tab === 'pendientes') cargarSolicitudesPendientes();
    if (tab === 'aprobados')  cargarUsuariosAprobados();
    if (tab === 'rechazados') cargarSolicitudesRechazadas();
};

// ── Loader genérico ──────────────────────────────────────────────────────────
function renderTablaUsuarios(contenedorId, filas, emptyMsg) {
    const el = document.getElementById(contenedorId);
    if (!el) return;
    if (filas.length === 0) { el.innerHTML = `<p style="color:#718096;text-align:center;padding:30px;">${emptyMsg}</p>`; return; }
    el.innerHTML = `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.9rem;">${filas.join('')}</table></div>`;
}

// ── Cache de datos de solicitudes (evita problemas de JSON en onclick) ────────
const _solicitudesCache = {};

// ── Solicitudes PENDIENTES ────────────────────────────────────────────────────
async function cargarSolicitudesPendientes() {
    const el = document.getElementById('tabla-solicitudes-pendientes');
    if (el) el.innerHTML = '<p style="color:#718096;text-align:center;padding:20px;">Cargando...</p>';

    try {
        const snap = await db.collection('solicitudes_acceso').where('estado','==','pendiente').orderBy('fecha','desc').get();

        // Actualizar badge
        const badge = document.getElementById('cnt-pendientes');
        if (badge) badge.textContent = snap.size;
        const badgeNav = document.getElementById('badge-solicitudes');
        if (badgeNav) { badgeNav.textContent = snap.size; badgeNav.style.display = snap.size > 0 ? 'inline-block' : 'none'; }

        const TH = `<thead><tr style="background:#F7FAFC;text-align:left;">
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Nombre</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">DNI</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Negocio / CUIT</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Contacto</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Ubicación</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Fecha</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Acciones</th>
        </tr></thead>`;

        const filas = [TH];
        snap.forEach(doc => {
            const d = doc.data();
            _solicitudesCache[doc.id] = d;
            const fecha = d.fecha && d.fecha.toDate ? d.fecha.toDate().toLocaleDateString('es-AR') : '-';
            filas.push(`<tr style="border-bottom:1px solid #EDF2F7;">
                <td style="padding:10px 12px;font-weight:600;">${d.nombre || '-'}</td>
                <td style="padding:10px 12px;">
                    <span style="font-family:monospace;font-size:0.95rem;font-weight:600;color:#2D3748;">${d.dni || '—'}</span>
                </td>
                <td style="padding:10px 12px;">
                    <div style="font-weight:500;">${d.negocio || '-'}</div>
                    <div style="font-size:0.8rem;color:#718096;">CUIT: ${d.cuit || '—'}</div>
                </td>
                <td style="padding:10px 12px;">
                    <div style="font-weight:600;color:#3182CE;">${d.telefono || '-'}</div>
                    <div style="font-size:0.8rem;color:#718096;">${d.email || ''}</div>
                </td>
                <td style="padding:10px 12px;">
                    <div>${d.ciudad || '-'}</div>
                    <div style="font-size:0.8rem;color:#718096;">${d.direccion || ''}</div>
                </td>
                <td style="padding:10px 12px;font-size:0.82rem;color:#718096;">${fecha}</td>
                <td style="padding:10px 12px;">
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        <button onclick="aprobarSolicitud('${doc.id}')"
                            style="background:#38A169;color:white;border:none;padding:6px 12px;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.82rem;">
                            ✅ APROBAR
                        </button>
                        <button onclick="rechazarSolicitud('${doc.id}')"
                            style="background:#E53E3E;color:white;border:none;padding:6px 12px;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.82rem;">
                            ❌ RECHAZAR
                        </button>
                        <a href="https://wa.me/${encodeURI('')}${d.telefono ? d.telefono.replace(/\D/g,'') : ''}"
                            target="_blank"
                            style="background:#25D366;color:white;border:none;padding:6px 10px;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.82rem;text-decoration:none;display:inline-flex;align-items:center;gap:3px;">
                            💬 WA
                        </a>
                    </div>
                </td>
            </tr>`);
        });

        renderTablaUsuarios('tabla-solicitudes-pendientes', filas, '');
    } catch (err) {
        console.error(err);
        const el = document.getElementById('tabla-solicitudes-pendientes');
        if (el) el.innerHTML = '<p style="color:#E53E3E;text-align:center;">Error al cargar. Puede que falte el índice en Firestore.</p>';
    }
}

// ── Aprobar solicitud → crear usuario en Auth + Firestore ────────────────────
window.aprobarSolicitud = async function(solicitudId) {
    const datos = _solicitudesCache[solicitudId];
    if (!datos) { alert('Error: no se encontraron los datos. Recargá la página.'); return; }
    const pass = prompt(`Crear contraseña para ${datos.nombre} (${datos.email}):\n(Mínimo 6 caracteres)`, 'Enzo2025!');
    if (!pass || pass.length < 6) { alert('Contraseña inválida o cancelado.'); return; }

    try {
        // ── 1. Crear o recuperar cuenta en Firebase Auth ──────────────────────
        let newUid = null;
        try {
            const cred = await secondaryAuth.createUserWithEmailAndPassword(datos.email, pass);
            await cred.user.updateProfile({ displayName: datos.nombre });
            newUid = cred.user.uid;
        } catch (authErr) {
            if (authErr.code === 'auth/email-already-in-use') {
                // La cuenta ya existe en Auth — hacer login temporal para obtener el UID
                console.warn('Email ya existe en Auth. Obteniendo UID existente...');
                try {
                    const tempCred = await secondaryAuth.signInWithEmailAndPassword(datos.email, pass);
                    newUid = tempCred.user.uid;
                } catch (loginErr) {
                    // La contraseña ingresada no coincide con la existente en Auth
                    // Igual podemos crear el documento si tenemos el UID por otro medio
                    // Por ahora continuamos sin UID — el admin deberá reintentar con la contraseña correcta
                    console.warn('No se pudo obtener UID:', loginErr.message);
                }
            } else {
                throw authErr;
            }
        } finally {
            await secondaryAuth.signOut().catch(() => {});
        }

        if (!newUid) {
            throw new Error('No se pudo obtener el UID del usuario. Verificá que la contraseña sea correcta o que la cuenta no tenga otra contraseña ya asignada.');
        }

        // ── 2. Escribir en Firestore (batch atómico) ─────────────────────────
        const batch = db.batch();

        // Actualizar solicitud a "aprobado"
        batch.update(db.collection('solicitudes_acceso').doc(solicitudId), {
            estado:          'aprobado',
            aprobado:        true,
            fechaAprobacion: new Date(),
            uidAsignado:     newUid
        });

        // Crear documento en "usuarios" con TODOS los campos de la solicitud
        batch.set(db.collection('usuarios').doc(newUid), {
            nombre:          datos.nombre,
            email:           datos.email,
            dni:             datos.dni       || '',
            negocio:         datos.negocio   || '',
            telefono:        datos.telefono  || '',
            cuit:            datos.cuit      || '',
            ciudad:          datos.ciudad    || '',
            direccion:       datos.direccion || '',
            aprobado:        true,
            fechaAprobacion: new Date(),
            creadoPor:       'admin'
        }, { merge: true });

        // Índice de login público — solo contiene el email, sin datos sensibles
        // Permite al usuario no autenticado buscar su email por DNI para hacer login
        if (datos.dni) {
            const dniNorm = datos.dni.replace(/\D/g, '');
            batch.set(db.collection('login_index').doc(dniNorm), {
                email: datos.email
            });
        }

        await batch.commit();

        // Generar link de WhatsApp para notificar al cliente
        const tel    = (datos.telefono || '').replace(/\D/g, '');
        const telWA  = tel.startsWith('54') ? tel : '54' + tel;
        const dniMostrar = datos.dni ? `🪪 DNI: ${datos.dni}` : `📧 Email: ${datos.email}`;
        const mensaje = `Hola ${datos.nombre}! 🎉 Tu acceso a *Distribuciones Enzo* fue aprobado.\n\n` +
            `✅ Ingresá en: https://enzodistribuciones.com/cuenta.html\n\n` +
            `*Tus datos de acceso:*\n` +
            `${dniMostrar}\n` +
            `🔑 Contraseña: ${pass}\n\n` +
            `Si olvidás tu contraseña podés recuperarla desde la página de ingreso.\n\n` +
            `¡Bienvenido/a! 🛒`;

        alert(`✅ Solicitud de ${datos.nombre} aprobada.\n\nSe abrirá WhatsApp para notificarle.`);
        cargarSolicitudesPendientes();

        const wa = window.open(`https://wa.me/${telWA}?text=${encodeURIComponent(mensaje)}`, '_blank');
        if (!wa) window.location.href = `https://wa.me/${telWA}?text=${encodeURIComponent(mensaje)}`;

    } catch (err) {
        console.error(err);
        alert('Error al aprobar: ' + err.message);
    }
};

// ── Rechazar solicitud ────────────────────────────────────────────────────────
window.rechazarSolicitud = async function(solicitudId) {
    if (!confirm('¿Confirmar rechazo de esta solicitud?')) return;
    try {
        await db.collection('solicitudes_acceso').doc(solicitudId).update({
            estado: 'rechazado',
            fechaRechazo: new Date()
        });
        cargarSolicitudesPendientes();
    } catch (err) {
        alert('Error: ' + err.message);
    }
};

// ── Usuarios APROBADOS — lee de colección "usuarios" (fuente de verdad) ──────
async function cargarUsuariosAprobados() {
    const el = document.getElementById('tabla-usuarios-aprobados');
    if (el) el.innerHTML = '<p style="color:#718096;text-align:center;padding:20px;">Cargando...</p>';

    try {
        // Traer TODOS los usuarios (aprobados y revocados) — sin filtro
        const snap = await db.collection('usuarios').get();

        if (snap.empty) {
            renderTablaUsuarios('tabla-usuarios-aprobados', [], 'No hay usuarios registrados aún.');
            return;
        }

        const TH = `<thead><tr style="background:#F7FAFC;text-align:left;">
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Nombre</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Contacto</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Negocio / CUIT</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Ubicación</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Estado</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Acciones</th>
        </tr></thead>`;

        const filas = [TH];
        snap.forEach(doc => {
            const d   = doc.data();
            const uid = doc.id;
            const estaAprobado = d.aprobado === true;
            const fecha = d.fechaAprobacion && d.fechaAprobacion.toDate
                ? d.fechaAprobacion.toDate().toLocaleDateString('es-AR') : '-';

            const estadoBadge = estaAprobado
                ? `<span style="background:#C6F6D5;color:#22543D;padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;">✅ Activo</span>`
                : `<span style="background:#FED7AA;color:#744210;padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:700;">🔒 Revocado</span>`;

            const botonesAccion = estaAprobado
                ? `<button onclick="revocarAccesoUsuario('${uid}')"
                       style="background:#ED8936;color:white;border:none;padding:6px 10px;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.78rem;display:flex;align-items:center;gap:4px;">
                       <span class="material-icons" style="font-size:0.9rem;">block</span> REVOCAR
                   </button>`
                : `<button onclick="reactivarAccesoUsuario('${uid}', '${(d.nombre||'').replace(/'/g,'')}')"
                       style="background:#38A169;color:white;border:none;padding:6px 10px;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.78rem;display:flex;align-items:center;gap:4px;">
                       <span class="material-icons" style="font-size:0.9rem;">check_circle</span> REACTIVAR
                   </button>`;

            filas.push(`<tr style="border-bottom:1px solid #EDF2F7;opacity:${estaAprobado ? '1' : '0.65'};">
                <td style="padding:10px 12px;font-weight:600;">${d.nombre || '-'}</td>
                <td style="padding:10px 12px;">
                    <div style="color:#3182CE;font-size:0.9rem;">${d.email || '-'}</div>
                    <div style="color:#38A169;font-size:0.82rem;margin-top:2px;">📱 ${d.telefono || '-'}</div>
                    <div style="color:#718096;font-size:0.78rem;margin-top:1px;">🪪 DNI: ${d.dni || '—'}</div>
                </td>
                <td style="padding:10px 12px;">
                    <div style="font-weight:500;">${d.negocio || '-'}</div>
                    <div style="font-size:0.8rem;color:#718096;margin-top:2px;">CUIT: ${d.cuit || '—'}</div>
                </td>
                <td style="padding:10px 12px;font-size:0.88rem;">
                    <div>${d.ciudad || '-'}</div>
                    <div style="color:#718096;font-size:0.8rem;">${d.direccion || ''}</div>
                </td>
                <td style="padding:10px 12px;">
                    ${estadoBadge}
                    <div style="font-size:0.75rem;color:#718096;margin-top:4px;">${fecha}</div>
                </td>
                <td style="padding:10px 12px;">
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${botonesAccion}
                        <button onclick="eliminarCuentaUsuario('${uid}', '${(d.nombre||'').replace(/'/g,'')}', '${d.email||''}')"
                            style="background:#E53E3E;color:white;border:none;padding:6px 10px;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.78rem;display:flex;align-items:center;gap:4px;">
                            <span class="material-icons" style="font-size:0.9rem;">delete</span> ELIMINAR
                        </button>
                    </div>
                </td>
            </tr>`);
        });

        renderTablaUsuarios('tabla-usuarios-aprobados', filas, 'No hay usuarios registrados aún.');
    } catch (err) {
        console.error(err);
        document.getElementById('tabla-usuarios-aprobados').innerHTML =
            '<p style="color:#E53E3E;text-align:center;padding:20px;">Error al cargar: ' + err.message + '</p>';
    }
}

// ── Revocar acceso (desactiva sin borrar) ─────────────────────────────────────
window.revocarAccesoUsuario = async function(uid) {
    if (!confirm('¿Revocar el acceso? El usuario dejará de ver precios pero su cuenta se conserva.')) return;
    try {
        await db.collection('usuarios').doc(uid).update({ aprobado: false });
        mostrarNotificacionAdmin('✅ Acceso revocado. El usuario ya no verá precios.');
        cargarUsuariosAprobados();
    } catch (err) { alert('Error: ' + err.message); }
};

// ── Reactivar acceso ──────────────────────────────────────────────────────────
window.reactivarAccesoUsuario = async function(uid, nombre) {
    if (!confirm(`¿Reactivar el acceso de ${nombre}? Volverá a ver precios VIP.`)) return;
    try {
        await db.collection('usuarios').doc(uid).update({
            aprobado:        true,
            fechaAprobacion: new Date()
        });
        mostrarNotificacionAdmin(`✅ Acceso de ${nombre} reactivado correctamente.`);
        cargarUsuariosAprobados();
    } catch (err) { alert('Error: ' + err.message); }
};

// ── Eliminar cuenta completamente ─────────────────────────────────────────────
window.eliminarCuentaUsuario = async function(uid, nombre, email) {
    const confirmar = await confirmarAccion({
        icono: '🗑️', titulo: 'Eliminar cuenta de usuario',
        mensaje: `Se eliminará a ${nombre} (${email}). La cuenta de Auth debe borrarse manualmente desde Firebase Console.`,
        textoBtn: 'Sí, eliminar', colorBtn: '#E53E3E'
    });
    if (!confirmar) return;

    try {
        // 1. Borrar documento en "usuarios"
        await db.collection('usuarios').doc(uid).delete();

        // 2. Borrar solicitud relacionada (si existe)
        const solSnap = await db.collection('solicitudes_acceso')
            .where('email', '==', email).get();
        const batch = db.batch();
        solSnap.forEach(doc => batch.delete(doc.ref));
        if (!solSnap.empty) await batch.commit();

        mostrarNotificacionAdmin(`✅ Cuenta de ${nombre} eliminada de Firestore.`);
        cargarUsuariosAprobados();

        // Aviso para Auth
        setTimeout(() => {
            alert(
                `✅ Documento eliminado de Firestore.\n\n` +
                `⚠️ Para eliminar completamente la cuenta de Firebase Auth:\n` +
                `Firebase Console → Authentication → buscá "${email}" → eliminá.`
            );
        }, 800);

    } catch (err) {
        alert('Error al eliminar: ' + err.message);
        console.error(err);
    }
};

// ── Solicitudes RECHAZADAS ────────────────────────────────────────────────────
async function cargarSolicitudesRechazadas() {
    const el = document.getElementById('tabla-solicitudes-rechazadas');
    if (el) el.innerHTML = '<p style="color:#718096;text-align:center;padding:20px;">Cargando...</p>';

    try {
        const snap = await db.collection('solicitudes_acceso').where('estado','==','rechazado').orderBy('fecha','desc').get();

        const TH = `<thead><tr style="background:#F7FAFC;text-align:left;">
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Nombre</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Email</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Negocio</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Fecha</th>
            <th style="padding:10px 12px;border-bottom:2px solid #E2E8F0;">Acciones</th>
        </tr></thead>`;

        const filas = [TH];
        snap.forEach(doc => {
            const d = doc.data();
            _solicitudesCache[doc.id] = d;
            const fecha = d.fecha && d.fecha.toDate ? d.fecha.toDate().toLocaleDateString('es-AR') : '-';
            filas.push(`<tr style="border-bottom:1px solid #EDF2F7;opacity:0.7;">
                <td style="padding:10px 12px;">${d.nombre || '-'}</td>
                <td style="padding:10px 12px;">${d.email || '-'}</td>
                <td style="padding:10px 12px;">${d.negocio || '-'}</td>
                <td style="padding:10px 12px;font-size:0.82rem;color:#718096;">${fecha}</td>
                <td style="padding:10px 12px;">
                    <button onclick="reactivarSolicitud('${doc.id}')"
                        style="background:#3182CE;color:white;border:none;padding:6px 12px;border-radius:6px;font-weight:700;cursor:pointer;font-size:0.82rem;">
                        🔄 REACTIVAR
                    </button>
                </td>
            </tr>`);
        });

        renderTablaUsuarios('tabla-solicitudes-rechazadas', filas, 'No hay solicitudes rechazadas.');
    } catch (err) {
        console.error(err);
    }
}

window.reactivarSolicitud = async function(id) {
    await db.collection('solicitudes_acceso').doc(id).update({ estado: 'pendiente' });
    cargarSolicitudesRechazadas();
};

// ── Modal: Cargar usuario MANUALMENTE ─────────────────────────────────────────
window.abrirModalCargarUsuario = function() {
    const modal = document.getElementById('modal-cargar-usuario');
    if (modal) modal.style.display = 'flex';
};

window.cerrarModalUsuario = function() {
    const modal = document.getElementById('modal-cargar-usuario');
    if (modal) { modal.style.display = 'none'; document.getElementById('form-crear-usuario').reset(); }
};

const formCrearUsuario = document.getElementById('form-crear-usuario');
if (formCrearUsuario) {
    formCrearUsuario.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn      = document.getElementById('usr-submit-btn');
        const errDiv   = document.getElementById('usr-error');
        const nombre   = document.getElementById('usr-nombre')?.value.trim()   || '';
        const dni      = document.getElementById('usr-dni')?.value.trim()      || '';
        const email    = document.getElementById('usr-email')?.value.trim().toLowerCase() || '';
        const pass     = document.getElementById('usr-pass')?.value.trim()     || '';
        const negocio  = document.getElementById('usr-negocio')?.value.trim()  || '';
        const cuit     = document.getElementById('usr-cuit')?.value.trim()     || '';
        const telefono = document.getElementById('usr-telefono')?.value.trim() || '';
        const ciudad   = document.getElementById('usr-ciudad')?.value.trim()   || '';
        const direccion= document.getElementById('usr-direccion')?.value.trim()|| '';

        // Validación
        if (errDiv) errDiv.style.display = 'none';
        if (!nombre || !dni || !email || !pass || !negocio) {
            if (errDiv) { errDiv.textContent = '⚠️ Nombre, DNI, Email, Contraseña y Negocio son obligatorios.'; errDiv.style.display = 'block'; }
            return;
        }
        if (pass.length < 6) {
            if (errDiv) { errDiv.textContent = '⚠️ La contraseña debe tener al menos 6 caracteres.'; errDiv.style.display = 'block'; }
            return;
        }
        const dniNorm = dni.replace(/\D/g, '');
        if (dniNorm.length < 7 || dniNorm.length > 8) {
            if (errDiv) { errDiv.textContent = '⚠️ El DNI debe tener 7 u 8 dígitos.'; errDiv.style.display = 'block'; }
            return;
        }

        try {
            btn.textContent = 'Creando...'; btn.disabled = true;

            // ── 1. Crear cuenta en Firebase Auth ──────────────────────────────
            let newUid = null;
            try {
                const cred = await secondaryAuth.createUserWithEmailAndPassword(email, pass);
                await cred.user.updateProfile({ displayName: nombre });
                newUid = cred.user.uid;
            } catch (authErr) {
                if (authErr.code === 'auth/email-already-in-use') {
                    try {
                        const tempCred = await secondaryAuth.signInWithEmailAndPassword(email, pass);
                        newUid = tempCred.user.uid;
                    } catch(e) { console.warn('No se pudo obtener UID:', e.message); }
                } else { throw authErr; }
            } finally {
                await secondaryAuth.signOut().catch(() => {});
            }

            if (!newUid) throw new Error('No se pudo crear la cuenta. Verificá email y contraseña.');

            // ── 2. Batch: usuarios + login_index + solicitudes_acceso ─────────
            const batch = db.batch();

            batch.set(db.collection('usuarios').doc(newUid), {
                nombre, email, dni: dniNorm, negocio, cuit,
                telefono, ciudad, direccion,
                aprobado:        true,
                fechaAprobacion: new Date(),
                creadoPor:       'admin-manual'
            }, { merge: true });

            // Índice de login por DNI (permite login sin estar autenticado)
            batch.set(db.collection('login_index').doc(dniNorm), { email });

            // Historial en solicitudes_acceso
            batch.set(db.collection('solicitudes_acceso').doc(), {
                nombre, email, dni: dniNorm, negocio, cuit,
                telefono, ciudad, direccion,
                estado: 'aprobado', aprobado: true,
                fecha: new Date(), fechaAprobacion: new Date(),
                creadoPor: 'admin-manual'
            });

            await batch.commit();

            // ── 3. WhatsApp de bienvenida ─────────────────────────────────────
            const tel   = telefono.replace(/\D/g, '');
            const telWA = tel.startsWith('54') ? tel : '54' + tel;
            const msj   = `Hola ${nombre}! 🎉 Tu acceso a *Distribuciones Enzo* fue creado.\n\n` +
                          `✅ Ingresá en: https://enzodistribuciones.com/cuenta.html\n\n` +
                          `*Tus datos de acceso:*\n` +
                          `🪪 DNI: ${dniNorm}\n` +
                          `🔑 Contraseña: ${pass}\n\n` +
                          `¡Bienvenido/a al catálogo mayorista! 🛒`;

            cerrarModalUsuario();
            mostrarNotificacionAdmin(`✅ Usuario "${nombre}" creado correctamente.`);
            cargarUsuariosAprobados();

            if (tel.length >= 8) {
                setTimeout(() => window.open(`https://wa.me/${telWA}?text=${encodeURIComponent(msj)}`, '_blank'), 500);
            }

        } catch (err) {
            console.error(err);
            alert('Error al crear usuario: ' + err.message);
        } finally {
            btn.textContent = '✅ CREAR Y APROBAR'; btn.disabled = false;
        }
    });
}

// ── Cargar sección usuarios cuando se navega a ella ──────────────────────────
// (Se integra con el mostrarSeccion() existente en admin.js)
const _mostrarSeccionOriginal = window.mostrarSeccion;
window.mostrarSeccion = function(seccion) {
    if (typeof _mostrarSeccionOriginal === 'function') _mostrarSeccionOriginal(seccion);
    if (seccion === 'usuarios') {
        cargarSolicitudesPendientes();
    }
};