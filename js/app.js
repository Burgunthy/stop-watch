/**
 * FM Synthesizer Main Application
 * Main initialization and coordination
 */

// Global error handler
window.addEventListener('error', (e) => {
    console.error('[FM Synth] Global error:', e.error);
});

class FMSynthesizer {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.operators = [];
        this.envelopes = [];
        this.lfos = [];
        this.modulationMatrix = null;
        this.lfoRouter = null;
        this.uiController = null;

        // Synth parameters
        this.masterTuning = 440; // A4 frequency
        this.masterVolume = 0.7;
        this.glideTime = 0; // Portamento time

        // Active notes
        this.activeVoices = new Map();

        // Initialization state
        this.isInitialized = false;
    }

    /**
     * Initialize the synthesizer
     */
    async init() {
        if (this.isInitialized) return;

        try {
            console.log('[FM Synth] Starting initialization...');

            // Initialize audio context FIRST
            await this.initAudio();

            // Create envelopes BEFORE operators (operators need envelopes)
            this.initEnvelopes();
            console.log('[FM Synth] Envelopes created');

            // Create operators after envelopes exist
            this.initOperators();
            console.log('[FM Synth] Operators created');

            // Create LFOs
            this.initLFOs();
            console.log('[FM Synth] LFOs created');

            // Create modulation matrix
            this.initModulationMatrix();
            console.log('[FM Synth] Modulation matrix initialized');

            // Create LFO router
            this.initLFORouter();
            console.log('[FM Synth] LFO router initialized');

            // Initialize UI
            this.uiController = new UIController(this);
            this.uiController.init();
            console.log('[FM Synth] UI initialized');

            // Apply initial preset for sound
            this.applyInitialPreset();
            console.log('[FM Synth] Initial preset applied');

            this.isInitialized = true;
            console.log('[FM Synth] ✓ FM Synthesizer fully initialized! Ready to play.');

        } catch (error) {
            console.error('[FM Synth] ✗ Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Initialize audio context and master chain
     */
    async initAudio() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContextClass();

        // Master gain
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = this.masterVolume;

        // Limiter to prevent clipping
        const limiter = this.audioContext.createDynamicsCompressor();
        limiter.threshold.value = -6;
        limiter.ratio.value = 12;

        // Connect master chain
        this.masterGain.connect(limiter);
        limiter.connect(this.audioContext.destination);

        // Resume if suspended
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    /**
     * Initialize 4 operators
     */
    initOperators() {
        for (let i = 0; i < 4; i++) {
            const op = new Operator(i, this.audioContext);
            op.createNodes();

            // Default values - all operators start silent
            op.setWaveform('sine');
            op.setFrequencyRatio(1.0);
            op.setLevel(0);
            op.setModulationIndex(0);

            // Assign envelope (envelopes should already exist)
            if (this.envelopes[i]) {
                op.setEnvelope(this.envelopes[i]);
            }

            this.operators.push(op);
        }

        console.log('[FM Synth] Created 4 operators');
    }

    /**
     * Initialize 4 ADSR envelopes
     */
    initEnvelopes() {
        for (let i = 0; i < 4; i++) {
            const env = new ADSREnvelope(i, this.audioContext);

            // Default ADSR values
            env.setAttack(0.01);
            env.setDecay(0.3);
            env.setSustain(0.5);
            env.setRelease(0.3);

            this.envelopes.push(env);
        }
    }

    /**
     * Initialize 4 LFOs
     */
    initLFOs() {
        for (let i = 0; i < 4; i++) {
            const lfo = new LFO(i, this.audioContext);
            lfo.createNodes();

            // Default values
            lfo.setWaveform('sine');
            lfo.setRate(5);
            lfo.setDepth(0.2);

            this.lfos.push(lfo);
        }
    }

    /**
     * Initialize modulation matrix
     */
    initModulationMatrix() {
        this.modulationMatrix = new ModulationMatrix(this.audioContext);
        this.modulationMatrix.setOperators(this.operators);
        this.modulationMatrix.setMasterOutput(this.masterGain);

        // Default modulation: simple 2-operator FM
        // OP1 modulates OP2 at ratio, OP2 modulates OP3, OP3 outputs
        this.modulationMatrix.setModulation(0, 1, 50); // OP1 -> OP2
        this.modulationMatrix.setModulation(1, 2, 30); // OP2 -> OP3
    }

    /**
     * Initialize LFO router
     */
    initLFORouter() {
        this.lfoRouter = new LFOModulationRouter(this.audioContext);
        this.lfoRouter.setLFOs(this.lfos);
        this.lfoRouter.setOperators(this.operators);
    }

    /**
     * Note on
     * @param {number} midi - MIDI note number (0-127)
     * @param {string} noteName - Note name (e.g., 'C4', 'A#3')
     * @param {number} velocity - Note velocity (0.0-1.0)
     */
    noteOn(midi, noteName, velocity = 0.75) {
        if (!this.isInitialized) return;

        const frequency = this.midiToFrequency(midi);

        // Stop any existing voice for this note if monophonic
        if (this.activeVoices.has(midi)) {
            this.noteOff(midi);
        }

        // Create voice
        const voice = {
            midi: midi,
            frequency: frequency,
            velocity: velocity,
            operatorVoices: []
        };

        // Trigger all operators that have output enabled
        this.operators.forEach(op => {
            const voiceId = op.noteOn(frequency, velocity);
            voice.operatorVoices.push(voiceId);
        });

        this.activeVoices.set(midi, voice);
    }

    /**
     * Note off
     * @param {number} midi - MIDI note number
     */
    noteOff(midi) {
        if (!this.isInitialized) return;

        const voice = this.activeVoices.get(midi);
        if (!voice) return;

        // Release all operators
        this.operators.forEach((op, i) => {
            if (voice.operatorVoices[i] !== undefined) {
                op.noteOff(voice.operatorVoices[i]);
            }
        });

        this.activeVoices.delete(midi);
    }

    /**
     * All notes off (panic)
     */
    allNotesOff() {
        this.activeVoices.forEach((voice, midi) => {
            this.noteOff(midi);
        });
        this.activeVoices.clear();

        // Also stop all operators
        this.operators.forEach(op => op.allNotesOff());
    }

    /**
     * Convert MIDI note number to frequency
     */
    midiToFrequency(midi) {
        // A4 = MIDI 69 = 440Hz (default)
        // Apply master tuning
        const a4Freq = this.masterTuning;
        return a4Freq * Math.pow(2, (midi - 69) / 12);
    }

    /**
     * Set operator parameter
     */
    updateOperatorParam(opIndex, param, value) {
        const op = this.operators[opIndex];
        if (!op) return;

        switch (param) {
            case 'frequency':
                // Logarithmic scale from 0.5Hz to 16kHz
                const minFreq = Math.log10(0.5);
                const maxFreq = Math.log10(16000);
                const frequency = Math.pow(10, minFreq + (maxFreq - minFreq) * value);
                op.setFrequency(frequency);
                break;

            case 'ratio':
                op.setFrequencyRatio(value * 16);
                break;

            case 'level':
                op.setLevel(value);
                break;

            case 'mod-index':
                op.setModulationIndex(value * 100);
                break;

            case 'pan':
                op.setPan((value - 0.5) * 2);
                break;
        }
    }

    /**
     * Set operator waveform
     */
    setOperatorWaveform(opIndex, waveform) {
        const op = this.operators[opIndex];
        if (op) {
            op.setWaveform(waveform);
        }
    }

    /**
     * Set operator phase invert
     */
    setOperatorPhaseInvert(opIndex, invert) {
        const op = this.operators[opIndex];
        if (op) {
            op.setPhaseInvert(invert);
        }
    }

    /**
     * Set operator master output
     */
    setOperatorMasterOut(opIndex, enabled) {
        this.modulationMatrix.setMasterOutput(opIndex, enabled);
    }

    /**
     * Set modulation between operators
     */
    setModulation(sourceIndex, targetIndex, depth) {
        this.modulationMatrix.setModulation(sourceIndex, targetIndex, depth);
    }

    /**
     * Update ADSR parameter
     */
    updateADSRParam(envIndex, param, value) {
        const env = this.envelopes[envIndex];
        if (!env) return;

        switch (param) {
            case 'attack':
                // Logarithmic scale from 1ms to 10s
                const minAtk = Math.log10(0.001);
                const maxAtk = Math.log10(10);
                env.setAttack(Math.pow(10, minAtk + (maxAtk - minAtk) * value));
                break;

            case 'decay':
                const minDec = Math.log10(0.001);
                const maxDec = Math.log10(10);
                env.setDecay(Math.pow(10, minDec + (maxDec - minDec) * value));
                break;

            case 'sustain':
                env.setSustain(value);
                break;

            case 'release':
                const minRel = Math.log10(0.001);
                const maxRel = Math.log10(10);
                env.setRelease(Math.pow(10, minRel + (maxRel - minRel) * value));
                break;
        }
    }

    /**
     * Assign envelope to operator
     */
    assignEnvelopeToOperator(opIndex, envIndex) {
        const op = this.operators[opIndex];
        const env = this.envelopes[envIndex];
        if (op && env) {
            op.setEnvelope(env);
        }
    }

    /**
     * Update LFO parameter
     */
    updateLFOParam(lfoIndex, param, value) {
        const lfo = this.lfos[lfoIndex];
        if (!lfo) return;

        switch (param) {
            case 'rate':
                lfo.setRate(0.1 + value * 19.9);
                break;

            case 'depth':
                lfo.setDepth(value, 100);
                break;

            case 'pan':
                lfo.setPan((value - 0.5) * 2);
                break;
        }
    }

    /**
     * Set LFO waveform
     */
    setLFOWaveform(lfoIndex, waveform) {
        const lfo = this.lfos[lfoIndex];
        if (lfo) {
            lfo.setWaveform(waveform);
        }
    }

    /**
     * Start LFO
     */
    startLFO(lfoIndex) {
        const lfo = this.lfos[lfoIndex];
        if (lfo) {
            lfo.start();
        }
    }

    /**
     * Stop LFO
     */
    stopLFO(lfoIndex) {
        const lfo = this.lfos[lfoIndex];
        if (lfo) {
            lfo.stop();
        }
    }

    /**
     * Set LFO target
     */
    setLFOTarget(lfoIndex, target) {
        // target format: "op1-freq", "op2-level", etc.
        const match = target.match(/op(\d+)-(freq|level)/);
        if (match) {
            const opIndex = parseInt(match[1]) - 1;
            const param = match[2] === 'freq' ? 'frequency' : 'level';
            const lfo = this.lfos[lfoIndex];
            const op = this.operators[opIndex];

            if (lfo && op) {
                // Clear existing connections for this LFO
                for (let i = 0; i < 4; i++) {
                    this.lfoRouter.disconnect(lfoIndex, i, 'frequency');
                    this.lfoRouter.disconnect(lfoIndex, i, 'level');
                }

                // Create new connection
                if (param === 'frequency') {
                    lfo.connect(op.getFrequencyParam());
                } else {
                    lfo.connect(op.outputGain.gain);
                }
            }
        }
    }

    /**
     * Update master parameter
     */
    updateMasterParam(param, value) {
        switch (param) {
            case 'volume':
                this.masterVolume = value;
                if (this.masterGain) {
                    this.masterGain.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.01);
                }
                break;

            case 'tuning':
                // value 0-1 maps to 415-466 Hz (A4)
                this.masterTuning = 415 + value * 51;
                break;

            case 'glide':
                // Portamento time 0-1 maps to 0-500ms
                this.glideTime = value * 0.5;
                break;
        }
    }

    /**
     * Set master tuning (cents from 440Hz)
     */
    setMasterTuning(cents) {
        this.masterTuning = 440 * Math.pow(2, cents / 1200);
    }

    /**
     * Apply initial preset for immediate sound output
     */
    applyInitialPreset() {
        // Simple bell-like FM preset
        // OP1 (modulator) -> OP2 (carrier) -> OUT

        // OP1: Modulator
        this.operators[0].setFrequencyRatio(2.0);
        this.operators[0].setLevel(0);
        this.operators[0].setModulationIndex(10);

        // OP2: Carrier (outputs to master)
        this.operators[1].setFrequencyRatio(1.0);
        this.operators[1].setLevel(0.5);
        this.operators[1].setModulationIndex(0);

        // OP3, OP4: silent
        this.operators[2].setLevel(0);
        this.operators[3].setLevel(0);

        // Set up modulation: OP1 modulates OP2
        this.modulationMatrix.clearAll();
        this.modulationMatrix.setModulation(0, 1, 50);
        this.modulationMatrix.setMasterOutput(1, true); // OP2 to master

        // Envelope settings for bell sound
        this.envelopes[1].setAttack(0.001);
        this.envelopes[1].setDecay(0.5);
        this.envelopes[1].setSustain(0);
        this.envelopes[1].setRelease(1.0);

        console.log('[FM Synth] Applied initial bell preset');
    }

    /**
     * Load preset
     */
    loadPreset(presetName) {
        this.modulationMatrix.loadPreset(presetName);
    }

    /**
     * Get synth state for saving
     */
    getState() {
        return {
            masterVolume: this.masterVolume,
            masterTuning: this.masterTuning,
            glideTime: this.glideTime,
            operators: this.operators.map(op => ({
                waveform: op.waveform,
                frequencyRatio: op.frequencyRatio,
                level: op.level,
                modulationIndex: op.modulationIndex,
                phaseInvert: op.phaseInvert
            })),
            envelopes: this.envelopes.map(env => env.getState()),
            lfos: this.lfos.map(lfo => lfo.getState()),
            matrix: this.modulationMatrix.getMatrix()
        };
    }

    /**
     * Set synth state
     */
    setState(state) {
        if (state.masterVolume !== undefined) {
            this.updateMasterParam('volume', state.masterVolume);
        }
        if (state.masterTuning !== undefined) {
            this.masterTuning = state.masterTuning;
        }
        if (state.glideTime !== undefined) {
            this.glideTime = state.glideTime;
        }
        if (state.operators) {
            state.operators.forEach((opState, i) => {
                const op = this.operators[i];
                if (op) {
                    op.setWaveform(opState.waveform);
                    op.setFrequencyRatio(opState.frequencyRatio);
                    op.setLevel(opState.level);
                    op.setModulationIndex(opState.modulationIndex);
                    op.setPhaseInvert(opState.phaseInvert);
                }
            });
        }
        if (state.envelopes) {
            state.envelopes.forEach((envState, i) => {
                const env = this.envelopes[i];
                if (env) {
                    env.setState(envState);
                }
            });
        }
        if (state.lfos) {
            state.lfos.forEach((lfoState, i) => {
                const lfo = this.lfos[i];
                if (lfo) {
                    lfo.setState(lfoState);
                }
            });
        }
        if (state.matrix) {
            this.modulationMatrix.setMatrix(state.matrix);
        }
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.allNotesOff();

        this.operators.forEach(op => op.dispose());
        this.lfos.forEach(lfo => lfo.dispose());
        this.modulationMatrix.dispose();
        this.lfoRouter.dispose();

        if (this.masterGain) {
            this.masterGain.disconnect();
        }
    }
}

// ============================================
// APP INITIALIZATION
// ============================================

let synth = null;

// Initialize on user interaction
async function initSynth() {
    if (synth) return;

    try {
        synth = new FMSynthesizer();
        await synth.init();

        // Update UI to reflect initial state
        if (synth.uiController) {
            synth.uiController.updateUI();
        }

        console.log('Synth ready! Click the keyboard or press keys Z/X/C/V...');
    } catch (error) {
        console.error('Failed to initialize synth:', error);
    }
}

// Auto-initialize on page load with user interaction detection
document.addEventListener('DOMContentLoaded', () => {
    // Show "Click to start" overlay
    const overlay = document.createElement('div');
    overlay.className = 'start-overlay';
    overlay.innerHTML = `
        <div class="start-message">
            <h1>FM SYNTHESIZER</h1>
            <p>Click anywhere to start</p>
        </div>
    `;
    document.body.appendChild(overlay);

    // Set initial status
    const statusIndicator = document.getElementById('statusIndicator');
    if (statusIndicator) {
        const statusText = statusIndicator.querySelector('.status-text');
        if (statusText) statusText.textContent = 'Click to Start';
    }

    // Initialize on first interaction
    const startHandler = async () => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);

        try {
            await initSynth();

            // Update status to show active
            if (statusIndicator) {
                statusIndicator.classList.add('active');
                const statusText = statusIndicator.querySelector('.status-text');
                if (statusText) statusText.textContent = 'Active';
            }
        } catch (error) {
            console.error('[FM Synth] Initialization failed:', error);

            // Show error status
            if (statusIndicator) {
                statusIndicator.classList.add('error');
                const statusText = statusIndicator.querySelector('.status-text');
                if (statusText) statusText.textContent = 'Error';
            }
        }

        document.removeEventListener('click', startHandler);
        document.removeEventListener('touchstart', startHandler);
        document.removeEventListener('keydown', startHandler);
    };

    document.addEventListener('click', startHandler);
    document.addEventListener('touchstart', startHandler, { passive: true });
    document.addEventListener('keydown', startHandler);
});

// Export for debugging
window.synth = synth;
window.FMSynthesizer = FMSynthesizer;
