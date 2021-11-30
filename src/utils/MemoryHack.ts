const MemoryHack = {
  memory: undefined as Memory | undefined,
  parseTime: -1,
  register() {
    const start = Game.cpu.getUsed();
    this.memory = Memory;
    const end = Game.cpu.getUsed();
    this.parseTime = end - start;
    this.memory = RawMemory._parsed;
  },
  pretick() {
    if (this.memory) {
      delete global.Memory;
      global.Memory = this.memory;
      RawMemory._parsed = this.memory;
    }
  }
};
MemoryHack.register();

export default MemoryHack;
