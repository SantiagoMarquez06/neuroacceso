// GENERADO por scripts/generar-tipos.mjs desde ../contrato — no editar a mano.
// Para actualizarlo: npm run tipos
export interface paths {
    "/api/v1/salud": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Salud */
        get: operations["salud_api_v1_salud_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/estado": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Estado */
        get: operations["estado_api_v1_estado_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conexion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Conectar */
        post: operations["conectar_api_v1_conexion_post"];
        /** Desconectar */
        delete: operations["desconectar_api_v1_conexion_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/modo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Modo */
        put: operations["modo_api_v1_modo_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/calibracion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Calibrar */
        post: operations["calibrar_api_v1_calibracion_post"];
        /** Cancelar Calibracion */
        delete: operations["cancelar_calibracion_api_v1_calibracion_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/gestos/disponibles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Gestos */
        get: operations["gestos_api_v1_gestos_disponibles_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/perfiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Perfiles */
        get: operations["perfiles_api_v1_perfiles_get"];
        put?: never;
        /** Crear Perfil */
        post: operations["crear_perfil_api_v1_perfiles_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/perfiles/{pid}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Perfil */
        get: operations["perfil_api_v1_perfiles__pid__get"];
        put?: never;
        post?: never;
        /** Borrar Perfil */
        delete: operations["borrar_perfil_api_v1_perfiles__pid__delete"];
        options?: never;
        head?: never;
        /** Editar Perfil */
        patch: operations["editar_perfil_api_v1_perfiles__pid__patch"];
        trace?: never;
    };
    "/api/v1/perfiles/{pid}/activar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Activar */
        post: operations["activar_api_v1_perfiles__pid__activar_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/perfiles/{pid}/ajustes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Ajustes */
        get: operations["ajustes_api_v1_perfiles__pid__ajustes_get"];
        /** Guardar Ajustes */
        put: operations["guardar_ajustes_api_v1_perfiles__pid__ajustes_put"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sesiones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Sesiones */
        get: operations["sesiones_api_v1_sesiones_get"];
        put?: never;
        /** Crear Sesion */
        post: operations["crear_sesion_api_v1_sesiones_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sesiones/exportar.csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Exportar */
        get: operations["exportar_api_v1_sesiones_exportar_csv_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sesiones/{sid}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Sesion */
        get: operations["sesion_api_v1_sesiones__sid__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sesiones/{sid}/intentos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Intentos */
        post: operations["intentos_api_v1_sesiones__sid__intentos_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sesiones/{sid}/enunciados": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Enunciados */
        post: operations["enunciados_api_v1_sesiones__sid__enunciados_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/sesiones/{sid}/finalizar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Finalizar */
        post: operations["finalizar_api_v1_sesiones__sid__finalizar_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/entrenamiento": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Entrenar */
        post: operations["entrenar_api_v1_entrenamiento_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/entrenamiento/{eid}/aceptar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Aceptar */
        post: operations["aceptar_api_v1_entrenamiento__eid__aceptar_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/entrenamiento/{eid}/rechazar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rechazar */
        post: operations["rechazar_api_v1_entrenamiento__eid__rechazar_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/voz/hablar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Hablar */
        post: operations["hablar_api_v1_voz_hablar_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** Ajustes */
        Ajustes: {
            /**
             * Version
             * @default 1
             * @constant
             */
            version: 1;
            /**
             * @default {
             *       "ganancia_x": 25,
             *       "ganancia_y": 25,
             *       "zona_muerta": 0.3,
             *       "suavizado": 0.5,
             *       "invertir_x": false,
             *       "invertir_y": false
             *     }
             */
            cursor: components["schemas"]["AjustesCursor"];
            /**
             * @default {
             *       "umbral": 0.4,
             *       "cooldown_ms": 1000,
             *       "mapeo": {
             *         "comunicador": {
             *           "clench": "seleccionar",
             *           "winkR": "seleccionar"
             *         },
             *         "cursor": {
             *           "clench": "clic",
             *           "winkL": "pausar",
             *           "winkR": "clic_derecho"
             *         }
             *       },
             *       "gesto_rescate": "surprise"
             *     }
             */
            gestos: components["schemas"]["AjustesGestos"];
            /**
             * @default {
             *       "activo": false,
             *       "ms": 1000,
             *       "radio_px": 30
             *     }
             */
            dwell: components["schemas"]["AjustesDwell"];
            /**
             * @default {
             *       "tiempo_barrido_ms": 1200,
             *       "frases": [
             *         "Sí",
             *         "No",
             *         "Tengo sed",
             *         "Tengo dolor",
             *         "Necesito ayuda",
             *         "Gracias"
             *       ],
             *       "disposicion": "abc"
             *     }
             */
            comunicador: components["schemas"]["AjustesComunicador"];
            /**
             * @default {
             *       "velocidad": 150
             *     }
             */
            voz: components["schemas"]["AjustesVoz"];
        };
        /** AjustesComunicador */
        AjustesComunicador: {
            /**
             * Tiempo Barrido Ms
             * @default 1200
             */
            tiempo_barrido_ms: number;
            /**
             * Frases
             * @default [
             *       "Sí",
             *       "No",
             *       "Tengo sed",
             *       "Tengo dolor",
             *       "Necesito ayuda",
             *       "Gracias"
             *     ]
             */
            frases: string[];
            /**
             * Disposicion
             * @default abc
             * @enum {string}
             */
            disposicion: "abc" | "frecuencia";
        };
        /** AjustesCursor */
        AjustesCursor: {
            /**
             * Ganancia X
             * @default 25
             */
            ganancia_x: number;
            /**
             * Ganancia Y
             * @default 25
             */
            ganancia_y: number;
            /**
             * Zona Muerta
             * @default 0.3
             */
            zona_muerta: number;
            /**
             * Suavizado
             * @default 0.5
             */
            suavizado: number;
            /**
             * Invertir X
             * @default false
             */
            invertir_x: boolean;
            /**
             * Invertir Y
             * @default false
             */
            invertir_y: boolean;
        };
        /** AjustesDwell */
        AjustesDwell: {
            /**
             * Activo
             * @default false
             */
            activo: boolean;
            /**
             * Ms
             * @default 1000
             */
            ms: number;
            /**
             * Radio Px
             * @default 30
             */
            radio_px: number;
        };
        /** AjustesGestos */
        AjustesGestos: {
            /**
             * Umbral
             * @default 0.4
             */
            umbral: number;
            /**
             * Cooldown Ms
             * @default 1000
             */
            cooldown_ms: number;
            /**
             * @default {
             *       "cursor": {
             *         "clench": "clic",
             *         "winkL": "pausar",
             *         "winkR": "clic_derecho"
             *       },
             *       "comunicador": {
             *         "clench": "seleccionar",
             *         "winkR": "seleccionar"
             *       }
             *     }
             */
            mapeo: components["schemas"]["MapeoGestos"];
            /**
             * Gesto Rescate
             * @default surprise
             */
            gesto_rescate: string;
        };
        /** AjustesVoz */
        AjustesVoz: {
            /** Voz Id */
            voz_id: string | null;
            /**
             * Velocidad
             * @default 150
             */
            velocidad: number;
        };
        /** CambioModo */
        CambioModo: {
            /**
             * Modo
             * @enum {string}
             */
            modo: "cursor" | "comunicador" | "pausa";
        };
        /** Conexion */
        Conexion: {
            /**
             * Estado
             * @default desconectado
             * @enum {string}
             */
            estado: "desconectado" | "conectando" | "conectado" | "error";
            /** Casco Id */
            casco_id: string | null;
            /** Detalle */
            detalle: string | null;
        };
        /** EntrenamientoIniciado */
        EntrenamientoIniciado: {
            /** Id */
            id: string;
        };
        /** Enunciado */
        Enunciado: {
            /** Texto */
            texto: string;
            /** Duracion Ms */
            duracion_ms: number;
            /**
             * Selecciones
             * @default 0
             */
            selecciones?: number;
            /**
             * Correcciones
             * @default 0
             */
            correcciones?: number;
        };
        /** Error */
        Error: {
            /**
             * Codigo
             * @enum {string}
             */
            codigo: "CORTEX_NO_DISPONIBLE" | "APP_NO_APROBADA" | "SIN_CASCO" | "CASCO_DESCONECTADO" | "TOKEN_CORTEX_EXPIRADO" | "PERFIL_NO_ENCONTRADO" | "MODO_INVALIDO" | "VALIDACION" | "NO_AUTORIZADO" | "ORIGEN_NO_PERMITIDO";
            /** Mensaje */
            mensaje: string;
            /** Detalle */
            detalle: {
                [key: string]: unknown;
            } | null;
        };
        /** Estado */
        Estado: {
            conexion: components["schemas"]["Conexion"];
            /**
             * Modo
             * @default desconectado
             * @enum {string}
             */
            modo: "desconectado" | "calibrando" | "cursor" | "comunicador" | "pausa" | "entrenando";
            /**
             * Pausado
             * @default false
             */
            pausado: boolean;
            /**
             * Calibrado
             * @default false
             */
            calibrado: boolean;
            /** Perfil Activo Id */
            perfil_activo_id: string | null;
            latencia_ms: components["schemas"]["Latencia"];
        };
        /** GestosDisponibles */
        GestosDisponibles: {
            facial: components["schemas"]["GestosFaciales"];
            /** Mental */
            mental: string[];
        };
        /** GestosFaciales */
        GestosFaciales: {
            /** Ojos */
            ojos: string[];
            /** Superior */
            superior: string[];
            /** Inferior */
            inferior: string[];
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail: components["schemas"]["ValidationError"][];
        };
        /** Intento */
        Intento: {
            /** N */
            n: number;
            /** T Inicio Ms */
            t_inicio_ms: number;
            /** T Fin Ms */
            t_fin_ms: number;
            objetivo: components["schemas"]["Objetivo"];
            origen: components["schemas"]["Punto"];
            clic: components["schemas"]["Punto"];
            /** Acierto */
            acierto: boolean;
            /**
             * Dpr
             * @default 1
             */
            dpr?: number;
        };
        /** Latencia */
        Latencia: {
            /**
             * P50
             * @default 0
             */
            p50: number;
            /**
             * P95
             * @default 0
             */
            p95: number;
        };
        /** MapeoGestos */
        MapeoGestos: {
            /**
             * Cursor
             * @default {
             *       "clench": "clic",
             *       "winkR": "clic_derecho",
             *       "winkL": "pausar"
             *     }
             */
            cursor: {
                [key: string]: "clic" | "clic_derecho" | "doble_clic" | "pausar" | "seleccionar" | "atras" | "cambiar_modo" | "ninguna";
            };
            /**
             * Comunicador
             * @default {
             *       "clench": "seleccionar",
             *       "winkR": "seleccionar"
             *     }
             */
            comunicador: {
                [key: string]: "clic" | "clic_derecho" | "doble_clic" | "pausar" | "seleccionar" | "atras" | "cambiar_modo" | "ninguna";
            };
        };
        /** Metricas */
        Metricas: {
            /** Throughput Bps */
            throughput_bps: number | null;
            /** Tiempo Medio Ms */
            tiempo_medio_ms: number | null;
            /** Precision */
            precision: number | null;
            /** Falsos Positivos Min */
            falsos_positivos_min: number | null;
            /** Caracteres Min */
            caracteres_min: number | null;
        };
        /** ModoActual */
        ModoActual: {
            /**
             * Modo
             * @enum {string}
             */
            modo: "desconectado" | "calibrando" | "cursor" | "comunicador" | "pausa" | "entrenando";
            /** Pausado */
            pausado: boolean;
        };
        /** Objetivo */
        Objetivo: {
            /** X */
            x: number;
            /** Y */
            y: number;
            /** Ancho */
            ancho: number;
        };
        /** PedirCalibracion */
        PedirCalibracion: {
            /**
             * Tipo
             * @default centro
             * @constant
             */
            tipo?: "centro";
        };
        /** PedirConexion */
        PedirConexion: {
            /** Fuente */
            fuente?: ("cortex" | "simulador" | "replay") | null;
        };
        /** PedirEntrenamiento */
        PedirEntrenamiento: {
            /**
             * Deteccion
             * @enum {string}
             */
            deteccion: "mental" | "facial";
            /** Accion */
            accion: string;
        };
        /** PedirVoz */
        PedirVoz: {
            /** Texto */
            texto: string;
        };
        /** Perfil */
        Perfil: {
            /** Id */
            id: string;
            /** Nombre */
            nombre: string;
            /** Cortex Profile */
            cortex_profile: string | null;
            /** Creado En */
            creado_en: string;
        };
        /** PerfilCrear */
        PerfilCrear: {
            /** Nombre */
            nombre: string;
            /** Cortex Profile */
            cortex_profile?: string | null;
        };
        /** PerfilEditar */
        PerfilEditar: {
            /** Nombre */
            nombre?: string | null;
            /** Cortex Profile */
            cortex_profile?: string | null;
        };
        /** Punto */
        Punto: {
            /** X */
            x: number;
            /** Y */
            y: number;
        };
        /** Salud */
        Salud: {
            /** Version */
            version: string;
            /**
             * Api Version
             * @default 1
             */
            api_version: number;
            /**
             * Fuente
             * @enum {string}
             */
            fuente: "cortex" | "simulador" | "replay";
            /** Demo */
            demo: boolean;
        };
        /** Sesion */
        Sesion: {
            /** Id */
            id: string;
            /** Perfil Id */
            perfil_id: string;
            /**
             * Tipo
             * @enum {string}
             */
            tipo: "libre" | "practica" | "comunicador";
            /** Inicio */
            inicio: string;
            /** Fin */
            fin: string | null;
            metricas: components["schemas"]["Metricas"] | null;
        };
        /** SesionCrear */
        SesionCrear: {
            /**
             * Tipo
             * @enum {string}
             */
            tipo: "libre" | "practica" | "comunicador";
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
            /** Input */
            input: unknown;
            /** Context */
            ctx: Record<string, never>;
        };
        /** OrigenAccion */
        OrigenAccion: {
            /**
             * Tipo
             * @enum {string}
             */
            tipo: "gesto" | "mental" | "dwell" | "interfaz";
            /** Nombre */
            nombre: string;
        };
        /** EvAccion */
        EvAccion: {
            /**
             * Accion
             * @enum {string}
             */
            accion: "clic" | "clic_derecho" | "doble_clic" | "pausar" | "seleccionar" | "atras" | "cambiar_modo" | "ninguna";
            origen: components["schemas"]["OrigenAccion"];
            /**
             * Modo
             * @enum {string}
             */
            modo: "desconectado" | "calibrando" | "cursor" | "comunicador" | "pausa" | "entrenando";
            /** Ejecutada */
            ejecutada: boolean;
            /**
             * Motivo
             * @default null
             */
            motivo: ("pausado" | "cooldown" | "bajo_umbral") | null;
        };
        /** EvAjustes */
        EvAjustes: {
            /** Perfil Id */
            perfil_id: string;
            ajustes: components["schemas"]["Ajustes"];
        };
        /** EvCalibracion */
        EvCalibracion: {
            /**
             * Estado
             * @enum {string}
             */
            estado: "en_curso" | "completada" | "fallida" | "cancelada";
            /** Progreso */
            progreso: number;
            /** Instruccion */
            instruccion: string;
        };
        /** EvConexion */
        EvConexion: {
            /**
             * Estado
             * @default desconectado
             * @enum {string}
             */
            estado: "desconectado" | "conectando" | "conectado" | "error";
            /**
             * Casco Id
             * @default null
             */
            casco_id: string | null;
            /**
             * Detalle
             * @default null
             */
            detalle: string | null;
            /**
             * Codigo
             * @default null
             */
            codigo: ("CORTEX_NO_DISPONIBLE" | "APP_NO_APROBADA" | "SIN_CASCO" | "CASCO_DESCONECTADO" | "TOKEN_CORTEX_EXPIRADO" | "PERFIL_NO_ENCONTRADO" | "MODO_INVALIDO" | "VALIDACION" | "NO_AUTORIZADO" | "ORIGEN_NO_PERMITIDO") | null;
        };
        /** EvDispositivo */
        EvDispositivo: {
            /** Bateria Pct */
            bateria_pct: number;
            /** Senal */
            senal: number;
            /** Contacto */
            contacto: {
                [key: string]: number;
            };
            /** Calidad Global */
            calidad_global: number;
        };
        /** EvEntrada */
        EvEntrada: {
            /**
             * Accion
             * @enum {string}
             */
            accion: "seleccionar" | "atras";
        };
        /** EvEntrenamiento */
        EvEntrenamiento: {
            /**
             * Fase
             * @enum {string}
             */
            fase: "iniciado" | "exito" | "fallo" | "guardado" | "rechazado";
            /**
             * Deteccion
             * @enum {string}
             */
            deteccion: "mental" | "facial";
            /** Accion */
            accion: string;
        };
        /** EvError */
        EvError: {
            /**
             * Codigo
             * @enum {string}
             */
            codigo: "CORTEX_NO_DISPONIBLE" | "APP_NO_APROBADA" | "SIN_CASCO" | "CASCO_DESCONECTADO" | "TOKEN_CORTEX_EXPIRADO" | "PERFIL_NO_ENCONTRADO" | "MODO_INVALIDO" | "VALIDACION" | "NO_AUTORIZADO" | "ORIGEN_NO_PERMITIDO";
            /** Mensaje */
            mensaje: string;
            /** Recuperable */
            recuperable: boolean;
        };
        /** EvGesto */
        EvGesto: {
            /** Gesto */
            gesto: string;
            /**
             * Zona
             * @enum {string}
             */
            zona: "ojos" | "superior" | "inferior" | "mental";
            /** Potencia */
            potencia: number;
        };
        /** EvHola */
        EvHola: {
            /** Version */
            version: string;
            estado: components["schemas"]["Estado"];
            /** @default null */
            ajustes: components["schemas"]["Ajustes"] | null;
        };
        /** EvModo */
        EvModo: {
            /**
             * Modo
             * @enum {string}
             */
            modo: "desconectado" | "calibrando" | "cursor" | "comunicador" | "pausa" | "entrenando";
            /** Pausado */
            pausado: boolean;
            /**
             * Motivo
             * @enum {string}
             */
            motivo: "usuario" | "gesto_rescate" | "ui_desconectada" | "calibracion" | "entrenamiento" | "conexion";
        };
        /** EvOrientacion */
        EvOrientacion: {
            /** Yaw */
            yaw: number;
            /** Pitch */
            pitch: number;
            /** Calibrado */
            calibrado: boolean;
        };
        /**
         * Sobre
         * @description Envoltorio de todo mensaje WebSocket (servidor → cliente).
         */
        Sobre: {
            /**
             * V
             * @default 1
             * @constant
             */
            v: 1;
            /** Tipo */
            tipo: string;
            /** Seq */
            seq: number;
            /** T */
            t: number;
            /** Datos */
            datos: {
                [key: string]: unknown;
            };
        };
        /**
         * EventosWs
         * @description Datos de cada evento WebSocket, por su campo "tipo".
         */
        EventosWs: {
            accion: components["schemas"]["EvAccion"];
            ajustes: components["schemas"]["EvAjustes"];
            calibracion: components["schemas"]["EvCalibracion"];
            conexion: components["schemas"]["EvConexion"];
            dispositivo: components["schemas"]["EvDispositivo"];
            entrada: components["schemas"]["EvEntrada"];
            entrenamiento: components["schemas"]["EvEntrenamiento"];
            error: components["schemas"]["EvError"];
            gesto: components["schemas"]["EvGesto"];
            hola: components["schemas"]["EvHola"];
            modo: components["schemas"]["EvModo"];
            orientacion: components["schemas"]["EvOrientacion"];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    salud_api_v1_salud_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Salud"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    estado_api_v1_estado_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Estado"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    conectar_api_v1_conexion_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["PedirConexion"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    desconectar_api_v1_conexion_delete: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    modo_api_v1_modo_put: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CambioModo"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ModoActual"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    calibrar_api_v1_calibracion_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "application/json": components["schemas"]["PedirCalibracion"] | null;
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    cancelar_calibracion_api_v1_calibracion_delete: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    gestos_api_v1_gestos_disponibles_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GestosDisponibles"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    perfiles_api_v1_perfiles_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Perfil"][];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    crear_perfil_api_v1_perfiles_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PerfilCrear"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Perfil"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    perfil_api_v1_perfiles__pid__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                pid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Perfil"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    borrar_perfil_api_v1_perfiles__pid__delete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                pid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    editar_perfil_api_v1_perfiles__pid__patch: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                pid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PerfilEditar"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Perfil"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    activar_api_v1_perfiles__pid__activar_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                pid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Estado"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    ajustes_api_v1_perfiles__pid__ajustes_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                pid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ajustes"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    guardar_ajustes_api_v1_perfiles__pid__ajustes_put: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                pid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Ajustes"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ajustes"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    sesiones_api_v1_sesiones_get: {
        parameters: {
            query?: {
                perfil_id?: string | null;
                desde?: string | null;
                hasta?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Sesion"][];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    crear_sesion_api_v1_sesiones_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SesionCrear"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Sesion"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    exportar_api_v1_sesiones_exportar_csv_get: {
        parameters: {
            query?: {
                perfil_id?: string | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    sesion_api_v1_sesiones__sid__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Sesion"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    intentos_api_v1_sesiones__sid__intentos_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Intento"][];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    enunciados_api_v1_sesiones__sid__enunciados_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Enunciado"];
            };
        };
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    finalizar_api_v1_sesiones__sid__finalizar_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Sesion"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    entrenar_api_v1_entrenamiento_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PedirEntrenamiento"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EntrenamientoIniciado"];
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    aceptar_api_v1_entrenamiento__eid__aceptar_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                eid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    rechazar_api_v1_entrenamiento__eid__rechazar_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                eid: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    hablar_api_v1_voz_hablar_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PedirVoz"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Unauthorized */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Forbidden */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}
