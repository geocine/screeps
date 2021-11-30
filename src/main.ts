import { Creep, Spawn } from "components";
import MemoryHack from "utils/MemoryHack";
import { withErrorMapper } from "utils/WithErrorMapper";

export const loop = withErrorMapper(() => {
  MemoryHack.pretick();
  // console.log(`Current game tick is ${Game.time}`);

  Spawn.loop();

  for (var name in Game.creeps) {
    const creep = Game.creeps[name];
    Creep.loop(creep);
  }
});
