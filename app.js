// ============================================
// RESTAURANTE LA CLAVE - APP.JS
// Sistema de Reservas + Panel Admin
// ============================================

// Variables globales
let reservas = [];
let adminLogueado = false;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    cargarReservas();
    inicializarFormularioReserva();
    cargarMenuDelDia();

    // Auto-actualizar estadísticas cada 30 segundos si admin está abierto
    setInterval(() => {
        if (adminLogueado && document.getElementById('adminModal').classList.contains('show')) {
            actualizarEstadisticas();
        }
    }, 30000);
});

// ============================================
// GESTIÓN DE RESERVAS
// ============================================

function cargarReservas() {
    try {
        const data = localStorage.getItem('reservas_laclave');
        reservas = data ? JSON.parse(data) : [];
        limpiarReservasAntiguas();
    } catch (error) {
        console.error('Error cargando reservas:', error);
        reservas = [];
    }
}

function guardarReservas() {
    try {
        localStorage.setItem('reservas_laclave', JSON.stringify(reservas));
    } catch (error) {
        console.error('Error guardando reservas:', error);
        alert('Error al guardar. Verifica el almacenamiento del navegador.');
    }
}

function limpiarReservasAntiguas() {
    const hoy = new Date().setHours(0, 0, 0, 0);
    const hace30dias = hoy - (30 * 24 * 60 * 60 * 1000);

    reservas = reservas.filter(r => {
        const fechaReserva = new Date(r.fecha).getTime();
        return fechaReserva >= hace30dias;
    });

    guardarReservas();
}

// ============================================
// FORMULARIO DE RESERVA
// ============================================

function inicializarFormularioReserva() {
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        const hoy = new Date();
        const manana = new Date(hoy);
        manana.setDate(hoy.getDate() + 1);
        const minFecha = manana.toISOString().split('T')[0];
        fechaInput.setAttribute('min', minFecha);

        const maxFecha = new Date(hoy);
        maxFecha.setDate(hoy.getDate() + 90);
        fechaInput.setAttribute('max', maxFecha.toISOString().split('T')[0]);
    }
}

function actualizarHorasDisponibles() {
    const fechaInput = document.getElementById('fecha');
    const horaSelect = document.getElementById('hora');

    if (!fechaInput || !horaSelect || !fechaInput.value) return;

    const fechaSeleccionada = new Date(fechaInput.value + 'T12:00:00');
    const diaSemana = fechaSeleccionada.getDay();

    // LUNES CERRADO (día 1)
    if (diaSemana === 1) {
        horaSelect.innerHTML = '<option value="">Cerrado los lunes</option>';
        return;
    }

    const horasComida = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30'];
    const horasCena = ['20:00', '20:30', '21:00', '21:30', '22:00', '22:30'];

    let html = '<option value="">Selecciona hora</option>';
    html += '<optgroup label="🍽️ Mediodía">';
    horasComida.forEach(hora => {
        html += `<option value="${hora}">${hora}</option>`;
    });
    html += '</optgroup><optgroup label="🌙 Cena">';
    horasCena.forEach(hora => {
        html += `<option value="${hora}">${hora}</option>`;
    });
    html += '</optgroup>';

    horaSelect.innerHTML = html;
}

function mostrarDisponibilidad() {
    const fecha = document.getElementById('fecha')?.value;
    const hora = document.getElementById('hora')?.value;
    const personas = document.getElementById('personas')?.value;
    const infoDiv = document.getElementById('availabilityInfo');

    if (!fecha || !hora || !personas || !infoDiv) return;

    const reservasEnHorario = reservas.filter(r => 
        r.fecha === fecha && r.hora === hora && r.estado !== 'cancelada'
    );

    const totalPersonas = reservasEnHorario.reduce((sum, r) => {
        return sum + (r.personas === 'mas8' ? 10 : parseInt(r.personas));
    }, 0);

    const capacidadTotal = CONFIG.capacidades[hora.includes('20:') || hora.includes('21:') || hora.includes('22:') ? 'cena' : 'comida'];
    const disponible = capacidadTotal - totalPersonas;

    if (disponible >= parseInt(personas)) {
        infoDiv.innerHTML = `<div class="availability-info">✓ Disponible (${disponible} plazas libres)</div>`;
    } else if (disponible > 0) {
        infoDiv.innerHTML = `<div class="availability-info warning">⚠️ Quedan ${disponible} plazas</div>`;
    } else {
        infoDiv.innerHTML = `<div class="availability-info full">✗ Completo para esta hora</div>`;
    }
}

function enviarReserva(event) {
    event.preventDefault();

    // Rate limiting
    const ultimoEnvio = parseInt(localStorage.getItem('ultimo_envio_reserva') || '0');
    const ahora = Date.now();
    if (ahora - ultimoEnvio < 60000) {
        alert('⏳ Por favor espera 1 minuto entre reservas.');
        return;
    }

    const nombre = sanitizarTexto(document.getElementById('nombre').value);
    const prefijo = document.getElementById('prefijo').value;
    const telefono = document.getElementById('telefono').value;
    const fecha = document.getElementById('fecha').value;
    const hora = document.getElementById('hora').value;
    const personas = document.getElementById('personas').value;
    const comentarios = sanitizarTexto(document.getElementById('comentarios')?.value || '');

    // Validaciones
    if (nombre.length < 3) {
        alert('❌ El nombre debe tener al menos 3 caracteres');
        return;
    }

    if (!/^[0-9]{9}$/.test(telefono)) {
        alert('❌ El teléfono debe tener 9 dígitos');
        return;
    }

    const fechaReserva = new Date(fecha + 'T12:00:00');
    const hoy = new Date();
    if (fechaReserva <= hoy) {
        alert('❌ Debes reservar con al menos 24h de antelación');
        return;
    }

    const reserva = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        nombre,
        telefono: prefijo + telefono,
        fecha,
        hora,
        personas,
        comentarios,
        estado: 'pendiente',
        fechaCreacion: new Date().toISOString()
    };

    reservas.push(reserva);
    guardarReservas();
    localStorage.setItem('ultimo_envio_reserva', ahora.toString());

    // Construir mensaje WhatsApp
    const mensaje = `🍽️ *NUEVA RESERVA - La Clave*

👤 *Nombre:* ${nombre}
📞 *Teléfono:* ${reserva.telefono}
📅 *Fecha:* ${formatearFecha(fecha)}
🕐 *Hora:* ${hora}
👥 *Personas:* ${personas === 'mas8' ? 'Más de 8' : personas}
${comentarios ? `💬 *Comentarios:* ${comentarios}` : ''}

_Reserva realizada desde la web_`;

    const urlWhatsApp = `https://wa.me/34669670985?text=${encodeURIComponent(mensaje)}`;

    // Abrir WhatsApp
    window.open(urlWhatsApp, '_blank');

    // Limpiar formulario
    document.getElementById('reservaForm').reset();
    document.getElementById('availabilityInfo').innerHTML = '';

    alert('✅ Reserva enviada. Te redirigimos a WhatsApp para confirmar.');
}

function sanitizarTexto(texto) {
    return texto
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim()
        .substring(0, 500);
}

// ============================================
// PANEL ADMIN
// ============================================

function abrirModalAdmin() {
    document.getElementById('adminModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function cerrarModalAdmin() {
    document.getElementById('adminModal').classList.remove('show');
    document.body.style.overflow = '';
    adminLogueado = false;
    document.getElementById('adminLogin').style.display = 'block';
    document.getElementById('adminContent').classList.remove('active');
    document.getElementById('pinInput').value = '';
}

function verificarPIN() {
    const pin = document.getElementById('pinInput').value;

    if (pin === CONFIG.pinAdmin) {
        adminLogueado = true;
        document.getElementById('adminLogin').style.display = 'none';
        document.getElementById('adminContent').classList.add('active');
        cargarPanelAdmin();
    } else {
        alert('❌ PIN incorrecto');
        document.getElementById('pinInput').value = '';
    }
}

function cargarPanelAdmin() {
    actualizarEstadisticas();
    renderizarCalendario();
    renderizarTodasLasReservas();
    cargarGaleriaMenus();
}

function actualizarEstadisticas() {
    const hoy = new Date().toISOString().split('T')[0];

    const pendientes = reservas.filter(r => r.estado === 'pendiente').length;
    const confirmadas = reservas.filter(r => r.estado === 'confirmada').length;
    const reservasHoy = reservas.filter(r => r.fecha === hoy && r.estado !== 'cancelada').length;
    const ingresos = confirmadas * 25;

    document.getElementById('pendientesCount').textContent = pendientes;
    document.getElementById('confirmadasCount').textContent = confirmadas;
    document.getElementById('reservasHoyCount').textContent = reservasHoy;
    document.getElementById('ingresosEstimados').textContent = ingresos + '€';
}

// ============================================
// CALENDARIO EN FORMATO SEMANAL (PRÓXIMO MES)
// ============================================

function renderizarCalendario() {
    const calendarGrid = document.getElementById('calendarGrid');
    const hoy = new Date();

    // Calcular inicio (domingo de esta semana o lunes según prefieras)
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay()); // Domingo de esta semana

    // Renderizar 5 semanas (35 días ≈ 1 mes)
    let html = '<div class="calendar-weeks">';

    for (let semana = 0; semana < 5; semana++) {
        html += '<div class="calendar-week">';

        for (let dia = 0; dia < 7; dia++) {
            const fecha = new Date(inicioSemana);
            fecha.setDate(inicioSemana.getDate() + (semana * 7) + dia);
            const fechaStr = fecha.toISOString().split('T')[0];
            const diaSemana = fecha.getDay();

            const reservasDelDia = reservas.filter(r => r.fecha === fechaStr && r.estado !== 'cancelada');
            const comida = reservasDelDia.filter(r => parseInt(r.hora.split(':')[0]) < 17).length;
            const cena = reservasDelDia.filter(r => parseInt(r.hora.split(':')[0]) >= 17).length;

            const esHoy = fecha.toDateString() === hoy.toDateString();
            const esPasado = fecha < hoy.setHours(0,0,0,0);
            const esCerrado = diaSemana === 1; // LUNES

            html += `
            <div class="calendar-day ${esHoy ? 'today' : ''} ${esPasado ? 'past' : ''} ${esCerrado ? 'closed' : ''}" 
                 onclick="mostrarReservasDia('${fechaStr}', this)">
                <div class="day-header">
                    <strong>${fecha.getDate()}</strong>
                    <small>${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][diaSemana]}</small>
                </div>
                <div class="day-info">
                    ${esCerrado ? '<span class="closed-badge">Cerrado</span>' : `
                        <div class="meal-count">🍽️ ${comida}</div>
                        <div class="meal-count">🌙 ${cena}</div>
                    `}
                </div>
            </div>`;
        }

        html += '</div>'; // Fin semana
    }

    html += '</div>'; // Fin calendar-weeks

    calendarGrid.innerHTML = html;

    // Mostrar primer día con reservas o hoy
    const primerDia = hoy.toISOString().split('T')[0];
    const primerElemento = calendarGrid.querySelector('.calendar-day.today') || calendarGrid.querySelector('.calendar-day');
    if (primerElemento) {
        mostrarReservasDia(primerDia, primerElemento);
    }
}

function mostrarReservasDia(fecha, elemento) {
    document.querySelectorAll('.calendar-day').forEach(c => c.classList.remove('selected'));
    if (elemento) elemento.classList.add('selected');

    const dayReservations = document.getElementById('dayReservations');
    const selectedDate = document.getElementById('selectedDate');
    const content = document.getElementById('dayReservationsContent');

    selectedDate.textContent = formatearFecha(fecha);

    const reservasDelDia = reservas.filter(r => r.fecha === fecha && r.estado !== 'cancelada');

    if (reservasDelDia.length === 0) {
        content.innerHTML = '<p style="text-align:center; color:#999; padding:2rem;">No hay reservas para este día</p>';
    } else {
        const comida = reservasDelDia.filter(r => parseInt(r.hora.split(':')[0]) < 17);
        const cena = reservasDelDia.filter(r => parseInt(r.hora.split(':')[0]) >= 17);

        let html = '';

        if (comida.length > 0) {
            html += '<div class="turno-section"><h4>🍽️ Mediodía</h4>';
            comida.forEach(r => html += renderizarReservaMini(r));
            html += '</div>';
        }

        if (cena.length > 0) {
            html += '<div class="turno-section"><h4>🌙 Cena</h4>';
            cena.forEach(r => html += renderizarReservaMini(r));
            html += '</div>';
        }

        content.innerHTML = html;
    }

    dayReservations.classList.add('show');
}

function renderizarReservaMini(r) {
    return `
    <div class="reservation-mini ${r.estado}">
        <div>
            <strong>${r.nombre}</strong>
            <small>${r.hora} | ${r.personas === 'mas8' ? '+8' : r.personas} personas | ${r.telefono}</small>
        </div>
        <span class="estado-badge ${r.estado}">${r.estado === 'pendiente' ? '⏳ Pendiente' : '✓ Confirmada'}</span>
    </div>`;
}

function renderizarTodasLasReservas() {
    const container = document.getElementById('reservationsList');
    const hoy = new Date().toISOString().split('T')[0];

    const reservasFuturas = reservas
        .filter(r => r.fecha >= hoy && r.estado !== 'cancelada')
        .sort((a, b) => {
            const diff = a.fecha.localeCompare(b.fecha);
            return diff !== 0 ? diff : a.hora.localeCompare(b.hora);
        });

    if (reservasFuturas.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; padding:2rem;">No hay reservas futuras</p>';
        return;
    }

    let html = '';
    reservasFuturas.forEach(r => {
        html += `
        <div class="reservation-item ${r.estado}">
            <div class="reservation-info">
                <strong>${r.nombre}</strong>
                <small>📅 ${formatearFecha(r.fecha)} | 🕐 ${r.hora} | 👥 ${r.personas === 'mas8' ? 'Más de 8' : r.personas} | 📞 ${r.telefono}</small>
                ${r.comentarios ? `<small>💬 ${r.comentarios}</small>` : ''}
            </div>
            <div class="reservation-actions">
                <span class="estado-badge ${r.estado}">${r.estado === 'pendiente' ? '⏳ Pendiente' : '✓ Confirmada'}</span>
                ${r.estado === 'pendiente' ? `<button class="confirm-btn" onclick="confirmarReserva('${r.id}')">✓ Confirmar</button>` : ''}
                <button class="delete-btn" onclick="eliminarReserva('${r.id}')">🗑️ Eliminar</button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}

function confirmarReserva(id) {
    const reserva = reservas.find(r => r.id === id);
    if (reserva) {
        reserva.estado = 'confirmada';
        guardarReservas();
        cargarPanelAdmin();
        alert('✅ Reserva confirmada');
    }
}

function eliminarReserva(id) {
    if (!confirm('¿Seguro que quieres eliminar esta reserva?')) return;

    reservas = reservas.filter(r => r.id !== id);
    guardarReservas();
    cargarPanelAdmin();
}

// ============================================
// RESERVA MANUAL
// ============================================

function mostrarModalReservaManual() {
    document.getElementById('manualReservationModal').classList.add('show');

    // Inicializar fecha mínima
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    document.getElementById('manualFecha').setAttribute('min', manana.toISOString().split('T')[0]);
}

function cerrarModalReservaManual() {
    document.getElementById('manualReservationModal').classList.remove('show');
    document.getElementById('manualReservationForm').reset();
}

function guardarReservaManual(event) {
    event.preventDefault();

    const nombre = sanitizarTexto(document.getElementById('manualNombre').value);
    const prefijo = document.getElementById('manualPrefijo').value;
    const telefono = document.getElementById('manualTelefono').value;
    const fecha = document.getElementById('manualFecha').value;
    const hora = document.getElementById('manualHora').value;
    const personas = document.getElementById('manualPersonas').value;
    const comentarios = sanitizarTexto(document.getElementById('manualComentarios')?.value || '');

    const reserva = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        nombre,
        telefono: prefijo + telefono,
        fecha,
        hora,
        personas,
        comentarios,
        estado: 'confirmada',
        fechaCreacion: new Date().toISOString()
    };

    reservas.push(reserva);
    guardarReservas();

    cerrarModalReservaManual();
    cargarPanelAdmin();

    alert('✅ Reserva manual añadida correctamente');
}

// ============================================
// GESTIÓN DE MENÚ DEL DÍA (MÁXIMO 2 ACTIVOS)
// ============================================

function cargarMenuDelDia() {
    try {
        const menusActivos = JSON.parse(localStorage.getItem('menus_activos') || '[]');
        const container = document.querySelector('.menu-preview-container');
        const noMenuMsg = document.getElementById('noMenuMsg');

        if (menusActivos.length === 0) {
            if (noMenuMsg) noMenuMsg.style.display = 'block';
            return;
        }

        if (noMenuMsg) noMenuMsg.style.display = 'none';

        // Limpiar contenedor y añadir imágenes
        const existingImgs = container.querySelectorAll('.menu-img-display');
        existingImgs.forEach(img => img.remove());

        menusActivos.forEach((menuUrl, index) => {
            const img = document.createElement('img');
            img.src = menuUrl;
            img.className = 'menu-img-display';
            img.alt = `Menú del día ${index + 1}`;
            img.style.display = 'block';
            container.appendChild(img);
        });

    } catch (error) {
        console.error('Error cargando menú:', error);
    }
}

function subirFotoMenu(input) {
    const file = input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('❌ Solo se permiten imágenes');
        input.value = '';
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('❌ La imagen no puede superar 5MB');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    const uploadLabel = document.querySelector('.upload-label');
    uploadLabel.classList.add('uploading');
    uploadLabel.textContent = '⏳ Subiendo...';

    reader.onload = function(e) {
        const imgData = e.target.result;

        try {
            // Guardar en localStorage
            const menus = JSON.parse(localStorage.getItem('menus_subidos') || '[]');
            const nuevoMenu = {
                id: Date.now().toString(),
                url: imgData,
                fecha: new Date().toISOString(),
                activo: false
            };

            menus.push(nuevoMenu);

            // Limitar a 10 menús máximo
            if (menus.length > 10) {
                menus.shift();
            }

            localStorage.setItem('menus_subidos', JSON.stringify(menus));

            uploadLabel.classList.remove('uploading');
            uploadLabel.textContent = '📤 Subir nueva foto del menú';
            input.value = '';

            cargarGaleriaMenus();
            alert('✅ Foto subida correctamente');

        } catch (error) {
            console.error('Error:', error);
            uploadLabel.classList.remove('uploading');
            uploadLabel.textContent = '📤 Subir nueva foto del menú';
            alert('❌ Error al subir. La imagen puede ser muy grande.');
        }
    };

    reader.readAsDataURL(file);
}

function cargarGaleriaMenus() {
    const gallery = document.getElementById('menuGallery');
    if (!gallery) return;

    try {
        const menus = JSON.parse(localStorage.getItem('menus_subidos') || '[]');

        if (menus.length === 0) {
            gallery.innerHTML = '<p class="no-menus-msg">No hay fotos subidas aún</p>';
            return;
        }

        renderizarGaleriaMenus(menus, gallery);

    } catch (error) {
        console.error('Error cargando galería:', error);
        gallery.innerHTML = '<p class="no-menus-msg">Error al cargar menús</p>';
    }
}

function renderizarGaleriaMenus(menus, gallery) {
    const menusActivos = JSON.parse(localStorage.getItem('menus_activos') || '[]');

    let html = '';
    menus.reverse().forEach(menu => {
        const fecha = new Date(menu.fecha);
        const fechaStr = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        const esActivo = menusActivos.includes(menu.url);

        html += `
        <div class="menu-gallery-item">
            ${esActivo ? '<span class="active-badge">✓ ACTIVO</span>' : ''}
            <img src="${menu.url}" alt="Menú ${fechaStr}" onclick="verImagenCompleta('${menu.url}')">
            <div class="menu-gallery-meta">
                <small>${fechaStr}</small>
                <div style="display:flex; gap:0.3rem;">
                    ${!esActivo ? `<button class="activate-menu-btn" onclick="activarMenuEnHome('${menu.id}', '${menu.url}')" title="Activar en página principal">✓ Activar</button>` : `<button class="deactivate-menu-btn" onclick="desactivarMenuEnHome('${menu.url}')" title="Desactivar">✗</button>`}
                    <button class="delete-img-btn" onclick="eliminarFotoMenu('${menu.id}')" title="Eliminar foto">🗑️</button>
                </div>
            </div>
        </div>`;
    });

    gallery.innerHTML = html;
}

function activarMenuEnHome(menuId, imgUrl) {
    try {
        let menusActivos = JSON.parse(localStorage.getItem('menus_activos') || '[]');

        // Verificar si ya hay 2 activos
        if (menusActivos.length >= 2 && !menusActivos.includes(imgUrl)) {
            alert('⚠️ Solo puedes tener 2 menús activos simultáneamente.\nDesactiva uno primero.');
            return;
        }

        // Si no está activo, añadirlo
        if (!menusActivos.includes(imgUrl)) {
            menusActivos.push(imgUrl);
            localStorage.setItem('menus_activos', JSON.stringify(menusActivos));
            cargarMenuDelDia();
            cargarGaleriaMenus();
            alert('✅ Menú activado en la página principal');
        }

    } catch (error) {
        console.error('Error activando menú:', error);
        alert('❌ Error al activar el menú');
    }
}

function desactivarMenuEnHome(imgUrl) {
    try {
        let menusActivos = JSON.parse(localStorage.getItem('menus_activos') || '[]');
        menusActivos = menusActivos.filter(url => url !== imgUrl);
        localStorage.setItem('menus_activos', JSON.stringify(menusActivos));

        cargarMenuDelDia();
        cargarGaleriaMenus();
        alert('✅ Menú desactivado');

    } catch (error) {
        console.error('Error desactivando menú:', error);
        alert('❌ Error al desactivar');
    }
}

function eliminarFotoMenu(menuId) {
    if (!confirm('¿Eliminar esta foto del menú?')) return;

    try {
        let menus = JSON.parse(localStorage.getItem('menus_subidos') || '[]');
        const menuAEliminar = menus.find(m => m.id === menuId);

        if (menuAEliminar) {
            // Desactivar si estaba activo
            desactivarMenuEnHome(menuAEliminar.url);
        }

        menus = menus.filter(m => m.id !== menuId);
        localStorage.setItem('menus_subidos', JSON.stringify(menus));

        cargarGaleriaMenus();
        cargarMenuDelDia();

    } catch (error) {
        console.error('Error eliminando menú:', error);
        alert('❌ Error al eliminar');
    }
}

function verImagenCompleta(url) {
    window.open(url, '_blank');
}

// ============================================
// MODALES LEGALES
// ============================================

function abrirModalLegal() {
    document.getElementById('legalModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function cerrarModalLegal() {
    document.getElementById('legalModal').classList.remove('show');
    document.body.style.overflow = '';
}

// ============================================
// UTILIDADES
// ============================================

function formatearFecha(fechaStr) {
    const fecha = new Date(fechaStr + 'T12:00:00');
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return fecha.toLocaleDateString('es-ES', opciones);
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    if (event.target.classList.contains('modal') || event.target.classList.contains('legal-modal')) {
        event.target.classList.remove('show');
        document.body.style.overflow = '';
    }
};