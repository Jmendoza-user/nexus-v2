# Aura Visualizer — Especificación Técnica

> El Aura es la presencia visual del agente. Comunica estado interno en tiempo real mediante partículas reactivas y paleta de colores semántica.

---

## 1. Parámetros de diseño

| Parámetro | Valor | Justificación |
|-----------|-------|---------------|
| Diámetro canvas | 220px (default) | Ocupa ~60% del ancho en 375px. Impacto visual sin dominar la pantalla |
| DPR | `window.devicePixelRatio` | Nitidez en Retina/AMOLED sin aliasing |
| Framerate target | 60fps | `requestAnimationFrame` sin throttle; caída natural en low-end |
| Partículas | 80 | Balance entre densidad visual y carga GPU |
| Radio base | 35% del radio del canvas | Núcleo compacto; margen para oscilación de partículas |
| Stroke partícula | 1.5–3.5px (var aleatorio) | Variación orgánica |
| Opacidad partícula | 0.3–0.8 (var aleatoria + reactiva) | Sensación etérea |

---

## 2. Paleta por estado

| Estado | Color primario | RGB | Semántica |
|--------|----------------|-----|-----------|
| `idle` | `#7C5CFF` | 124, 92, 255 | Violeta marca — presencia tranquila |
| `listening` | `#34D399` | 52, 211, 153 | Verde esmeralda — escucha activa |
| `thinking` | `#FBBF24` | 251, 191, 36 | Ámbar — procesamiento cálido |
| `speaking` | `#3B82F6` | 59, 130, 246 | Azul — voz saliente |

---

## 3. Algoritmo de partículas — descripción

### 3.1 Inicialización

Cada partícula tiene 6 propiedades inmutables (determinadas al inicio):
```
angle:      distribución uniforme 0..2π (partícula #i: (i/N)*2π)
baseRadius: random en [0.85, 1.15] × radioBase × tamaño canvas
speed:      random en [0.003, 0.007] rad/frame
size:       random en [1.5, 3.5] px (antes de DPR)
opacity:    random en [0.3, 0.8]
phase:      random 0..2π (offset de ola individual)
```

### 3.2 Frame loop

Por cada frame:

1. **Leer amplitud** del AnalyserNode (si disponible):
   ```
   dataArray = Uint8Array(analyser.frequencyBinCount)
   analyser.getByteTimeDomainData(dataArray)
   rms = √(Σ(v-128)²/N)   para v en dataArray
   amplitude = min(rms/50, 1)   // normalizar 0..1
   ```

2. **Calcular `stateAmplitude`** (modulación por estado):
   ```
   idle:      0.10 + sin(time*0.0015) * 0.05          // respiración muy suave
   listening: 0.30 + amplitude * 0.70                  // muy reactivo al micrófono
   thinking:  0.20 + sin(time*0.003) * 0.15            // oscilación ansiosa
   speaking:  0.40 + amplitude * 0.60                  // reactivo al audio de salida
   ```

3. **Avanzar ángulo** de cada partícula: `p.angle += p.speed`

4. **Calcular posición** con ola:
   ```
   waveOffset = sin(p.angle*3 + p.phase + time*0.002) * stateAmplitude * 30 * dpr
   r = baseRadius*dpr + waveOffset
   x = cx + cos(p.angle) * r
   y = cy + sin(p.angle) * r
   ```

5. **Dibujar glow** radial en (cx, cy) con radio ~1.8×baseRadius, opacidad proporcional a `stateAmplitude`

6. **Dibujar anillo base** (círculo stroke en `baseRadius`) con opacidad 0.25..0.45

7. **Dibujar partículas** como `arc(x, y, size*dpr, 0, 2π)` fill con `rgba(r,g,b, opacity*(0.6+stateAmplitude*0.4))`

### 3.3 Interpolación de color entre estados

Al cambiar de estado, hacer lerp lineal del RGB durante 450ms:
```ts
function lerpColor(a: [number,number,number], b: [number,number,number], t: number) {
  return [
    Math.round(a[0] + (b[0]-a[0])*t),
    Math.round(a[1] + (b[1]-a[1])*t),
    Math.round(a[2] + (b[2]-a[2])*t),
  ] as [number,number,number];
}
```

En el loop, en lugar de leer `STATE_COLORS[state]` directamente, usar el valor interpolado con `t = min(elapsedSinceStateChange/450, 1)`.

---

## 4. Elección de tecnología: Canvas 2D (no Three.js)

**Decisión**: Canvas 2D nativo del navegador.

**Justificación**:
- Three.js añadiría ~130KB gzipped al bundle (viola `<120KB` target del brief).
- Canvas 2D cubre todos los efectos requeridos: glow radial, partículas circulares, gradientes.
- En dispositivos low-end (Moto G Power), WebGL puede tener latencia de contexto; Canvas 2D es más estable.
- Three.js shaders serían over-engineering para un efecto de partículas 2D.

**Si en el futuro se quiere escalar** (partículas 3D, shaders, bloom real): migrar al componente `AuraVisualizerGL.tsx` con Three.js y tree-shake el 2D.

---

## 5. Integración con Web Audio API

```ts
// En el hook useVoiceSession o useAudio:
const audioContext = new AudioContext();
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const source = audioContext.createMediaStreamSource(stream);
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
analyser.smoothingTimeConstant = 0.8;
source.connect(analyser);
// NO conectar analyser a destination (no retroalimentación)

// Pasar al componente:
<AuraVisualizer state="listening" analyser={analyser} size={220} />
```

Para el audio de salida (TTS ElevenLabs):
```ts
const audio = new Audio(ttsUrl);
const sourceOut = audioContext.createMediaElementSource(audio);
const analyserOut = audioContext.createAnalyser();
analyserOut.fftSize = 256;
sourceOut.connect(analyserOut);
sourceOut.connect(audioContext.destination); // sí conectar a speakers
// Pasar analyserOut cuando state="speaking"
```

---

## 6. Código de referencia completo (TypeScript)

Ver `/root/nexus-v2/docs/components/AuraVisualizer.tsx` para la implementación React funcional completa.

El componente acepta props `state`, `analyser`, `size` y maneja automáticamente:
- Setup del canvas con DPR
- Loop de animación con `requestAnimationFrame`
- Cleanup en `useEffect` return
- Variante reducida para `prefers-reduced-motion`

---

## 7. Variante `prefers-reduced-motion`

Si `window.matchMedia("(prefers-reduced-motion: reduce)").matches === true`:

1. NO iniciar el loop de animación.
2. Renderizar un **gradiente estático** radial con el color del estado actual.
3. Al cambiar de estado, re-renderizar el gradiente estático (sin animación de transición).

```ts
// gradiente estático
const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx * 0.8);
gradient.addColorStop(0, `rgba(${rgb.join(",")}, 0.20)`);
gradient.addColorStop(0.5, `rgba(${rgb.join(",")}, 0.10)`);
gradient.addColorStop(1, "rgba(0,0,0,0)");
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, w, h);
// Anillo estático
ctx.beginPath();
ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
ctx.strokeStyle = `rgba(${rgb.join(",")}, 0.35)`;
ctx.lineWidth = 1.5 * dpr;
ctx.stroke();
```

El usuario con sensibilidad a movimiento recibe la misma información semántica (color = estado) sin animación.

---

## 8. Testing y performance

### Métricas objetivo
- Frame time < 4ms en Moto G Power (budget 16.67ms por frame)
- Uso de memoria canvas < 5MB
- Sin memory leaks: verificar que `cancelAnimationFrame` se llama en unmount

### Smoke test manual
1. Cambiar `state` entre los 4 valores con botones de test.
2. Activar micrófono y hablar: las partículas deben oscilar.
3. Silencio total: Aura idle respira suavemente.
4. Activar reducción de movimiento en SO: canvas debe ser estático.

### Chrome DevTools
```
Performance → Record → verificar que el frame loop no genera GC frecuente
Memory → Heap snapshot antes/después de 30s: no debe crecer
```
