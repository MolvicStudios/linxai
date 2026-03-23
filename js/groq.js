// groq.js — Groq API client
import { getState } from './state.js'

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const SHARED_KEY = 'REEMPLAZAR_CON_TU_GROQ_KEY'
const MODEL = 'llama-3.3-70b-versatile'

export function getApiKey() {
  const mode = localStorage.getItem('linxai_api_mode')
  if (mode === 'personal') {
    return localStorage.getItem('linxai_groq_key') || SHARED_KEY
  }
  return SHARED_KEY
}

export async function askGroq(messages, systemPrompt) {
  const key = getApiKey()
  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 2048,
      stream: false
    })
  })
  if (!response.ok) {
    const err = await response.text().catch(() => '')
    throw new Error(`Groq error ${response.status}: ${err}`)
  }
  const data = await response.json()
  return data.choices[0].message.content
}

// ===== System prompt builders =====

const DISTRO_NAMES = {
  ubuntu: 'Ubuntu',
  mint: 'Linux Mint',
  popos: 'Pop!_OS',
  elementary: 'Elementary OS',
  fedora: 'Fedora',
  opensuse: 'openSUSE',
  manjaro: 'Manjaro',
  arch: 'Arch Linux'
}

const GESTORES = {
  ubuntu: 'apt', mint: 'apt', popos: 'apt', elementary: 'apt',
  fedora: 'dnf',
  opensuse: 'zypper',
  manjaro: 'pacman', arch: 'pacman'
}

export function getGestorPaquetes(distro) {
  return GESTORES[distro] || 'apt'
}

export function getDistroName(distro) {
  return DISTRO_NAMES[distro] || distro
}

const LEVEL_NAMES = {
  beginner: { es: 'principiante', en: 'beginner' },
  intermediate: { es: 'intermedio', en: 'intermediate' },
  advanced: { es: 'avanzado', en: 'advanced' }
}

export function buildChatPrompt() {
  const { distro, level, lang } = getState()
  const distroName = DISTRO_NAMES[distro] || distro
  const levelName = LEVEL_NAMES[level]?.[lang] || level
  const langLabel = lang === 'es' ? 'español' : 'English'
  const gestor = getGestorPaquetes(distro)

  return `Eres LinxAI, un asistente experto en Linux especializado en ayudar a usuarios que migran desde Windows.
El usuario usa ${distroName} (gestor de paquetes: ${gestor}) y tiene nivel ${levelName}.
Responde en ${langLabel}. Sé directo, práctico y amigable.
IMPORTANTE: Cuando des comandos de instalación, usa SIEMPRE ${gestor} (no apt si la distro es Fedora/openSUSE/Arch).
Cuando muestres comandos, usa bloques de código con \`\`\`. Explica siempre qué hace cada comando antes de mostrarlo.
Si el usuario pregunta algo de Windows, muestra el equivalente en Linux para ${distroName}.`
}

export function buildTerminalPrompt() {
  const { distro, lang } = getState()
  const distroName = DISTRO_NAMES[distro] || distro
  const langLabel = lang === 'es' ? 'español' : 'English'
  const gestor = getGestorPaquetes(distro)

  return `Eres un traductor experto de lenguaje natural a comandos Linux.
El usuario usa ${distroName} (gestor de paquetes: ${gestor}).
Responde en ${langLabel}.
Responde SIEMPRE en este formato JSON exacto y nada más:
{
  "comando": "el-comando-aqui",
  "explicacion": "qué hace este comando en una frase",
  "partes": [{"parte": "segmento", "significado": "qué hace"}],
  "peligroso": true|false,
  "razon_peligro": "por qué es peligroso (solo si peligroso=true)"
}
No escribas nada fuera del JSON. Si el comando involucra alguno de estos patrones, marca peligroso=true:
- rm -rf con rutas del sistema o wildcard amplio
- dd if= escribiendo en /dev/sd*
- chmod 777 en directorios del sistema
- curl/wget piped a sudo bash/sh
- mkfs en dispositivos
- fork bomb :(){:|:&};:
- Modificar /etc/passwd, /etc/shadow
- Cualquier comando que pueda causar pérdida de datos irreversible`
}

export function buildGuidePrompt(lessonTitle) {
  const { distro, level, lang } = getState()
  const distroName = DISTRO_NAMES[distro] || distro
  const levelName = LEVEL_NAMES[level]?.[lang] || level
  const langLabel = lang === 'es' ? 'español' : 'English'

  return `Eres LinxAI en modo tutor. Guía al usuario paso a paso por la lección: "${lessonTitle}".
Distro: ${distroName}. Nivel: ${levelName}. Idioma: ${langLabel}.
Sé paciente, usa ejemplos concretos y confirma que el usuario entiende antes de avanzar.
Cuando muestres comandos usa bloques de código. Explica cada paso claramente.`
}

export function buildGamingPrompt() {
  const { distro, lang, gpu } = getState()
  const distroName = DISTRO_NAMES[distro] || distro
  const gestor = getGestorPaquetes(distro)
  const langLabel = lang === 'es' ? 'español' : 'English'
  const gpuLabel = gpu === 'si' ? 'NVIDIA' : gpu === 'amd' ? 'AMD/Intel' : 'desconocida'

  return `Eres LinxAI en modo Gaming experto.
El usuario tiene ${distroName} (gestor: ${gestor}) y GPU: ${gpuLabel}.
Ayuda con Steam, Proton, drivers GPU y compatibilidad de juegos.
Da comandos específicos para ${distroName} usando ${gestor} cuando sea necesario.
Responde en ${langLabel}. Sé directo y práctico.`
}
