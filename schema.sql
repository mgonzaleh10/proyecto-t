CREATE DATABASE proyecto;

---------------------------------------------
--------- BASE DE DATOS ACTUALIZADA ---------
---------------------------------------------

-- Tabla de usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100)        NOT NULL,
    correo VARCHAR(100) UNIQUE NOT NULL,
    contrasena VARCHAR(100)    NOT NULL,
    rol VARCHAR(20)            NOT NULL
        CHECK (rol IN ('crew')),
    horas_contrato INTEGER,
    puede_cerrar   BOOLEAN
);

-- Tabla de disponibilidades
CREATE TABLE disponibilidades (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL
        REFERENCES usuarios(id),
    dia_semana VARCHAR(10) NOT NULL
        CHECK (dia_semana IN (
            'lunes','martes','miércoles',
            'jueves','viernes','sábado','domingo'
        )),
    hora_inicio TIME NOT NULL,
    hora_fin    TIME NOT NULL,
    fecha_envio DATE DEFAULT CURRENT_DATE
);

-- Tabla de beneficios o permisos especiales
CREATE TABLE beneficios (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL
        REFERENCES usuarios(id),
    tipo       VARCHAR(50) NOT NULL,
    fecha      DATE         NOT NULL,
    descripcion TEXT
);

-- Tabla de turnos generados
CREATE TABLE turnos (
    id           SERIAL PRIMARY KEY,
    usuario_id   INTEGER NOT NULL
                   REFERENCES usuarios(id),
    fecha        DATE NOT NULL,
    hora_inicio  TIME NOT NULL,
    hora_fin     TIME NOT NULL,
    observaciones TEXT
);

-- Tabla historial de generación de horarios
CREATE TABLE historial_generacion (
    id                SERIAL PRIMARY KEY,
    fecha_generacion  TIMESTAMP WITHOUT TIME ZONE NOT NULL
                        DEFAULT CURRENT_TIMESTAMP,
    generado_por      INTEGER NOT NULL
                        REFERENCES usuarios(id),
    observaciones     TEXT
);

-----------------------

-- Tabla licencias medicas
CREATE TABLE licencias (
    id 				SERIAL PRIMARY KEY,
    usuario_id 		INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_inicio 	DATE NOT NULL,
    fecha_fin 		DATE NOT NULL
);

-----------------------





CREATE TABLE intercambios_turnos (
  id SERIAL PRIMARY KEY,
  turno_origen_id INT REFERENCES turnos(id) ON DELETE CASCADE,
  usuario_solicitante INT REFERENCES usuarios(id),
  usuario_candidato INT REFERENCES usuarios(id),
  fecha DATE NOT NULL,
  tipo VARCHAR(20) CHECK (tipo IN ('swap','cobertura')),
  estado VARCHAR(20) DEFAULT 'pendiente',
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_confirmacion TIMESTAMP
);

----------------------------

SELECT * FROM usuarios;
SELECT * FROM disponibilidades;
SELECT * FROM turnos;
SELECT * FROM beneficios;
SELECT * FROM licencias;
SELECT * FROM intercambios_turnos;

-- Vacía y reinicia la tabla de disponibilidades
TRUNCATE disponibilidades RESTART IDENTITY CASCADE;

-- Vacía y reinicia la tabla de beneficios
TRUNCATE beneficios RESTART IDENTITY CASCADE;

-- Vacía y reinicia la tabla de turnos
TRUNCATE turnos RESTART IDENTITY CASCADE;


-- Vacía y reinicia la tabla de usuarios
TRUNCATE usuarios RESTART IDENTITY CASCADE;

-- Vacía y reinicia la tabla de intercambios_turnos
TRUNCATE intercambios_turnos RESTART IDENTITY CASCADE;

DELETE FROM intercambios_turnos;

DROP TABLE usuarios





