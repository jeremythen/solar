# Solar 241 — Plano de diseño

Plano interactivo del lote (HTML/CSS/JS). Abre en el navegador; no necesita backend.

## En la web (GitHub Pages)

**URL:** https://jeremythen.github.io/solar/

## En local

Abre `index.html` o sirve la carpeta:

```bash
python3 -m http.server 8765
```

Luego ve a `http://127.0.0.1:8765/`.

## Compartir diseño

Cada navegador guarda su propio plano (localStorage). Para compartir:

1. **Exportar JSON**
2. Enviar el archivo
3. En el otro dispositivo: **Importar** (combinar o reemplazar)

## Estructura / framing

Pestaña **Estructura**: clic derecho en un área → **Diseñar estructura**.

**Vistas:** Plan · Elevación (por pared) · 3D (orbitar)

**Generar:**
- Caja completa (4 muros + puerta)
- Joists de piso
- Techo a dos aguas (rafters + ridge + collars)
- Planchas de muro

**Herramientas:** palo, plancha, muro, puerta, ventana (king/jack/header/cripples)

**Lista de corte** con totales por perfil. Persistencia + export/import JSON.
