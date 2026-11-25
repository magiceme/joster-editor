class JosterNoiseGate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{name: 'threshold', defaultValue: -90, minValue: -90, maxValue: -15, automationRate: 'k-rate'}];
  }

  constructor() {
    super();
    this.envelope = 0;
    this.level = 1;
    this.attack = Math.exp(-1 / (sampleRate * .004));
    this.release = Math.exp(-1 / (sampleRate * .09));
  }

  process([input], [output], parameters) {
    if (!input.length || !output.length) return true;
    const db = parameters.threshold[0];
    const threshold = 10 ** (db / 20);
    for (let index = 0; index < output[0].length; index++) {
      let peak = 0;
      for (const channel of input) peak = Math.max(peak, Math.abs(channel[index]));
      this.envelope = Math.max(peak, this.envelope * this.release);
      const target = db <= -89 || this.envelope >= threshold ? 1 : .04;
      const smoothing = target > this.level ? this.attack : this.release;
      this.level = target + smoothing * (this.level - target);
      for (let channel = 0; channel < output.length; channel++) {
        output[channel][index] = input[Math.min(channel, input.length - 1)][index] * this.level;
      }
    }
    return true;
  }
}
registerProcessor('joster-noise-gate', JosterNoiseGate);
