/**
 * UI Controller
 * Handles all UI interactions and updates for the FM Synthesizer
 */

class UIController {
    constructor(synth) {
        this.synth = synth;
        this.isDraggingKnob = false;
        this.activeKnob = null;
        this.dragStartY = 0;
        this.dragStartValue = 0;

        // Keyboard mapping
        this.keyboardMap = this.createKeyboardMap();
        this.activeNotes = new Map();
    }

    /**
     * Initialize all UI event listeners
     */
    init() {
        this.initKnobs();
        this.initSliders();
        this.initSwitches();
        this.initMatrix();
        this.initVirtualKeyboard();
        this.initComputerKeyboard();
        this.initWaveformSelectors();
        this.initADSRControls();
        this.initLFOControls();
        this.initMasterControls();

        // Initialize knob visual values after a small delay
        setTimeout(() => {
            this.initKnobValues();
            this.initFaderValues();
        }, 100);
    }

    /**
     * Initialize all knob visual values
     */
    initKnobValues() {
        const knobs = document.querySelectorAll('.knob');
        knobs.forEach(knob => {
            const value = parseFloat(knob.dataset.value) || 0;
            this.setKnobValue(knob, value);
        });
    }

    /**
     * Initialize all fader visual values
     */
    initFaderValues() {
        const faderWrappers = document.querySelectorAll('.fader-wrapper');
        faderWrappers.forEach(wrapper => {
            const thumb = wrapper.querySelector('.fader-thumb');
            if (thumb) {
                const value = parseFloat(thumb.dataset.value) || 0;
                this.updateFaderValue(wrapper, value);
            }
        });
    }

    /**
     * Initialize knob controls
     */
    initKnobs() {
        const knobs = document.querySelectorAll('.knob');

        knobs.forEach(knob => {
            // Mouse events
            knob.addEventListener('mousedown', (e) => this.handleKnobMouseDown(e, knob));

            // Touch events
            knob.addEventListener('touchstart', (e) => this.handleKnobTouchStart(e, knob), { passive: false });

            // Wheel events
            knob.addEventListener('wheel', (e) => this.handleKnobWheel(e, knob), { passive: false });

            // Double click to reset
            knob.addEventListener('dblclick', (e) => this.handleKnobDoubleClick(e, knob));
        });

        // Global mouse move and up events
        document.addEventListener('mousemove', (e) => this.handleKnobDrag(e));
        document.addEventListener('mouseup', () => this.handleKnobDragEnd());
        document.addEventListener('touchmove', (e) => this.handleKnobTouchMove(e), { passive: false });
        document.addEventListener('touchend', () => this.handleKnobDragEnd());
    }

    /**
     * Handle knob mouse down
     */
    handleKnobMouseDown(e, knob) {
        e.preventDefault();
        this.startKnobDrag(e.clientY, knob);
    }

    /**
     * Handle knob touch start
     */
    handleKnobTouchStart(e, knob) {
        e.preventDefault();
        const touch = e.touches[0];
        this.startKnobDrag(touch.clientY, knob);
    }

    /**
     * Start knob dragging
     */
    startKnobDrag(startY, knob) {
        this.isDraggingKnob = true;
        this.activeKnob = knob;
        this.dragStartY = startY;
        this.dragStartValue = this.getKnobValue(knob);

        knob.classList.add('active');
    }

    /**
     * Handle knob drag
     */
    handleKnobDrag(e) {
        if (!this.isDraggingKnob || !this.activeKnob) return;

        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        if (clientY === undefined) return;

        const deltaY = this.dragStartY - clientY;
        const sensitivity = this.activeKnob.dataset.sensitivity || 0.005;
        const value = this.clampValue(this.dragStartValue + deltaY * parseFloat(sensitivity), 0, 1);

        this.setKnobValue(this.activeKnob, value);
    }

    /**
     * Handle knob touch move
     */
    handleKnobTouchMove(e) {
        this.handleKnobDrag(e);
    }

    /**
     * Handle knob drag end
     */
    handleKnobDragEnd() {
        if (this.activeKnob) {
            this.activeKnob.classList.remove('active');
        }
        this.isDraggingKnob = false;
        this.activeKnob = null;
    }

    /**
     * Handle knob wheel
     */
    handleKnobWheel(e, knob) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.01 : 0.01;
        const currentValue = this.getKnobValue(knob);
        const newValue = this.clampValue(currentValue + delta, 0, 1);
        this.setKnobValue(knob, newValue);
    }

    /**
     * Handle knob double click (reset to default)
     */
    handleKnobDoubleClick(e, knob) {
        const defaultValue = knob.dataset.default || 0.5;
        this.setKnobValue(knob, parseFloat(defaultValue));
    }

    /**
     * Get knob value from data attribute
     */
    getKnobValue(knob) {
        return parseFloat(knob.dataset.value) || 0;
    }

    /**
     * Set knob value and update visual
     */
    setKnobValue(knob, value) {
        value = this.clampValue(value, 0, 1);
        knob.dataset.value = value;

        // Update rotation
        const minRotation = -135;
        const maxRotation = 135;
        const rotation = minRotation + (maxRotation - minRotation) * value;

        const indicator = knob.querySelector('.knob-indicator');
        if (indicator) {
            indicator.style.setProperty('--rotation', `${rotation}deg`);
            indicator.style.transform = `rotate(${rotation}deg)`;
        }

        const pointer = knob.querySelector('.knob-pointer');
        if (pointer) {
            pointer.style.setProperty('--pointer-rotation', `${rotation}deg`);
            pointer.style.transform = `translateX(-50%) rotate(${rotation}deg)`;
        }

        // Update value display
        const valueDisplay = knob.parentElement.querySelector('.knob-value');
        if (valueDisplay) {
            const displayValue = this.formatKnobValue(knob, value);
            valueDisplay.textContent = displayValue;
        }

        // Trigger change callback
        this.onKnobChange(knob, value);
    }

    /**
     * Format knob value for display
     */
    formatKnobValue(knob, value) {
        const type = knob.dataset.type;

        switch (type) {
            case 'frequency':
                // Logarithmic scale from 0.5 Hz to 16 kHz
                return this.frequencyValueToDisplay(value);
            case 'ratio':
                return (value * 16).toFixed(2);
            case 'percent':
                return Math.round(value * 100) + '%';
            case 'mod-index':
                return Math.round(value * 100);
            case 'seconds':
                return this.secondsValueToDisplay(value);
            case 'lfo-rate':
                return (0.1 + value * 19.9).toFixed(1) + ' Hz';
            default:
                return (value * 100).toFixed(0);
        }
    }

    /**
     * Convert normalized frequency value to display string
     */
    frequencyValueToDisplay(value) {
        if (value <= 0) return '0 Hz';
        // Logarithmic scale
        const minFreq = Math.log10(0.5);
        const maxFreq = Math.log10(16000);
        const freq = Math.pow(10, minFreq + (maxFreq - minFreq) * value);
        if (freq >= 1000) {
            return (freq / 1000).toFixed(2) + ' kHz';
        }
        return freq.toFixed(1) + ' Hz';
    }

    /**
     * Convert normalized seconds value to display string
     */
    secondsValueToDisplay(value) {
        // Logarithmic scale from 1ms to 10s
        const minSec = Math.log10(0.001);
        const maxSec = Math.log10(10);
        const seconds = Math.pow(10, minSec + (maxSec - minSec) * value);
        if (seconds < 0.01) {
            return (seconds * 1000).toFixed(1) + ' ms';
        }
        return seconds.toFixed(2) + ' s';
    }

    /**
     * Convert normalized value to actual frequency
     */
    frequencyValueToHz(value) {
        const minFreq = Math.log10(0.5);
        const maxFreq = Math.log10(16000);
        return Math.pow(10, minFreq + (maxFreq - minFreq) * value);
    }

    /**
     * Convert normalized value to seconds
     */
    secondsValueToSeconds(value) {
        const minSec = Math.log10(0.001);
        const maxSec = Math.log10(10);
        return Math.pow(10, minSec + (maxSec - minSec) * value);
    }

    /**
     * Handle knob value change
     */
    onKnobChange(knob, value) {
        const target = knob.dataset.target;
        const param = knob.dataset.param;
        const index = parseInt(knob.dataset.index);

        switch (target) {
            case 'operator':
                this.synth.updateOperatorParam(index, param, value);
                break;
            case 'lfo':
                this.synth.updateLFOParam(index, param, value);
                break;
            case 'master':
                this.synth.updateMasterParam(param, value);
                break;
        }
    }

    /**
     * Initialize slider controls (ADSR faders)
     */
    initSliders() {
        const faderWrappers = document.querySelectorAll('.fader-wrapper');

        faderWrappers.forEach(wrapper => {
            const track = wrapper.querySelector('.fader-track');
            const thumb = track.querySelector('.fader-thumb');

            if (!thumb) return;

            // Mouse events
            wrapper.addEventListener('mousedown', (e) => {
                if (e.target === thumb || e.target === track) {
                    e.preventDefault();
                    this.startFaderDrag(e, wrapper, thumb);
                }
            });

            // Touch events
            wrapper.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                this.startFaderDrag(touch, wrapper, thumb);
            }, { passive: false });
        });
    }

    /**
     * Start fader dragging
     */
    startFaderDrag(startEvent, wrapper, thumb) {
        const track = wrapper.querySelector('.fader-track');
        const trackRect = track.getBoundingClientRect();
        const envIndex = parseInt(wrapper.dataset.env);
        const param = wrapper.dataset.param;

        const updateFader = (clientY) => {
            let value = (clientY - trackRect.top) / trackRect.height;
            value = 1 - Math.max(0, Math.min(1, value)); // Invert (bottom = 0, top = 1)

            this.updateFaderValue(wrapper, value);
            this.updateADSRFromFader(envIndex, param, value);
        };

        // Initial value
        updateFader(startEvent.clientY);

        // Drag handlers
        const onMove = (e) => {
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            if (clientY !== undefined) {
                updateFader(clientY);
            }
        };

        const onEnd = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    }

    /**
     * Update fader visual value
     */
    updateFaderValue(wrapper, value) {
        const thumb = wrapper.querySelector('.fader-thumb');
        const fill = wrapper.querySelector('.fader-fill');
        const valueDisplay = wrapper.querySelector('.fader-value');

        if (thumb) {
            thumb.style.bottom = `${value * 100}%`;
            thumb.dataset.value = value;
        }

        if (fill) {
            fill.style.height = `${value * 100}%`;
        }

        if (valueDisplay) {
            valueDisplay.textContent = this.formatFaderValue(wrapper, value);
        }
    }

    /**
     * Format fader value for display
     */
    formatFaderValue(wrapper, value) {
        const param = wrapper.dataset.param;

        if (param === 'sustain') {
            return Math.round(value * 100) + '%';
        }

        // Logarithmic scale for time-based parameters
        const minSec = Math.log10(0.001);
        const maxSec = Math.log10(10);
        const seconds = Math.pow(10, minSec + (maxSec - minSec) * value);

        if (seconds < 0.01) {
            return Math.round(seconds * 1000) + 'ms';
        }
        return (seconds * 1000).toFixed(0) + 'ms';
    }

    /**
     * Convert normalized value to seconds
     */
    faderValueToSeconds(value) {
        const minSec = Math.log10(0.001);
        const maxSec = Math.log10(10);
        return Math.pow(10, minSec + (maxSec - minSec) * value);
    }

    /**
     * Update ADSR parameter from fader value
     */
    updateADSRFromFader(envIndex, param, value) {
        if (param === 'sustain') {
            this.synth.envelopes[envIndex].setSustain(value);
        } else {
            const seconds = this.faderValueToSeconds(value);
            this.synth.envelopes[envIndex][`set${param.charAt(0).toUpperCase() + param.slice(1)}`](seconds);
        }
    }

    /**
     * Handle slider value change (legacy, for compatibility)
     */
    handleSliderChange(slider, value) {
        slider.dataset.value = value;

        const target = slider.dataset.target;
        const param = slider.dataset.param;
        const index = parseInt(slider.dataset.index);

        switch (target) {
            case 'operator':
                this.synth.updateOperatorParam(index, param, value);
                break;
            case 'lfo':
                this.synth.updateLFOParam(index, param, value);
                break;
            case 'adsr':
                this.synth.updateADSRParam(index, param, value);
                break;
        }
    }

    /**
     * Initialize toggle switches
     */
    initSwitches() {
        const switches = document.querySelectorAll('.switch');

        switches.forEach(sw => {
            sw.addEventListener('click', () => {
                this.toggleSwitch(sw);
            });
        });
    }

    /**
     * Toggle switch state
     */
    toggleSwitch(sw) {
        const currentState = sw.classList.contains('on');
        const newState = !currentState;

        if (newState) {
            sw.classList.add('on');
            sw.dataset.state = 'on';
        } else {
            sw.classList.remove('on');
            sw.dataset.state = 'off';
        }

        this.onSwitchChange(sw, newState);
    }

    /**
     * Handle switch state change
     */
    onSwitchChange(sw, state) {
        const target = sw.dataset.target;
        const param = sw.dataset.param;
        const index = parseInt(sw.dataset.index);

        switch (target) {
            case 'operator':
                if (param === 'phase-invert') {
                    this.synth.setOperatorPhaseInvert(index, state);
                }
                break;
            case 'lfo':
                if (param === 'enable') {
                    if (state) {
                        this.synth.startLFO(index);
                    } else {
                        this.synth.stopLFO(index);
                    }
                }
                break;
            case 'matrix':
                const row = parseInt(sw.dataset.row);
                const col = parseInt(sw.dataset.col);
                this.synth.setModulation(row, col, state ? 50 : 0);
                break;
        }
    }

    /**
     * Initialize modulation matrix
     */
    initMatrix() {
        const matrixCells = document.querySelectorAll('.matrix-cell');

        matrixCells.forEach(cell => {
            cell.addEventListener('click', () => {
                this.toggleMatrixCell(cell);
            });
        });

        // Master output switches
        const masterSwitches = document.querySelectorAll('.matrix-master-switch');
        masterSwitches.forEach(sw => {
            sw.addEventListener('click', () => {
                const index = parseInt(sw.dataset.index);
                const isOn = sw.classList.toggle('on');
                this.synth.setOperatorMasterOut(index, isOn);
            });
        });
    }

    /**
     * Toggle matrix cell
     */
    toggleMatrixCell(cell) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const currentState = cell.classList.contains('active');

        if (currentState) {
            cell.classList.remove('active');
            this.synth.setModulation(row, col, 0);
        } else {
            cell.classList.add('active');
            this.synth.setModulation(row, col, 50);
        }
    }

    /**
     * Initialize waveform selectors
     */
    initWaveformSelectors() {
        const selectors = document.querySelectorAll('.waveform-select');

        selectors.forEach(selector => {
            selector.addEventListener('change', () => {
                const target = selector.dataset.target;
                const index = parseInt(selector.dataset.index);
                const waveform = selector.value;

                if (target === 'operator') {
                    this.synth.setOperatorWaveform(index, waveform);
                } else if (target === 'lfo') {
                    this.synth.setLFOWaveform(index, waveform);
                }
            });
        });
    }

    /**
     * Initialize ADSR controls
     */
    initADSRControls() {
        // ADSR envelope selectors for operators
        const envelopeSelectors = document.querySelectorAll('.envelope-select');

        envelopeSelectors.forEach(selector => {
            selector.addEventListener('change', () => {
                const opIndex = parseInt(selector.dataset.index);
                const envIndex = parseInt(selector.value);

                this.synth.assignEnvelopeToOperator(opIndex, envIndex);
            });
        });
    }

    /**
     * Initialize LFO controls
     */
    initLFOControls() {
        // LFO target selectors
        const targetSelectors = document.querySelectorAll('.lfo-target-select');

        targetSelectors.forEach(selector => {
            selector.addEventListener('change', () => {
                const lfoIndex = parseInt(selector.dataset.index);
                const target = selector.value;

                this.synth.setLFOTarget(lfoIndex, target);
            });
        });
    }

    /**
     * Initialize virtual keyboard
     */
    initVirtualKeyboard() {
        const keys = document.querySelectorAll('.piano-key');

        keys.forEach(key => {
            // Mouse events
            key.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.noteOn(key);
            });

            key.addEventListener('mouseup', () => {
                this.noteOff(key);
            });

            key.addEventListener('mouseleave', () => {
                if (key.classList.contains('active')) {
                    this.noteOff(key);
                }
            });

            // Touch events
            key.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.noteOn(key);
            });

            key.addEventListener('touchend', () => {
                this.noteOff(key);
            });
        });
    }

    /**
     * Note on for virtual keyboard
     */
    noteOn(key) {
        if (key.classList.contains('active')) return;

        const note = key.dataset.note;
        const midi = parseInt(key.dataset.midi);

        key.classList.add('active');
        this.synth.noteOn(midi, note);

        // Visual feedback
        this.activeNotes.set(midi, key);
    }

    /**
     * Note off for virtual keyboard
     */
    noteOff(key) {
        const midi = parseInt(key.dataset.midi);

        key.classList.remove('active');
        this.synth.noteOff(midi);

        this.activeNotes.delete(midi);
    }

    /**
     * Initialize computer keyboard
     */
    initComputerKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.repeat) return;

            const key = e.key.toLowerCase();
            const mapping = this.keyboardMap[key];

            if (mapping) {
                e.preventDefault();
                const virtualKey = document.querySelector(`.piano-key[data-midi="${mapping.midi}"]`);
                if (virtualKey && !virtualKey.classList.contains('active')) {
                    this.noteOn(virtualKey);
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            const mapping = this.keyboardMap[key];

            if (mapping) {
                const virtualKey = document.querySelector(`.piano-key[data-midi="${mapping.midi}"]`);
                if (virtualKey) {
                    this.noteOff(virtualKey);
                }
            }
        });
    }

    /**
     * Create keyboard mapping for computer keyboard
     */
    createKeyboardMap() {
        return {
            // Bottom row (Z, S, X, D, C, V, G, B, H, N, J, M)
            'z': { midi: 48, note: 'C3' },
            's': { midi: 49, note: 'C#3' },
            'x': { midi: 50, note: 'D3' },
            'd': { midi: 51, note: 'D#3' },
            'c': { midi: 52, note: 'E3' },
            'v': { midi: 53, note: 'F3' },
            'g': { midi: 54, note: 'F#3' },
            'b': { midi: 55, note: 'G3' },
            'h': { midi: 56, note: 'G#3' },
            'n': { midi: 57, note: 'A3' },
            'j': { midi: 58, note: 'A#3' },
            'm': { midi: 59, note: 'B3' },

            // Top row (Q, 2, W, 3, E, R, 5, T, 6, Y, 7, U)
            'q': { midi: 60, note: 'C4' },
            '2': { midi: 61, note: 'C#4' },
            'w': { midi: 62, note: 'D4' },
            '3': { midi: 63, note: 'D#4' },
            'e': { midi: 64, note: 'E4' },
            'r': { midi: 65, note: 'F4' },
            '5': { midi: 66, note: 'F#4' },
            't': { midi: 67, note: 'G4' },
            '6': { midi: 68, note: 'G#4' },
            'y': { midi: 69, note: 'A4' },
            '7': { midi: 70, note: 'A#4' },
            'u': { midi: 71, note: 'B4' },
            'i': { midi: 72, note: 'C5' }
        };
    }

    /**
     * Initialize master controls
     */
    initMasterControls() {
        // Master volume
        const masterVolume = document.querySelector('.master-volume-knob');
        if (masterVolume) {
            masterVolume.dataset.value = 0.7;
            masterVolume.dataset.default = 0.7;
        }

        // Master tuning
        const masterTuning = document.querySelector('.master-tuning-knob');
        if (masterTuning) {
            masterTuning.addEventListener('input', (e) => {
                const cents = (parseFloat(e.target.value) - 0.5) * 200; // +/- 100 cents
                this.synth.setMasterTuning(cents);
            });
        }

        // Panic button (all notes off)
        const panicButton = document.querySelector('.panic-button');
        if (panicButton) {
            panicButton.addEventListener('click', () => {
                this.synth.allNotesOff();

                // Clear all active virtual keys
                this.activeNotes.forEach(key => {
                    key.classList.remove('active');
                });
                this.activeNotes.clear();
            });
        }
    }

    /**
     * Clamp value between min and max
     */
    clampValue(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Update all UI elements from synth state
     */
    updateUI() {
        // Update operators
        for (let i = 0; i < 4; i++) {
            const op = this.synth.operators[i];
            if (!op) continue;

            // Update waveform
            const waveSelect = document.querySelector(`.waveform-select[data-index="${i}"][data-target="operator"]`);
            if (waveSelect) waveSelect.value = op.waveform;

            // Update frequency knob
            const freqKnob = document.querySelector(`.knob[data-index="${i}"][data-param="frequency"]`);
            if (freqKnob) this.setKnobValue(freqKnob, op.frequency / 16000);

            // Update level knob
            const levelKnob = document.querySelector(`.knob[data-index="${i}"][data-param="level"]`);
            if (levelKnob) this.setKnobValue(levelKnob, op.level);

            // Update mod index knob
            const modKnob = document.querySelector(`.knob[data-index="${i}"][data-param="mod-index"]`);
            if (modKnob) this.setKnobValue(modKnob, op.modulationIndex / 100);

            // Update phase invert switch
            const phaseSwitch = document.querySelector(`.switch[data-index="${i}"][data-param="phase-invert"]`);
            if (phaseSwitch) {
                phaseSwitch.classList.toggle('on', op.phaseInvert);
            }
        }

        // Update matrix
        const matrix = this.synth.modulationMatrix.getMatrix();
        matrix.forEach((row, i) => {
            row.forEach((depth, j) => {
                const cell = document.querySelector(`.matrix-cell[data-row="${i}"][data-col="${j}"]`);
                if (cell) {
                    cell.classList.toggle('active', depth > 0);
                }
            });
        });
    }
}
