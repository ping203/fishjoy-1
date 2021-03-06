//var util = require("util");
//var EventEmitter = require("events").EventEmitter;
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser');
var view = '/view/';
var Generator = require('./game/generator');
var Rooms = require('./game/rooms');
var Global = require('./globals');


var rooms = new Rooms();
var checkConnectionTimeout = null;

process.env.PWD = process.cwd();

app.use(express.static(__dirname));
app.use(bodyParser.urlencoded({extended: false}));
app.set('view engine', 'ejs');
app.set('views', __dirname + view);

app.get('/', function (req, res) {
    checkRoomId(req, res);
    //res.render('index');
});

app.post('/game', function (req, res) {
    checkRoomId(req, res);
});

// LISTENING
http.listen(3300, function () {
    console.log('listening on -- Port 3300');
});

// SOCKET CONNECTION
io.on('connection', function (socket) {
    console.log('----- user connects, '+socket.id);

    socket.on('error', function (err) {
        console.error(err.stack);
    });

    socket.on('createroom', function (data) {
        console.log("CREATE ROOM REQUEST");
        var clientdata = data;
        var selectedDisplay = data.display;
        var selectedW = Global.displayList[selectedDisplay].w;
        var selectedH = Global.displayList[selectedDisplay].h;
        var selectedCannon = Global.maxCannonList[data.cannon];
        var selectedMinBuy = Global.minBuyList[data.minBuy];
        var selectedMaxBuy = Global.maxBuyList[data.maxBuy];
        //console.log("-- selected Min: "+selectedMinBuy+" - Max: "+selectedMaxBuy+" -- Cannon: "+selectedCannon);
        var _cannon = getCannonListByNumber(selectedCannon);

        var game = null;
        var socketid = socket.id;
        var playerid = clientdata.playerid;
        var newRoom = rooms.addRoom(clientdata.name, game, selectedW, selectedH, selectedCannon, selectedMinBuy, selectedMaxBuy);
        //rooms.addPlayer(newRoom, socketid, playerid, 0);

        // move to game page

        var _obj = rooms.getRoomById(newRoom);
        console.log("---- " + _obj.roomname + "(" + _obj.id + ") W: " + _obj.w + " H: " + _obj.h + " Min: " + _obj.minBuy + " Max: " + _obj.maxBuy + " Cannon: " + _obj.cannon);

        //io.to(socketid).emit('enter_room', _obj);
        io.emit('new_room_item', _obj);
    });

    socket.on('initiate', function (data) {
        console.log("----- INITIATE");
        var clientdata = data;
        var playerid = clientdata.playerid;
        var socketid = socket.id;
        socket.room = clientdata.id;
        socket.join(clientdata.roomid);
        console.log(socket.id+" come into "+socket.room);

        var selectedRoom = rooms.getRoomById(clientdata.id);
        //console.log("---- SELECTED ROOM "+selectedRoom);
        var _g = rooms.getGame(clientdata.id);// selectedRoom.game;
        //console.log("---- SOCKET INITIATE of "+clientdata.id+" -- "+_g);

        if (_g == null) {
            console.log("--- SET NEW GAME");
            //_g = new Generator(Global.initialFishNo, selectedRoom.w, selectedRoom.h, selectedRoom.cannonList);
            rooms.setGame(clientdata.id, new Generator(Global.initialFishNo, selectedRoom.w, selectedRoom.h, selectedRoom.cannonList, clientdata.id));
            rooms.getGame(clientdata.id).on("angle_change", function (data) {
                //io.in(data.roomid).emit('change_fish_angle', data);
                broadcastMessage('change_fish_angle', data.roomid, data);
            });

            rooms.getGame(clientdata.id).on("new_fish", function (data) {
                //console.log("3. --- FINAL EMIT "+data.roomid);
                //io.in(data.roomid).emit('new_fish', data);
                broadcastMessage('new_fish', data.roomid, data);
            });

            rooms.getGame(clientdata.id).on("remove_fish", function (data) {
                broadcastMessage('remove_fish', data.roomid, data);
            });

            rooms.getGame(clientdata.id).on("remove_bullet", function (data) {
                //broadcastMessage('remove_bullet', data.roomid, data);
            });
            //

        }else{
            //console.log("NOT NULL "+rooms.getGame(clientdata.id).getFishes().length);
        }

       // console.log("--- GAME is Set "+_g+" fishes? "+rooms.getGame(clientdata.id).getFishes().length);

        rooms.addPlayer(selectedRoom.id, socketid, clientdata.playerid, 0, 0, 0, null);
        //roomid, sid, pid, status, score, coin, position

        var thegame = rooms.getGame(clientdata.id);

        var _passdata = new Object();
        _passdata.cannonList = rooms.getCannonList(clientdata.id);// selectedRoom.cannon;
        _passdata.w = selectedRoom.w;
        _passdata.h = selectedRoom.h;
        _passdata.cannon = rooms.getTotalCannon(clientdata.id);
        _passdata.minBuy = selectedRoom.minBuy;
        _passdata.maxBuy = selectedRoom.maxBuy;
        //cannonTypeList = data.cannonList;
        _passdata.sid = socketid;
        _passdata.fishdata = thegame.getFishes();
        _passdata.bullet = thegame.getBullet();
        _passdata.playerList = rooms.getActivePlayers(clientdata.id);
        io.to(socket.id).emit('prepare', _passdata);
        //io.to(socket.id).emit('prepare',_g.getFishes());
    });

    socket.on('getroomlist', function () {
        var _roomlist = rooms.getRoomList();
        var _data = [];
        for(var i=0; i < _roomlist.length; i++){
            var current = _roomlist[i];
            var _obj = {};
            _obj.id = current.id;
            _obj.roomname = current.roomname;
            _obj.w = current.w;
            _obj.h = current.h;
            _obj.cannon = current.cannon;
            _obj.minBuy = current.minBuy;
            _obj.maxBuy = current.maxBuy;

            _data.push(_obj);
        }

        io.to(socket.id).emit('getroomlist', _data);
    });

    socket.on('getcannonpos', function (roomid) {
        io.to(socket.id).emit('getcannonpos', rooms.getCannonList(roomid));
    });

    socket.on('checkin', function (data) {
        //console.log("---- CHECKIN");
        var clientdata = data;

        // CHECK PLAYER COIN IS AVAILABLE
        var isAvailable = checkPlayerCoinAvaialable(clientdata.playerid, clientdata.coin);

        // CHECK IF PLAYER SLOT IS AVAILABLE

        if (isAvailable) {
            console.log("----CHECK IN ==== Score: "+clientdata.score+"- Coin: "+clientdata.coin);
            rooms.changePlayerStatus(clientdata.roomid, socket.id, 1, clientdata.position, clientdata.score, clientdata.coin, clientdata.playerid);

            //updatePlayerListInGenerator(clientdata.roomid);

            //socket.room = clientdata.roomid;
            //socket.join(clientdata.roomid);

            var _outputdata = {};
            //data.playerid = playerid;
            ///data.roomid = roomname;
            _outputdata.position = clientdata.position;
            _outputdata.score = clientdata.score;
            _outputdata.coin = clientdata.coin;
            _outputdata.playerList = rooms.getActivePlayers(clientdata.roomid);

            // OPEN UP IF READY
            io.to(socket.id).emit('checkin', _outputdata);

            _outputdata = {};
            _outputdata.playerList = rooms.getActivePlayers(clientdata.roomid);
            _outputdata.cannonList = rooms.getCannonList(clientdata.roomid);
            broadcastMessageExceptSender('new_join', clientdata.roomid, _outputdata, socket.id);
            //broadcastMessage('new_join', clientdata.roomid, rooms.getCannonList(clientdata.roomid));
        } else {
            io.to(socket.id).emit('not_available_coin');
        }

    });


    socket.on("shot", function(data){
        var clientdata = data;
        var roomId = clientdata.roomid;
        var _g = rooms.getGame(roomId);

        console.log("SHOT size: "+clientdata.size);
        //var _player = rooms.getPlayerById(roomId, socket.id);
        var _cannon = _g.getCannon(clientdata.type);
        if(_cannon !== null){
            var _bulletType = _cannon.bulletType;
            var _coinvalue = getCoinValue(_bulletType);
            var playerCoin = rooms.getPlayerCoin(socket.id, roomId);


            if(rooms.checkCoinAvailable(roomId, socket.id, _coinvalue)){
                rooms.changePlayerCoin(socket.id, roomId, playerCoin -_coinvalue);

                var  _player = rooms.getPlayerById(roomId, socket.id);
                var data = {};
                data.position = _player.position;
                data.coin = _player.coin;
                broadcastMessage("change_coin", roomId, data);

                var _thebullet = _g.newbullet(clientdata, socket.id);
                var _bulletdata = _thebullet.getBullet();
                console.log("READY TO SEND - size : "+_bulletdata.size);
                broadcastMessageExceptSender('new_bullet', clientdata.roomid, _bulletdata, socket.id);
            }else{
                io.to(socket.id).emit('not_enough_coin');
            }
        }
    });

    socket.on("change_cannon_angle", function(data){
        var clientdata = data;
        var roomId = clientdata.roomid;
        var _g = rooms.getGame(roomId);
        _g.setCannon(clientdata.rot, clientdata.type, clientdata.size);
        broadcastMessageExceptSender('change_cannon_angle', clientdata.roomid, data, socket.id);
    });

    socket.on("change_cannon_size", function(data){
        var clientdata = data;
        var roomId = clientdata.roomid;
        var _g = rooms.getGame(roomId);
        _g.setCannon(clientdata.rot, clientdata.type, clientdata.size);
        broadcastMessageExceptSender('change_cannon_size', clientdata.roomid, data, socket.id);
    });

    socket.on("hit", function(data){
        //name, position, fishX, fishY, fishtype
        var clientdata = data;
        var roomId = clientdata.roomid;
        var _g = rooms.getGame(roomId);

        // check collide
        var isHit = true; // need to check for hit
        //clientdata.bulletName
        //clientdata.bulletPosition (object)
        //clientdata.fishName
        //clientdata.fishX
        //clientdata.fishY
        //clientdata.fishType

        // check/setup score
        var _player = null;
        var _fish = null;
        if(isHit){
            _player = rooms.getPlayerById(roomId, socket.id);
            _fish = _g.getFishByName(clientdata.fishName);
            if(_player !== null && _fish !== null){
                var pScore = rooms.getPlayerScore(socket.id, roomId);

                rooms.changePlayerScore(socket.id, roomId, pScore + _fish.score);

                var data = {};
                data.position = _player.position;
                data.score = _player.score;
                broadcastMessage("change_score", roomId, data);
            }
        }
        // remove bullet
        _g.removeBulletByNameFromList(data.bulletName);
        //Broadcast


    });

    socket.on("remove_bullet", function(data){ // only room id & name
        var clientdata = data;
        var roomId = clientdata.roomid;
        var _g = rooms.getGame(roomId);
        _g.removeBulletByNameFromList(data.name);
        //broadcastMessageExceptSender('new_bullet', clientdata.roomid, data, socket.id);
    });

    socket.on('topup', function (data) {
        // CHECK PLAYER COIN IS AVAILABLE
        var clientdata = data;
        var isAvailable = checkPlayerCoinAvaialable(clientdata.playerid, clientdata.coin);

        if (isAvailable) {
            var roomId = clientdata.roomid;
            var _player = rooms.getPlayerById(roomId, socket.id);
            var pCoin = rooms.getPlayerCoin(socket.id, roomId);
            rooms.changePlayerCoin(socket.id, clientdata.roomid, pCoin + Number(clientdata.coin));

            var data = {};
            data.position = _player.position;
            data.coin = _player.coin;
            broadcastMessage("change_coin", roomId, data);
        }

        var _outputdata = {};
        _outputdata.pass = isAvailable;
        io.to(socket.id).emit('topup', _outputdata);
    });


    socket.on('standout', function (data) {
        // save coin/score first
        var clientdata = data;
        //console.log("--- Get Standout from " + clientdata.roomid + " -- id: " + clientdata.id + " playerid: " + clientdata.playerid);

        var roomId = clientdata.roomid;

        var pScore = rooms.getPlayerScore(socket.id,roomId);
        var pCoin = rooms.getPlayerCoin(socket.id,roomId);

        //rooms.changePlayerStatus(clientdata.roomid, socket.id, 1, clientdata.position, clientdata.score, clientdata.coin, clientdata.playerid);
        rooms.changePlayerStatus(roomId, socket.id, 0, clientdata.position, pScore, pCoin, clientdata.playerid);
        //updatePlayerListInGenerator(clientdata.roomid);

       //var cCannon = getCannonItem(clientdata.position);
        var _cannonListOri = Global.cannon;

        var _rot = 0;
        for(var i=0; i < _cannonListOri.length; i++){
            if(_cannonListOri[i].id == clientdata.position){
                _rot = _cannonListOri[i].angle;
                //console.log("RESET CANNON ANGLE of "+clientdata.position+" to "+_rot)
            }
        }

        var _g = rooms.getGame(roomId);
        _g.setCannon(_rot, clientdata.position, 1);

        var _data = {};
        _data.playerList = rooms.getActivePlayers(roomId);
        _data.cannonList = rooms.getCannonList(roomId);

        io.to(socket.id).emit('standout');
        broadcastMessage('new_join', roomId, _data);
    });

    socket.on('signout', function (data) {
        // save coin/score first
        var clientdata = data;
        var roomId = clientdata.roomid;

        removePlayer(socket.id, roomId);

        //console.log("--- CHECK OUT FROM " + roomId);

        io.to(socket.id).emit('signout');
        //console.log("---- AFTER CHECKOUT");

        var _data = {};
        _data.playerList = rooms.getActivePlayers(roomId);
        _data.cannonList = rooms.getCannonList(roomId);

        broadcastMessage('new_join', roomId, _data);
        //io.to(sid).emit('new_join', rooms.getCannonList(clientdata.roomid));
        socket.leave(socket.room);

    });

    /*
    socket.on('shot', function (data) {
        var _g = getGameData(data.roomname);
        if (rooms.checkCoinAvailable(data.roomname, socket.id, data.type)) {
            _g.newbullet(data, socket.id);
        } else {
            console.log(" NOT ENOUGH COIN FOR SHOT");
            io.to(socket.id).emit("not_enough_coin");
        }
    });

    socket.on('cannon', function (data) {
        //var _g = getGameData(socket.room);
        var _g = getGameData(data.roomname);
        _g.setCannon(data.angle, data.id, data.type);
    });

    socket.on('change_cannon_type', function (data) {
        var _g = getGameData(data.roomname);
        if (_g !== null) {
            _g.setIndividualCannon(data.id, data.type);
        }
    });

    socket.on('checkout', function (data) {
        // save coin/score first
        var clientdata = data;
        removePlayer(clientdata.roomid, clientdata.sid);

        console.log("--- CHECK OUT FROM " + clientdata.roomid);

        if (clientdata.roomid) {
            console.log("---- AFTER CHECKOUT");
            rooms.showCannonList(clientdata.roomid);
            broadcastMessage('new_join', clientdata.roomid, rooms.getCannonList(clientdata.roomid));
            //io.to(sid).emit('new_join', rooms.getCannonList(clientdata.roomid));
        }

        io.to(socket.id).emit('checkout');
        socket.leave(socket.room);

    });
    */
    socket.on("disconnect", function () {
        console.log('user disconnect id: ' + socket.id + " -- room: " + socket.room);
        var roomId = socket.room;

        removePlayer(socket.id, socket.room);

        console.log("--- DISCONNECT FROM " + socket.room);

        if (socket.room) {


            var selectedRoom = rooms.getRoomById(socket.room);
            var players = rooms.getRoomPlayers(socket.room);

            console.log("---- AFTER DISCONNECT Players left "+players.length);

            // check if no player
            if(players.length < 1){

                rooms.getGame(socket.room).destroy();
                rooms.removeGame(socket.room)
                selectedRoom.active  = false;
                //selectedRoom.player_driver = null;
            }

            //rooms.showCannonList(socket.room);
            //broadcastMessage('new_join', socket.room, rooms.getCannonList(socket.room));
            //io.to(sid).emit('new_join', rooms.getCannonList(clientdata.roomid));

            var _data = {};
            _data.playerList = rooms.getActivePlayers(roomId);
            _data.cannonList = rooms.getCannonList(roomId);
            broadcastMessage('new_join', roomId, _data);
        }


        socket.leave(socket.room);
    });

    socket.on("check_connection", function(){
        var _g = rooms.getGame(socket.room);
        if(_g){
            io.to(socket.id).emit("check_connection");
        }
    });

    /*
    socket.on('game_update', function (data) {
       // get game data from player driver
        var gamedata = data;
        var gameId = data.roomid;
        var selectedRoom = rooms.getRoomById(gameId);
        //selectedRoom.game = {fish:gamedata.fishdata, bullet:gamedata.bulletdata};

        //console.log("--- game "+selectedRoom.game);
        //update();
    });

    socket.on('new_fish',function(data){
        var gamedata = data;
        var gameId = gamedata.roomid;
        var selectedRoom = rooms.getRoomById(gameId);
        //console.log("++ New Fish "+data.isFlip);
        //socket.broadcast.to(gameId).emit('new_fish', data);
        broadcastMessageExceptSender('new_fish', gameId, data, socket.id);
        //socket.broadcast.to(gameId).emit('new_fish', data.object);
    });

    socket.on('change_fish_angle',function(data){
        var gameId = data.roomid;
        var selectedRoom = rooms.getRoomById(gameId);

        //console.log("++ change angle "+gameId+"-- "+data.angle);
        //socket.broadcast.to(gameId).emit('change_fish_angle', data);
        broadcastMessageExceptSender('change_fish_angle', gameId, data, socket.id);
        //socket.broadcast.to(gameId).emit('change_fish_angle', fish);
    });
    */
});

// FUNCTIONS
function connectionTimeOut(){

}

function goToIndex(req, res){
    res.header("CacheControl", "no-cache,private,no-store,must-revalidate,max-stale=0,post-check=0,pre-check=0");
    res.render('index');
}

function checkRoomId(req, res) {
    res.header("CacheControl", "no-cache,private,no-store,must-revalidate,max-stale=0,post-check=0,pre-check=0");
    if (req.body.roomId == null) {
        res.render('index');
    } else {
        selectRoom(req.body.roomId);
        res.render('game', {roomId: req.body.roomId});
    }
}

function selectRoom(roomid) {
    var selectedRoom = rooms.getRoomById(roomid);
    var _cannon = getCannonListByNumber(selectedRoom.cannon);

    var _cannonList = rooms.getCannonList(roomid);
    if (_cannonList.length < 1) {
        rooms.setCannonListByRoomId(roomid, _cannon);
    }
    return;
}

function checkPlayerCoinAvaialable(playerid, coin) {
    // some check here
    return true;
}


function getCoinValue(size){
   var sizeList = Global.cannonSizeList;
    console.log("++ SIZE: "+size);
    if(size <= sizeList.length && size >= 0){
        return sizeList[size].coin;
    }
    return 0;
}

function broadcastMessageExceptSender(emitKey, roomid, param, sender) {
    var _players = rooms.getRoomPlayers(roomid);
    for (var i = 0; i   < _players.length; i++) {
        var sid = _players[i].socketid;
        if(sid !== sender){
            io.to(sid).emit(emitKey, param);
        }else{
            if(emitKey == "new_bullet"){
                //console.log(emitKey+"--- it's sender");
            }
        }
    }
}

function broadcastMessage(emitKey, roomid, param) {
    var _players = rooms.getRoomPlayers(roomid);
    for (var i = 0; i < _players.length; i++) {
        var sid = _players[i].socketid;
        io.to(sid).emit(emitKey, param);
    }
}

function removePlayer(id, rname) {
    console.log("REMOVE Player "+ id +" from "+rname);
    if (rname) {
        rooms.removePlayerToCannonlist(rname, id);
        rooms.removePlayer(rname, id);
    }

    return;
}


function removeRoom(roomid) {
    var _g = rooms.getGame(roomid);
    _g.destroy();
    rooms.removeRoom(roomid);

}

function getCannonListByNumber(noOfCannon) {
    var _cannon = [];
    for (var i = 0; i < Global.cannon.length; i++) {
        var _cCannon = Global.cannon[i].type;
        for (var j = 0; j < _cCannon.length; j++) {
            var _type = _cCannon[j];
            if (_type == noOfCannon) {
                var _sourceCannon = Global.cannon[i];
                _sourceCannon.oriRot = _sourceCannon.angle;
                _cannon.push(_sourceCannon);
                break;
            }
        }
    }

    return _cannon;
}

function getGameData(rname) {
    var data = [];
    var _list = rooms.getRoomList();
    for (var i = 0; i < _list.length; i++) {
        if (_list[i].id == rname) {
            return _list[i].game;
        }
    }
    return data;
}

function saveGameData(rname, data) {
    var _list = rooms.getRoomList();
    for (i = 0; i < _list.length; i++) {
        if (_list[i].id == rname) {
            _list[i].game = data;
            break;
        }
    }

    return;
}

/*
 // sending to sender-client only
 socket.emit('message', "this is a test");

 // sending to all clients, include sender
 io.emit('message', "this is a test");

 // sending to all clients except sender
 socket.broadcast.emit('message', "this is a test");

 // sending to all clients in 'game' room(channel) except sender
 socket.broadcast.to('game').emit('message', 'nice game');

 // sending to all clients in 'game' room(channel), include sender
 io.in('game').emit('message', 'cool game');

 // sending to sender client, only if they are in 'game' room(channel)
 socket.to('game').emit('message', 'enjoy the game');

 // sending to all clients in namespace 'myNamespace', include sender
 io.of('myNamespace').emit('message', 'gg');

 // sending to individual socketid
 socket.broadcast.to(socketid).emit('message', 'for your eyes only');
 */
