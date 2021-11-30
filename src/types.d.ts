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
    forgetTarget?: Id<Source>[];
    seekTimeout?: number;
  }

  interface Creep {
    run(): void;
    log(message: string, limitName?: string): void;
  }

  interface RoomSource {
    id: Id<Source>;
    walkableLocations: { x: number; y: number }[];
  }

  // Syntax for adding proprties to `global` (ex "global.log")
  namespace NodeJS {
    interface Global {
      log: any;
      Memory?: Memory;
      roomSources: RoomSource[];
    }
  }
}
