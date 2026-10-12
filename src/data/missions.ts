import { MissionConfig } from '../types';

export const CAMPAIGN_MISSIONS: MissionConfig[] = [
  // =========================================================================
  // MISSION 01 (ODD): FIRST CONTACT & BACKUP GENERATOR
  // =========================================================================
  {
    id: 1,
    title: 'MISSION 01: FIRST CONTACT',
    subTitle: 'Quarantine District Entryway',
    district: 'SECTOR-04 URBAN RUINS',
    difficultyRecommended: 'EASY',
    briefing: 'Infiltration team wiped out. Start the emergency backup street generator to reboot gate locks, eliminate converging infected hordes, and secure the emergency safehouse.',
    baseRewardCredits: 400,
    objectives: [
      {
        id: 'm1_obj1',
        title: 'START EMERGENCY BACKUP GENERATOR',
        description: 'Locate the yellow street generator console and press Interact [E].',
        type: 'interact_object',
        targetPosition: [0, 0, 16],
        targetRadius: 4.8,
      },
      {
        id: 'm1_obj2',
        title: 'ELIMINATE CONVERGING HORDE',
        description: 'Generator noise alerted the street walkers! Neutralize 12 hostiles.',
        type: 'kill_count',
        targetCount: 12,
        currentCount: 0,
      },
      {
        id: 'm1_obj3',
        title: 'REACH THE SAFEHOUSE',
        description: 'Follow the green beacon to the reinforced blast doors.',
        type: 'reach_zone',
        targetPosition: [0, 0, 48],
        targetRadius: 4.5,
      },
    ],
    waves: [
      {
        waveNumber: 1,
        enemies: [
          { type: 'walker', count: 8 },
          { type: 'runner', count: 4 },
        ],
        spawnDelay: 1.5,
      },
      {
        waveNumber: 2,
        enemies: [
          { type: 'walker', count: 6 },
          { type: 'runner', count: 5 },
          { type: 'crawler', count: 2 },
        ],
        spawnDelay: 2.0,
      },
    ],
  },

  // =========================================================================
  // MISSION 02 (EVEN): NO SIGNAL
  // =========================================================================
  {
    id: 2,
    title: 'MISSION 02: NO SIGNAL',
    subTitle: 'Auxiliary Substation',
    district: 'SECTOR-07 GRID ALLEY',
    difficultyRecommended: 'NORMAL',
    briefing: 'The district emergency broadcast relay went offline. Find the emergency backup diesel generator, restore grid power, and hold off the alerted swarm.',
    baseRewardCredits: 600,
    objectives: [
      {
        id: 'm2_obj1',
        title: 'FIND & RESTORE GENERATOR POWER',
        description: 'Approach the yellow substation generator and press Interact [E].',
        type: 'interact_object',
        targetPosition: [12.0, 0, 8.0],
        targetRadius: 5.5,
      },
      {
        id: 'm2_obj2',
        title: 'SURVIVE THE HORDE ASSAULT',
        description: 'Grid sirens alerted the sector! Hold your ground for 40 seconds.',
        type: 'survive_time',
        timerSeconds: 40,
      },
      {
        id: 'm2_obj3',
        title: 'EXTRACT TO SAFEHOUSE',
        description: 'Retreat to the extraction blast door before overwhelming numbers arrive.',
        type: 'reach_zone',
        targetPosition: [-14.0, 0, 36.0],
        targetRadius: 4.8,
      },
    ],
    waves: [
      {
        waveNumber: 1,
        enemies: [
          { type: 'walker', count: 6 },
          { type: 'runner', count: 4 },
        ],
        spawnDelay: 2.0,
      },
      {
        waveNumber: 2,
        enemies: [
          { type: 'walker', count: 6 },
          { type: 'runner', count: 6 },
          { type: 'spitter', count: 2 },
        ],
        spawnDelay: 1.2,
      },
    ],
  },

  // =========================================================================
  // MISSION 03 (ODD): INFESTATION & FUEL REFILL
  // =========================================================================
  {
    id: 3,
    title: 'MISSION 03: INFESTATION',
    subTitle: 'Commercial Freight Depot',
    district: 'LOGISTICS WAREHOUSE DEPOT',
    difficultyRecommended: 'NORMAL',
    briefing: 'A mutated strain of infected has turned the depot into a hive. Refill industrial oil in the depot pumps, restart the ventilation generator, and eliminate the swarm.',
    baseRewardCredits: 850,
    objectives: [
      {
        id: 'm3_obj1',
        title: 'REFILL OIL AT DEPOT FUEL PUMP',
        description: 'Reach the fuel drum reserve at [-18, 0, 8] and press Interact [E].',
        type: 'interact_object',
        targetPosition: [-18.0, 0, 8.0],
        targetRadius: 5.0,
      },
      {
        id: 'm3_obj2',
        title: 'START VENTILATION GENERATOR',
        description: 'Activate the main intake fan generator to purge toxic air.',
        type: 'interact_object',
        targetPosition: [14.0, 0, 12.0],
        targetRadius: 5.0,
      },
      {
        id: 'm3_obj3',
        title: 'PURGE MASSIVE INFESTED HORDE',
        description: 'Eliminate 20 bio-hazards including feral runners, toxic spitters, and brutes.',
        type: 'kill_count',
        targetCount: 20,
        currentCount: 0,
      },
      {
        id: 'm3_obj4',
        title: 'BOARD EVACUATION TRANSPORT',
        description: 'Enter the green extraction beacon zone to evacuate the freight depot.',
        type: 'reach_zone',
        targetPosition: [22.0, 0, 31.0],
        targetRadius: 5.0,
      },
    ],
    waves: [
      {
        waveNumber: 1,
        enemies: [
          { type: 'walker', count: 8 },
          { type: 'runner', count: 6 },
          { type: 'spitter', count: 2 },
        ],
        spawnDelay: 1.5,
      },
      {
        waveNumber: 2,
        enemies: [
          { type: 'runner', count: 7 },
          { type: 'spitter', count: 3 },
          { type: 'crawler', count: 4 },
          { type: 'brute', count: 2 },
        ],
        spawnDelay: 1.8,
      },
    ],
  },

  // =========================================================================
  // MISSION 04 (EVEN): LAST STAND
  // =========================================================================
  {
    id: 4,
    title: 'MISSION 04: LAST STAND',
    subTitle: 'Barricade 9 Perimeter',
    district: 'EVACUATION CHECKPOINT BRAVO',
    difficultyRecommended: 'HARD',
    briefing: 'Heavy infected swarms are converging on the main containment wall. Fortify the checkpoint and survive 3 consecutive lethal waves.',
    baseRewardCredits: 1200,
    objectives: [
      {
        id: 'm4_obj1',
        title: 'DEFEND THE BARRICADE (WAVE 1)',
        description: 'Repel the initial wave of high-speed runners.',
        type: 'kill_count',
        targetCount: 10,
        currentCount: 0,
      },
      {
        id: 'm4_obj2',
        title: 'DEFEND THE BARRICADE (WAVE 2)',
        description: 'Eliminate heavy armored brutes and toxic spitters.',
        type: 'kill_count',
        targetCount: 12,
        currentCount: 0,
      },
      {
        id: 'm4_obj3',
        title: 'ELIMINATE HORDE REMNANTS',
        description: 'Survive the final surge of the outbreak horde.',
        type: 'kill_count',
        targetCount: 14,
        currentCount: 0,
      },
    ],
    waves: [
      {
        waveNumber: 1,
        enemies: [
          { type: 'walker', count: 6 },
          { type: 'runner', count: 6 },
        ],
        spawnDelay: 1.0,
      },
      {
        waveNumber: 2,
        enemies: [
          { type: 'brute', count: 2 },
          { type: 'spitter', count: 3 },
          { type: 'crawler', count: 4 },
          { type: 'walker', count: 4 },
        ],
        spawnDelay: 1.2,
      },
      {
        waveNumber: 3,
        enemies: [
          { type: 'brute', count: 3 },
          { type: 'runner', count: 8 },
          { type: 'spitter', count: 4 },
          { type: 'crawler', count: 3 },
        ],
        spawnDelay: 1.5,
      },
    ],
  },

  // =========================================================================
  // MISSION 05 (ODD): THE COLOSSUS & HELICOPTER PREP
  // =========================================================================
  {
    id: 5,
    title: 'MISSION 05: THE COLOSSUS',
    subTitle: 'Ground Zero Containment Center',
    district: 'SECTOR-01 CENTRAL PLAZA',
    difficultyRecommended: 'NIGHTMARE',
    briefing: 'A 10-foot armored monstrosity code-named THE COLOSSUS has emerged. Refill helicopter oil drums, pre-start the helicopter turbine, and destroy the Colossus to escape.',
    baseRewardCredits: 2200,
    objectives: [
      {
        id: 'm5_obj1',
        title: 'REFILL OIL DRUMS FOR HELICOPTER',
        description: 'Interact with the fuel depot drums at [-10, 0, 18].',
        type: 'interact_object',
        targetPosition: [-10.0, 0, 18.0],
        targetRadius: 5.0,
      },
      {
        id: 'm5_obj2',
        title: 'START HELICOPTER AVIONICS',
        description: 'Boot the helipad pre-flight avionics sequencer at [0, 0, 36].',
        type: 'interact_object',
        targetPosition: [0.0, 0, 36.0],
        targetRadius: 5.2,
      },
      {
        id: 'm5_obj3',
        title: 'ELIMINATE THE MUTATED COLOSSUS',
        description: 'Destroy the mutated Colossus. Aim for its glowing cardiac core and head weak points!',
        type: 'defeat_boss',
        targetCount: 1,
        currentCount: 0,
      },
      {
        id: 'm5_obj4',
        title: 'EXTRACTION CHOPPER PROTOCOL',
        description: 'Board the evacuation helicopter at the central helipad [0, 0, 44] to escape!',
        type: 'reach_zone',
        targetPosition: [0, 0, 44],
        targetRadius: 6.5,
      },
    ],
    waves: [
      {
        waveNumber: 1,
        enemies: [
          { type: 'colossus', count: 1 },
          { type: 'runner', count: 8 },
          { type: 'spitter', count: 3 },
        ],
        spawnDelay: 1.0,
      },
      {
        waveNumber: 2,
        enemies: [
          { type: 'runner', count: 6 },
          { type: 'crawler', count: 4 },
          { type: 'brute', count: 2 },
        ],
        spawnDelay: 8.0,
      },
    ],
  },

  // =========================================================================
  // MISSION 06 (EVEN): OPERATION IRONCLAD
  // =========================================================================
  {
    id: 6,
    title: 'MISSION 06: OPERATION IRONCLAD',
    subTitle: 'Forward Operating Base Alpha',
    district: 'PERIMETER BARRICADE SIEGE',
    difficultyRecommended: 'HARD',
    briefing: 'Forward command was overrun. Armored infected brutes are tearing through sandbag bastions. Deploy automated turrets and repel the brute vanguard.',
    baseRewardCredits: 1600,
    objectives: [
      {
        id: 'm6_obj1',
        title: 'REPEL ARMORED BRUTE SIEGE',
        description: 'Eliminate 16 hostiles spearheading the breach.',
        type: 'kill_count',
        targetCount: 16,
        currentCount: 0,
      },
      {
        id: 'm6_obj2',
        title: 'HOLD FORWARD LZ',
        description: 'Defend the forward barricade position for 35 seconds.',
        type: 'survive_time',
        timerSeconds: 35,
      },
      {
        id: 'm6_obj3',
        title: 'REGROUP AT COMMAND TENT',
        description: 'Fall back to the secure tactical operations center.',
        type: 'reach_zone',
        targetPosition: [0, 0, 38],
        targetRadius: 5.0,
      },
    ],
    waves: [
      {
        waveNumber: 1,
        enemies: [
          { type: 'brute', count: 3 },
          { type: 'runner', count: 7 },
          { type: 'spitter', count: 2 },
        ],
        spawnDelay: 1.2,
      },
      {
        waveNumber: 2,
        enemies: [
          { type: 'brute', count: 4 },
          { type: 'crawler', count: 5 },
          { type: 'runner', count: 8 },
        ],
        spawnDelay: 2.0,
      },
    ],
  },

  // =========================================================================
  // MISSION 07 (ODD): BLACKOUT PROTOCOL (MORE ZOMBIES & MULTIPLE TASKS)
  // =========================================================================
  {
    id: 7,
    title: 'MISSION 07: BLACKOUT PROTOCOL',
    subTitle: 'Substation Deep Grid',
    district: 'SECTOR-09 INDUSTRIAL POWER GRID',
    difficultyRecommended: 'VERY HARD',
    briefing: 'The regional power grid failed. Massive zombie hoards are converging in pitch darkness. Refill the cooling oil tanks, restart the dual diesel generators, and eliminate the overwhelming horde.',
    baseRewardCredits: 2400,
    objectives: [
      {
        id: 'm7_obj1',
        title: 'REFILL OIL IN SUBSTATION TANKS',
        description: 'Reach the fuel manifold at [-12, 0, 10] and refill high-density lubricant.',
        type: 'interact_object',
        targetPosition: [-12.0, 0, 10.0],
        targetRadius: 5.2,
      },
      {
        id: 'm7_obj2',
        title: 'START PRIMARY TURBINE GENERATOR',
        description: 'Reboot the main turbine generator console at [12, 0, 8].',
        type: 'interact_object',
        targetPosition: [12.0, 0, 8.0],
        targetRadius: 5.2,
      },
      {
        id: 'm7_obj3',
        title: 'START AUXILIARY BACKUP GENERATOR',
        description: 'Engage the secondary emergency power unit at [0, 0, 22].',
        type: 'interact_object',
        targetPosition: [0.0, 0, 22.0],
        targetRadius: 5.0,
      },
      {
        id: 'm7_obj4',
        title: 'ELIMINATE THE CONVERGING HORDE',
        description: 'Multiple hoards have breached the perimeter! Neutralize 26 infected.',
        type: 'kill_count',
        targetCount: 26,
        currentCount: 0,
      },
      {
        id: 'm7_obj5',
        title: 'FALL BACK TO SECURE BUNKER',
        description: 'Reach the reinforced subterranean blast hatch.',
        type: 'reach_zone',
        targetPosition: [-14.0, 0, 36.0],
        targetRadius: 4.8,
      },
    ],
    waves: [
      {
        waveNumber: 1,
        enemies: [
          { type: 'runner', count: 10 },
          { type: 'walker', count: 8 },
          { type: 'spitter', count: 4 },
        ],
        spawnDelay: 1.0,
      },
      {
        waveNumber: 2,
        enemies: [
          { type: 'brute', count: 4 },
          { type: 'runner', count: 10 },
          { type: 'crawler', count: 6 },
          { type: 'spitter', count: 3 },
        ],
        spawnDelay: 1.5,
      },
      {
        waveNumber: 3,
        enemies: [
          { type: 'colossus', count: 1 },
          { type: 'runner', count: 8 },
          { type: 'brute', count: 2 },
        ],
        spawnDelay: 2.0,
      },
    ],
  },

  // =========================================================================
  // MISSION 08 (EVEN): THE HORDE BREACH
  // =========================================================================
  {
    id: 8,
    title: 'MISSION 08: THE HORDE BREACH',
    subTitle: 'Rail Freight Yard Terminal',
    district: 'WEST DISTRICT INDUSTRIAL CORRIDOR',
    difficultyRecommended: 'VERY HARD',
    briefing: 'A containment rail line was derailed, unleashing hundreds of infected into the freight yard. Establish tactical choke points and survive against toxic spitters and crawler packs.',
    baseRewardCredits: 2800,
    objectives: [
      {
        id: 'm8_obj1',
        title: 'NEUTRALIZE FREIGHT YARD VANGUARD',
        description: 'Eliminate 18 rapidly advancing runners and spitters.',
        type: 'kill_count',
        targetCount: 18,
        currentCount: 0,
      },
      {
        id: 'm8_obj2',
        title: 'DEFEND FREIGHT DEPOT CHOKEPOINT',
        description: 'Hold the central rail platform for 40 seconds.',
        type: 'survive_time',
        timerSeconds: 40,
      },
      {
        id: 'm8_obj3',
        title: 'EXTRACT VIA ARMORED TRAIN CAR',
        description: 'Sprint to the extraction rail engine platform at [22, 0, 31].',
        type: 'reach_zone',
        targetPosition: [22.0, 0, 31.0],
        targetRadius: 5.0,
      },
    ],
    waves: [
      {
        waveNumber: 1,
        enemies: [
          { type: 'runner', count: 8 },
          { type: 'crawler', count: 6 },
          { type: 'spitter', count: 4 },
        ],
        spawnDelay: 1.0,
      },
      {
        waveNumber: 2,
        enemies: [
          { type: 'brute', count: 3 },
          { type: 'runner', count: 10 },
          { type: 'spitter', count: 4 },
        ],
        spawnDelay: 1.5,
      },
    ],
  },

  // =========================================================================
  // MISSION 09 (ODD): THE FINAL COUNTDOWN (MORE ZOMBIES, REFILL OIL, START GEN, START HELI)
  // =========================================================================
  {
    id: 9,
    title: 'MISSION 09: THE FINAL COUNTDOWN',
    subTitle: 'Central Plaza Pre-Evacuation Staging',
    district: 'GROUND ZERO PERIMETER PLAZA',
    difficultyRecommended: 'NIGHTMARE',
    briefing: 'The final evacuation protocol is beginning. Searing alarm sirens have awakened multiple massive hordes! Refill high-octane oil drums, start the plaza generator, boot up the helicopter pre-flight systems, and defeat the nightmare swarm.',
    baseRewardCredits: 3500,
    objectives: [
      {
        id: 'm9_obj1',
        title: 'REFILL HIGH-OCTANE OIL FOR HELICOPTER',
        description: 'Interact with fuel drums at [-10, 0, 18] to fuel the evacuation choppers.',
        type: 'interact_object',
        targetPosition: [-10.0, 0, 18.0],
        targetRadius: 5.2,
      },
      {
        id: 'm9_obj2',
        title: 'START EMERGENCY BACKUP GENERATOR',
        description: 'Reboot the central power generator at [10, 0, -12].',
        type: 'interact_object',
        targetPosition: [10.0, 0, -12.0],
        targetRadius: 5.2,
      },
      {
        id: 'm9_obj3',
        title: 'START HELICOPTER PRE-FLIGHT IGNITION',
        description: 'Engage the helicopter rotor avionics switch at [0, 0, 36].',
        type: 'interact_object',
        targetPosition: [0.0, 0, 36.0],
        targetRadius: 5.5,
      },
      {
        id: 'm9_obj4',
        title: 'REPEL THE NIGHTMARE SWARM',
        description: 'Multiple dense hordes of 30 zombies are storming the plaza! Slay 30 hostiles.',
        type: 'kill_count',
        targetCount: 30,
        currentCount: 0,
      },
      {
        id: 'm9_obj5',
        title: 'EVACUATE TO AIRFIELD LZ',
        description: 'Reach the helipad rendezvous point at [0, 0, 44].',
        type: 'reach_zone',
        targetPosition: [0.0, 0, 44.0],
        targetRadius: 6.5,
      },
    ],
    waves: [
      {
        waveNumber: 1,
        enemies: [
          { type: 'runner', count: 12 },
          { type: 'walker', count: 10 },
          { type: 'spitter', count: 5 },
        ],
        spawnDelay: 0.8,
      },
      {
        waveNumber: 2,
        enemies: [
          { type: 'brute', count: 4 },
          { type: 'runner', count: 12 },
          { type: 'crawler', count: 8 },
          { type: 'spitter', count: 4 },
        ],
        spawnDelay: 1.2,
      },
      {
        waveNumber: 3,
        enemies: [
          { type: 'colossus', count: 1 },
          { type: 'brute', count: 3 },
          { type: 'runner', count: 10 },
        ],
        spawnDelay: 1.5,
      },
    ],
  },

  // =========================================================================
  // MISSION 10 (CLIMAX): OPERATION OMEGA PROTOCOL
  // Find Engine -> Refill Petrol -> Deploy Time-Bombs -> Fly with Allies within 60s -> Nuclear Explosion Cutscene!
  // =========================================================================
  {
    id: 10,
    title: 'MISSION 10: OPERATION OMEGA PROTOCOL',
    subTitle: 'The Final Extinction Protocol',
    district: 'GROUND ZERO AIRFIELD & EXTRACTION LZ',
    difficultyRecommended: 'NIGHTMARE',
    briefing: 'The last evacuation Blackhawk is damaged on the runway. Secure the replacement engine, refill petrol into the helicopter tanks, and arm the thermobaric time-bombs to sterilize the quarantine zone. Once the bomb is armed, you have exactly 60 SECONDS to board the helicopter with your allies before total detonation blasts the entire city!',
    baseRewardCredits: 5000,
    objectives: [
      {
        id: 'm10_obj1',
        title: 'FIND & SECURE REPLACEMENT HELICOPTER ENGINE',
        description: 'Navigate to the hangar maintenance crane at [16, 0, -18] and retrieve the heavy turboshaft engine.',
        type: 'interact_object',
        targetPosition: [16.0, 0, -18.0],
        targetRadius: 5.0,
      },
      {
        id: 'm10_obj2',
        title: 'REFILL PETROL IN EVACUATION HELICOPTER',
        description: 'Carry fuel canisters to the helipad pump station at [0, 0, 36] and fill the helicopter tank.',
        type: 'interact_object',
        targetPosition: [0.0, 0, 36.0],
        targetRadius: 5.2,
      },
      {
        id: 'm10_obj3',
        title: 'DEPLOY THERMOBARIC TIME-BOMBS',
        description: 'Arm the central quarantine pylon time-bomb at [0, 0, 0]. WARNING: 60-SECOND DETONATION TIMER WILL START!',
        type: 'interact_object',
        targetPosition: [0.0, 0, 0.0],
        targetRadius: 5.5,
      },
      {
        id: 'm10_obj4',
        title: 'FLY WITH ALLIES WITHIN 60 SECONDS!',
        description: 'THE TIME-BOMB IS TICKING DOWN! Fight through the relentless zombie swarms and board the helicopter at [0, 0, 44] before 60 seconds expire!',
        type: 'reach_zone',
        targetPosition: [0.0, 0, 44.0],
        targetRadius: 6.8,
        timerSeconds: 60,
      },
    ],
    waves: [
      {
        waveNumber: 1,
        enemies: [
          { type: 'runner', count: 10 },
          { type: 'walker', count: 8 },
          { type: 'spitter', count: 3 },
        ],
        spawnDelay: 1.0,
      },
      {
        waveNumber: 2,
        enemies: [
          { type: 'brute', count: 4 },
          { type: 'runner', count: 12 },
          { type: 'spitter', count: 4 },
          { type: 'crawler', count: 6 },
        ],
        spawnDelay: 1.5,
      },
      {
        waveNumber: 3,
        enemies: [
          { type: 'colossus', count: 1 },
          { type: 'brute', count: 4 },
          { type: 'runner', count: 14 },
          { type: 'spitter', count: 5 },
        ],
        spawnDelay: 1.5,
      },
    ],
  },

// =========================================================================
// MISSION 11: HUMANITY'S LAST REQUEST — RESCUE & COLLECT
// =========================================================================
// Post-campaign side operation in the apocalyptic city: extract stranded
// survivors before the swarm converges, and secure virus research samples
// for the lab. Every objective anchor is beacon-marked in-world.
{
  id: 11,
  title: 'MISSION 11: HUMANITY\u2019S LAST REQUEST',
  subTitle: 'Apocalyptic City \u2014 Rescue Operation',
  district: 'SECTOR-00 GROUND ZERO',
  difficultyRecommended: 'HARD',
  briefing: 'Civilians are still alive in the quarantine city. Escort four survivors to the evacuation point and recover three virus samples for the lab. Beacons mark every objective \u2014 expect heavy resistance at each site.',
  baseRewardCredits: 4200,
  objectives: [
    {
      id: 'm11_obj1',
      title: 'RESEARCH: COLLECT 3 VIRUS SAMPLES',
      description: 'Follow the amber beacons to glowing research cases. Walk over them to secure the samples.',
      type: 'collect_samples',
      targetCount: 3,
      currentCount: 0,
    },
    {
      id: 'm11_obj2',
      title: 'CIVILIANS: RESCUE 4 SURVIVORS',
      description: 'Cyan beacons mark stranded civilians waving for help. Get close and press [E] to rescue each one.',
      type: 'rescue_survivors',
      targetCount: 4,
      currentCount: 0,
    },
    {
      id: 'm11_obj3',
      title: 'EVACUATE AT THE HELIPORT',
      description: 'All packages secured. Follow the green beacon to the helicopter and finish the operation.',
      type: 'reach_zone',
      targetPosition: [6, 0, 96],
      targetRadius: 5.0,
    },
  ],
  waves: [
    {
      waveNumber: 1,
      enemies: [
        { type: 'runner', count: 6 },
        { type: 'walker', count: 8 },
        { type: 'spitter', count: 2 },
      ],
      spawnDelay: 8.0,
    },
    {
      waveNumber: 2,
      enemies: [
        { type: 'brute', count: 2 },
        { type: 'runner', count: 8 },
        { type: 'screamer', count: 2 },
        { type: 'crawler', count: 4 },
      ],
      spawnDelay: 10.0,
    },
  ],
},
];

