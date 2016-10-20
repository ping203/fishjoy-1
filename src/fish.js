var DEG_TO_RAD = Math.PI/180;
var RAD_TO_DEG = 180/Math.PI;
var idle = 20;
var angleShift = 5;
var isResurrect = false;

var fish = cc.Sprite.extend({
    ctor:function(id, flip, x, y, name, angle){
        this._super();
        //console.log(id+" -- "+fishassets[id]);
        var _data = fishassets[id];
        //console.log(_data.id);

        var _w = _data.w;
        var _h = _data.h;
        var _segment = _data.segment;
        var _totalLifeSegment = _data.lifesegment;

        this.typeId = id;
        this.name = name;
        this.type = _data.id;
        this.angle = angle;
        this.speed = _data.speed;
        this.moving = true;
        this.canTurning = false;
        this.hasShown = false;
        this.captured = false;
        this.active = true;
        this.frame = 1;
        this.totalFrame = _segment;
        this.totalActiveFrame = _totalLifeSegment;
        this.isFlip = flip;
        this.capturingCounter = _segment - _totalLifeSegment;
        this.score = 0;
        this.life = _data.life;
        this.dir = 1;

        this.idle = idle;
        this.timetick = 0;

        //console.log(map[0]+"--"+map[1]);
        this.cache = cc.spriteFrameCache.addSpriteFrames(map[0], map[1]);
        //var content = new cc.Sprite("#00");
        //this.addChild(content);
        this.initWithSpriteFrameName(this.type+"-01"+".png");

        //this.initWithFile(_src, cc.rect(0,0,_w, (_h/_segment)));
        //this.scheduleUpdate();

        var posX = x;
        if(this.isFlip){
            this.dir = -1;
            this.flippedX = true;
            //this.setScaleX(-1);
            posX += this.width/2;
        }else{
            posX -= this.width/2
        }


        var posY = y;

        this.setPosition(cc.p(posX, posY));
        //this.interval = setInterval(randAngle(this),3);

        gameLayer.addBody(posX, posY, this.width, this.height, 0, true, this, this.type, this.life);

        // ANIMATE

        var animFrames = [];
        var hitFrames = [];
        for (var i = 0; i < this.totalFrame; i++) {
            var j = i+1;
            str = this.type+"-"+(j < 10 ? ("0" + j) : j)+".png";
            var spriteFrame = cc.spriteFrameCache.getSpriteFrame(str);
            var animFrame = new cc.AnimationFrame();
            animFrame.initWithSpriteFrame(spriteFrame, 1, null);
            if(i<this.totalActiveFrame){
                animFrames.push(animFrame);
            }else{
                hitFrames.push(animFrame);
            }
        }
        var animation = new cc.Animation(animFrames, 0.15, 200);// cc.Animation.create(animFrames, 0.08, 100);
        this.animate   = new cc.Animate(animation);// cc.Animate.create(animation);

        var hitAnimation = new cc.Animation(hitFrames, 0.15, 1);
        this.hitAnimate = new cc.Animate(hitAnimation);

        this.runAction(this.animate);
        this.scheduleUpdate();
        return;

    },
    update:function(){
        /*
        if(isDriver) {
            this.timetick++;
            if (this.timetick >= this.idle) {
                this.timetick = 0;
                //console.log("OLD ANGLE"+this.angle);
                var min = 0;
                var max = 1;
                //var randomAngle = min + (Math.random(max-min)*max);
                var randAngle = Math.round(Math.random());
                var randDir = Math.round(Math.random());
                var randomAngle = 0;
                var randomDir = 1;

                if (randAngle == 0) {
                    randomAngle = 10;
                }

                if (randDir == 0) {
                    randomDir = -1;
                }

                this.angle += randomDir * randomAngle;

                var datasend = {};
                //datasend.roomid = roomname;
                datasend.name = this.name;
                datasend.angle = this.angle;

                //spreadToOther("change_angle", datasend);
                //console.log("add angle: "+datasend+" -- dir: "+this.angle);
            }
        }
        */
        if(isConnect){
            if(isResurrect){
                isResurrect = false;
                this.runAction(this.animate);
            }
            var speedX = this.speed * Math.cos(this.angle * DEG_TO_RAD);
            var speedY = this.speed * Math.sin(this.angle * DEG_TO_RAD);

            var posX = this.getPosition().x + this.dir * speedX;
            var posY = this.getPosition().y - this.dir * speedY;

            var rotateAnimation = new cc.rotateTo(0.1, this.angle);
            //this.runAction(rotateAnimation);

            this.setRotation(this.angle);

            //if(checkBorder(posX, posY, this.width, this.isFlip)){
            if (this.checkBorder(posX, posY)) {
                this.setPosition(posX, posY);
                var moveAnimation = new cc.moveTo(0.1, posX, posY);
                //this.runAction(moveAnimation);
            } else {
                this.destroy();
            }
        }else{
            isResurrect = true;
            this.stopAction(this.animate);
        }

    },
    checkBorder: function (x,y) {
        if(this.isFlip){
            if(x > -this._getWidth() && y > 0 && y < screen_height){
                return true;
            }
        }else{
            if(x < screen_width + this._getWidth()  && y > 0 && y < screen_height){
                return true;
            }
        }

        return false;
    },
    hit: function (lifeReduce) {
        this.life -= lifeReduce;
        if(this.life <= 0){
            removeShapeBody(this, "fish");
            this.startHitStatus();
            return true;
        }
        return false;
    },
    startHitStatus:function(){
        this.unscheduleUpdate();

        var _src = asset_folder+getSource("web4");
        var _websprite = new cc.Sprite(_src);
        this.addChild(_websprite);
        _websprite.setPosition(cc.p(this.width/2, this.height/2));

        this.stopAction(this.animate);
        //this.runAction(this.hitAnimate);
        this.runAction(cc.sequence( this.hitAnimate, cc.callFunc(this.destroy, this)));


    },
    destroy: function () {
        this.unscheduleUpdate();
        removeShapeBody(this, "fish");
        removeFromFishList(this);
        fishLayer.removeChild(this);
        if(isDriver){
            //initFishes(1);
        }
    },
    moveIt:function(posX, posY){
        var moveAnimation = new cc.moveTo(0.1, posX, posY);
        //this.runAction(moveAnimation);
    },
    getType:function(){
        return this.type;
    },
    rotateIt:function(angle){
        this.angle = angle;
        this.setRotation(this.angle);
    },
    getName:function(){
        return this.name;
    },
    getPositionX:function(){
        return this.getPosition().x;
    },
    getPositionY:function(){
        return this.getPosition().y;
    },
    checkPointCollide: function (position) {
        //return this.containsPoint(this.getBoundingBox(),position);
        //console.log("Hit on Fish? "+cc.rectContainsPoint(this.getBoundingBox(),position));
        return cc.rectContainsPoint(this.getBoundingBox(),position);
    }
});
