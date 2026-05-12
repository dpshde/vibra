use crate::engine::Engine;
use crate::midi::MidiEvent;
use crate::modules::ModuleKind;
use crate::modules::registry;

/// Creates a new Engine instance.  Returns an opaque pointer to be passed to
/// all other FFI functions.
#[no_mangle]
pub extern "C" fn vibra_create(sample_rate: f32, block_size: usize) -> *mut Engine {
    let engine = Box::new(Engine::new(sample_rate, block_size));
    Box::into_raw(engine)
}

/// Destroys an Engine instance created by `vibra_create`.
#[no_mangle]
pub extern "C" fn vibra_destroy(engine: *mut Engine) {
    if engine.is_null() {
        return;
    }
    unsafe {
        let _ = Box::from_raw(engine);
    }
}

#[no_mangle]
pub extern "C" fn vibra_module_count() -> usize {
    registry().len()
}

/// Write a compact JSON array of all module manifests into `buf` up to `len` bytes.
/// Returns the total byte count needed (call again with larger buf if > len).
#[no_mangle]
pub extern "C" fn vibra_module_manifest_json(buf: *mut u8, len: usize) -> usize {
    let json = build_manifest_json();
    let bytes = json.as_bytes();
    let needed = bytes.len();
    if !buf.is_null() && len > 0 {
        let to_write = needed.min(len);
        unsafe {
            std::ptr::copy_nonoverlapping(bytes.as_ptr(), buf, to_write);
        }
    }
    needed
}

fn build_manifest_json() -> String {
    let mut s = String::new();
    s.push('[');
    let reg = registry();
    for (i, m) in reg.iter().enumerate() {
        if i > 0 { s.push(','); }
        s.push_str("{\"id\":\""); s.push_str(m.id);
        s.push_str("\",\"name\":\""); s.push_str(m.name);
        s.push_str("\",\"category\":\""); s.push_str(m.category);
        s.push_str("\",\"kind\":"); s.push_str(&(m.kind as u32).to_string());
        s.push_str(",\"inputs\":[");
        for (j, p) in m.inputs.iter().enumerate() {
            if j > 0 { s.push(','); }
            s.push_str("{\"id\":\""); s.push_str(p.id);
            s.push_str("\",\"name\":\""); s.push_str(p.name);
            s.push_str("\",\"rate\":\""); s.push_str(p.rate.as_str());
            s.push_str("\"}");
        }
        s.push_str("],\"outputs\":[");
        for (j, p) in m.outputs.iter().enumerate() {
            if j > 0 { s.push(','); }
            s.push_str("{\"id\":\""); s.push_str(p.id);
            s.push_str("\",\"name\":\""); s.push_str(p.name);
            s.push_str("\",\"rate\":\""); s.push_str(p.rate.as_str());
            s.push_str("\"}");
        }
        s.push_str("],\"parameters\":[");
        for (j, p) in m.parameters.iter().enumerate() {
            if j > 0 { s.push(','); }
            s.push_str("{\"id\":\""); s.push_str(p.id);
            s.push_str("\",\"name\":\""); s.push_str(p.name);
            s.push_str("\",\"unit\":\""); s.push_str(p.unit.as_str());
            s.push_str("\",\"min\":"); s.push_str(&p.min.to_string());
            s.push_str(",\"max\":"); s.push_str(&p.max.to_string());
            s.push_str(",\"default\":"); s.push_str(&p.default.to_string());
            if !p.enum_values.is_empty() {
                s.push_str(",\"enum_values\":[");
                for (k, v) in p.enum_values.iter().enumerate() {
                    if k > 0 { s.push(','); }
                    s.push('"'); s.push_str(v); s.push('"');
                }
                s.push(']');
            }
            s.push('}');
        }
        s.push_str("]}");
    }
    s.push(']');
    s
}

#[no_mangle]
pub extern "C" fn vibra_set_voice_mode(
    engine: *mut Engine,
    mode: u32,
    polyphony: u32,
    unison_count: u32,
    unison_detune: f32,
) {
    if engine.is_null() {
        return;
    }
    let engine = unsafe { &mut *engine };
    let mode = crate::voice::VoiceMode::from_u32(mode);
    engine.set_voice_mode(mode, polyphony as usize, unison_count as usize, unison_detune);
}

#[no_mangle]
pub extern "C" fn vibra_get_active_voices(engine: *mut Engine) -> u32 {
    if engine.is_null() {
        return 0;
    }
    let engine = unsafe { &*engine };
    engine.active_voices() as u32
}

#[no_mangle]
pub extern "C" fn vibra_process(engine: *mut Engine, frames: usize, channels: usize) -> *const f32 {
    if engine.is_null() {
        return std::ptr::null();
    }
    let engine = unsafe { &mut *engine };
    engine.process(frames, channels);
    engine.output_ptr()
}

#[no_mangle]
pub extern "C" fn vibra_add_module(engine: *mut Engine, id: u32, kind: u32) -> bool {
    if engine.is_null() {
        return false;
    }
    let engine = unsafe { &mut *engine };
    let kind = ModuleKind::from_u32(kind);
    engine.add_module(id, kind);
    true
}

#[no_mangle]
pub extern "C" fn vibra_remove_module(engine: *mut Engine, id: u32) -> bool {
    if engine.is_null() {
        return false;
    }
    let engine = unsafe { &mut *engine };
    engine.remove_module(id);
    true
}

#[no_mangle]
pub extern "C" fn vibra_connect(
    engine: *mut Engine,
    source_id: u32,
    source_port: u32,
    target_id: u32,
    target_port: u32,
) -> bool {
    if engine.is_null() {
        return false;
    }
    let engine = unsafe { &mut *engine };
    engine.connect(source_id, source_port, target_id, target_port);
    true
}

#[no_mangle]
pub extern "C" fn vibra_disconnect(
    engine: *mut Engine,
    source_id: u32,
    source_port: u32,
    target_id: u32,
    target_port: u32,
) -> bool {
    if engine.is_null() {
        return false;
    }
    let engine = unsafe { &mut *engine };
    engine.disconnect(source_id, source_port, target_id, target_port);
    true
}

#[no_mangle]
pub extern "C" fn vibra_set_param(engine: *mut Engine, module_id: u32, param_id: u32, value: f32) {
    if engine.is_null() {
        return;
    }
    let engine = unsafe { &mut *engine };
    engine.set_param(module_id, param_id, value);
}

#[no_mangle]
pub extern "C" fn vibra_push_midi(
    engine: *mut Engine,
    sample_offset: u32,
    byte0: u8,
    byte1: u8,
    byte2: u8,
) {
    if engine.is_null() {
        return;
    }
    let engine = unsafe { &mut *engine };
    engine.push_midi(MidiEvent {
        sample_offset,
        data: [byte0, byte1, byte2],
    });
}

#[no_mangle]
pub extern "C" fn vibra_note_on(engine: *mut Engine, note: u8, velocity: f32) {
    if engine.is_null() {
        return;
    }
    let engine = unsafe { &mut *engine };
    engine.note_on(note, velocity);
}

#[no_mangle]
pub extern "C" fn vibra_note_off(engine: *mut Engine, note: u8) {
    if engine.is_null() {
        return;
    }
    let engine = unsafe { &mut *engine };
    engine.note_off(note);
}

#[no_mangle]
pub extern "C" fn vibra_scope_ptr(engine: *mut Engine) -> *const f32 {
    if engine.is_null() {
        return std::ptr::null();
    }
    let engine = unsafe { &*engine };
    engine.scope_ptr()
}
