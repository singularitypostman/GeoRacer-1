var express = require('express'), app = express();
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
var path = require('path');
var jade = require('jade'); 
var http = require('http').Server(app);
var io = require('socket.io')(http);


var settings = {
    min_players:1,
    max_players:3
};

function isPlayerInLobby(player_id){
    /*
    for(var x = 0; x < Lobbies.length; x++ ){
        if(Lobbies[x].players.indexOf(player_id) != -1){
            return true;
        }
    };
    return false;
    */
}

function getPlayerLobby(player_id){
    /*
    for(var x = 0; x < Lobbies.length; x++ ){
        if(Lobbies[x].players.indexOf(player_id) != -1){
            return Lobbies[x];
        }
    };
    return false;
    */
}

function lobby(type){
    this.type = type;   //O == private, 1 == public
    this.open = 1;      //1 == open, 0 == not open
    this.state = 1;     //0 == ingame, 1 == lobby
    this.players = [];  //Players/sockets in the lobby
}

var find_private = 0, find_public = 1, ingame = 2;
var Players = new Array([],[],[]);

var Public_Lobbies = new Array(new lobby(1), new lobby(1), new lobby(1));
var Private_Lobbies = new Array(new lobby(2), new lobby(2), new lobby(2));


app.get('/', function(req, res){
    res.render('index.html');
});


app.get('/lobby/:lobby_id', function(req, res) {
    //res.send("lobby_id is set to " + req.params.lobby_id);
    res.render('lobby');
});


app.get('/find_public_game', function(req, res){
    res.render('find_public_game');
});

app.get('/find_private_game', function(req, res){
    res.render('find_private_game');
});

app.get('/about', function(req, res){
    res.render('about');
});



app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', function(socket){
    //Page =  0/Find Private Game     1/Find public game    2/InGame
    var active_page = parseInt(socket.handshake.query.page);
    switch(active_page){
        case find_private: //Find Private Game
            Players[find_private].push(socket.id);

            //Before we find a lobby we need to verify all users are here with a ping request of some kind

            //Find a private lobby here
        break;
        case find_public: //Find Public Game
            Players[find_public].push(socket.id);

            //Before we find a lobby we need to verify all users are here with a ping request of some kind
            console.log("Finding an open lobby");
            var lobby_id = -1;
            for(var x = Public_Lobbies.length -1; x > -1; x--){
                if(Public_Lobbies[x].players.length < settings.max_players && Public_Lobbies[x].state == 1){
                    lobby_id = x;
                }
            }

            if(lobby_id == -1){
                console.log("Could not find a free lobby, please try again later");
                break;
            }

            console.log("Moving player to lobby " + lobby_id);
            Players[find_public].forEach(function(socketId, index){
                io.to(socketId).emit('join_lobby-' + lobby_id);
                Public_Lobbies[lobby_id].players.push(socketId);
                if(Public_Lobbies[lobby_id].players.length >= settings.min_players){
                    //Start this lobby
                    Public_Lobbies[lobby_id].open = 0;
                    console.log("Lobby " + lobby_id + " is now ready to start");
                }
            });
           Players[find_public].length = 0;
            //Find a public lobby here
        break;
        case ingame: //InGame
            Players[ingame].push(socket.id);

            //In Game code here
        break;
        default: //Unkown Origin
            console.log("Unkown location");

        break;
    }

    console.log("Players:");
    console.log(Players);
    console.log("Public Lobbies");
    console.log(Public_Lobbies);

    socket.on('disconnect', function(){
        for(var x = 0; x < 3; x++){
            var index = Players[x].indexOf(socket.id);
            if (index > -1) {
                Players[x].splice(index, 1);
            }
        }
    });

    socket.on('join_lobby', function(lobby_id){
        if(Lobbies[lobby_id].players.length < 2){
            if(!isPlayerInLobby(socket.id)){
                Lobbies[lobby_id].players.push(socket.id);
                updateGUI();
                io.to(socket.id).emit('lobby_join', { success : true});
                if(Lobbies[lobby_id].players.length == 2){
                    Lobbies[lobby_id].started = true;
                    io.to(Lobbies[lobby_id].players[0]).emit('game_start', { player : 1 , enemy : 2});
                    io.to(Lobbies[lobby_id].players[1]).emit('game_start', { player : 2 , enemy : 1});
                }
            }
        }else{
            io.to(socket.id).emit('lobby_join', { success : false, reason : "Lobby is full!" })
        }
    });

    socket.on('player_move', function(obj){
        if(obj.player == 2){
            io.to(getPlayerLobby(socket.id).players[0]).emit('player_moved', { player : 2 , direction : obj.direction });
        }else if(obj.player == 1){
            io.to(getPlayerLobby(socket.id).players[1]).emit('player_moved', { player : 1 , direction : obj.direction });
        }
    });
});
/*

setInterval(
    function(){
        //Update

        for(var x = 0; x < Lobbies.length; x++ ){
            if(Lobbies[x].players.length < 2 && Lobbies[x].started == true){
                io.to(Lobbies[x].players[0]).emit('game_abandoned');
                Lobbies[x].started = false;
                Lobbies[x].player_1_score = 0;
                Lobbies[x].player_2_score = 0;
            }
        };
},100);

*/
http.listen(25565, function(){
    console.log('listening on *:25565');
});