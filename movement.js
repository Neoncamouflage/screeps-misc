/*
* Basic movement snippet to allow ignoring creeps with moveTo(). Intended as a quick measure to improve traffic
* until a custom traffic manager is implemented. Works by creating a global movement tracker and swapping
* creep positions when needed.
*/

// -- Add this to the standard creep garbage collection from tutorial code or your own implementation
//To remove a creep from the move tracker after it dies
delete global.moveTracker[creep.name];

// -- Add this outside of the main loop
//Patch the moveTo() method on the Creep prototype
if (!Creep.prototype._moveTo) {
    //This method uses a global tracker. Initialize it if needed
    if(!global.moveTracker) global.moveTracker = {};
    //Store the old method
    Creep.prototype._moveTo = Creep.prototype.moveTo;
    //Create our modified method
    Creep.prototype.moveTo = function(firstArg, secondArg, opts) {
        //Stuck limit is how long before we try to fix being stuck
        const stuckLimit = 2;
        //Swap delay is how long we give a stuck creep ahead of us to fix their issue before swapping
        //Higher values make chains of swaps less likely, but increase potential traffic delays 
        const swapDelay = 4;

        //Get move data if available.
        let moveData = global.moveTracker[this.name];
        //If creep is currently swapping, change it to false and return ERR_NO_PATH
        if(moveData && moveData.swap){
            moveData.swap = false;
            return ERR_NO_PATH;
        }
        //Call original moveTo() - Return early if unsuccessful
        let returnValue = this._moveTo(firstArg, secondArg, opts);
        if(returnValue !== OK) return returnValue;   
        //Execute our custom move logic if successful
        //Check if we're already at the target position. If so, remove tracking and return early
        if(this.pos.isEqualTo(this.memory._move.dest.x,this.memory._move.dest.y)){
            delete global.moveTracker[this.name];
            return returnValue;
        }   
        //If we're not already in the tracker, or if we successfully moved since last time,update and return
        if(!moveData || !this.pos.isEqualTo(moveData.x,moveData.y)){
            global.moveTracker[this.name] = {tick:Game.time,x:this.pos.x,y:this.pos.y};
            return returnValue;
        }
        //If the move attempt is beyond our limit for being stuck, swap
        if(Game.time-moveData.tick > stuckLimit){
            let targetX = parseInt(this.memory._move.path.substring(0, 2));
            let targetY = parseInt(this.memory._move.path.substring(2, 4));
            let blockingCreep = this.room.lookForAt(LOOK_CREEPS,targetX,targetY)[0];
            //If we have a blocking creep, check if it is also stuck. If it is, return. If it isn't stuck, have it swap with us.
            if(blockingCreep){
                if(global.moveTracker[blockingCreep.name] && Game.time-global.moveTracker[blockingCreep.name].tick > stuckLimit && Game.time-global.moveTracker[blockingCreep.name].tick <= swapDelay){
                    return returnValue;
                }
                else{
                    //Order creep to swap and register the swap in the tracker so we don't override it on the other creep.
                    global.moveTracker[blockingCreep.name] = {tick:Game.time,x:blockingCreep.pos.x,y:blockingCreep.pos.y,swap:true};
                    blockingCreep.move(blockingCreep.pos.getDirectionTo(this.pos));
                };
            };
        };
        return returnValue;
    };
};
