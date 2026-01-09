// ============================================
// RESTAURANTE LA CLAVE - JAVASCRIPT COMPLETO
// ============================================

// ========== SEGURIDAD ==========
const RateLimiter = {
    attempts: {},
    blocked: {},

    check(key, maxAttempts = 5, windowMs = 300000) {
        const now = Date.now();

        if (this.blocked[key] && this.blocked[key] > now) {
            return false;
        }

        if (!this.attempts[key]) {
            this.attempts[key] = [];
        }

        this.attempts[key] = this.attempts[key].filter(t => t > now - windowMs);

        if (this.attempts[key].length >= maxAttempts) {
            this.blocked[key] = now + windowMs;
            return false;
        }

        this.attempts[key].push(now);
        return true;
    },

    reset(key) {
        delete this.attempts[key];
        delete this.blocked[key];
    }
};

function sanitizeInput(str) {
    if (typeof str !== 'string') return '';
    return str.trim()
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '');
}

function sanitizePhone(phone) {
    return phone.replace(/[^0-9]/g, '').slice(0, 9);
}

function isValidFutureDate(dateStr) {
    const selected = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selected >= today;
}

// ========== ADMIN MODAL ==========
function abrirModalAdmin() {
    document.getElementById('adminModal').classList.add('show');
    document.body.style.overflow = 'hidden';
    document.getElementById('pinInput').focus();
}

function cerrarModalAdmin() {
    document.getElementById('adminModal').classList.remove('show');
    document.body.style.overflow = 'auto';
    document.getElementById('adminLogin').style.display = 'block';
    document.getElementById('adminContent').classList.remove('active');
    document.getElementById('pinInput').value = '';
    document.getElementById('dayReservations').classList.remove('show');
}

function verificarPIN() {
    const pinInput = document.getElementById('pinInput');
    const pin = pinInput.value.trim();

    if (!RateLimiter.check('admin_login', CONFIG.maxIntentosLogin, CONFIG.tiempoBloqueoLogin)) {
        alert('❌ Demasiados intentos. Espera 5 minutos.');
        pinInput.value = '';
        return;
    }

    if (pin === CONFIG.pinAdmin) {
        document.getElementById('adminLogin').style.display = 'none';
        document.getElementById('adminContent').classList.add('active');
        RateLimiter.reset('admin_login');
        limpiarReservasExpiradas();
        cargarDatosAdmin();
        cargarMenusDesdeServidor();
    } else {
        alert('❌ PIN incorrecto');
        pinInput.value = '';
        pinInput.focus();
    }
}

// ========== GESTIÓN DE RESERVAS ==========
function obtenerReservas() {
    try {
        const reservas = localStorage.getItem('reservas');
        return reservas ? JSON.parse(reservas) : [];
    } catch (e) {
        console.error('Error leyendo reservas:', e);
        return [];
    }
}

function guardarReservas(reservas) {
    try {
        localStorage.setItem('reservas', JSON.stringify(reservas));
    } catch (e) {
        console.error('Error guardando reservas:', e);
        alert('Error guardando datos.');
    }
}

function limpiarReservasExpiradas() {
    const reservas = obtenerReservas();
    const ahora = new Date();
    const reservasActivas = reservas.filter(r => {
        if (r.estado === 'confirmada') return true;
        const fechaCreacion = new Date(r.timestamp);
        const horasTranscurridas = (ahora - fechaCreacion) / (1000 * 60 * 60);
        return horasTranscurridas < CONFIG.expiracionReservasHoras;
    });
    if (reservasActivas.length !== reservas.length) {
        guardarReservas(reservasActivas);
    }
}

function calcularOcupacion(fecha, turno) {
    const reservas = obtenerReservas();
    const horasFiltro = turno === 'mediodia' ? CONFIG.horarios.mediodia : CONFIG.horarios.noche;

    return reservas
        .filter(r => r.fecha === fecha && horasFiltro.includes(r.hora) && r.estado === 'confirmada')
        .reduce((sum, r) => sum + (r.personas === 'mas8' ? 10 : parseInt(r.personas)), 0);
}

function obtenerEstadoTurno(ocupacion) {
    if (ocupacion >= CONFIG.capacidad.umbralRojo) return 'full';
    if (ocupacion >= CONFIG.capacidad.umbralNaranja) return 'partial';
    return 'available';
}

function actualizarHorasDisponibles() {
    const fecha = document.getElementById('fecha').value;
    const horaSelect = document.getElementById('hora');

    if (!fecha) return;

    if (!isValidFutureDate(fecha)) {
        alert('⚠️ No puedes reservar en fechas pasadas');
        document.getElementById('fecha').value = '';
        return;
    }

    horaSelect.innerHTML = '<option value="">Selecciona hora</option>';

    const ocupacionMediodia = calcularOcupacion(fecha, 'mediodia');
    const ocupacionNoche = calcularOcupacion(fecha, 'noche');
    const disponibleMediodia = CONFIG.capacidad.mediodia - ocupacionMediodia;
    const disponibleNoche = CONFIG.capacidad.noche - ocupacionNoche;

    const mediodia = document.createElement('optgroup');
    mediodia.label = `Mediodía (${disponibleMediodia}/${CONFIG.capacidad.mediodia} confirmadas)`;

    const cena = document.createElement('optgroup');
    cena.label = `Cena (${disponibleNoche}/${CONFIG.capacidad.noche} confirmadas)`;

    if (disponibleMediodia > 0) {
        CONFIG.horarios.mediodia.forEach(h => {
            const o = document.createElement('option');
            o.value = h;
            o.textContent = h;
            mediodia.appendChild(o);
        });
        horaSelect.appendChild(mediodia);
    }

    if (disponibleNoche > 0) {
        CONFIG.horarios.noche.forEach(h => {
            const o = document.createElement('option');
            o.value = h;
            o.textContent = h;
            cena.appendChild(o);
        });
        horaSelect.appendChild(cena);
    }

    if (disponibleMediodia === 0 && disponibleNoche === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Sin disponibilidad';
        option.disabled = true;
        horaSelect.appendChild(option);
    }
}

function mostrarDisponibilidad() {
    const fecha = document.getElementById('fecha').value;
    const hora = document.getElementById('hora').value;
    const personasVal = document.getElementById('personas').value;
    const infoDiv = document.getElementById('availabilityInfo');

    if (!fecha || !hora || !personasVal) {
        infoDiv.innerHTML = '';
        return;
    }

    const personas = personasVal === 'mas8' ? 10 : parseInt(personasVal);
    const esMediodia = CONFIG.horarios.mediodia.includes(hora);
    const turno = esMediodia ? 'mediodia' : 'noche';
    const capacidad = esMediodia ? CONFIG.capacidad.mediodia : CONFIG.capacidad.noche;
    const ocupacion = calcularOcupacion(fecha, turno);
    const disponible = capacidad - ocupacion;

    if (personasVal === 'mas8') {
        infoDiv.innerHTML = '<div class="availability-info warning">⚠️ Para grupos grandes, confirmaremos por WhatsApp</div>';
    } else if (personas > disponible) {
        infoDiv.innerHTML = '<div class="availability-info full">❌ No hay plazas suficientes</div>';
    } else if (disponible - personas < 5) {
        infoDiv.innerHTML = `<div class="availability-info warning">⚠️ Quedan pocas plazas: ${disponible}/${capacidad}</div>`;
    } else {
        infoDiv.innerHTML = `<div class="availability-info">✅ Disponible: ${disponible}/${capacidad} personas</div>`;
    }
}

function enviarReserva(event) {
    event.preventDefault();

    if (!RateLimiter.check('reserva_form', 3, 60000)) {
        alert('⚠️ Espera un minuto antes de enviar otra reserva.');
        return;
    }

    const nombre = sanitizeInput(document.getElementById('nombre').value);
    const prefijo = document.getElementById('prefijo').value;
    const telefono = sanitizePhone(document.getElementById('telefono').value);
    const fecha = document.getElementById('fecha').value;
    const hora = document.getElementById('hora').value;
    const personasVal = document.getElementById('personas').value;
    const comentarios = sanitizeInput(document.getElementById('comentarios').value);

    if (!nombre || nombre.length < 3) {
        alert('❌ Introduce un nombre válido (mínimo 3 caracteres)');
        return;
    }

    if (telefono.length !== 9 || !/^[0-9]{9}$/.test(telefono)) {
        alert('❌ El teléfono debe tener exactamente 9 dígitos');
        return;
    }

    if (!isValidFutureDate(fecha)) {
        alert('❌ La fecha debe ser hoy o futura');
        return;
    }

    if (personasVal !== 'mas8') {
        const personas = parseInt(personasVal);
        const esMediodia = CONFIG.horarios.mediodia.includes(hora);
        const turno = esMediodia ? 'mediodia' : 'noche';
        const capacidad = esMediodia ? CONFIG.capacidad.mediodia : CONFIG.capacidad.noche;
        const ocupacion = calcularOcupacion(fecha, turno);
        const disponible = capacidad - ocupacion;

        if (personas > disponible) {
            alert('❌ No hay plazas suficientes confirmadas');
            return;
        }
    }

    const reservas = obtenerReservas();
    reservas.push({
        id: Date.now(),
        nombre,
        telefono: prefijo + telefono,
        fecha,
        hora,
        personas: personasVal,
        comentarios,
        estado: 'pendiente',
        timestamp: new Date().toISOString()
    });
    guardarReservas(reservas);

    const fechaObj = new Date(fecha + 'T00:00:00');
    const fechaFormateada = fechaObj.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    let mensaje = `¡Hola! Me gustaría hacer una reserva:%0A%0A`;
    mensaje += `👤 Nombre: ${nombre}%0A`;
    mensaje += `☎️ Teléfono: ${prefijo} ${telefono}%0A`;
    mensaje += `📅 Fecha: ${fechaFormateada}%0A`;
    mensaje += `🕐 Hora: ${hora}%0A`;
    mensaje += `👥 Personas: ${personasVal === 'mas8' ? 'Más de 8' : personasVal}%0A`;
    if (comentarios) {
        mensaje += `%0A💬 ${encodeURIComponent(comentarios)}%0A`;
    }

    window.open(`https://wa.me/${CONFIG.whatsappNumero}?text=${mensaje}`, '_blank');

    document.getElementById('reservaForm').reset();
    document.getElementById('availabilityInfo').innerHTML = 
        '<div class="availability-info">✅ Reserva enviada (pendiente de confirmar)</div>';
}

function confirmarReserva(id) {
    let reservas = obtenerReservas();
    reservas = reservas.map(r => r.id === id ? { ...r, estado: 'confirmada' } : r);
    guardarReservas(reservas);
    cargarDatosAdmin();
}

function eliminarReserva(id) {
    if (!confirm('¿Eliminar esta reserva?')) return;
    let reservas = obtenerReservas();
    reservas = reservas.filter(r => r.id !== id);
    guardarReservas(reservas);
    cargarDatosAdmin();
}

// ========== PANEL ADMINISTRATIVO ==========
function cargarDatosAdmin() {
    const reservas = obtenerReservas();
    actualizarEstadisticas(reservas);
    generarCalendario(reservas);
    mostrarTodasReservas(reservas);
}

function actualizarEstadisticas(reservas) {
    const pendientes = reservas.filter(r => r.estado === 'pendiente').length;
    const confirmadas = reservas.filter(r => r.estado === 'confirmada').length;
    const hoy = new Date().toISOString().split('T')[0];
    const reservasHoy = reservas.filter(r => r.fecha === hoy).length;

    const totalPersonas = reservas
        .filter(r => r.estado === 'confirmada')
        .reduce((sum, r) => sum + (r.personas === 'mas8' ? 10 : parseInt(r.personas)), 0);

    const ingresosEstimados = totalPersonas * CONFIG.precioMedio;

    document.getElementById('pendientesCount').textContent = pendientes;
    document.getElementById('confirmadasCount').textContent = confirmadas;
    document.getElementById('reservasHoyCount').textContent = reservasHoy;
    document.getElementById('ingresosEstimados').textContent = `${ingresosEstimados}€`;
}

function generarCalendario(reservas) {
    const container = document.getElementById('calendarGrid');
    container.innerHTML = '';

    const hoy = new Date();
    for (let i = 0; i < 14; i++) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() + i);
        const fechaStr = fecha.toISOString().split('T')[0];

        const ocupacionMediodia = calcularOcupacion(fechaStr, 'mediodia');
        const ocupacionNoche = calcularOcupacion(fechaStr, 'noche');

        const estadoMediodia = obtenerEstadoTurno(ocupacionMediodia);
        const estadoNoche = obtenerEstadoTurno(ocupacionNoche);

        const disponibleMediodia = CONFIG.capacidad.mediodia - ocupacionMediodia;
        const disponibleNoche = CONFIG.capacidad.noche - ocupacionNoche;

        const nombreDia = fecha.toLocaleDateString('es-ES', { weekday: 'short' });
        const dia = fecha.getDate();
        const mes = fecha.toLocaleDateString('es-ES', { month: 'short' });

        const card = document.createElement('div');
        card.className = 'calendar-day-card';
        card.onclick = () => mostrarReservasDelDia(fechaStr, card);

        card.innerHTML = `
            <div class="calendar-day-header">
                <strong>${dia}</strong>
                <small>${mes} - ${nombreDia}</small>
            </div>
            <div class="calendar-turnos">
                <div class="turno-status ${estadoMediodia}">
                    🌞 Mediodía<br>
                    <small>${disponibleMediodia}/${CONFIG.capacidad.mediodia} libres</small>
                </div>
                <div class="turno-status ${estadoNoche}">
                    🌙 Noche<br>
                    <small>${disponibleNoche}/${CONFIG.capacidad.noche} libres</small>
                </div>
            </div>
        `;

        container.appendChild(card);
    }
}

function mostrarReservasDelDia(fecha, cardElement) {
    document.querySelectorAll('.calendar-day-card').forEach(c => c.classList.remove('selected'));
    cardElement.classList.add('selected');

    const reservas = obtenerReservas().filter(r => r.fecha === fecha);
    const container = document.getElementById('dayReservations');
    const fechaObj = new Date(fecha + 'T00:00:00');
    const fechaFormateada = fechaObj.toLocaleDateString('es-ES', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });

    document.getElementById('selectedDate').textContent = fechaFormateada;

    const mediodia = reservas.filter(r => CONFIG.horarios.mediodia.includes(r.hora));
    const noche = reservas.filter(r => CONFIG.horarios.noche.includes(r.hora));

    let html = '';

    if (mediodia.length > 0) {
        html += '<div class="turno-section"><h4>🌞 Mediodía</h4>';
        mediodia.forEach(r => {
            html += `
                <div class="reservation-mini ${r.estado}">
                    <div>
                        <strong>${r.hora} - ${r.nombre}</strong>
                        <small>📞 ${r.telefono} | 👥 ${r.personas === 'mas8' ? '8+' : r.personas} personas</small>
                        ${r.comentarios ? `<br><small>💬 ${r.comentarios}</small>` : ''}
                    </div>
                    <div class="reservation-actions">
                        <span class="estado-badge ${r.estado}">${r.estado === 'pendiente' ? '⏳ Pendiente' : '✅ Confirmada'}</span>
                        ${r.estado === 'pendiente' ? `<button class="confirm-btn" onclick="confirmarReserva(${r.id})">✓ Confirmar</button>` : ''}
                        <button class="delete-btn" onclick="eliminarReserva(${r.id})" style="padding:0.4rem 0.8rem; font-size:0.8rem;">🗑️</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }

    if (noche.length > 0) {
        html += '<div class="turno-section"><h4>🌙 Noche</h4>';
        noche.forEach(r => {
            html += `
                <div class="reservation-mini ${r.estado}">
                    <div>
                        <strong>${r.hora} - ${r.nombre}</strong>
                        <small>📞 ${r.telefono} | 👥 ${r.personas === 'mas8' ? '8+' : r.personas} personas</small>
                        ${r.comentarios ? `<br><small>💬 ${r.comentarios}</small>` : ''}
                    </div>
                    <div class="reservation-actions">
                        <span class="estado-badge ${r.estado}">${r.estado === 'pendiente' ? '⏳ Pendiente' : '✅ Confirmada'}</span>
                        ${r.estado === 'pendiente' ? `<button class="confirm-btn" onclick="confirmarReserva(${r.id})">✓ Confirmar</button>` : ''}
                        <button class="delete-btn" onclick="eliminarReserva(${r.id})" style="padding:0.4rem 0.8rem; font-size:0.8rem;">🗑️</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }

    if (reservas.length === 0) {
        html = '<p style="text-align:center; color:#999; padding:2rem;">Sin reservas para este día</p>';
    }

    document.getElementById('dayReservationsContent').innerHTML = html;
    container.classList.add('show');
}

function mostrarTodasReservas(reservas) {
    const container = document.getElementById('reservationsList');

    if (reservas.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; padding:2rem;">No hay reservas</p>';
        return;
    }

    reservas.sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
        return a.hora.localeCompare(b.hora);
    });

    let html = '';
    reservas.forEach(r => {
        const fechaObj = new Date(r.fecha + 'T00:00:00');
        const fechaFormateada = fechaObj.toLocaleDateString('es-ES', { 
            day: 'numeric', 
            month: 'short',
            year: 'numeric'
        });

        html += `
            <div class="reservation-item ${r.estado}">
                <div class="reservation-info">
                    <strong>${fechaFormateada} - ${r.hora}</strong>
                    <small>${r.nombre} | ${r.telefono} | ${r.personas === 'mas8' ? '8+' : r.personas} personas</small>
                    ${r.comentarios ? `<br><small>💬 ${r.comentarios}</small>` : ''}
                </div>
                <div class="reservation-actions">
                    <span class="estado-badge ${r.estado}">${r.estado === 'pendiente' ? 'Pendiente' : 'Confirmada'}</span>
                    ${r.estado === 'pendiente' ? `<button class="confirm-btn" onclick="confirmarReserva(${r.id})">Confirmar</button>` : ''}
                    <button class="delete-btn" onclick="eliminarReserva(${r.id})">Eliminar</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ========== GESTIÓN DE MENÚ (FIREBASE + IMGBB) ==========
async function subirFotoMenu(input) {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];

    if (file.size > 5 * 1024 * 1024) {
        alert('⚠️ La imagen es muy grande. Máximo 5 MB.');
        return;
    }

    if (!file.type.startsWith('image/')) {
        alert('⚠️ Solo se permiten imágenes.');
        return;
    }

    const label = document.querySelector('.upload-label');
    const originalText = label.textContent;
    label.innerHTML = '<span class="loading-spinner"></span> Subiendo...';
    label.classList.add('uploading');

    try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.imgbb.apiKey}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Error subiendo a ImgBB');

        const data = await response.json();
        const imageUrl = data.data.url;

        await guardarMenuEnServidor(imageUrl);

        label.textContent = '✅ Menú actualizado y sincronizado';
        label.classList.remove('uploading');

        setTimeout(() => {
            label.textContent = originalText;
        }, 3000);

        cargarMenusDesdeServidor();

    } catch (error) {
        console.error('Error:', error);
        label.textContent = '❌ Error al subir. Inténtalo de nuevo.';
        label.classList.remove('uploading');

        setTimeout(() => {
            label.textContent = originalText;
        }, 3000);
    }

    input.value = '';
}

async function guardarMenuEnServidor(url) {
    const menuData = {
        url: url,
        timestamp: new Date().toISOString(),
        active: true
    };

    try {
        const response = await fetch(`${CONFIG.firebase.dbUrl}menus.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(menuData)
        });

        if (!response.ok) throw new Error('Error guardando en Firebase');

        const result = await response.json();
        console.log('Menú guardado en Firebase:', result.name);

        await marcarMenuComoActivo(result.name);

    } catch (error) {
        console.error('Error guardando en servidor:', error);
        throw error;
    }
}

async function marcarMenuComoActivo(menuId) {
    try {
        const response = await fetch(`${CONFIG.firebase.dbUrl}menus.json`);
        const menus = await response.json();

        if (!menus) return;

        for (const [id, menu] of Object.entries(menus)) {
            const isActive = id === menuId;
            await fetch(`${CONFIG.firebase.dbUrl}menus/${id}.json`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ active: isActive })
            });
        }

    } catch (error) {
        console.error('Error actualizando estado activo:', error);
    }
}

async function cargarMenusDesdeServidor() {
    try {
        const response = await fetch(`${CONFIG.firebase.dbUrl}menus.json`);

        if (!response.ok) {
            console.warn('Firebase no disponible');
            mostrarAdvertenciaFirebase();
            return;
        }

        ocultarAdvertenciaFirebase();

        const menus = await response.json();

        if (!menus) {
            mostrarMensajeSinMenus();
            return;
        }

        const menusArray = Object.entries(menus).map(([id, data]) => ({
            id,
            ...data
        }));

        menusArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const menuActivo = menusArray.find(m => m.active);
        if (menuActivo) {
            mostrarMenuActivo(menuActivo);
        }

        mostrarGaleriaMenus(menusArray);

    } catch (error) {
        console.error('Error cargando menús:', error);
        mostrarAdvertenciaFirebase();
    }
}

function mostrarMenuActivo(menu) {
    const imgElement = document.getElementById('menuImgDisplay');
    imgElement.src = menu.url;
    imgElement.style.display = 'block';

    const msgElement = document.getElementById('noMenuMsg');
    if (msgElement) msgElement.style.display = 'none';
}

function mostrarGaleriaMenus(menus) {
    const gallery = document.getElementById('menuGallery');
    if (!gallery) return;

    if (menus.length === 0) {
        gallery.innerHTML = '<p class="no-menus-msg">No hay menús subidos todavía</p>';
        return;
    }

    gallery.innerHTML = '';

    menus.forEach(menu => {
        const item = document.createElement('div');
        item.className = 'menu-gallery-item';

        const fecha = new Date(menu.timestamp);
        const fechaStr = fecha.toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: '2-digit',
            year: '2-digit'
        });
        const horaStr = fecha.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        item.innerHTML = `
            ${menu.active ? '<span class="active-badge">ACTIVO</span>' : ''}
            <img src="${menu.url}" alt="Menú" onclick="window.open('${menu.url}', '_blank')">
            <div class="menu-gallery-meta">
                <small>${fechaStr} ${horaStr}</small>
                <button class="delete-img-btn" onclick="eliminarMenuServidor('${menu.id}')">🗑️</button>
            </div>
        `;

        gallery.appendChild(item);
    });
}

async function eliminarMenuServidor(menuId) {
    if (!confirm('¿Eliminar este menú del servidor?')) return;

    try {
        const response = await fetch(`${CONFIG.firebase.dbUrl}menus/${menuId}.json`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Error eliminando');

        alert('✅ Menú eliminado');
        cargarMenusDesdeServidor();

    } catch (error) {
        console.error('Error:', error);
        alert('❌ Error al eliminar');
    }
}

function mostrarMensajeSinMenus() {
    const imgElement = document.getElementById('menuImgDisplay');
    imgElement.style.display = 'none';

    const msgElement = document.getElementById('noMenuMsg');
    if (msgElement) msgElement.style.display = 'block';
}

function mostrarAdvertenciaFirebase() {
    const warning = document.getElementById('firebaseWarning');
    if (warning) warning.style.display = 'block';
}

function ocultarAdvertenciaFirebase() {
    const warning = document.getElementById('firebaseWarning');
    if (warning) warning.style.display = 'none';
}

// ========== RESERVA MANUAL (ADMIN) ==========
function mostrarModalReservaManual() {
    document.getElementById('manualReservationModal').classList.add('show');
}

function cerrarModalReservaManual() {
    document.getElementById('manualReservationModal').classList.remove('show');
    document.getElementById('manualReservationForm').reset();
}

function guardarReservaManual(event) {
    event.preventDefault();

    const nombre = sanitizeInput(document.getElementById('manualNombre').value);
    const prefijo = document.getElementById('manualPrefijo').value;
    const telefono = sanitizePhone(document.getElementById('manualTelefono').value);
    const fecha = document.getElementById('manualFecha').value;
    const hora = document.getElementById('manualHora').value;
    const personasVal = document.getElementById('manualPersonas').value;
    const comentarios = sanitizeInput(document.getElementById('manualComentarios').value);

    if (!nombre || telefono.length !== 9 || !fecha || !hora || !personasVal) {
        alert('❌ Completa todos los campos obligatorios');
        return;
    }

    const reservas = obtenerReservas();
    reservas.push({
        id: Date.now(),
        nombre,
        telefono: prefijo + telefono,
        fecha,
        hora,
        personas: personasVal,
        comentarios,
        estado: 'confirmada',
        timestamp: new Date().toISOString()
    });
    guardarReservas(reservas);

    cerrarModalReservaManual();
    cargarDatosAdmin();
    alert('✅ Reserva añadida y confirmada');
}

// ========== MODALES LEGALES ==========
function abrirModalLegal(tipo) {
    const modal = document.getElementById(tipo + 'Modal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function cerrarModalLegal(tipo) {
    const modal = document.getElementById(tipo + 'Modal');
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', function() {
    const hoy = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('fecha');
    if (fechaInput) {
        fechaInput.setAttribute('min', hoy);
    }

    const manualFechaInput = document.getElementById('manualFecha');
    if (manualFechaInput) {
        manualFechaInput.setAttribute('min', hoy);
    }

    cargarMenusDesdeServidor();

    setInterval(cargarMenusDesdeServidor, CONFIG.menuPollInterval);

    const pinInput = document.getElementById('pinInput');
    if (pinInput) {
        pinInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                verificarPIN();
            }
        });
    }

    console.log('✅ Sistema inicializado - Restaurante La Clave');
});