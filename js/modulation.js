/**
 * FM Modulation Matrix
 * Manages connections between operators for FM synthesis
 */

class ModulationMatrix {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.operators = [];
        this.masterGain = null;

        // Connection matrix: 4x4 for operator-to-operator, plus 4 for operator-to-master
        // connections[sourceIndex][targetIndex] = { depth, modulationGain }
        this.connections = [];

        // Operator-to-master output
        this.masterOutputs = [];

        // Initialize 4 operators
        for (let i = 0; i < 4; i++) {
            this.connections[i] = [];
            this.masterOutputs[i] = null;
            for (let j = 0; j < 4; j++) {
                this.connections[i][j] = null;
            }
        }
    }

    /**
     * Set operators array
     */
    setOperators(operators) {
        this.operators = operators;
        this.createModulationNodes();
    }

    /**
     * Set master output gain
     */
    setMasterOutput(masterNode) {
        this.masterGain = masterNode;
    }

    /**
     * Create modulation nodes for each operator
     */
    createModulationNodes() {
        for (let i = 0; i < this.operators.length; i++) {
            const op = this.operators[i];
            if (op && op.getModulationInput) {
                // Each operator already has a modulationGain node
                // We just need to manage connections
            }
        }
    }

    /**
     * Set modulation from source operator to target operator
     * @param {number} sourceIndex - Source operator index (0-3)
     * @param {number} targetIndex - Target operator index (0-3)
     * @param {number} depth - Modulation depth (0-100)
     */
    setModulation(sourceIndex, targetIndex, depth) {
        if (sourceIndex < 0 || sourceIndex >= this.operators.length) return;
        if (targetIndex < 0 || targetIndex >= this.operators.length) return;

        const sourceOp = this.operators[sourceIndex];
        const targetOp = this.operators[targetIndex];

        if (!sourceOp || !targetOp) return;

        // Remove existing connection if any
        if (this.connections[sourceIndex][targetIndex]) {
            this.clearModulation(sourceIndex, targetIndex);
        }

        // Create new connection if depth > 0
        if (depth > 0) {
            const modGain = this.audioContext.createGain();
            modGain.gain.value = depth * 10; // Scale depth appropriately

            // Connect: source output -> mod gain -> target frequency
            sourceOp.getOutput().connect(modGain);
            modGain.connect(targetOp.getFrequencyParam());

            this.connections[sourceIndex][targetIndex] = {
                depth: depth,
                gainNode: modGain
            };
        }
    }

    /**
     * Update modulation depth for existing connection
     */
    updateModulationDepth(sourceIndex, targetIndex, depth) {
        if (this.connections[sourceIndex] && this.connections[sourceIndex][targetIndex]) {
            const connection = this.connections[sourceIndex][targetIndex];
            connection.depth = depth;
            connection.gainNode.gain.setTargetAtTime(
                depth * 10,
                this.audioContext.currentTime,
                0.01
            );
        } else {
            this.setModulation(sourceIndex, targetIndex, depth);
        }
    }

    /**
     * Clear modulation connection
     */
    clearModulation(sourceIndex, targetIndex) {
        if (this.connections[sourceIndex] && this.connections[sourceIndex][targetIndex]) {
            const connection = this.connections[sourceIndex][targetIndex];

            // Disconnect
            try {
                if (this.operators[sourceIndex]) {
                    this.operators[sourceIndex].getOutput().disconnect(connection.gainNode);
                }
                connection.gainNode.disconnect();
            } catch (e) {
                // Ignore disconnection errors
            }

            this.connections[sourceIndex][targetIndex] = null;
        }
    }

    /**
     * Toggle operator output to master
     * @param {number} opIndex - Operator index (0-3)
     * @param {boolean} enabled - Whether output to master is enabled
     */
    setMasterOutput(opIndex, enabled) {
        if (opIndex < 0 || opIndex >= this.operators.length) return;

        const op = this.operators[opIndex];
        if (!op) return;

        // Clear existing connection
        if (this.masterOutputs[opIndex]) {
            try {
                op.disconnect(this.masterOutputs[opIndex]);
            } catch (e) {
                // Ignore
            }
            this.masterOutputs[opIndex] = null;
        }

        // Create new connection if enabled
        if (enabled && this.masterGain) {
            op.connect(this.masterGain);
            this.masterOutputs[opIndex] = this.masterGain;
        }
    }

    /**
     * Set all modulations from a matrix configuration
     * @param {Array} matrix - 2D array [source][target] of depth values
     */
    setMatrix(matrix) {
        for (let i = 0; i < matrix.length && i < 4; i++) {
            for (let j = 0; j < matrix[i].length && j < 4; j++) {
                this.setModulation(i, j, matrix[i][j] || 0);
            }
        }
    }

    /**
     * Get current matrix state
     * @returns {Array} 2D array of current depths
     */
    getMatrix() {
        const matrix = [];
        for (let i = 0; i < 4; i++) {
            matrix[i] = [];
            for (let j = 0; j < 4; j++) {
                if (this.connections[i][j]) {
                    matrix[i][j] = this.connections[i][j].depth;
                } else {
                    matrix[i][j] = 0;
                }
            }
        }
        return matrix;
    }

    /**
     * Check if modulation exists
     */
    hasModulation(sourceIndex, targetIndex) {
        return !!(this.connections[sourceIndex] && this.connections[sourceIndex][targetIndex]);
    }

    /**
     * Get modulation depth
     */
    getModulationDepth(sourceIndex, targetIndex) {
        if (this.connections[sourceIndex] && this.connections[sourceIndex][targetIndex]) {
            return this.connections[sourceIndex][targetIndex].depth;
        }
        return 0;
    }

    /**
     * Clear all modulations
     */
    clearAll() {
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                this.clearModulation(i, j);
            }
        }
    }

    /**
     * Set preset configuration
     */
    loadPreset(presetName) {
        this.clearAll();

        const presets = {
            'basic-fm': {
                // Classic 2-operator FM
                matrix: [
                    [0, 0, 0, 0],
                    [50, 0, 0, 0],  // Op1 modulates Op2
                    [0, 0, 0, 0],
                    [0, 1, 0, 0]   // Op2 outputs to master
                ],
                master: [0, 1, 0, 0]
            },
            'complex-fm': {
                // Complex multi-operator FM
                matrix: [
                    [0, 30, 0, 0],
                    [40, 0, 20, 0],
                    [0, 25, 0, 35],
                    [0, 0, 45, 0]
                ],
                master: [0, 0, 0, 1]
            },
            'feedback': {
                // Feedback FM
                matrix: [
                    [50, 40, 0, 0],
                    [0, 0, 30, 0],
                    [0, 0, 60, 20],
                    [0, 0, 0, 0]
                ],
                master: [0, 0, 1, 0]
            },
            'parallel': {
                // Parallel carriers
                matrix: [
                    [0, 0, 0, 0],
                    [30, 0, 0, 0],
                    [40, 0, 0, 0],
                    [0, 0, 0, 0]
                ],
                master: [0, 1, 1, 0]  // Op2 and Op3 both output
            },
            'cascade': {
                // Cascaded modulation
                matrix: [
                    [0, 25, 0, 0],
                    [0, 0, 30, 0],
                    [0, 0, 0, 35],
                    [0, 0, 0, 0]
                ],
                master: [0, 0, 0, 1]
            }
        };

        const preset = presets[presetName];
        if (preset) {
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    if (preset.matrix[i][j] > 0) {
                        this.setModulation(i, j, preset.matrix[i][j]);
                    }
                }
                if (preset.master[i]) {
                    this.setMasterOutput(i, true);
                }
            }
        }
    }

    /**
     * Get matrix as display-friendly string
     */
    toString() {
        let str = 'Modulation Matrix:\n';
        str += '     OP1  OP2  OP3  OP4  OUT\n';
        str += '  ---------------------------\n';

        for (let i = 0; i < 4; i++) {
            str += `OP${i + 1} |`;
            for (let j = 0; j < 4; j++) {
                const hasMod = this.hasModulation(i, j);
                str += hasMod ? '  ●  ' : '  ○  ';
            }
            const hasMaster = this.masterOutputs[i] !== null;
            str += hasMaster ? '  ●  ' : '  ○  ';
            str += '\n';
        }

        return str;
    }

    /**
     * Clean up all connections
     */
    dispose() {
        this.clearAll();

        for (let i = 0; i < 4; i++) {
            if (this.masterOutputs[i]) {
                this.setMasterOutput(i, false);
            }
        }
    }
}

// ============================================
// LFO MODULATION ROUTER
// ============================================

class LFOModulationRouter {
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.lfos = [];
        this.operators = [];

        // LFO to operator connections
        // connections[lfoIndex][operatorIndex] = { frequency: boolean, level: boolean }
        this.connections = [];

        // Depth control nodes
        this.depthNodes = [];
    }

    /**
     * Set LFOs array
     */
    setLFOs(lfos) {
        this.lfos = lfos;
    }

    /**
     * Set operators array
     */
    setOperators(operators) {
        this.operators = operators;
        this.initializeConnections();
    }

    /**
     * Initialize connection tracking
     */
    initializeConnections() {
        this.connections = [];
        this.depthNodes = [];

        for (let i = 0; i < this.lfos.length; i++) {
            this.connections[i] = [];
            this.depthNodes[i] = [];

            for (let j = 0; j < this.operators.length; j++) {
                this.connections[i][j] = {
                    frequency: null,
                    level: null
                };
                this.depthNodes[i][j] = {
                    frequency: null,
                    level: null
                };
            }
        }
    }

    /**
     * Connect LFO to operator parameter
     * @param {number} lfoIndex - LFO index (0-3)
     * @param {number} opIndex - Operator index (0-3)
     * @param {string} target - 'frequency' or 'level'
     * @param {number} depth - Modulation depth
     */
    connect(lfoIndex, opIndex, target, depth) {
        if (lfoIndex < 0 || lfoIndex >= this.lfos.length) return;
        if (opIndex < 0 || opIndex >= this.operators.length) return;

        const lfo = this.lfos[lfoIndex];
        const op = this.operators[opIndex];

        if (!lfo || !op) return;

        // Disconnect existing
        this.disconnect(lfoIndex, opIndex, target);

        if (depth > 0) {
            const depthGain = this.audioContext.createGain();

            // Set depth based on target
            if (target === 'frequency') {
                depthGain.gain.value = depth * 100; // +/- 100 Hz modulation
                lfo.getOutput().connect(depthGain);
                depthGain.connect(op.getFrequencyParam());
            } else if (target === 'level') {
                depthGain.gain.value = depth * 0.5; // +/- 50% level modulation
                lfo.getOutput().connect(depthGain);
                depthGain.connect(op.outputGain.gain);
            }

            this.connections[lfoIndex][opIndex][target] = depthGain;
            this.depthNodes[lfoIndex][opIndex][target] = depth;
        }
    }

    /**
     * Disconnect LFO from operator parameter
     */
    disconnect(lfoIndex, opIndex, target) {
        if (this.connections[lfoIndex] && this.connections[lfoIndex][opIndex]) {
            const node = this.connections[lfoIndex][opIndex][target];
            if (node) {
                try {
                    node.disconnect();
                } catch (e) {
                    // Ignore
                }
                this.connections[lfoIndex][opIndex][target] = null;
            }
        }
    }

    /**
     * Update modulation depth
     */
    updateDepth(lfoIndex, opIndex, target, depth) {
        const node = this.connections[lfoIndex]?.[opIndex]?.[target];
        if (node) {
            const maxDepth = target === 'frequency' ? 100 : 0.5;
            node.gain.setTargetAtTime(depth * maxDepth, this.audioContext.currentTime, 0.01);
            this.depthNodes[lfoIndex][opIndex][target] = depth;
        } else {
            this.connect(lfoIndex, opIndex, target, depth);
        }
    }

    /**
     * Get current depth value
     */
    getDepth(lfoIndex, opIndex, target) {
        return this.depthNodes[lfoIndex]?.[opIndex]?.[target] || 0;
    }

    /**
     * Check if connection exists
     */
    isConnected(lfoIndex, opIndex, target) {
        return !!(this.connections[lfoIndex]?.[opIndex]?.[target]);
    }

    /**
     * Clean up all connections
     */
    dispose() {
        for (let i = 0; i < this.connections.length; i++) {
            for (let j = 0; j < this.connections[i].length; j++) {
                this.disconnect(i, j, 'frequency');
                this.disconnect(i, j, 'level');
            }
        }
    }
}
