/* Content data. Edit here to change parts, schedules, faults or jobs. */
export const SYS={
  structure:{name:"Engine structure",color:"#5b6f86"},
  fuel:{name:"Fuel",color:"#d9a21b"},
  raw:{name:"Raw water",color:"#2f8fd0"},
  coolant:{name:"Coolant",color:"#3aa37a"},
  oil:{name:"Lubrication",color:"#a8742d"},
  air:{name:"Air and exhaust",color:"#8b8f96"},
  elec:{name:"Electrical",color:"#cf4a3c"},
  drive:{name:"Saildrive",color:"#b58a3c"}
};
export const PARTS={
  block:{n:"Cylinder block",s:"structure",d:"Carries the crankshaft, pistons and camshaft. Coolant and oil passages run through it."},
  sump:{n:"Oil sump",s:"oil",d:"Reservoir for the engine oil. Oil is drawn out through the dipstick tube or a drain when changing."},
  head:{n:"Cylinder head",s:"structure",d:"Holds the valves, injectors and glow plugs. Glow plugs preheat the combustion chambers for a cold start."},
  rocker:{n:"Valve cover",s:"structure",d:"Covers the rocker gear. Removed to check valve clearances."},
  oilfill:{n:"Oil filler, engine",s:"oil",m:"14",d:"Where new engine oil goes in. Check the level on the dipstick, never by filling to the cap."},
  flywheel:{n:"Flywheel housing",s:"structure",d:"Encloses the flywheel and the flexible coupling to the saildrive."},
  crankpulley:{n:"Crankshaft pulley",s:"structure",d:"Drives the belt for the alternator and coolant pump."},
  circpump:{n:"Coolant circulation pump",s:"coolant",d:"Belt-driven pump that moves coolant round the block, head and heat exchanger."},
  alternator:{n:"Alternator",s:"elec",m:"6",d:"Charges the batteries when the engine runs. Belt-driven from the crankshaft."},
  belt:{n:"Drive belt",s:"elec",d:"Drives the alternator and coolant pump. A slipping belt causes both low charge and overheating."},
  heatex:{n:"Heat exchanger and coolant filling",s:"coolant",m:"1, 3",d:"Raw water passes through tubes and cools the engine coolant. The pressure cap on top is where coolant level is checked, only with the engine cold."},
  thermostat:{n:"Thermostat",s:"coolant",d:"Holds coolant in the engine until it reaches working temperature, then opens to the heat exchanger."},
  turbo:{n:"Turbocharger",s:"air",m:"5",d:"Exhaust-driven compressor that pushes more air into the cylinders."},
  exhaust:{n:"Exhaust elbow and hose",s:"air",d:"Raw water is injected here to cool the exhaust before it enters the rubber hose."},
  aircooler:{n:"Charge air cooler",s:"air",m:"4",d:"Cools the air after the turbocharger compresses it, so more air fits in each cylinder. A black pipe carries the air from the turbo outlet to the cooler on the front of the engine. In the manual illustration this is item 4. Its exact routing on the model is approximate."},
  airfilter:{n:"Air filter and air intake",s:"air",m:"12",d:"Cleans intake air. A blocked filter starves the engine and makes black smoke."},
  injpump:{n:"Injection pump and stop control",s:"fuel",m:"20",d:"Meters high-pressure fuel to each injector. The throttle lever and stop solenoid act on it."},
  injectors:{n:"Injectors",s:"fuel",d:"Spray fuel into each cylinder. Service is workshop work."},
  fuelfilter:{n:"Fuel filters and hand primer",s:"fuel",m:"19",d:"The pre-filter traps water and dirt, the fine filter protects the injection pump. The hand pump is used to bleed air after a filter change."},
  fuelpump:{n:"Fuel pump",s:"fuel",m:"17",d:"Lifts fuel from the tank to the filters and injection pump."},
  oilfilter:{n:"Oil filter",s:"oil",m:"18",d:"Spin-on filter. Replaced at every oil change."},
  dipstick:{n:"Oil dipstick, engine",s:"oil",m:"13",d:"Level must sit between the two marks. Too high is as harmful as too low."},
  rawpump:{n:"Raw water pump",s:"raw",m:"21",d:"Rubber impeller pump that pulls sea water through the drive leg. The impeller is the most common cause of overheating."},
  starter:{n:"Starter motor",s:"elec",m:"7",d:"Cranks the engine. Has a time limit on continuous cranking, so let it cool between attempts."},
  relaybox:{n:"Relay box",s:"elec",m:"2",d:"Relays for start, stop and preheat, plus the engine fuses."},
  battery:{n:"Start battery",s:"elec",d:"Supplies the starter and preheat. Low voltage is the first thing to check on a no-start."},
  mounts:{n:"Engine mounts",s:"structure",d:"Rubber mounts that isolate vibration. A failed mount shows as new vibration."},
  driveupper:{n:"Saildrive upper gear",s:"drive",d:"Reverse gear and oil reservoir of the drive. Has its own dipstick and oil filter."},
  sdip:{n:"Oil dipstick, S-drive",s:"drive",m:"11",d:"Checks the oil level in the saildrive. Read it with the engine stopped and the boat level, and top up through the same opening if low. Follow the operator's manual for the interval and the oil grade."},
  sdrain:{n:"Oil drain, S-drive",s:"drive",m:"16",d:"Drain port in the underside of the drive leg, used to empty the drive oil when changing it. Catch the oil, and follow the service manual for the plug and seal."},
  seal:{n:"Hull seal (rubber diaphragm)",s:"drive",d:"Seals the hole in the hull around the drive. It has a fixed replacement age regardless of hours."},
  seacock:{n:"Sea cock, S-drive, and raw water strainer",s:"raw",m:"8",d:"Shut-off valve on the drive for the cooling water supply, with the strainer after it."},
  leg:{n:"Drive leg and cooling water inlet, S-drive",s:"drive",m:"9",d:"Carries the vertical shaft. Cooling water enters through slots in the leg."},
  lower:{n:"Lower gear housing",s:"drive",d:"The rounded foot of the leg turns the drive through 90 degrees to the propeller shaft, which runs aft inside a plain cylindrical housing. The oil drain port is in the underside."},
  anode:{n:"Sacrificial anodes",s:"drive",m:"15",d:"A split zinc collar clamped on the shaft housing where it leaves the leg. It corrodes in place of the drive. Clean with emery paper, never a wire brush, and replace when about half gone."},
  prop:{n:"Folding propeller",s:"drive",m:"10",d:"Three-blade folding propeller. The blades open under power and fold back against the hub when the engine is stopped, cutting drag when sailing. Run the engine to see them open. Check the hinge pins for wear and play, and the blades for fouling and free movement."}
};
/* Service schedule: intervals as listed in the D2-60F service protocol in the project files. */
export const SERVICES=[
 {c:"S",h:50,m:0,int:"Once, at 50 hours",t:[["Replace drive oil and filter","driveupper"]]},
 {c:"A",h:200,m:12,int:"Every 12 months or 200 hours",t:[["Check coolant level and antifreeze mix","heatex"],["Inspect drive belts","belt"],["Drain water from fuel pre-filter","fuelfilter"],["Clean raw water strainer","seacock"],["Inspect raw water impeller","rawpump"],["Replace drive oil and filter","driveupper"],["Inspect anodes","anode"],["Lubricate propeller shaft","prop"],["Inspect exhaust hose","exhaust"],["Inspect raw water intake","leg"]]},
 {c:"B",h:400,m:12,int:"Every 12 months or 400 hours",t:[["Replace engine oil and oil filter","oilfilter"],["Replace fuel pre-filter insert","fuelfilter"],["Replace fuel fine filter","fuelfilter"],["Inspect vacuum valve","rawpump"],["Check idle speed","injpump"],["Inspect hull seal","seal"],["Inspect folding propeller","prop"]]},
 {c:"C",h:400,m:24,int:"Every 24 months or 400 hours",t:[["Replace air filter","airfilter"],["Replace raw water impeller","rawpump"]]},
 {c:"D",h:600,m:48,int:"Every 48 months or 600 hours",t:[["Check valve clearance","rocker"],["Replace exhaust hose","exhaust"],["Replace drive belts","belt"]]},
 {c:"E",h:2000,m:48,int:"Every 48 months or 2000 hours",t:[["Replace coolant","heatex"]]},
 {c:"F",h:0,m:84,int:"Every 84 months",t:[["Replace hull seal","seal"]]}
];
export const CAUSES={
 1:["Flat battery","battery"],2:["Poor contact or broken cable","starter"],3:["Stop control left pulled out","injpump"],
 4:["Not enough preheat","head"],5:["No fuel reaching the engine","fuelpump"],6:["Blocked air filter","airfilter"],
 7:["Air in the fuel system","fuelfilter"],8:["Water or dirt in the fuel","fuelfilter"],9:["Boat unusually heavily loaded",null],
 10:["Fouling on hull, drive or propeller","prop"],11:["Throttle lever travel restricted","injpump"],12:["Not enough air reaching the engine","airfilter"],
 13:["Coolant temperature too high","heatex"],14:["Coolant temperature too low","thermostat"],15:["Oil level too low","dipstick"],
 16:["Blocked oil filter","oilfilter"],17:["Damaged or wrong propeller","prop"],18:["Failed engine mount","mounts"],
 19:["Coolant level too low","heatex"],20:["Blocked raw water inlet, hose or strainer","seacock"],21:["Coolant pump belt slipping","belt"],
 22:["Worn or broken impeller","rawpump"],23:["Faulty or wrong thermostat","thermostat"],24:["Oil level too high","dipstick"],
 25:["Alternator belt slipping","belt"],26:["Starter cranking time limit reached","starter"],27:["Stop solenoid stuck","injpump"]
};
export const SYMPTOMS=[
 ["Starter will not turn, or turns slowly",[1,2,26]],["Engine does not start",[3,4,5,6,7,8,27]],
 ["Engine starts, then stops",[5,6,7,8]],["Engine is hard to start",[5,6,7,8]],
 ["Will not reach full revs",[6,7,8,9,10,11,12,17]],["Engine knocks",[13]],
 ["Engine runs roughly",[5,6,7,8,12,13]],["Engine vibrates",[17,18]],
 ["High fuel consumption",[9,10,12,14,17]],["Black exhaust smoke",[4,12,14,17]],
 ["Blue or white exhaust smoke",[14,24]],["Oil pressure too low",[15,16]],
 ["Coolant temperature too high",[19,20,21,22,23]],["No charge, or poor charge",[1,25]]
];
