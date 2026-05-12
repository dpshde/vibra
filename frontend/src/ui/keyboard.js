const NOTE_FREQS = {
  'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56,
  'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00,
  'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13,
  'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00,
  'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25
}

// Computer keyboard → note mapping (two-octave layout like DAWs)
const KEY_MAP = {
  // Lower octave (Z row)
  'z': 'C3', 's': 'C#3', 'x': 'D3', 'd': 'D#3',
  'c': 'E3', 'v': 'F3', 'g': 'F#3', 'b': 'G3',
  'h': 'G#3', 'n': 'A3', 'j': 'A#3', 'm': 'B3',
  ',': 'C4', 'l': 'C#4', '.': 'D4', ';': 'D#4', '/': 'E4',
  // Upper octave (Q row)
  'q': 'C4', '2': 'C#4', 'w': 'D4', '3': 'D#4',
  'e': 'E4', 'r': 'F4', '5': 'F#4', 't': 'G4',
  '6': 'G#4', 'y': 'A4', '7': 'A#4', 'u': 'B4', 'i': 'C5',
}

export function createKeyboard(container, onNoteOn, onNoteOff) {
  container.innerHTML = ''
  const keys = document.createElement('div')
  keys.className = 'keyboard'

  for (const [note, freq] of Object.entries(NOTE_FREQS)) {
    const key = document.createElement('div')
    key.className = `key ${note.includes('#') ? 'black' : 'white'}`
    key.dataset.note = note
    key.dataset.freq = freq
    key.textContent = note

    key.addEventListener('mousedown', () => {
      key.classList.add('active')
      onNoteOn(note, freq)
    })
    key.addEventListener('mouseup', () => {
      key.classList.remove('active')
      onNoteOff(note)
    })
    key.addEventListener('mouseleave', () => {
      if (key.classList.contains('active')) {
        key.classList.remove('active')
        onNoteOff(note)
      }
    })

    keys.appendChild(key)
  }

  container.appendChild(keys)

  // Computer keyboard support
  const heldComputerKeys = new Set()
  const noteActiveCount = new Map()

  function isTyping() {
    const tag = document.activeElement?.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  }

  document.addEventListener('keydown', (e) => {
    if (e.repeat || isTyping()) return
    const note = KEY_MAP[e.key.toLowerCase()]
    if (!note) return
    e.preventDefault()

    heldComputerKeys.add(e.key.toLowerCase())
    const prevCount = noteActiveCount.get(note) || 0
    noteActiveCount.set(note, prevCount + 1)

    if (prevCount === 0) {
      const keyEl = keys.querySelector(`[data-note="${note}"]`)
      if (keyEl) keyEl.classList.add('active')
      onNoteOn(note, NOTE_FREQS[note])
    }
  })

  document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase()
    if (!heldComputerKeys.has(key)) return
    heldComputerKeys.delete(key)

    const note = KEY_MAP[key]
    if (!note) return

    const prevCount = noteActiveCount.get(note) || 0
    if (prevCount > 0) {
      const newCount = prevCount - 1
      noteActiveCount.set(note, newCount)
      if (newCount === 0) {
        const keyEl = keys.querySelector(`[data-note="${note}"]`)
        if (keyEl) keyEl.classList.remove('active')
        onNoteOff(note)
      }
    }
  })
}
