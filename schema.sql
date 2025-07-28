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
        CHECK (rol IN ('administrador', 'crew')),
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
    creado_por   INTEGER NOT NULL
                   REFERENCES usuarios(id),
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

-- Insertar 18 crews con distintos contratos
INSERT INTO usuarios (nombre, correo, contrasena, rol, horas_contrato) VALUES
  -- 2 crews de 45h
  ('Crew A', 'crewa@bk.cl', 'pass123', 'crew', 45),
  ('Crew B', 'crewb@bk.cl', 'pass123', 'crew', 45),

  -- 11 crews de 30h
  ('Crew C', 'crewc@bk.cl', 'pass123', 'crew', 30),
  ('Crew D', 'crewd@bk.cl', 'pass123', 'crew', 30),
  ('Crew E', 'crewe@bk.cl', 'pass123', 'crew', 30),
  ('Crew F', 'crewf@bk.cl', 'pass123', 'crew', 30),
  ('Crew G', 'crewg@bk.cl', 'pass123', 'crew', 30),
  ('Crew H', 'crewh@bk.cl', 'pass123', 'crew', 30),
  ('Crew I', 'crewi@bk.cl', 'pass123', 'crew', 30),
  ('Crew J', 'crewj@bk.cl', 'pass123', 'crew', 30),
  ('Crew K', 'crewk@bk.cl', 'pass123', 'crew', 30),
  ('Crew L', 'crewl@bk.cl', 'pass123', 'crew', 30),
  ('Crew M', 'crewm@bk.cl', 'pass123', 'crew', 30),

  -- 2 crews de 20h
  ('Crew N', 'crewn@bk.cl', 'pass123', 'crew', 20),
  ('Crew O', 'crewo@bk.cl', 'pass123', 'crew', 20),

  -- 3 crews de 16h
  ('Crew P', 'crewp@bk.cl', 'pass123', 'crew', 16),
  ('Crew Q', 'crewq@bk.cl', 'pass123', 'crew', 16),
  ('Crew R', 'crewr@bk.cl', 'pass123', 'crew', 16);

-- Insertar adminsitrador
INSERT INTO usuarios (nombre, correo, contrasena, rol, horas_contrato) VALUES ('Admin Local', 'admin@bk.cl', 'admin123', 'administrador', 0);

-- Insertar disponibilidades
INSERT INTO disponibilidades (usuario_id, dia_semana, hora_inicio, hora_fin) VALUES
  -- Crew 1
  (1,'lunes','08:00','23:30'),
  (1,'martes','08:00','23:30'),
  (1,'miércoles','08:00','23:30'),
  (1,'jueves','08:00','23:30'),
  (1,'viernes','08:00','23:30'),
  (1,'sábado','08:00','23:30'),
  (1,'domingo','08:00','23:30'),
  -- Crew 2
  (2,'lunes','08:00','23:30'),
  (2,'martes','08:00','23:30'),
  (2,'miércoles','08:00','23:30'),
  (2,'jueves','08:00','23:30'),
  (2,'viernes','08:00','23:30'),
  (2,'sábado','08:00','23:30'),
  (2,'domingo','08:00','23:30'),
   -- Crew 3
  (3,'lunes','11:00','20:00'),
  (3,'martes','11:00','20:00'),
  (3,'miércoles','11:00','20:00'),
  (3,'jueves','11:00','20:00'),
  (3,'viernes','11:00','20:00'),
  (3,'sábado','11:00','20:00'),
  (3,'domingo','11:00','20:00'),
   -- Crew 4
  (4,'lunes','16:30','23:30'),
  (4,'martes','16:30','23:30'),
  (4,'miércoles','16:30','23:30'),
  (4,'jueves','16:30','23:30'),
  (4,'viernes','16:30','23:30'),
  (4,'sábado','09:00','23:30'),
  (4,'domingo','09:00','23:30'),
  -- Crew 5
  (5,'lunes','16:30','23:30'),
  (5,'martes','16:30','23:30'),
  (5,'miércoles','16:30','23:30'),
  (5,'jueves','16:30','23:30'),
  (5,'viernes','08:00','23:30'),
  (5,'sábado','08:00','23:30'),
  (5,'domingo','08:00','23:30'),
  -- Crew 6
  (6,'lunes','08:00','23:30'),
  (6,'martes','08:00','23:30'),
  (6,'miércoles','08:00','23:30'),
  (6,'jueves','08:00','23:30'),
  (6,'viernes','08:00','23:30'),
  (6,'sábado','08:00','23:30'),
  (6,'domingo','08:00','23:30'),
   -- Crew 7
  (7,'lunes','13:00','23:30'),
  (7,'martes','13:00','23:30'),
  (7,'miércoles','13:00','23:30'),
  (7,'jueves','11:00','20:00'),
  (7,'viernes','11:00','20:00'),
  (7,'domingo','11:00','20:00'),
   -- Crew 8
  (8,'lunes','08:00','23:30'),
  (8,'martes','08:00','23:30'),
  (8,'miércoles','08:00','23:30'),
  (8,'jueves','08:00','23:30'),
  (8,'viernes','08:00','23:30'),
  (8,'sábado','08:00','23:30'),
  (8,'domingo','08:00','23:30'),
  -- Crew 9
  (9,'lunes','08:00','23:30'),
  (9,'martes','12:00','23:30'),
  (9,'miércoles','15:00','23:30'),
  (9,'jueves','12:00','23:30'),
  (9,'viernes','08:00','23:30'),
  (9,'sábado','08:00','23:30'),
  (9,'domingo','08:00','23:30'),
  -- Crew 10
  (10,'lunes','09:00','23:30'),
  (10,'martes','09:00','23:30'),
  (10,'miércoles','09:00','23:30'),
  (10,'jueves','09:00','23:30'),
  (10,'viernes','09:00','23:30'),
  (10,'sábado','09:00','23:30'),
  (10,'domingo','09:00','23:30'),
   -- Crew 11
  (11,'lunes','09:00','23:30'),
  (11,'martes','09:00','23:30'),
  (11,'miércoles','09:00','23:30'),
  (11,'jueves','09:00','23:30'),
  (11,'viernes','09:00','23:30'),
  (11,'sábado','09:00','23:30'),
  (11,'domingo','09:00','23:30'),
   -- Crew 12
  (12,'lunes','10:00','23:30'),
  (12,'martes','10:00','23:30'),
  (12,'miércoles','10:00','23:30'),
  (12,'jueves','10:00','23:30'),
  (12,'viernes','10:00','23:30'),
  (12,'sábado','10:00','23:30'),
  (12,'domingo','10:00','23:30'),
  -- Crew 13
  (13,'lunes','10:00','23:30'),
  (13,'martes','10:00','23:30'),
  (13,'miércoles','10:00','23:30'),
  (13,'jueves','10:00','23:30'),
  (13,'viernes','10:00','23:30'),
  (13,'sábado','10:00','23:30'),
  (13,'domingo','10:00','23:30'),
  -- Crew 14
  (14,'lunes','09:00','23:30'),
  (14,'sábado','08:00','23:30'),
  (14,'domingo','08:00','23:30'),
   -- Crew 15
  (15,'lunes','09:00','23:30'),
  (15,'martes','09:00','23:30'),
  (15,'miércoles','09:00','23:30'),
  (15,'jueves','09:00','23:30'),
  (15,'viernes','09:00','23:30'),
  (15,'domingo','09:00','23:30'),
   -- Crew 16
  (16,'sábado','08:00','23:30'),
  (16,'domingo','08:00','23:30'),
    -- Crew 17
  (17,'sábado','08:00','23:30'),
  (17,'domingo','08:00','23:30'),
    -- Crew 18
  (18,'sábado','08:00','23:30'),
  (18,'domingo','08:00','23:30');

-- INGRESO DE TURNOS MANUALMENTE PARA PROBAR FUNCIONALIDAD
INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones) VALUES
-- Crew 1
(1,'2025-07-07','08:30','18:30',19,''),
(1,'2025-07-08','08:30','18:30',19,''),
(1,'2025-07-09','09:00','18:00',19,''),
(1,'2025-07-10','08:30','18:30',19,''),
(1,'2025-07-12','08:00','18:00',19,''),

-- Crew 2
(2,'2025-07-08','09:00','19:00',19,''),
(2,'2025-07-09','08:00','18:00',19,''),
(2,'2025-07-10','09:00','18:00',19,''),
(2,'2025-07-11','08:30','18:30',19,''),
(2,'2025-07-13','08:30','18:30',19,''),

-- Crew 3
(3,'2025-07-07','11:00','18:00',19,''),
(3,'2025-07-09','11:00','18:00',19,''),
(3,'2025-07-10','12:00','18:00',19,''),
(3,'2025-07-12','12:00','19:00',19,''),
(3,'2025-07-13','12:00','19:00',19,''),

-- Crew 4
(4,'2025-07-07','16:30','23:30',19,''),
(4,'2025-07-08','17:30','23:30',19,''),
(4,'2025-07-09','15:30','23:30',19,''),
(4,'2025-07-10','16:30','23:30',19,''),
(4,'2025-07-11','16:30','23:30',19,''),

-- Crew 5
(5,'2025-07-07','15:00','22:00',19,''),
(5,'2025-07-08','15:00','22:00',19,''),
(5,'2025-07-11','11:00','18:00',19,''),
(5,'2025-07-12','16:30','23:30',19,''),
(5,'2025-07-13','16:30','23:30',19,''),

-- Crew 6
(6,'2025-07-08','17:30','23:30',19,''),
(6,'2025-07-09','13:00','21:00',19,''),
(6,'2025-07-10','16:30','23:30',19,''),
(6,'2025-07-11','16:30','23:30',19,''),
(6,'2025-07-12','16:30','23:30',19,''),

-- Crew 7
(7,'2025-07-07','17:30','23:30',19,''),
(7,'2025-07-08','13:00','21:00',19,''),
(7,'2025-07-09','16:00','22:00',19,''),
(7,'2025-07-11','09:00','17:00',19,''),
(7,'2025-07-12','11:00','18:00',19,''),

-- Crew 8
(8,'2025-07-07','17:30','23:30',19,''),
(8,'2025-07-08','16:30','23:30',19,''),
(8,'2025-07-09','16:30','23:30',19,''),
(8,'2025-07-10','13:00','21:00',19,''),
(8,'2025-07-11','16:30','23:30',19,''),

-- Crew 9
(9,'2025-07-07','09:00','17:00',19,''),
(9,'2025-07-09','17:30','23:30',19,''),
(9,'2025-07-10','16:30','23:30',19,''),
(9,'2025-07-11','12:00','19:00',19,''),
(9,'2025-07-13','11:00','18:00',19,''),

-- Crew 10
(10,'2025-07-07','12:00','19:00',19,''),
(10,'2025-07-08','11:00','18:00',19,''),
(10,'2025-07-10','16:00','22:00',19,''),
(10,'2025-07-11','13:00','21:00',19,''),
(10,'2025-07-12','10:00','17:00',19,''),

-- Crew 11
(11,'2025-07-07','10:00','17:00',19,''),
(11,'2025-07-08','10:00','17:00',19,''),
(11,'2025-07-09','10:00','17:00',19,''),
(11,'2025-07-10','10:00','17:00',19,''),
(11,'2025-07-11','10:00','17:00',19,''),

-- Crew 12
(12,'2025-07-08','12:00','19:00',19,''),
(12,'2025-07-09','12:00','19:00',19,''),
(12,'2025-07-10','11:00','18:00',19,''),
(12,'2025-07-11','15:00','22:00',19,''),
(12,'2025-07-13','10:00','17:00',19,''),

-- Crew 13
(13,'2025-07-07','11:00','19:00',19,''),
(13,'2025-07-08','11:00','18:00',19,''),
(13,'2025-07-09','13:00','23:00',19,''),
(13,'2025-07-11','13:00','20:00',19,''),
(13,'2025-07-12','13:00','20:00',19,''),

-- Crew 14
(14,'2025-07-07','13:00','21:00',19,''),
(14,'2025-07-12','15:30','23:30',19,''),
(14,'2025-07-13','16:30','23:30',19,''),

-- Crew 15
(15,'2025-07-07','11:00','17:00',19,''),
(15,'2025-07-09','13:00','19:00',19,''),
(15,'2025-07-10','13:00','19:00',19,''),
(15,'2025-07-13','13:00','19:00',19,''),

-- Crew 16
(16,'2025-07-12','12:00','21:00',19,''),
(16,'2025-07-13','14:30','23:30',19,''),

-- Crew 17
(17,'2025-07-12','13:00','22:00',19,''),
(17,'2025-07-13','09:00','18:00',19,''),

-- Crew 18
(18,'2025-07-12','09:00','18:00',19,''),
(18,'2025-07-13','12:00','21:00',19,'')
;


------------
SELECT * FROM usuarios;
SELECT * FROM disponibilidades;
SELECT * FROM turnos;
SELECT * FROM beneficios;

-- Vacía y reinicia la tabla de disponibilidades
TRUNCATE disponibilidades RESTART IDENTITY CASCADE;

-- Vacía y reinicia la tabla de beneficios
TRUNCATE beneficios RESTART IDENTITY CASCADE;

-- Vacía y reinicia la tabla de turnos
TRUNCATE turnos RESTART IDENTITY CASCADE;



DROP TABLE usuarios









