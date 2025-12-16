# ---------- Backend: Node + Python + Julia (Papermill) ----------
FROM node:20-bookworm-slim

# ==========================================
# 1) INFRAESTRUCTURA (Lo que casi nunca cambia)
# ==========================================

# Instalar dependencias del sistema y Python
RUN apt-get update && apt-get install -y \
    python3 python3-venv python3-pip \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Instalar Julia (Versión 1.11.2 según original)
ARG JULIA_VERSION=1.11.2
RUN curl -L "https://julialang-s3.julialang.org/bin/linux/x64/1.11/julia-${JULIA_VERSION}-linux-x86_64.tar.gz" \
  | tar -xz -C /opt \
  && ln -s /opt/julia-${JULIA_VERSION}/bin/julia /usr/local/bin/julia

# (Solo descargar)
RUN julia -e 'using Pkg; \
  Pkg.add(["IJulia","XLSX","DataFrames","CSV","Tables","JuMP","HiGHS"]);'

# (Precompilar - Lo pesado)
# Al separarlo, Docker guarda el progreso del paso anterior.
RUN julia -e 'using Pkg; Pkg.precompile();'

# Configurar Python venv y Papermill
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/venv/bin/pip install --no-cache-dir papermill jupyter nbclient jupyter-client

# Registrar el kernel de Julia para que el Notebook lo vea
RUN julia -e 'using IJulia; IJulia.installkernel("julia-1.11")'

# Configurar variables de entorno globales
ENV PATH="/opt/venv/bin:$PATH"
ENV NODE_ENV=production

# ==========================================
# 2) DEPENDENCIAS DE NODE
# ==========================================
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ==========================================
# 3) CÓDIGO FUENTE (Lo que cambia siempre)
# ==========================================
COPY . .

# Exponemos el puerto interno (no tocar)
EXPOSE 3000
CMD ["node", "src/index.js"]
