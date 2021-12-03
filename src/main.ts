import { Creep, Spawn } from "components";
import MemoryHack from "utils/MemoryHack";
import { withErrorMapper } from "utils/WithErrorMapper";

global.creepStates = {};

export const loop = withErrorMapper(() => {
  MemoryHack.pretick();
  // console.log(`Current game tick is ${Game.time}`);

  Spawn.update();

  for (var name in Game.creeps) {
    const creep = Game.creeps[name];
    Creep.update(creep);
  }
});
