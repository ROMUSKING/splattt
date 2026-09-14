export class Juice {
  trauma = 0;
  hitstop = 0;
  ox = 0;
  oy = 0;
  rot = 0;
  flash = 0;
  private t = 0;
  reduced = false;
  shakeOn = true;

  add(hit: number, stop = 0, flash = 0) {
    const scale = this.reduced || !this.shakeOn ? 0.25 : 1;
    this.trauma = Math.min(1, this.trauma + hit * scale);
    if (!this.reduced) this.hitstop = Math.max(this.hitstop, stop);
    this.flash = Math.max(this.flash, flash * (this.reduced ? 0.3 : 1));
  }

  tick(dt: number) {
    this.t += dt;
    if (this.t > 256) this.t -= 256;
    this.trauma = Math.max(0, this.trauma - dt * 2.4);
    this.hitstop = Math.max(0, this.hitstop - dt);
    this.flash = Math.max(0, this.flash - dt * 4.5);
    const shake = this.trauma * this.trauma;
    const mag = (this.reduced || !this.shakeOn ? 6 : 22) * shake;
    const n1 = Math.sin(this.t * 47.1);
    const n2 = Math.sin(this.t * 31.7 + 1.7);
    this.ox = mag * n1;
    this.oy = mag * n2;
    this.rot = this.reduced ? 0 : shake * 0.045 * Math.sin(this.t * 19);
  }
}
