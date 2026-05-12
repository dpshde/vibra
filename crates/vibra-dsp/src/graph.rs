use crate::modules::{create_module, Module, ModuleKind};

pub struct Graph {
    block_size: usize,
    modules: Vec<ModuleNode>,
    connections: Vec<Connection>,
    pub master_output: Vec<f32>,
}

struct ModuleNode {
    id: u32,
    module: Box<dyn Module>,
    inputs: Vec<Vec<f32>>,
    outputs: Vec<Vec<f32>>,
}

struct Connection {
    source_id: u32,
    source_port: usize,
    target_id: u32,
    target_port: usize,
}

impl Graph {
    pub fn new(block_size: usize) -> Self {
        Self {
            block_size,
            modules: Vec::new(),
            connections: Vec::new(),
            master_output: vec![0.0; block_size],
        }
    }

    pub fn add_module(&mut self, id: u32, kind: ModuleKind, sample_rate: f32, block_size: usize) {
        let module = create_module(kind, sample_rate, block_size);
        let num_inputs = module.num_inputs();
        let num_outputs = module.num_outputs();
        let node = ModuleNode {
            id,
            module,
            inputs: (0..num_inputs).map(|_| vec![0.0; block_size]).collect(),
            outputs: (0..num_outputs).map(|_| vec![0.0; block_size]).collect(),
        };
        self.modules.push(node);
    }

    pub fn remove_module(&mut self, id: u32) {
        self.modules.retain(|m| m.id != id);
        self.connections
            .retain(|c| c.source_id != id && c.target_id != id);
    }

    pub fn connect(&mut self, source_id: u32, source_port: u32, target_id: u32, target_port: u32) {
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
            !(c.source_id == source_id
                && c.source_port == sp
                && c.target_id == target_id
                && c.target_port == tp)
        });
    }

    pub fn set_param(&mut self, module_id: u32, param_id: u32, value: f32) {
        if let Some(node) = self.modules.iter_mut().find(|m| m.id == module_id) {
            node.module.set_param(param_id as usize, value);
        }
    }

    pub fn update_voices(&mut self, freq: f32, gate: f32, velocity: f32) {
        for node in &mut self.modules {
            node.module.set_voice(freq, gate, velocity);
        }
    }

    pub fn process(&mut self, frames: usize) {
        for node in &mut self.modules {
            for buf in &mut node.inputs {
                for s in &mut buf[..frames] {
                    *s = 0.0;
                }
            }
        }
        for s in &mut self.master_output[..frames] {
            *s = 0.0;
        }

        for c in &self.connections {
            if let Some(sidx) = self.modules.iter().position(|m| m.id == c.source_id) {
                if let Some(tidx) = self.modules.iter().position(|m| m.id == c.target_id) {
                    if sidx == tidx {
                        continue;
                    }
                    let src_ptr = &self.modules[sidx] as *const ModuleNode;
                    let dst_ptr = &mut self.modules[tidx] as *mut ModuleNode;
                    unsafe {
                        let outputs = &(*src_ptr).outputs;
                        let inputs = &(*dst_ptr).inputs;
                        if c.source_port < outputs.len() && c.target_port < inputs.len() {
                            let src_buf = &outputs[c.source_port];
                            let dst_buf = &mut (&mut (*dst_ptr).inputs)[c.target_port];
                            for i in 0..frames {
                                dst_buf[i] += src_buf[i];
                            }
                        }
                    }
                }
            }
        }

        for node in &mut self.modules {
            let input_refs: Vec<&[f32]> = node.inputs.iter().map(|b| &b[..frames]).collect();
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

    pub fn master_output(&self) -> &[f32] {
        &self.master_output
    }
}
