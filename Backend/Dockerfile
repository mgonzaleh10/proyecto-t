# ---------- Backend: Node + Python + Julia (Papermill) ----------
FROM node:20-bookworm-slim

# 1) Dependencias del sistema (Python + utilidades para descargar Julia)
RUN apt-get update && apt-get install -y \
    python3 python3-venv python3-pip \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2) Instalar dependencias Node (producción)
COPY package*.json ./
RUN npm ci --omit=dev

# 3) Copiar el resto del proyecto
COPY . .

# 4) Crear venv e instalar papermill (evita PEP 668)
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/venv/bin/pip install --no-cache-dir papermill jupyter nbclient jupyter-client

# 5) Instalar Julia (1.11.x) y registrar kernel IJulia
ARG JULIA_VERSION=1.11.2
RUN curl -L "https://julialang-s3.julialang.org/bin/linux/x64/1.11/julia-${JULIA_VERSION}-linux-x86_64.tar.gz" \
  | tar -xz -C /opt \
  && ln -s /opt/julia-${JULIA_VERSION}/bin/julia /usr/local/bin/julia

# 6) Instalar IJulia + paquetes mínimos típicos del notebook (ajusta si tu notebook usa otros)
#    - IJulia: kernel para Jupyter
#    - JuMP/HiGHS: típico para optimización
RUN julia -e 'using Pkg; \
  Pkg.add(["IJulia","XLSX","DataFrames","CSV","Tables","JuMP","HiGHS"]); \
  Pkg.precompile();'


# 7) Asegurar que exista el kernel "julia-1.11" (por tu error exacto)
RUN julia -e 'using IJulia; IJulia.installkernel("julia-1.11")'

# 8) Usar el venv por defecto
ENV PATH="/opt/venv/bin:$PATH"

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/index.js"]
