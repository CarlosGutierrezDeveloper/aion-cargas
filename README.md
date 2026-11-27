# Mi AION UT · Registro de cargas

App web (HTML + CSS + JavaScript puro, sin dependencias) para llevar el control de las cargas de mi GAC AION UT Elite 2027.

## Qué hace

- **Inicio**: ficha técnica del carro (batería, autonomía, potencia, torque, carga AC/DC, conector), último nivel de batería, autonomía estimada, gasto del mes, histórico, costo por km y ahorro frente a gasolina.
- **Cargas**: registras el % inicial y el % final; la app calcula:
  - kWh que entraron a la batería = capacidad × (final − inicial) / 100
  - kWh cobrados = kWh a la batería ÷ eficiencia (90 % AC / 95 % DC, editable), o el valor real del recibo/app si lo tienes
  - costo = kWh cobrados × valor del kWh + cargo fijo
  - tiempo estimado según la potencia del cargador y el máximo que acepta el carro
- **Electrolineras**: nombre, operador, dirección, enlace a Maps y sus cargadores (AC/DC, conector, kW, valor del kWh, cargo fijo). Marca en rojo los conectores no compatibles.
- **Ajustes**: conectar Google Sheets, editar la ficha del carro, eficiencias, precio de la gasolina; exportar/importar respaldo (.json) y exportar cargas a Excel (.csv).
- Funciona **sin señal** (útil en el sótano) y se puede **instalar** en el celular ("Agregar a pantalla de inicio").

## Datos

La app guarda todo en el navegador (`localStorage`) y, si la conectas, lo sincroniza con **una hoja de Google Sheets de tu cuenta de Gmail**. Así ves lo mismo en el celular y en el computador, y tienes tus cargas en una hoja para hacer tablas o gráficos.

Sin Google Sheets, si borras los datos del navegador o cambias de celular se pierden: usa **Ajustes → Exportar respaldo**.

## Conectar con Google Sheets (una sola vez, ~10 minutos)

La conexión usa **Google Apps Script**: un pequeño programa que vive dentro de tu hoja, en tu cuenta. No necesitas Google Cloud ni tarjeta de crédito.

1. **Crea la hoja.** Entra a [sheets.new](https://sheets.new) con tu Gmail y ponle un nombre, por ejemplo *Mi AION UT*.
2. **Abre Apps Script.** En la hoja: menú **Extensiones → Apps Script**.
3. **Pega el código.** Borra lo que aparece en `Código.gs` y pega todo el contenido de [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
4. **Pon tu clave.** En la línea `const CLAVE = 'CAMBIA-ESTA-CLAVE';` cambia el texto por una frase larga que solo tú sepas (ej. `aion-wxn839-mi-frase-secreta-2026`). Guarda (ícono de disquete).
5. **Publica.** Botón azul **Implementar → Nueva implementación**. En el engranaje elige **Aplicación web** y configura:
   - Descripción: `Mi AION UT`
   - Ejecutar como: **Yo (tu correo)**
   - Quién tiene acceso: **Cualquier persona**
   
   Toca **Implementar**.
6. **Autoriza.** Google pide permiso para que el script use tus hojas. Elige tu cuenta. Como el script es tuyo y no está "verificado", aparece *"Google no ha verificado esta app"*: toca **Configuración avanzada → Ir a Mi AION UT (no seguro)** → **Permitir**. Es normal en scripts personales.
7. **Copia la URL** de la aplicación web (termina en `/exec`).
8. **Conecta la app.** En la app: **Ajustes → Google Sheets**, pega la URL y la clave, y toca **Conectar**. La primera vez se crean las pestañas *Cargas*, *Electrolineras* y *Config* y se suben tus datos.
9. **En tu otro dispositivo** (computador o tablet): abre la app, pega la misma URL y clave, y verás los mismos datos.

Para comprobar la URL, ábrela en el navegador: debe decir *"El backend de Mi AION UT está funcionando"*.

### Cómo funciona la sincronización

- Sincroniza sola **al abrir la app**, **pocos segundos después de cada cambio** y **cuando vuelve la señal**. El indicador de arriba a la derecha dice *Sincronizado*, *Pendiente*, *Sin conexión* o *Error*; tócalo para sincronizar a mano.
- Sin señal (por ejemplo en el sótano) puedes registrar la carga igual; se sube después.
- Si el mismo dato cambió en dos lugares, **gana el cambio más reciente**.
- **Puedes corregir datos en la hoja** (por ejemplo el costo o el valor del kWh): la columna *Actualizado* se marca sola y la app toma tu corrección.
- **Para borrar**, hazlo desde la app. Si borras una fila en la hoja, la app la vuelve a subir.
- **No agregues columnas** en *Cargas* ni *Electrolineras* (la app reescribe esas pestañas). Para tablas dinámicas o gráficos, crea otra pestaña que lea de ellas.

### Seguridad

- La URL y la clave **no** van en el código de GitHub: se escriben en Ajustes y quedan solo en tu navegador.
- Quien tenga la URL **y** la clave puede leer y modificar los datos de la hoja. No las compartas.
- Si cambias el código de Apps Script, publica con **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión** para conservar la misma URL.
- Para desconectar un dispositivo: **Ajustes → Desconectar**. Para cortar el acceso por completo: archiva la implementación en Apps Script.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub (por ejemplo `aion-cargas`), público.
2. Sube todos los archivos de esta carpeta a la raíz del repositorio (`Add file → Upload files`).
3. Ve a **Settings → Pages**. En *Build and deployment* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)` y guarda.
4. En 1–2 minutos queda en `https://TU-USUARIO.github.io/aion-cargas/`.
5. Ábrela en el celular y usa "Agregar a pantalla de inicio".

Cuando publiques cambios, sube el número en `sw.js` (`aion-cargas-v2` → `v3`) para que el celular tome la versión nueva.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | Estructura y navegación |
| `styles.css` | Diseño (oscuro, móvil primero) |
| `app.js` | Lógica, cálculos y almacenamiento |
| `sw.js` | Funcionamiento sin conexión |
| `manifest.webmanifest`, `icon*.png`, `icon.svg` | Instalación como app |
| `google-apps-script/Code.gs` | Backend para Google Sheets (se pega en Apps Script, no lo usa GitHub Pages) |

## Probar en el computador

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Referencias (nov-2026)

- Ficha AION UT Elite: batería LFP 44,12 kWh, 400 km NEDC, 100 kW (134 HP), 145 Nm, carga AC 6,6 kW. La potencia máxima DC queda "por confirmar" (revisar el manual).
- Tarifa de casa precargada: $900/kWh como referencia (EMCALI estrato 4 ≈ $915/kWh en sep-2026). Cámbiala con tu factura.
- Terpel Voltex DC precargado en $1.750/kWh (Terpel anunció $1.650–1.800/kWh). Las demás electrolineras vienen sin precio.
