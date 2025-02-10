/*
By default this module references an object stored in global that is updated by the rest of the bot.
The object must conform to the format shown in this example.
kingdomStatus: {
    displayAll: true, //Optional value to set whether we want to display all resources even with zero quantities
    cycleTicks: 5,  //Optional value to set how frequently the visual cycles
    wares: {'OH':27000,'utrium_bar':900 ...}, //Amounts for every resource type in storages/containers/terminals/whatever you want counted
    fiefs: {
        E1N1 : {
            roomStatus: 'OK', //Optional value to indicate room status
            fiefCreeps: 80,  //Total creeps associated with the room
            hostileCreeps: true, //If hostile creeps are present in the room
        }
    }
}
*/

// --Constants --

//Base scroll dimensions and colors
const ROLL_OPACITY = 1;
const MIDDLE_OPACITY = 0.5;
const SCROLL_WIDTH = 6.25;
const SCROLL_LENGTH = 0.75;
const SCROLL_FILL_COLOR = '#c99157';
const SCROLL_END_COLOR = '#ffdd8a';
//Max fiefs to display before it has to cycle
//Lower this to take up less space, increasing past 7 causes it to extend past the bottom of the room
const MAXIMUM_FIEFS_DISPLAYED = 5;

//Icons
const RCL_ICONS = {
    0:'0️⃣',
    1:'1️⃣',
    2:'2️⃣',
    3:'3️⃣',
    4:'4️⃣',
    5:'5️⃣',
    6:'6️⃣',
    7:'7️⃣',
    8:'8️⃣'
};
const STORAGE_ICONS = {
    0:'🌑', //No Storage
    1:'🌘', //Less than 1/4 full
    2:'🌗', //Less than half full
    3:'🌖', //Less than 3/4 full
    4:'🌕' //More than 3/4 full
};
const STATUS_ICONS = {
    0:'👍', //Good
    1:'⚔️', //Hostiles in room
    2:'🛡️'  //Safemode
};
//How many ticks before the scroll changes to a new view
const SCROLL_CYCLE_TICKS = 2;
//Which tick we're on out of the current cycle.
let current_cycle_tick = 1;
//Cycle the scrolls based on the cycle constant. Wares scroll will cycle through base minerals and boost tiers, no commodities at this time.
let cycleOptions = ['Basic','T1','T2','T3']
//Ranges for checking resources types with RESOURCES_ALL
let resourceRanges = {
    'Basic':[0,8],
    'T1':[10,22],
    'T2':[23,32],
    'T3':[33,42]
}
//Which ware selection we're currently displaying.
let current_ware = 0;
const statusManager = {

    run: function() {

        //The overall status object. As long as this is properly assigned, all the rest will work as-is.
        let kingdomStatus = global.heap.kingdomStatus;
        //true  - Display all minerals and boosts, even with 0 quantity
        //false - Display only minerals and boosts with a positive quantity, skip displaying resource sets with none of any in stock
        const DISPLAY_ALL = kingdomStatus.displayAll || true;

        //Take a custom cycleTicks value from the status object, or default to the constant
        let cycleTicks = kingdomStatus.cycleTicks || SCROLL_CYCLE_TICKS;
        current_cycle_tick++;
        let rVis = new RoomVisual();


        //Process the current tick
        if(current_cycle_tick > cycleTicks){
            current_cycle_tick = 1;
            current_ware++;
        }

        //Get the current ware selection and update them, moving to the next type if we have none of the current cycle type
        //We bypass this if the DISPLAY_ALL option is set to true, since we don't care if we display zeroes in that case
        let hasWares = Object.keys(kingdomStatus.wares).length
        let wareSet = [];
        if(!DISPLAY_ALL && hasWares){
            let safety = 0
            while(safety < 6){
                safety++
                if(current_ware >= cycleOptions.length){
                    current_ware = 0;
                }
                //Check if any of our wares are of the type we need
                let [startIndex, endIndex] = resourceRanges[cycleOptions[current_ware]];
                let wareKeys = Object.keys(kingdomStatus.wares);
                let resourcesInRange = RESOURCES_ALL.slice(startIndex, endIndex + 1);
                let wareCheck = wareKeys.some(ware => resourcesInRange.includes(ware));
                if(wareCheck){
                    wareSet = Object.entries(kingdomStatus.wares)
                    .filter(([key]) => resourcesInRange.includes(key))
                    .map(([key, value]) => [key, value]);
                    break;
                }
                else{
                    current_cycle_tick = 1;
                    current_ware++;
                }
            }
        }
        else if(DISPLAY_ALL){
            if(current_ware >= cycleOptions.length){
                current_ware = 0;
            }
            let [startIndex, endIndex] = resourceRanges[cycleOptions[current_ware]];
            let resourcesInRange = RESOURCES_ALL.slice(startIndex, endIndex + 1);
            for(let resType of resourcesInRange){
                wareSet.push([resType,kingdomStatus.wares[resType] || 0]);
            }
        }
        //Draw the base decorations
        drawScrolls(Object.keys(wareSet).length);
        drawBanners();

        //Update kingdom wares if applicable
        if(hasWares)updateWares(wareSet);
        //Update fiefs
        if (Object.keys(kingdomStatus.fiefs).length) updateFiefs()

        function formatNum(number) {
            if (number >= 1000000) {
                return (number / 1000000).toFixed(1) + 'M';
            } else if (number >= 10000) {
                return (number / 1000).toFixed(1) + 'K';
            } else{
                return number.toLocaleString();
            }
        }

        function updateFiefs(){
            let fiefText = [];
            for(let fiefName of Object.keys(kingdomStatus.fiefs)){
                //Add a breaker line if not the first fief
                if(fiefText.length)fiefText.push('----------------');
                let fief = kingdomStatus.fiefs[fiefName];
                let room = Game.rooms[fiefName]
                //Start off the text status for this room with the name
                let fiefStatus = fiefName;
                //Get storage icon
                if(room.storage){
                    let storePart = room.storage.store.getUsedCapacity()/10000
                    if(storePart<25){
                        fiefStatus+=STORAGE_ICONS[1];
                    }
                    else if(storePart <50){
                        fiefStatus+=STORAGE_ICONS[2];
                    }
                    else if(storePart <75){
                        fiefStatus+=STORAGE_ICONS[3];
                    }
                    else{
                        fiefStatus+=STORAGE_ICONS[4];
                    }
                }
                else{
                    fiefStatus+=STORAGE_ICONS[0];
                }

                //Get room status from fief object
                if(fief.roomStatus){
                    if(fief.roomStatus == 'SAFEMODE'){
                        fiefStatus += STATUS_ICONS[2]
                    }
                    else if(fief.roomStatus == 'ATTACK'){
                        fiefStatus += STATUS_ICONS[1]
                    }
                    else{
                        fiefStatus += STATUS_ICONS[0]
                    }
                }
                //If not available in fief object, determine room status based on hostiles and safemode
                else{
                    if(room.controller.safeMode){
                        fiefStatus += STATUS_ICONS[2]
                    }
                    else if(fief.hostileCreeps && fief.hostileCreeps.length){
                        fiefStatus += STATUS_ICONS[1]
                    }
                    else{
                        fiefStatus += STATUS_ICONS[0]
                    }
                }

                //RCL and and % if not fully upgraded
                fiefStatus += RCL_ICONS[room.controller.level]
                fiefStatus+=room.controller.level == 8 ? '' : ((room.controller.progress/CONTROLLER_LEVELS[room.controller.level])*100).toFixed(0)+'%';

                fiefText.push(fiefStatus)

            }
            
            let lineCount = 0;
            for(let line of fiefText){
                rVis.text(line, -0.4, statusManager.fiefTextStart+lineCount, {color: 'black', align:'left',font: 'bold 0.75 Bridgnorth'});
                lineCount++;
            }
            

        }

        function updateWares(wares){
            if(Object.keys(wares).length == 0) return
            let wareY = 2
            let textOffset = 0.5
            let iconOffset = 0
            let wareX=0


            //Wider boost icons need text adjustment
            if(cycleOptions[current_ware] == 'T2'){
                textOffset += 0.25;
                iconOffset += 0.25;
            }
            else if(cycleOptions[current_ware] == 'T3'){
                textOffset += 0.5;
                iconOffset += 0.5;
            }
            for(let each of wares){
                rVis.resource(each[0],wareX+iconOffset,wareY-0.25,0.45);
                rVis.text(formatNum(each[1]), wareX+iconOffset+textOffset, wareY, {color: 'black', font: 'bold 0.8 Bridgnorth',align: 'left'});
                if(wareX == 0){
                    if(cycleOptions[current_ware] == 'T3'){
                        wareX = 4;
                    }
                    else{
                        wareX = 3.5;
                    }
                }
                else{
                    wareX = 0;
                    wareY += 1.5;
                }

                
            }
        }

        function drawBanners(){

        }

        function drawScrolls(wareLength){
            
            //Minimum length of 1 if empty, otherwise extend the scroll up to the maximum
            let fiefCount = Math.min(MAXIMUM_FIEFS_DISPLAYED,Object.keys(kingdomStatus.fiefs).length)
            let totalFiefLength = SCROLL_LENGTH + fiefCount + (fiefCount > 1 ? (fiefCount-1) : 0) - 1
            let totalWaresLength = SCROLL_LENGTH + (Math.ceil(wareLength/2)*1.5)
            let fiefStart = totalWaresLength + 3
            let wareWidth = SCROLL_WIDTH
            //T3 boosts need more width
            if(cycleOptions[current_ware] == 'T2'){
                wareWidth += 0.5
            }
            else if(cycleOptions[current_ware] == 'T3'){
                wareWidth += 1
            }



            //Build wares scroll top
            rVis.circle(wareWidth-.4,0.20,{
                radius: .75,
                fill:SCROLL_FILL_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });
            rVis.rect(-0.25, -0.5,wareWidth, 1.5,{
                opacity: ROLL_OPACITY,
                fill:SCROLL_FILL_COLOR
            }); 
            rVis.circle(-0.25,0.22,{
                radius: .73,
                fill:SCROLL_END_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });

            //Middle of wares scroll
            rVis.rect(-0.5, 0.9, wareWidth+0.2, totalWaresLength,{
                opacity: MIDDLE_OPACITY,
                fill:SCROLL_FILL_COLOR
            }); 

            //Bottom of wares scroll
            rVis.circle(wareWidth-.4,totalWaresLength+1,{
                radius: .70,
                fill:SCROLL_FILL_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });
            rVis.rect(-0.25, totalWaresLength+0.25,wareWidth, 1.5,{
                opacity: ROLL_OPACITY,
                fill:SCROLL_FILL_COLOR
            }); 
            rVis.circle(-0.25,totalWaresLength+1,{
                radius: .70,
                fill:SCROLL_END_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });

            //Build fief scroll below wares
            //Top of scroll
            rVis.circle(SCROLL_WIDTH-.4,fiefStart,{
                radius: .75,
                fill:SCROLL_FILL_COLOR,
                opacity: 1,
                stroke: SCROLL_FILL_COLOR
            });
            rVis.rect(-0.25, fiefStart-0.79,SCROLL_WIDTH, 1.59,{
                opacity: 1,
                fill:SCROLL_FILL_COLOR
            }); 
            rVis.circle(-0.25,fiefStart,{
                radius: .75,
                fill:SCROLL_END_COLOR,
                opacity: 1,
                stroke: SCROLL_FILL_COLOR
            });
            
            //Middle of scroll
            rVis.rect(-0.5, fiefStart+0.75, SCROLL_WIDTH+0.2, totalFiefLength+1,{
                opacity: 0.5,
                fill:SCROLL_FILL_COLOR
            }); 
            //Bottom of scroll
            rVis.circle(SCROLL_WIDTH-.4,fiefStart+totalFiefLength+2,{
                radius: .70,
                fill:SCROLL_FILL_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });
            rVis.rect(-0.25, fiefStart+totalFiefLength+1.25,SCROLL_WIDTH, 1.5,{
                opacity: ROLL_OPACITY,
                fill:SCROLL_FILL_COLOR
            }); 
            rVis.circle(-0.25,fiefStart+totalFiefLength+2,{
                radius: .70,
                fill:SCROLL_END_COLOR,
                opacity: ROLL_OPACITY,
                stroke: SCROLL_FILL_COLOR
            });
            //Since the text start varies based on wares length, set the property for our fief statuses to track
            statusManager.fiefTextStart = fiefStart+1.7;

            //Scroll Labels ----------------------//
            rVis.text('📦Wares', SCROLL_WIDTH/2, 0.5, {color: 'black', font: 'bold 1 Bridgnorth'});
            rVis.text('🏰Fiefs '+Object.keys(Memory.kingdom.fiefs).length+'/'+Game.gcl.level, SCROLL_WIDTH/2, fiefStart+0.25, {color: 'black', font: 'bold 1 Bridgnorth'});
        }
    }
}

module.exports = statusManager;
