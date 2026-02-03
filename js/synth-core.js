/**
 * FM Synthesizer Core Classes
 * Operator, ADSR Envelope, and LFO implementations
 */

// ============================================
// OPERATOR CLASS
// ============================================

class Operator {
    constructor(id, audioContext) {
        this.id = id;
        this.audioContext = audioContext;

        // Audio nodes
        this.oscillator = null;
        this.phaseInvertGain = null;
        this.outputGain = null;
        this.modulationGain = null;
        this.panner = null;

        // Parameters
        this.waveform = 'sine';
        this.frequency = 440;
        this.frequencyRatio = 1.0;
        this.level = 0.5;
        this.modulationIndex = 0;
        this.phaseInvert = false;

        // Envelope
        this.envelope = null;
        this.envelopeGain = null;

        // LFO connections
        this.lfoConnections = {
            frequency: [],
            level: []
        };

        // Active voices (for polyphony)
        this.voices = new Map();
        this.nextVoiceId = 0;
    }

    /**
     * Create audio nodes for this operator
     */
    createNodes() {
        // Main oscillator
        this.oscillator = this.audioContext.createOscillator();
        this.oscillator.type = this.waveform;
        this.oscillator.frequency.value = this.frequency;

        // Phase inversion (gain of -1 or 1)
        this.phaseInvertGain = this.audioContext.createGain();
        this.phaseInvertGain.gain.value = this.phaseInvert ? -1 : 1;

        // Output level control
        this.outputGain = this.audioContext.createGain();
        this.outputGain.gain.value = this.level;

        // Envelope gain (for ADSR control)
        this.envelopeGain = this.audioContext.createGain();
        this.envelopeGain.gain.value = 1;

        // Modulation input gain (for FM modulation)
        this.modulationGain = this.audioContext.createGain();
        this.modulationGain.gain.value = this.modulationIndex;

        // Stereo panner
        this.panner = this.audioContext.createStereoPanner();
        this.panner.pan.value = 0;

        // Connect nodes: Osc -> PhaseInvert -> EnvGain -> OutputGain -> Panner
        this.oscillator.connect(this.phaseInvertGain);
        this.phaseInvertGain.connect(this.envelopeGain);
        this.envelopeGain.connect(this.outputGain);
        this.outputGain.connect(this.panner);

        // Start oscillator
        this.oscillator.start();
    }

    /**
     * Connect this operator's output to a destination
     */
    connect(destination) {
        if (this.panner) {
            this.panner.connect(destination);
        }
    }

    /**
     * Disconnect this operator's output
     */
    disconnect(destination) {
        if (this.panner) {
            this.panner.disconnect(destination);
        }
    }

    /**
     * Get the output node for modulation routing
     */
    getOutput() {
        return this.panner;
    }

    /**
     * Get the frequency node for modulation input
     */
    getFrequencyParam() {
        return this.oscillator ? this.oscillator.frequency : null;
    }

    /**
     * Get the modulation gain node for FM input
     */
    getModulationInput() {
        return this.modulationGain;
    }

    /**
     * Connect modulation input to oscillator frequency
     */
    connectModulationInput() {
        if (this.modulationGain && this.oscillator) {
            this.modulationGain.connect(this.oscillator.frequency);
        }
    }

    /**
     * Set waveform type
     * @param {string} type - 'sine', 'cosine', 'square', 'sawtooth'
     */
    setWaveform(type) {
        this.waveform = type;
        if (this.oscillator) {
            if (type === 'cosine') {
                // Cosine = sine with 90 degree phase shift
                this.oscillator.type = 'sine';
                // Note: true cosine requires additional phase node
            } else {
                this.oscillator.type = type;
            }
        }
    }

    /**
     * Set frequency (Hz)
     */
    setFrequency(freq) {
        this.frequency = freq;
        if (this.oscillator) {
            this.oscillator.frequency.setTargetAtTime(freq, this.audioContext.currentTime, 0.01);
        }
    }

    /**
     * Set frequency ratio (multiplicative)
     */
    setFrequencyRatio(ratio) {
        this.frequencyRatio = ratio;
        // Actual frequency will be calculated based on base note frequency
    }

    /**
     * Set output level (0.0 to 1.0)
     */
    setLevel(level) {
        this.level = level;
        if (this.outputGain) {
            this.outputGain.gain.setTargetAtTime(level, this.audioContext.currentTime, 0.01);
        }
    }

    /**
     * Set modulation index (0 to 100)
     */
    setModulationIndex(index) {
        this.modulationIndex = index;
        if (this.modulationGain) {
            // Scale index to reasonable modulation depth
            const scaledIndex = index * 100; // Adjust multiplier as needed
            this.modulationGain.gain.setTargetAtTime(scaledIndex, this.audioContext.currentTime, 0.01);
        }
    }

    /**
     * Toggle phase inversion
     */
    setPhaseInvert(invert) {
        this.phaseInvert = invert;
        if (this.phaseInvertGain) {
            this.phaseInvertGain.gain.setTargetAtTime(invert ? -1 : 1, this.audioContext.currentTime, 0.01);
        }
    }

    /**
     * Set pan position (-1 to 1)
     */
    setPan(value) {
        if (this.panner) {
            this.panner.pan.setTargetAtTime(value, this.audioContext.currentTime, 0.01);
        }
    }

    /**
     * Note on - trigger the envelope
     */
    noteOn(frequency, velocity = 0.75) {
        if (!this.envelope) return;

        // Update frequency
        const actualFreq = frequency * this.frequencyRatio;
        this.setFrequency(actualFreq);

        // Trigger envelope
        this.envelope.trigger(this.envelopeGain.gain, velocity);

        // Store active voice
        const voiceId = this.nextVoiceId++;
        this.voices.set(voiceId, { frequency, velocity });
        return voiceId;
    }

    /**
     * Note off - release the envelope
     */
    noteOff(voiceId) {
        if (!this.envelope) return;

        this.envelope.release(this.envelopeGain.gain);
        this.voices.delete(voiceId);
    }

    /**
     * Stop all active voices
     */
    allNotesOff() {
        if (this.envelope) {
            this.envelope.release(this.envelopeGain.gain);
        }
        this.voices.clear();
    }

    /**
     * Set envelope for this operator
     */
    setEnvelope(envelope) {
        this.envelope = envelope;
    }

    /**
     * Add LFO connection
     */
    addLFOConnection(target, lfo) {
        this.lfoConnections[target].push(lfo);
    }

    /**
     * Remove LFO connection
     */
    removeLFOConnection(target, lfo) {
        const index = this.lfoConnections[target].indexOf(lfo);
        if (index > -1) {
            this.lfoConnections[target].splice(index, 1);
        }
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
        }
        if (this.phaseInvertGain) this.phaseInvertGain.disconnect();
        if (this.outputGain) this.outputGain.disconnect();
        if (this.envelopeGain) this.envelopeGain.disconnect();
        if (this.modulationGain) this.modulationGain.disconnect();
        if (this.panner) this.panner.disconnect();
    }
}

// ============================================
// ADSR ENVELOPE CLASS
// ============================================

class ADSREnvelope {
    constructor(id, audioContext) {
        this.id = id;
        this.audioContext = audioContext;

        // Envelope parameters
        this.attack = 0.01;      // seconds
        this.decay = 0.1;        // seconds
        this.sustain = 0.7;      // 0.0 to 1.0
        this.release = 0.3;      // seconds

        // Current state
        this.isActive = false;
        this.currentValue = 0;
        this.releaseTimeout = null;
    }

    /**
     * Set attack time (seconds)
     */
    setAttack(value) {
        this.attack = Math.max(0.001, value);
    }

    /**
     * Set decay time (seconds)
     */
    setDecay(value) {
        this.decay = Math.max(0.001, value);
    }

    /**
     * Set sustain level (0.0 to 1.0)
     */
    setSustain(value) {
        this.sustain = Math.max(0, Math.min(1, value));
    }

    /**
     * Set release time (seconds)
     */
    setRelease(value) {
        this.release = Math.max(0.001, value);
    }

    /**
     * Trigger the envelope (note on)
     * @param {AudioParam} param - The audio parameter to control
     * @param {number} velocity - Note velocity (0.0 to 1.0)
     */
    trigger(param, velocity = 0.75) {
        const now = this.audioContext.currentTime;
        const peakLevel = velocity;

        // Cancel any scheduled changes
        param.cancelScheduledValues(now);
        param.setValueAtTime(this.currentValue, now);

        // Attack phase
        param.linearRampToValueAtTime(peakLevel, now + this.attack);

        // Decay phase to sustain
        param.linearRampToValueAtTime(peakLevel * this.sustain, now + this.attack + this.decay);

        this.isActive = true;
        this.currentValue = peakLevel * this.sustain;

        // Clear any pending release
        if (this.releaseTimeout) {
            clearTimeout(this.releaseTimeout);
            this.releaseTimeout = null;
        }
    }

    /**
     * Release the envelope (note off)
     * @param {AudioParam} param - The audio parameter to control
     */
    release(param) {
        if (!this.isActive) return;

        const now = this.audioContext.currentTime;

        // Cancel scheduled changes
        param.cancelScheduledValues(now);

        // Get current value
        const currentValue = param.value;
        param.setValueAtTime(currentValue, now);

        // Release to zero
        param.linearRampToValueAtTime(0, now + this.release);

        this.isActive = false;
        this.currentValue = 0;
    }

    /**
     * Quick reset (hard stop)
     * @param {AudioParam} param - The audio parameter to control
     */
    reset(param) {
        const now = this.audioContext.currentTime;
        param.cancelScheduledValues(now);
        param.setValueAtTime(0, now);
        this.isActive = false;
        this.currentValue = 0;
    }

    /**
     * Get envelope as time-value array for visualization
     */
    getEnvelopeCurve() {
        const points = [];
        const duration = this.attack + this.decay + this.release + 0.1;
        const samples = 100;

        for (let i = 0; i < samples; i++) {
            const t = (i / samples) * duration;
            let value = 0;

            if (t < this.attack) {
                // Attack phase
                value = t / this.attack;
            } else if (t < this.attack + this.decay) {
                // Decay phase
                const decayProgress = (t - this.attack) / this.decay;
                value = 1 - decayProgress * (1 - this.sustain);
            } else if (t < this.attack + this.decay + 0.1) {
                // Sustain phase
                value = this.sustain;
            } else {
                // Release phase
                const releaseProgress = (t - this.attack - this.decay - 0.1) / this.release;
                value = this.sustain * (1 - Math.min(1, releaseProgress));
            }

            points.push({ time: t, value });
        }

        return points;
    }

    /**
     * Get envelope state as object
     */
    getState() {
        return {
            attack: this.attack,
            decay: this.decay,
            sustain: this.sustain,
            release: this.release
        };
    }

    /**
     * Set envelope state from object
     */
    setState(state) {
        if (state.attack !== undefined) this.setAttack(state.attack);
        if (state.decay !== undefined) this.setDecay(state.decay);
        if (state.sustain !== undefined) this.setSustain(state.sustain);
        if (state.release !== undefined) this.setRelease(state.release);
    }
}

// ============================================
// LFO CLASS
// ============================================

class LFO {
    constructor(id, audioContext) {
        this.id = id;
        this.audioContext = audioContext;

        // Audio nodes
        this.oscillator = null;
        this.depthGain = null;
        this.outputGain = null;
        this.panner = null;

        // Parameters
        this.waveform = 'sine';
        this.rate = 5;           // Hz
        this.depth = 0.5;        // 0.0 to 1.0
        this.isRunning = false;

        // Targets
        this.targets = {
            frequency: [],
            level: []
        };
    }

    /**
     * Create audio nodes for this LFO
     */
    createNodes() {
        // LFO oscillator
        this.oscillator = this.audioContext.createOscillator();
        this.oscillator.type = this.waveform;
        this.oscillator.frequency.value = this.rate;

        // Depth control
        this.depthGain = this.audioContext.createGain();
        this.depthGain.gain.value = this.depth;

        // Output gain (for on/off)
        this.outputGain = this.audioContext.createGain();
        this.outputGain.gain.value = 0; // Start muted

        // Stereo panner
        this.panner = this.audioContext.createStereoPanner();
        this.panner.pan.value = 0;

        // Connect nodes
        this.oscillator.connect(this.depthGain);
        this.depthGain.connect(this.outputGain);
        this.outputGain.connect(this.panner);

        // Start oscillator
        this.oscillator.start();
    }

    /**
     * Start the LFO
     */
    start() {
        if (this.outputGain && !this.isRunning) {
            this.outputGain.gain.setTargetAtTime(1, this.audioContext.currentTime, 0.01);
            this.isRunning = true;
        }
    }

    /**
     * Stop the LFO
     */
    stop() {
        if (this.outputGain && this.isRunning) {
            this.outputGain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
            this.isRunning = false;
        }
    }

    /**
     * Toggle LFO on/off
     */
    toggle() {
        if (this.isRunning) {
            this.stop();
        } else {
            this.start();
        }
        return this.isRunning;
    }

    /**
     * Connect to a target parameter
     */
    connect(target) {
        if (this.panner) {
            this.panner.connect(target);
        }
    }

    /**
     * Disconnect from a target parameter
     */
    disconnect(target) {
        if (this.panner) {
            this.panner.disconnect(target);
        }
    }

    /**
     * Get output node for connecting to targets
     */
    getOutput() {
        return this.panner;
    }

    /**
     * Set waveform type
     * @param {string} type - 'sine', 'square', 'sawtooth', 'triangle'
     */
    setWaveform(type) {
        this.waveform = type;
        if (this.oscillator) {
            this.oscillator.type = type;
        }
    }

    /**
     * Set rate (frequency in Hz)
     */
    setRate(rate) {
        this.rate = rate;
        if (this.oscillator) {
            this.oscillator.frequency.setTargetAtTime(rate, this.audioContext.currentTime, 0.01);
        }
    }

    /**
     * Set depth (modulation amount)
     * @param {number} depth - 0.0 to 1.0
     * @param {number} maxDepth - Maximum depth in actual units (e.g., 100 for Hz modulation)
     */
    setDepth(depth, maxDepth = 1) {
        this.depth = depth;
        if (this.depthGain) {
            this.depthGain.gain.setTargetAtTime(depth * maxDepth, this.audioContext.currentTime, 0.01);
        }
    }

    /**
     * Set pan position
     */
    setPan(value) {
        if (this.panner) {
            this.panner.pan.setTargetAtTime(value, this.audioContext.currentTime, 0.01);
        }
    }

    /**
     * Add target operator for modulation
     */
    addTarget(targetType, operator) {
        if (!this.targets[targetType].includes(operator)) {
            this.targets[targetType].push(operator);
        }
    }

    /**
     * Remove target operator
     */
    removeTarget(targetType, operator) {
        const index = this.targets[targetType].indexOf(operator);
        if (index > -1) {
            this.targets[targetType].splice(index, 1);
        }
    }

    /**
     * Clean up resources
     */
    dispose() {
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
        }
        if (this.depthGain) this.depthGain.disconnect();
        if (this.outputGain) this.outputGain.disconnect();
        if (this.panner) this.panner.disconnect();
    }

    /**
     * Get LFO state as object
     */
    getState() {
        return {
            waveform: this.waveform,
            rate: this.rate,
            depth: this.depth,
            isRunning: this.isRunning
        };
    }

    /**
     * Set LFO state from object
     */
    setState(state) {
        if (state.waveform !== undefined) this.setWaveform(state.waveform);
        if (state.rate !== undefined) this.setRate(state.rate);
        if (state.depth !== undefined) this.setDepth(state.depth);
        if (state.isRunning && !this.isRunning) {
            this.start();
        } else if (!state.isRunning && this.isRunning) {
            this.stop();
        }
    }
}
