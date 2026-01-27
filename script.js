/* ==========================================================================
   1. BASE DE DATOS (INVENTARIO)
   Esta es la "memoria" del sitio. Aquí viven todos los datos de los productos.
   ========================================================================== */
const inventario = [
    { 
        id: 1, 
        nombre: "Taladro Percutor 13mm 700W", 
        marca: "MAKITA", 
        precio: 125000, 
        imagen: "./Productos en stoks/Taladro Percutor 13mm 700W.webp", 
        categoria: "electricas", 
        enOferta: true,
        descripcion: "Taladro percutor ideal para uso profesional. Cuenta con velocidad variable y reversible, empuñadura ergonómica y diseño robusto para mayor durabilidad en obra.",
        ficha: { "Potencia": "700W", "Mandril": "13mm", "Velocidad": "3000 RPM", "Peso": "2.1 Kg" }
    },
    { 
        id: 2, 
        nombre: "Amoladora Angular 4-1/2\"", 
        marca: "BLACK+DECKER", 
        precio: 68500, 
        imagen: "./Productos en stoks/Amoladora Angular.jpg", 
        categoria: "electricas",
        enOferta: true,
        descripcion: "Potente motor de 820W. Traba de eje para cambio fácil de disco. Caja de engranajes metálica para mayor durabilidad y vida útil.",
        ficha: { "Potencia": "820W", "Disco": "115mm", "Velocidad": "11000 RPM" }
    },
    { 
        id: 3, 
        nombre: "Cinta Métrica 5m", 
        marca: "STANLEY", 
        precio: 15200, 
        imagen: "./Productos en stoks/cinta metrica.jpg", 
        categoria: "medicion",
        enOferta: true,
        descripcion: "Cinta métrica con recubrimiento de nylon para mayor vida útil. Gancho Cero-Absoluto para mediciones precisas internas y externas."
    },
    { 
        id: 4, 
        nombre: "Set Destornilladores 10pz", 
        marca: "STANLEY", 
        precio: 25000, 
        imagen: "./Productos en stoks/Set de Destornilladores 10 piezas.webp", 
        categoria: "manuales",
        enOferta: false,
        descripcion: "Juego versátil de destornilladores planos y phillips. Barras de acero al cromo vanadio y mangos ergonómicos antideslizantes."
    },
    { 
        id: 5, 
        nombre: "Compresor de Aire 6L", 
        marca: "STANLEY", 
        precio: 85000, 
        imagen: "./Productos en stoks/Compresor de Aire 6 Litros.webp", 
        categoria: "neumaticas", 
        enOferta: false,
        descripcion: "Compresor portátil, libre de aceite. Ideal para tareas domésticas, inflado, limpieza y uso con clavadoras neumáticas pequeñas.",
        ficha: { "Capacidad": "6 Litros", "Presión": "8 Bar", "Motor": "1.5 HP" }
    },
    { 
        id: 6, 
        nombre: "Lijadora Orbital 1/4 Sheet", 
        marca: "STANLEY", 
        precio: 45000, 
        imagen: "./Productos en stoks/Lijadora Orbital 1)4 Sheet.webp", 
        categoria: "electricas",
        enOferta: false,
        descripcion: "Lijadora compacta para terminaciones finas en madera. Sistema de clips para lija y bolsa recolectora de polvo."
    },
    { 
        id: 7, 
        nombre: "Multímetro Digital", 
        marca: "STANLEY", 
        precio: 35000, 
        imagen: "./Productos en stoks/Multímetro Digital.webp", 
        categoria: "medicion",
        enOferta: false,
        descripcion: "Instrumento de medición robusto. Mide voltaje AC/DC, corriente DC, resistencia y continuidad. Pantalla LCD grande."
    },
    { 
        id: 8, 
        nombre: "Sierra Circular 7 1/4\"", 
        marca: "STANLEY", 
        precio: 95000, 
        imagen: "./Productos en stoks/Sierra Circular 7 1)4 pulgada.webp", 
        categoria: "electricas",
        enOferta: false,
        descripcion: "Sierra potente de 1600W. Ajuste rápido de profundidad y ángulo de corte. Incluye disco de carburo de tungsteno."
    },
    { 
        id: 9, 
        nombre: "Taladro Inalámbrico 20V", 
        marca: "DEWALT", 
        precio: 220000, 
        imagen: "./Productos en stoks/Taladro Inalámbrico 20V.jpg", 
        categoria: "inalambricas",
        enOferta: true,
        descripcion: "Tecnología Brushless (sin carbones) para mayor autonomía. Batería de Ion-Litio de carga rápida. Diseño compacto y ligero.",
        ficha: { "Voltaje": "20V", "Batería": "Ion-Litio", "Mandril": "13mm" }
    },
    { 
        id: 10, 
        nombre: "Pistola de Calor 1500W", 
        marca: "WAGNER", 
        precio: 85000, 
        imagen: "./Productos en stoks/Pistola de Calor 1500W.webp", 
        categoria: "electricas",
        enOferta: false,
        descripcion: "Herramienta térmica para decapar pintura, descongelar tuberías y secar superficies. Dos niveles de temperatura."
    },
    { 
        id: 11, 
        nombre: "Atornillador Inalámbrico 12V", 
        marca: "STANLEY", 
        precio: 85000, 
        imagen: "./Productos en stoks/Atornillador Inalámbrico 12V.jpg", 
        categoria: "inalambricas",
        enOferta: false,
        descripcion: "Diseño ligero y compacto para lugares estrechos. Control de torque de 20 posiciones para atornillado preciso."
    },
    { 
        id: 12, 
        nombre: "Martillo de Uña 16oz", 
        marca: "STANLEY", 
        precio: 22000, 
        imagen: "./Productos en stoks/Martillo de Uña 16oz.webp", 
        categoria: "manuales",
        enOferta: false,
        descripcion: "Cabeza de acero forjado con tratamiento térmico. Mango de fibra de vidrio que reduce las vibraciones."
    },
    { 
        id: 13, 
        nombre: "Nivel de Burbuja 24\"", 
        marca: "STANLEY", 
        precio: 18500, 
        imagen: "./Productos en stoks/Nivel de Burbuja 24 pulgadas.webp", 
        categoria: "medicion",
        enOferta: false,
        descripcion: "Cuerpo de aluminio reforzado. Burbujas de fácil lectura (plomada, nivel y 45 grados). Extremos protegidos."
    },
    { 
        id: 14, 
        nombre: "Cinta Aisladora 19mm", 
        marca: "STANLEY", 
        precio: 5500, 
        imagen: "./Productos en stoks/Cinta Aisladora 19mm x 10m.jpg", 
        categoria: "cintas",
        enOferta: false,
        descripcion: "Cinta de PVC de uso general para aislación eléctrica. Resistente a la abrasión, humedad y corrosión."
    },
    {
        id: 15,
        nombre: "Pintura Vinílica 1 Galón",
        marca: "Pintuco",
        precio: 45000,
        imagen: "./Productos en stoks/Pintura Vinílica 1 Galón.jpg",
        categoria: "interior/latex",
        enOferta: true,
        descripcion: "Pintura vinílica de alta calidad para interiores. Fácil aplicación, secado rápido y excelente cobertura.",
        ficha: { "Rendimiento": "40 m²/gal", "Secado": "30 min", "Acabado": "Mate" }
    }
];

/* ==========================================================================
   2. ESTADO GLOBAL DE LA APLICACIÓN
   Aquí guardamos filtros, paginación y el carrito de compras.
   ========================================================================== */
let estado = {
    paginaActual: 1,
    productosPorPagina: 9, 
    categoria: 'all',
    precioMin: 0,
    precioMax: 99999999,
    soloOfertas: false,
    productosFiltrados: []
};

// Cargar carrito desde la memoria (LocalStorage) o iniciar vacío
let carrito = JSON.parse(localStorage.getItem('carritoEnzo')) || [];


/* ==========================================================================
   3. INICIALIZACIÓN (AL CARGAR LA PÁGINA)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', function() {
    
    // Identificamos en qué página estamos
    const contenedorOfertas = document.getElementById('contenedor-ofertas');     // Index
    const contenedorProductos = document.getElementById('contenedor-productos'); // Catálogo
    const detailContainer = document.getElementById('detail-container');         // Detalle

    // Actualizamos el número rojo del carrito al entrar
    actualizarBadgeCarrito();

    // ------------------------------------------------
    // CASO 1: ESTAMOS EN EL HOME (INDEX)
    // ------------------------------------------------
    if (contenedorOfertas) {
        // Mostramos solo las ofertas destacadas
        const ofertas = inventario.filter(p => p.enOferta === true);
        renderizarGrid(ofertas, contenedorOfertas);
    }
    verificarSesionUsuario();
    // ------------------------------------------------
    // CASO 2: ESTAMOS EN EL CATÁLOGO (PRODUCTOS)
    // ------------------------------------------------
    if (contenedorProductos) {
        estado.productosFiltrados = inventario;

        // ¿Venimos con una orden desde el Home? (URL Params)
        const params = new URLSearchParams(window.location.search);
        
        // A. Orden: Mostrar solo ofertas
        if (params.get('filter') === 'ofertas') {
            estado.soloOfertas = true;
            actualizarBotonOfertaVisualmente();
            const titulo = document.getElementById('titulo-catalogo');
            if(titulo) titulo.textContent = "Ofertas Especiales";
        }
        
        // B. Orden: Mostrar una categoría específica
        const urlCat = params.get('category');
        if (urlCat) {
            estado.categoria = urlCat;
            const titulo = document.getElementById('titulo-catalogo');
            if(titulo) titulo.textContent = "Categoría: " + urlCat.toUpperCase();
        }

        aplicarFiltrosGlobales();
        configurarListenersSidebar();
    }

    // ------------------------------------------------
    // CASO 3: ESTAMOS EN EL DETALLE DE PRODUCTO
    // ------------------------------------------------
    if (detailContainer) {
        cargarDetalleProducto();
        setTimeout(() => detailContainer.classList.add('visible'), 50);
    }

    // ------------------------------------------------
    // CARGAR INTERFAZ COMÚN (Menú, Carrito, etc.)
    // ------------------------------------------------
    iniciarInterfaz();
    configurarEventosCarrito(); // Activamos botones del carrito
    console.log("Sistema cargado correctamente."); 
});


/* ==========================================================================
   4. LÓGICA DE FILTRADO (SIDEBAR)
   ========================================================================== */

function configurarListenersSidebar() {
    const titulo = document.getElementById('titulo-catalogo');

    // A. Categorías
    document.querySelectorAll('.btn-cat').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const cat = btn.getAttribute('data-category');
            estado.categoria = cat;
            
            // Si elige "Ver Todo", reseteamos ofertas y precios
            if (cat === 'all') {
                estado.soloOfertas = false;
                estado.precioMin = 0;
                estado.precioMax = 99999999;
                actualizarBotonOfertaVisualmente();
                resetearBotonesPrecio();
                if (titulo) titulo.textContent = "Catálogo Completo";
            } else {
                // Título Padre / Hijo
                if (titulo) {
                    const padre = btn.closest('.main-cat-item');
                    if (padre) {
                        const linkPadre = padre.querySelector('.main-cat-link');
                        const nombrePadre = linkPadre.firstChild.textContent.trim();
                        titulo.textContent = `${nombrePadre} / ${btn.innerText}`;
                    } else {
                        titulo.textContent = btn.innerText;
                    }
                }
            }

            estado.paginaActual = 1;
            aplicarFiltrosGlobales();
            cerrarSidebarMovil();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // B. Precios (Con lógica de interruptor)
    const botonesPrecio = document.querySelectorAll('.btn-precio');
    botonesPrecio.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const minClic = Number(btn.getAttribute('data-min'));
            const maxClic = Number(btn.getAttribute('data-max'));

            // Si toca el mismo que ya está activo, lo apagamos
            if (estado.precioMin === minClic && estado.precioMax === maxClic) {
                estado.precioMin = 0;
                estado.precioMax = 99999999;
                btn.style.fontWeight = 'normal';
                btn.style.color = '#555';
            } else {
                // Si es nuevo, lo prendemos y apagamos los demás
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

    // C. Ofertas
    const btnOferta = document.getElementById('btn-filtro-ofertas');
    if (btnOferta) {
        btnOferta.addEventListener('click', (e) => {
            e.preventDefault();
            estado.soloOfertas = !estado.soloOfertas;
            actualizarBotonOfertaVisualmente();

            if (titulo) {
                if (estado.soloOfertas) titulo.textContent = "Ofertas Especiales";
                else if (estado.categoria === 'all') titulo.textContent = "Catálogo Completo";
            }

            estado.paginaActual = 1;
            aplicarFiltrosGlobales();
            cerrarSidebarMovil();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

// Helpers visuales para filtros
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

// FUNCIÓN MAESTRA DE FILTRADO
function aplicarFiltrosGlobales() {
    const resultado = inventario.filter(prod => {
        const pasaCat = (estado.categoria === 'all') || (prod.categoria === estado.categoria);
        const pasaPrecio = (prod.precio >= estado.precioMin && prod.precio <= estado.precioMax);
        const pasaOferta = estado.soloOfertas ? (prod.enOferta === true) : true;
        return pasaCat && pasaPrecio && pasaOferta;
    });

    estado.productosFiltrados = resultado;
    gestionarPaginacion();
}


/* ==========================================================================
   5. PAGINACIÓN Y RENDERIZADO
   ========================================================================== */
function gestionarPaginacion() {
    const contenedor = document.getElementById('contenedor-productos');
    const contenedorPaginacion = document.querySelector('.pagination-container');
    
    // Cálculos
    const inicio = (estado.paginaActual - 1) * estado.productosPorPagina;
    const fin = inicio + estado.productosPorPagina;
    const productosPagina = estado.productosFiltrados.slice(inicio, fin);
    
    renderizarGrid(productosPagina, contenedor);

    // Botones 1, 2, 3...
    const totalPaginas = Math.ceil(estado.productosFiltrados.length / estado.productosPorPagina);
    let htmlBotones = '';

    if (totalPaginas > 1) {
        if (estado.paginaActual > 1) htmlBotones += `<button class="page-btn" onclick="cambiarPagina(${estado.paginaActual - 1})"><</button>`;
        for (let i = 1; i <= totalPaginas; i++) {
            const clase = (i === estado.paginaActual) ? 'active' : '';
            htmlBotones += `<button class="page-btn ${clase}" onclick="cambiarPagina(${i})">${i}</button>`;
        }
        if (estado.paginaActual < totalPaginas) htmlBotones += `<button class="page-btn" onclick="cambiarPagina(${estado.paginaActual + 1})">></button>`;
    }
    
    if (contenedorPaginacion) contenedorPaginacion.innerHTML = htmlBotones;
}

// Cambio de página con animación suave
window.cambiarPagina = function(num) {
    const contenedor = document.getElementById('contenedor-productos');
    contenedor.classList.add('loading'); // Fade Out
    setTimeout(() => {
        estado.paginaActual = num;
        gestionarPaginacion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => contenedor.classList.remove('loading'), 50); // Fade In
    }, 300);
};

/* (RENDERIZAR GRID) - VERSIÓN CORREGIDA
========================================================================== */
function renderizarGrid(lista, contenedor) {
    contenedor.innerHTML = ''; 

    if (lista.length === 0) {
        contenedor.innerHTML = '<div style="width:100%; text-align:center; padding:50px;"><h3>No se encontraron productos.</h3><p>Intenta quitar algunos filtros.</p></div>';
        return;
    }

    lista.forEach(prod => {
        const link = `detalle.html?id=${prod.id}`;
        
        // Creamos un ID único para el input de esta tarjeta (ej: qty-1, qty-5)
        const inputId = `qty-${prod.id}`;

        const html = `
            <article class="product-card">
                <a href="${link}" style="text-decoration:none; color:inherit; display:block;">
                    <div class="card-image">
                        <img src="${prod.imagen}" alt="${prod.nombre}">
                    </div>
                    <div class="card-info">
                        <span class="brand">${prod.marca}</span>
                        <h3>${prod.nombre}</h3>
                        <div class="price">$${prod.precio.toLocaleString('es-AR')}</div>
                    </div>
                </a>
                
                <div class="card-info">
                    <div class="card-actions">
                        <div class="quantity-selector">
                            <button onclick="modificarCantidadTarjeta('${inputId}', -1)">-</button>
                            
                            <input type="text" id="${inputId}" value="1" readonly>
                            
                            <button onclick="modificarCantidadTarjeta('${inputId}', 1)">+</button>
                        </div>
                        
                        <button class="add-btn" onclick="agregarDesdeTarjeta(${prod.id}, '${inputId}')">AGREGAR</button>
                    </div>
                </div>
            </article>
        `;
        contenedor.innerHTML += html;
    });
}

// --- NUEVAS FUNCIONES AUXILIARES PARA LAS TARJETAS ---

// 1. Sube o baja el número visualmente en la tarjeta
function modificarCantidadTarjeta(inputId, cambio) {
    const input = document.getElementById(inputId);
    if (input) {
        let valorActual = parseInt(input.value);
        let nuevoValor = valorActual + cambio;
        
        // Evitamos que baje de 1
        if (nuevoValor >= 1) {
            input.value = nuevoValor;
        }
    }
}

// 2. Lee el número y lo manda al carrito
function agregarDesdeTarjeta(idProducto, inputId) {
    const input = document.getElementById(inputId);
    const cantidad = input ? parseInt(input.value) : 1;
    
    agregarAlCarrito(idProducto, cantidad);
}


/* ==========================================================================
   6. DETALLE DEL PRODUCTO
   ========================================================================== */
function cargarDetalleProducto() {
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'));
    const producto = inventario.find(p => p.id === id);

    if (producto) {
        document.getElementById('detail-image').src = producto.imagen;
        document.getElementById('detail-brand').textContent = producto.marca;
        document.getElementById('detail-name').textContent = producto.nombre;
        document.getElementById('detail-price').textContent = "$" + producto.precio.toLocaleString('es-AR');
        document.getElementById('detail-desc').textContent = producto.descripcion || "Sin descripción.";
        
        if (producto.enOferta) {
            const tag = document.getElementById('offer-tag');
            if(tag) tag.style.display = 'inline-block';
        }

        const specs = document.getElementById('specs-container');
        if (producto.ficha && specs) {
            let html = '<table class="specs-table"><tbody>';
            for (const [k, v] of Object.entries(producto.ficha)) {
                html += `<tr><td>${k}</td><td>${v}</td></tr>`;
            }
            html += '</tbody></table>';
            specs.innerHTML = html;
        }

        // Lógica de cantidad en el detalle
        const inputQty = document.querySelector('.big-selector input');
        const btnMinus = document.querySelector('.big-selector button:first-child');
        const btnPlus = document.querySelector('.big-selector button:last-child');
        const btnAdd = document.getElementById('detail-add-btn');

        if(btnMinus && btnPlus && inputQty) {
            btnMinus.onclick = () => { if(inputQty.value > 1) inputQty.value--; };
            btnPlus.onclick = () => { inputQty.value++; };
        }

        if(btnAdd) {
            btnAdd.onclick = () => {
                const qty = parseInt(inputQty.value) || 1;
                agregarAlCarrito(producto.id, qty);
            };
        }
        document.title = producto.nombre + " - Ferretería Enzo";
    } else {
        document.getElementById('detail-container').innerHTML = "<h2 style='text-align:center; padding:50px;'>Producto no encontrado</h2>";
    }
}


/* ==========================================================================
   7. LÓGICA DEL CARRITO (CARRITO DE COMPRAS)
   ========================================================================== */

// Función principal para agregar productos
function agregarAlCarrito(id, cantidad = 1) {
    const producto = inventario.find(p => p.id === id);
    const itemEnCarrito = carrito.find(p => p.id === id);

    if (itemEnCarrito) {
        itemEnCarrito.cantidad += cantidad;
    } else {
        carrito.push({ ...producto, cantidad: cantidad });
    }

    guardarCarrito();
    actualizarBadgeCarrito();
    
    // Feedback: Abrir cajón y mostrar notificación
    renderizarCarrito();
    abrirCarrito();
    mostrarNotificacion(`¡${producto.nombre} agregado!`);
}

function eliminarDelCarrito(id) {
    carrito = carrito.filter(p => p.id !== id);
    guardarCarrito();
    renderizarCarrito();
    actualizarBadgeCarrito();
}

function cambiarCantidadCarrito(id, operacion) {
    const item = carrito.find(p => p.id === id);
    if (item) {
        if (operacion === 'sumar') item.cantidad++;
        if (operacion === 'restar' && item.cantidad > 1) item.cantidad--;
        guardarCarrito();
        renderizarCarrito();
        actualizarBadgeCarrito();
    }
}

function vaciarCarrito() {
    carrito = [];
    guardarCarrito();
    renderizarCarrito();
    actualizarBadgeCarrito();
}

function guardarCarrito() {
    localStorage.setItem('carritoEnzo', JSON.stringify(carrito));
}

function actualizarBadgeCarrito() {
    const total = carrito.reduce((acc, item) => acc + item.cantidad, 0);
    document.querySelectorAll('.badge').forEach(b => b.textContent = total);
}

// Renderizar el contenido HTML del cajón lateral
function renderizarCarrito() {
    const contenedor = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total-price');
    const countEl = document.getElementById('cart-count-header');
    
    contenedor.innerHTML = '';
    let totalPrecio = 0;
    let totalItems = 0;

    if (carrito.length === 0) {
        contenedor.innerHTML = '<div style="text-align:center; padding:20px; color:#999;"><span class="material-icons" style="font-size:3rem;">shopping_cart_off</span><p>Tu carrito está vacío</p></div>';
    } else {
        carrito.forEach(item => {
            totalPrecio += item.precio * item.cantidad;
            totalItems += item.cantidad;
            
            const html = `
                <div class="cart-item">
                    <img src="${item.imagen}" alt="${item.nombre}">
                    <div class="cart-item-info">
                        <div class="cart-item-title">${item.nombre}</div>
                        <div class="cart-item-price">$${(item.precio * item.cantidad).toLocaleString('es-AR')}</div>
                        <div class="cart-item-controls">
                            <div class="cart-qty-box">
                                <button onclick="cambiarCantidadCarrito(${item.id}, 'restar')">-</button>
                                <span>${item.cantidad}</span>
                                <button onclick="cambiarCantidadCarrito(${item.id}, 'sumar')">+</button>
                            </div>
                            <span class="material-icons btn-remove" onclick="eliminarDelCarrito(${item.id})">delete</span>
                        </div>
                    </div>
                </div>`;
            contenedor.innerHTML += html;
        });
    }
    
    if(totalEl) totalEl.textContent = `$${totalPrecio.toLocaleString('es-AR')}`;
    if(countEl) countEl.textContent = `(${totalItems})`;
}

// Abrir y Cerrar Carrito
function configurarEventosCarrito() {
    const cartIcons = document.querySelectorAll('.cart-icon');
    const closeBtn = document.getElementById('close-cart-btn');
    const clearBtn = document.getElementById('btn-clear-cart');
    const overlay = document.getElementById('cart-overlay');

    cartIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            renderizarCarrito();
            abrirCarrito();
        });
    });

    if(closeBtn) closeBtn.addEventListener('click', cerrarCarrito);
    if(overlay) overlay.addEventListener('click', cerrarCarrito);
    if(clearBtn) clearBtn.addEventListener('click', vaciarCarrito);
}

function abrirCarrito() {
    document.getElementById('cart-drawer').classList.add('active');
    document.getElementById('cart-overlay').classList.add('active');
}

function cerrarCarrito() {
    document.getElementById('cart-drawer').classList.remove('active');
    document.getElementById('cart-overlay').classList.remove('active');
}

function mostrarNotificacion(msj) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toast-message');
    if(toast && msg) {
        msg.textContent = msj;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}


/* ==========================================================================
   8. INTERFAZ COMÚN
   ========================================================================== */
function iniciarInterfaz() {
    // Menú Móvil
    const btnMenu = document.getElementById('mobile-menu-btn');
    const nav = document.getElementById('main-nav');
    if (btnMenu) btnMenu.addEventListener('click', () => nav.classList.toggle('active'));

    // Sidebar Filtros
    const btnFilter = document.getElementById('filter-btn');
    const sidebar = document.getElementById('sidebar-filters');
    const btnClose = document.getElementById('close-filter-btn');
    if (btnFilter) btnFilter.addEventListener('click', () => sidebar.classList.add('active'));
    if (btnClose) btnClose.addEventListener('click', () => sidebar.classList.remove('active'));

    // Acordeón
    document.querySelectorAll('.main-cat-link').forEach(header => {
        header.addEventListener('click', function() {
            if (this.classList.contains('btn-cat')) return;
            const sub = this.nextElementSibling;
            if (sub && sub.classList.contains('sub-category-list')) {
                sub.classList.toggle('open');
                const arrow = this.querySelector('.material-icons');
                if (arrow) arrow.classList.toggle('rotate-icon');
            }
        });
    });
}

function cerrarSidebarMovil() {
    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar-filters');
        if(sidebar) sidebar.classList.remove('active');
    }
}

/* ==========================================================================
   9. BUSCADOR PREDICTIVO INTELIGENTE
   ========================================================================== */

// Variables del DOM
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const searchForm = document.getElementById('search-form');

// 1. Escuchar el tecleo del usuario
if (searchInput) {
    searchInput.addEventListener('input', function(e) {
        const textoBusqueda = e.target.value.toLowerCase().trim();
        
        // Si borró todo, ocultamos la lista
        if (textoBusqueda.length === 0) {
            searchResults.classList.remove('active');
            searchResults.innerHTML = '';
            return;
        }

        // 2. Filtrar el inventario
        // Buscamos coincidencia en Nombre, Marca o Categoría
        const resultados = inventario.filter(prod => {
            const nombre = prod.nombre.toLowerCase();
            const marca = prod.marca.toLowerCase();
            const categoria = prod.categoria.toLowerCase();
            
            return nombre.includes(textoBusqueda) || 
                   marca.includes(textoBusqueda) || 
                   categoria.includes(textoBusqueda);
        });

        // 3. Mostrar resultados
        mostrarResultadosBusqueda(resultados);
    });

    // Cerrar el buscador si hago clic fuera de él
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('active');
        }
    });
}

// Función para pintar la lista flotante
function mostrarResultadosBusqueda(lista) {
    searchResults.innerHTML = ''; // Limpiar anteriores
    
    if (lista.length > 0) {
        searchResults.classList.add('active'); // Mostrar caja

        // Recortamos a máximo 5 resultados para no llenar la pantalla
        const topResultados = lista.slice(0, 6);

        topResultados.forEach(prod => {
            const item = document.createElement('a');
            item.classList.add('search-item');
            item.href = `detalle.html?id=${prod.id}`; // Al hacer clic va al producto
            
            item.innerHTML = `
                <img src="${prod.imagen}" alt="${prod.nombre}">
                <div class="search-info">
                    <h4>${prod.nombre}</h4>
                    <span>${prod.marca}</span>
                </div>
                <div class="search-price">$${prod.precio.toLocaleString('es-AR')}</div>
            `;
            searchResults.appendChild(item);
        });

        // Si hay muchos más, mostramos un mensaje
        if (lista.length > 6) {
            const masResultados = document.createElement('div');
            masResultados.classList.add('search-item');
            masResultados.style.justifyContent = 'center';
            masResultados.style.color = '#FF6600';
            masResultados.style.fontWeight = 'bold';
            masResultados.textContent = `Ver los ${lista.length} resultados...`;
            // Al hacer clic, vamos al catálogo filtrado (Opcional, requiere lógica extra)
            masResultados.onclick = () => {
                window.location.href = `productos.html`; 
            };
            searchResults.appendChild(masResultados);
        }

    } else {
        searchResults.classList.add('active');
        searchResults.innerHTML = `<div class="no-results">No encontramos productos 😢</div>`;
    }
}

// 4. Manejar el "Enter" o clic en la lupa
if (searchForm) {
    searchForm.addEventListener('submit', function(e) {
        e.preventDefault(); // Evitar recarga
        // Aquí podrías redirigir a productos.html con un filtro si quisieras
        // Por ahora, nos basamos en la lista predictiva
        if (searchResults.firstChild && searchResults.firstChild.href) {
            // Si hay resultados, ir al primero al dar Enter
            window.location.href = searchResults.firstChild.href;
        }
    });
}

/* ==========================================================================
   10. GESTIÓN DE USUARIO (SIMULACIÓN FRONTEND - CORREGIDO MÓVIL)
   ========================================================================== */
function verificarSesionUsuario() {
    // Leemos de la memoria si hay un usuario guardado
    const usuarioLogueado = localStorage.getItem('usuarioLogueado');
    const nombreUsuario = localStorage.getItem('nombreUsuario');

    // Buscamos los botones de "Cuenta" (PC y Móvil)
    const btnCuentaPC = document.querySelector('.btn-outline.desktop-only');
    const btnCuentaMovil = document.querySelector('.mobile-only a'); // El enlace del menú hamburguesa

    if (usuarioLogueado === 'true' && nombreUsuario) {
        // --- USUARIO LOGUEADO ---
        
        // Configuración PC
        if (btnCuentaPC) {
            btnCuentaPC.textContent = `HOLA, ${nombreUsuario.toUpperCase()}`;
            btnCuentaPC.style.backgroundColor = '#333';
            btnCuentaPC.style.borderColor = '#333';
            
            // Al hacer clic, preguntar si cerrar sesión
            btnCuentaPC.onclick = (e) => {
                e.preventDefault();
                cerrarSesion();
            };
        }
        
        // Configuración MÓVIL
        if (btnCuentaMovil) {
            btnCuentaMovil.textContent = `Hola, ${nombreUsuario} (Salir)`;
            btnCuentaMovil.href = "#"; // Evitamos navegación
            btnCuentaMovil.onclick = (e) => {
                e.preventDefault();
                cerrarSesion(); // En celular también permite salir
            };
        }

    } else {
        // --- USUARIO NO LOGUEADO (Invitado) ---
        
        // Configuración PC: Ir a login
        if (btnCuentaPC) {
            btnCuentaPC.textContent = "CUENTA";
            btnCuentaPC.style.backgroundColor = ""; // Reset estilo
            btnCuentaPC.style.borderColor = "";
            btnCuentaPC.onclick = () => window.location.href = 'cuenta.html';
        }

        // Configuración MÓVIL: Ir a login (ESTO FALTABA)
        if (btnCuentaMovil) {
            btnCuentaMovil.textContent = "Iniciar Sesión / Registro";
            btnCuentaMovil.href = "cuenta.html"; // Ahora sí tiene enlace
        }
    }
}

// Función auxiliar para cerrar sesión
function cerrarSesion() {
    if(confirm("¿Deseas cerrar tu sesión?")) {
        localStorage.removeItem('usuarioLogueado');
        localStorage.removeItem('nombreUsuario');
        window.location.reload();
    }
}

/* ==========================================================================
   11. LÓGICA DE MODALS DE SERVICIOS (HOME)
   ========================================================================== */

function configurarModalsServicios() {
    const cardEnvios = document.getElementById('card-envios');
    const cardPagos = document.getElementById('card-pagos');
    const cardAsesoramiento = document.getElementById('card-asesoramiento');
    
    const overlay = document.getElementById('modal-overlay');
    const modalEnvios = document.getElementById('modal-envios');
    const modalPagos = document.getElementById('modal-pagos');

    // 1. Abrir Modal ENVÍOS
    if (cardEnvios) {
        cardEnvios.addEventListener('click', () => {
            abrirModal(modalEnvios);
        });
    }

    // 2. Abrir Modal PAGOS
    if (cardPagos) {
        cardPagos.addEventListener('click', () => {
            abrirModal(modalPagos);
        });
    }

    // 3. Acción directa WHATSAPP (Asesoramiento)
    if (cardAsesoramiento) {
        cardAsesoramiento.addEventListener('click', () => {
            // Número real del footer: +54 3755 123456
            const telefono = "5493755123456"; 
            const mensaje = "Hola Ferretería Enzo, necesito asesoramiento técnico sobre un producto.";
            const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
            
            // Abrir en nueva pestaña
            window.open(url, '_blank');
        });
    }

    // Cerrar al hacer clic en el fondo oscuro
    if (overlay) {
        overlay.addEventListener('click', cerrarModals);
    }
}

// Funciones Auxiliares
function abrirModal(modal) {
    const overlay = document.getElementById('modal-overlay');
    if (modal && overlay) {
        overlay.classList.add('active');
        modal.classList.add('active');
    }
}

function cerrarModals() {
    const overlay = document.getElementById('modal-overlay');
    // Buscamos cualquier modal activo para cerrarlo
    const modals = document.querySelectorAll('.modal-window.active');
    
    if (overlay) overlay.classList.remove('active');
    modals.forEach(m => m.classList.remove('active'));
}

// --- ACTIVAR AL INICIO ---
// Agrega esta llamada dentro de tu 'iniciarInterfaz()' o 'DOMContentLoaded' existente
// O simplemente déjala correr sola si está al final del script:
document.addEventListener('DOMContentLoaded', () => {
    configurarModalsServicios();
});