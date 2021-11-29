interface CreepDefinition {
  role: string;
  body: BodyPartConstant[];
  limit: number;
}

const creepTable: CreepDefinition[] = [
  {
    role: "harvester",
    body: [WORK, CARRY, CARRY, MOVE, MOVE],
    limit: 5
  },
  {
    role: "upgrader",
    body: [WORK, CARRY, CARRY, MOVE, MOVE],
    limit: 3
  },
  {
    role: "builder",
    body: [WORK, CARRY, CARRY, MOVE, MOVE],
    limit: 3
  }
];

const loop = () => {
  const spawn = Game.spawns["Spawn1"];

  for (const creepDefinition of creepTable) {
    const creeps = _.filter(Game.creeps, (creep: Creep) => creep.memory.role === creepDefinition.role);
    if (creeps.length < creepDefinition.limit) {
      const newName = `${creepDefinition.role}${Game.time}`;
      const result = spawn.spawnCreep(creepDefinition.body, newName, {
        memory: { role: creepDefinition.role }
      });
      if (result === OK) {
        console.log(`Spawning new ${creepDefinition.role} creep: ${newName}`);
      }
    }
  }
};

export default {
  loop
};
