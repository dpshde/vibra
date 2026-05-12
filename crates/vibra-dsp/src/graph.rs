use crate::modules::{create_module, manifest_for, Module, ModuleKind, ModuleManifest, VoiceScope};
use crate::voice::VoiceState;

pub struct Graph {
    block_size: usize,
    max_voices: usize,
    module_scopes: Vec<Option<VoiceScope>>,
    module_manifests: Vec<Option<&'static ModuleManifest>>,
    global_nodes: Vec<Option<ModuleNode>>,
    voice_nodes: Vec<Vec<Option<ModuleNode>>>,
    connections: Vec<Connection>,
    pub master_output: Vec<f32>,
}

struct ModuleNode {
    module: Box<dyn Module>,
    manifest: &'static ModuleManifest,
    inputs: Vec<Vec<f32>>,
    outputs: Vec<Vec<f32>>,
}

#[derive(Clone)]
struct Connection {
    source_id: u32,
    source_port: usize,
    target_id: u32,
    target_port: usize,
}

impl Graph {
    pub fn new(block_size: usize, max_voices: usize) -> Self {
        Self {
            block_size,
            max_voices: max_voices.max(1),
            module_scopes: Vec::new(),
            module_manifests: Vec::new(),
            global_nodes: Vec::new(),
            voice_nodes: Vec::new(),
            connections: Vec::new(),
            master_output: vec![0.0; block_size],
        }
    }

    pub fn add_module(&mut self, id: u32, kind: ModuleKind, sample_rate: f32, block_size: usize) {
        let manifest = manifest_for(kind);
        let scope = manifest.voice_scope;
        let idx = id as usize;

        if idx >= self.module_scopes.len() {
            self.module_scopes.resize_with(idx + 1, || None);
            self.module_manifests.resize_with(idx + 1, || None);
            self.global_nodes.resize_with(idx + 1, || None);
            self.voice_nodes.resize_with(idx + 1, || Vec::new());
        }

        self.module_scopes[idx] = Some(scope);
        self.module_manifests[idx] = Some(manifest);

        let num_inputs = manifest.inputs.len();
        let num_outputs = manifest.outputs.len();

        match scope {
            VoiceScope::Global => {
                let module = create_module(kind, sample_rate, block_size);
                let node = ModuleNode {
                    module,
                    manifest,
                    inputs: (0..num_inputs).map(|_| vec![0.0; block_size]).collect(),
                    outputs: (0..num_outputs).map(|_| vec![0.0; block_size]).collect(),
                };
                self.global_nodes[idx] = Some(node);
                self.voice_nodes[idx] = Vec::new();
            }
            VoiceScope::PerVoice => {
                let mut voice_copies = Vec::with_capacity(self.max_voices);
                for _ in 0..self.max_voices {
                    let module = create_module(kind, sample_rate, block_size);
                    let node = ModuleNode {
                        module,
                        manifest,
                        inputs: (0..num_inputs).map(|_| vec![0.0; block_size]).collect(),
                        outputs: (0..num_outputs).map(|_| vec![0.0; block_size]).collect(),
                    };
                    voice_copies.push(Some(node));
                }
                self.voice_nodes[idx] = voice_copies;
                self.global_nodes[idx] = None;
            }
        }
    }

    pub fn remove_module(&mut self, id: u32) {
        let idx = id as usize;
        if idx < self.global_nodes.len() {
            self.global_nodes[idx] = None;
        }
        if idx < self.voice_nodes.len() {
            for v in &mut self.voice_nodes[idx] {
                *v = None;
            }
        }
        // module_scopes and module_manifests stay for connection routing
        self.connections.retain(|c| c.source_id != id && c.target_id != id);
    }

    pub fn connect(&mut self, source_id: u32, source_port: u32, target_id: u32, target_port: u32) {
        let sidx = source_id as usize;
        let tidx = target_id as usize;

        let source_scope = self.module_scopes.get(sidx).and_then(|s| *s);
        let target_scope = self.module_scopes.get(tidx).and_then(|s| *s);

        if source_scope.is_none() || target_scope.is_none() {
            return;
        }

        let source_scope = source_scope.unwrap();
        let target_scope = target_scope.unwrap();

        // Validate ports using manifest
        if let (Some(sm), Some(tm)) = (self.module_manifests.get(sidx).and_then(|m| *m), self.module_manifests.get(tidx).and_then(|m| *m)) {
            if (source_port as usize) >= sm.outputs.len() || (target_port as usize) >= tm.inputs.len() {
                return;
            }
        } else {
            return;
        }

        self.connections.push(Connection {
            source_id,
            source_port: source_port as usize,
            target_id,
            target_port: target_port as usize,
        });
    }

    pub fn disconnect(
        &mut self,
        source_id: u32,
        source_port: u32,
        target_id: u32,
        target_port: u32,
    ) {
        let sp = source_port as usize;
        let tp = target_port as usize;
        self.connections.retain(|c| {
            !(c.source_id == source_id && c.source_port == sp && c.target_id == target_id && c.target_port == tp)
        });
    }

    pub fn set_param(&mut self, module_id: u32, param_id: u32, value: f32) {
        let idx = module_id as usize;
        if let Some(scope) = self.module_scopes.get(idx).and_then(|s| *s) {
            match scope {
                VoiceScope::Global => {
                    if let Some(node) = self.global_nodes.get_mut(idx).and_then(|n| n.as_mut()) {
                        if (param_id as usize) < node.manifest.parameters.len() {
                            node.module.set_param(param_id as usize, value);
                        }
                    }
                }
                VoiceScope::PerVoice => {
                    if let Some(voices) = self.voice_nodes.get_mut(idx) {
                        for voice_opt in voices.iter_mut() {
                            if let Some(node) = voice_opt {
                                if (param_id as usize) < node.manifest.parameters.len() {
                                    node.module.set_param(param_id as usize, value);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    pub fn process(&mut self, frames: usize, voice_states: &[VoiceState]) {
        let connections = self.connections.clone();
        let module_scopes = self.module_scopes.clone();

        // Zero global input buffers
        for node_opt in &mut self.global_nodes {
            if let Some(node) = node_opt {
                for buf in &mut node.inputs {
                    for s in &mut buf[..frames] {
                        *s = 0.0;
                    }
                }
            }
        }

        // Zero per-voice input buffers
        for voice_vec in &mut self.voice_nodes {
            for voice_opt in voice_vec.iter_mut() {
                if let Some(node) = voice_opt {
                    for buf in &mut node.inputs {
                        for s in &mut buf[..frames] {
                            *s = 0.0;
                        }
                    }
                }
            }
        }

        for s in &mut self.master_output[..frames] {
            *s = 0.0;
        }

        // Get raw pointers for routing without borrow checker conflicts
        let global_ptr = self.global_nodes.as_mut_ptr();
        let voice_ptr = self.voice_nodes.as_mut_ptr();

        // Route connections
        for conn in &connections {
            let sidx = conn.source_id as usize;
            let tidx = conn.target_id as usize;

            let source_scope = if sidx < module_scopes.len() {
                module_scopes[sidx]
            } else { continue; };
            let target_scope = if tidx < module_scopes.len() {
                module_scopes[tidx]
            } else { continue; };

            match (source_scope, target_scope) {
                (Some(VoiceScope::Global), Some(VoiceScope::Global)) => {
                    unsafe {
                        let src_opt = (*global_ptr.add(sidx)).as_ref();
                        let dst_opt = (*global_ptr.add(tidx)).as_mut();
                        if let (Some(src), Some(dst)) = (src_opt, dst_opt) {
                            if conn.source_port < src.outputs.len() && conn.target_port < dst.inputs.len() {
                                let src_buf = &src.outputs[conn.source_port];
                                let dst_buf = &mut dst.inputs[conn.target_port];
                                for i in 0..frames {
                                    dst_buf[i] += src_buf[i];
                                }
                            }
                        }
                    }
                }
                (Some(VoiceScope::PerVoice), Some(VoiceScope::PerVoice)) => {
                    for v in 0..voice_states.len().min(self.max_voices) {
                        if !voice_states[v].active { continue; }
                        unsafe {
                            let src_vec = &*voice_ptr.add(sidx);
                            let dst_vec = &mut *voice_ptr.add(tidx);
                            if let (Some(src), Some(dst)) = (
                                src_vec.get(v).and_then(|n| n.as_ref()),
                                dst_vec.get_mut(v).and_then(|n| n.as_mut())
                            ) {
                                if conn.source_port < src.outputs.len() && conn.target_port < dst.inputs.len() {
                                    let src_buf = &src.outputs[conn.source_port];
                                    let dst_buf = &mut dst.inputs[conn.target_port];
                                    for i in 0..frames {
                                        dst_buf[i] += src_buf[i];
                                    }
                                }
                            }
                        }
                    }
                }
                (Some(VoiceScope::PerVoice), Some(VoiceScope::Global)) => {
                    for v in 0..voice_states.len().min(self.max_voices) {
                        if !voice_states[v].active { continue; }
                        unsafe {
                            let src_vec = &*voice_ptr.add(sidx);
                            let dst_opt = (*global_ptr.add(tidx)).as_mut();
                            if let (Some(src), Some(dst)) = (
                                src_vec.get(v).and_then(|n| n.as_ref()),
                                dst_opt
                            ) {
                                if conn.source_port < src.outputs.len() && conn.target_port < dst.inputs.len() {
                                    let src_buf = &src.outputs[conn.source_port];
                                    let dst_buf = &mut dst.inputs[conn.target_port];
                                    for i in 0..frames {
                                        dst_buf[i] += src_buf[i];
                                    }
                                }
                            }
                        }
                    }
                }
                (Some(VoiceScope::Global), Some(VoiceScope::PerVoice)) => {
                    unsafe {
                        let src_opt = (*global_ptr.add(sidx)).as_ref();
                        if let Some(src) = src_opt {
                            if conn.source_port < src.outputs.len() {
                                let src_buf = &src.outputs[conn.source_port];
                                for v in 0..voice_states.len().min(self.max_voices) {
                                    if !voice_states[v].active { continue; }
                                    let dst_vec = &mut *voice_ptr.add(tidx);
                                    if let Some(dst) = dst_vec.get_mut(v).and_then(|n| n.as_mut()) {
                                        if conn.target_port < dst.inputs.len() {
                                            let dst_buf = &mut dst.inputs[conn.target_port];
                                            for i in 0..frames {
                                                dst_buf[i] += src_buf[i];
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        // Update voice state on all per-voice modules
        let active_count = voice_states.len().min(self.max_voices);
        for v in 0..active_count {
            let vs = &voice_states[v];
            for voice_vec in &mut self.voice_nodes {
                if let Some(node) = voice_vec.get_mut(v).and_then(|n| n.as_mut()) {
                    node.module.set_voice(vs.freq, vs.gate, vs.velocity);
                }
            }
        }

        // Update global modules with the first active voice (or silent if none)
        let mut any_active = false;
        let mut first_active_freq = 440.0f32;
        let mut first_active_gate = 0.0f32;
        let mut first_active_vel = 0.0f32;
        for v in 0..active_count {
            if voice_states[v].active {
                if !any_active {
                    first_active_freq = voice_states[v].freq;
                    first_active_gate = voice_states[v].gate;
                    first_active_vel = voice_states[v].velocity;
                }
                any_active = true;
                if voice_states[v].gate > first_active_gate {
                    first_active_gate = voice_states[v].gate;
                }
            }
        }
        for node_opt in &mut self.global_nodes {
            if let Some(node) = node_opt {
                node.module.set_voice(first_active_freq, first_active_gate, first_active_vel);
            }
        }

        // Process global modules first so their outputs are ready for per-voice modules
        for node_opt in &mut self.global_nodes {
            if let Some(node) = node_opt {
                let input_refs: Vec<&[f32]> =
                    node.inputs.iter().map(|b| &b[..frames]).collect();
                let mut output_refs: Vec<&mut [f32]> =
                    node.outputs.iter_mut().map(|b| &mut b[..frames]).collect();
                node.module.process(&input_refs, &mut output_refs, frames);

                if node.module.kind() == ModuleKind::Destination {
                    for i in 0..frames {
                        self.master_output[i] += node.inputs[0][i];
                    }
                }
            }
        }

        // Process per-voice modules (they may read global outputs routed to their inputs)
        for v in 0..active_count {
            for voice_vec in &mut self.voice_nodes {
                if let Some(node) = voice_vec.get_mut(v).and_then(|n| n.as_mut()) {
                    let input_refs: Vec<&[f32]> =
                        node.inputs.iter().map(|b| &b[..frames]).collect();
                    let mut output_refs: Vec<&mut [f32]> =
                        node.outputs.iter_mut().map(|b| &mut b[..frames]).collect();
                    node.module.process(&input_refs, &mut output_refs, frames);
                }
            }
        }
    }

    pub fn master_output(&self) -> &[f32] {
        &self.master_output
    }
}
