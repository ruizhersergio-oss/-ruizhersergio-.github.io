// ============================================
// CONFIGURACIÓN - Restaurante La Clave
// ============================================

const CONFIG = {
    // Sistema de Reservas
    capacidad: {
        mediodia: 15,
        noche: 15,
        umbralNaranja: 7,
        umbralRojo: 10
    },

    // Precios y tiempos
    precioMedio: 25,
    expiracionReservasHoras: 24,

    // Seguridad - CAMBIAR ANTES DE PRODUCCIÓN
    pinAdmin: '2010', // ⚠️ CAMBIAR POR UNO SEGURO
    maxIntentosLogin: 3,
    tiempoBloqueoLogin: 300000, // 5 minutos en ms

    // APIs Externas
    imgbb: {
        apiKey: '0d76e8bef888bcc0d47d93929dcac1b5' // ⚠️ Validar permisos
    },

    firebase: {
        dbUrl: 'https://la-clave-5f529-default-rtdb.firebaseio.com/'
    },

    // Sistema de sincronización
    menuPollInterval: 30000, // 30 segundos

    // WhatsApp
    whatsappNumero: '34669670985',

    // Horarios de operación
    horarios: {
        mediodia: ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30'],
        noche: ['20:00', '20:30', '21:00', '21:30', '22:00', '22:30']
    }
};

// Protección contra modificación
Object.freeze(CONFIG);
Object.freeze(CONFIG.capacidad);
Object.freeze(CONFIG.imgbb);
Object.freeze(CONFIG.firebase);
Object.freeze(CONFIG.horarios);