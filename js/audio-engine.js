/**
 * FM Synthesizer Audio Engine
 * Handles AudioContext initialization and master audio routing
 */

class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.limiter = null;
        this.analyser = null;
        this.isInitialized = false;
    }

    /**
     * Initialize AudioContext (must be called after user gesture)
     */
    async init() {
        if (this.isInitialized) {
            return;
        }

        try {
            // Create AudioContext
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass();

            // Create master chain: Source -> Limiter -> MasterGain -> Analyser -> Destination
            this.limiter = this.audioContext.createDynamicsCompressor();
            this.limiter.threshold.value = -6;
            this.limiter.knee.value = 0;
            this.limiter.ratio.value = 20;
            this.limiter.attack.value = 0;
            this.limiter.release.value = 0.25;

            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.7;

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;

            // Connect the chain
            this.limiter.connect(this.masterGain);
            this.masterGain.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);

            this.isInitialized = true;
            console.log('Audio Engine initialized');
        } catch (error) {
            console.error('Failed to initialize Audio Engine:', error);
            throw error;
        }
    }

    /**
     * Resume AudioContext if suspended (required after user gesture)
     */
    async resume() {
        if (!this.isInitialized) {
            await this.init();
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        return this.audioContext;
    }

    /**
     * Get the current AudioContext
     */
    getContext() {
        return this.audioContext;
    }

    /**
     * Connect a node to the master chain
     */
    connectToMaster(node) {
        if (this.limiter) {
            node.connect(this.limiter);
        }
    }

    /**
     * Disconnect a node from the master chain
     */
    disconnectFromMaster(node) {
        try {
            node.disconnect(this.limiter);
        } catch (e) {
            // Ignore if already disconnected
        }
    }

    /**
     * Set master volume
     * @param {number} value - Volume level (0.0 to 1.0)
     */
    setMasterVolume(value) {
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.01);
        }
    }

    /**
     * Get current master volume
     */
    getMasterVolume() {
        return this.masterGain ? this.masterGain.gain.value : 0.7;
    }

    /**
     * Get current time from AudioContext
     */
    getCurrentTime() {
        return this.audioContext ? this.audioContext.currentTime : 0;
    }

    /**
     * Get analyser data for visualization
     */
    getAnalyserData(dataArray) {
        if (this.analyser) {
            this.analyser.getByteTimeDomainData(dataArray);
        }
    }

    /**
     * Get frequency data for visualization
     */
    getFrequencyData(dataArray) {
        if (this.analyser) {
            this.analyser.getByteFrequencyData(dataArray);
        }
    }

    /**
     * Create a new oscillator node
     */
    createOscillator() {
        return this.audioContext.createOscillator();
    }

    /**
     * Create a new gain node
     */
    createGain() {
        return this.audioContext.createGain();
    }

    /**
     * Create a new stereo panner node
     */
    createStereoPanner() {
        return this.audioContext.createStereoPanner();
    }

    /**
     * Create a new constant source for modulation
     */
    createConstant() {
        return this.audioContext.createConstantSource();
    }
}

// Singleton instance
const audioEngine = new AudioEngine();
