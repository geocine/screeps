export {};

declare global {
  // Memory extension samples
  interface Memory {
    uuid: number;
    log: any;
  }

  interface RawMemory {
    _parsed: Memory;
  }

  interface CreepMemory {
    role: string;
    room?: string;
    working?: boolean;
    forgetTarget?: string[];
    seekTimeout?: number;
  }

  interface Creep {
    run(): void;
  }

  // Syntax for adding proprties to `global` (ex "global.log")
  namespace NodeJS {
    interface Global {
      log: any;
      Memory?: Memory;
    }
  }
}
