$(document).ready(function(){
	$("body").on('click', '.toggle_target', function(){
		if($(this).data("toggle") == "show"){
			$($(this).data('target')).hide();
			$(this).addClass($(this).data('addclass'));
			$(this).html($(this).data('showtext'));
			$(this).data("toggle", "hide");
			//hide
		}else{
			$($(this).data('target')).show();
			$(this).removeClass($(this).data('addclass'));
			$(this).html($(this).data('hidetext'));
			$(this).data("toggle", "show");
			//show
		}
	});

	$("#toggle_chat").click(function(){
		if($(this).data("toggle") == "show"){
			new_message_count = 0;
		}
	});

});

var lobby_id = parseInt(window.location.pathname.split( '/' )[2]);

var panorama;
var map;

var marker_array = new Array();

var markers = {};

var player_count = 0;

var start_angle = 34; //manually entered ATM
var last_angle = start_angle;

var new_message_count = 0;

/*
	Rome targets:
	41.898961	12.473089	-	Fiumi Fountain
	41.8981484	12.473024	-	Pantheon









*/

var minimap_styles = [
  {
    featureType: "all",
    elementType: "labels",
    stylers: [
      { visibility: "off" }
    ]
  }
];

var panorama_styles = [
  {
    featureType: "all",
    elementType: "labels",
    stylers: [
      { visibility: "off" }
    ]
  }
];

function initialize() {
	//Get our username from previous page
	var username = localStorage.getItem("username");
	var area_height = 0.005;
	var area_width = 0.008;
	//Set up socket connection, stating where we are from and our username
	var socket = io.connect(window.location.origin,{query:'page=3&lobby_id='+lobby_id+'&username='+username}); //page=2 means show we're in a lobby

	//Currently a static start location, will be automatic in future
  	var google_start_loc = new google.maps.LatLng(52.9529907,-1.1864428);

  	var my_colour = { fill : "rgba(50,0,0,0.3)", stroke : "rgba(50,0,0,0.5)", name : "grey"};

  	var bounds = {
  		north: google_start_loc.lat() + area_height,
  		south: google_start_loc.lat() - area_height,
  		east: google_start_loc.lng() + area_width,
  		west: google_start_loc.lng() - area_width
  	};

  	var rectangle = new google.maps.Rectangle({
	    bounds: bounds,
	    fillColor: "rgba(63, 191, 63, 0.45)",
	    strokeColor: "rgba(63, 191, 63, 0.73)",
	    strokeWeight: 2,
	    clickable: false
	});



  	//Let the server know we are ready
  	socket.emit('joined_game', { lobby_id : lobby_id, username : username, loc : google_start_loc});


  	//Setup the minimap
  	map = new google.maps.Map(
  		document.getElementById("mini_map_container"), {
    		center: google_start_loc,
    		zoom: 14,
      		streetViewControl: false,
			zoomControl: false,
			mapTypeControl: false,
			scaleControl: false,
			rotateControl: false,
			liteMode: true
  	});
	map.setOptions({styles: minimap_styles});

	var request = {
	    location: google_start_loc,
	    radius: measure(google_start_loc.lat(),google_start_loc.lng(), google_start_loc.lat() + area_height, google_start_loc.lng())
	};
	service = new google.maps.places.PlacesService(map);
	service.nearbySearch(request, places_callback);

  	var my_marker = new google.maps.Marker({
		position: google_start_loc,
		map: map,
	    icon: {
	      	path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
	      	scale: 4,
	      	rotation: start_angle+180,
		    strokeColor: my_colour.stroke,
		    fillColor: my_colour.fill,
		    fillOpacity:1,
			liteMode: true
	    }
	});

  	//Setup the streetview
  	panorama = new google.maps.StreetViewPanorama(
      	document.getElementById("street_view_container"), {
        	position: google_start_loc,
        	pov: {
          		heading: start_angle,
          		pitch: 0
        	},
        	zoomControl: false,
      		streetViewControl: false,
			mapTypeControl: false,
			scaleControl: false,
			rotateControl: false
    });

	panorama.setOptions({styles: panorama_styles});



	panorama.addListener('pov_changed', function() {
		my_marker.setIcon({
		    path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
		    scale: 4,
		    rotation: panorama.pov.heading+180,
		    strokeColor: my_colour.stroke,
		    fillColor: my_colour.fill,
		    fillOpacity:100
		});

		if(panorama.pov.heading >= last_angle+30 || panorama.pov.heading <= last_angle-30){
			last_angle = panorama.pov.heading;
			socket.emit('update_my_angle', { username : username, angle : panorama.pov.heading, lobby_id : lobby_id, colour : my_colour});
		}
	});

  	
  	//Let people know when we have changed location
	panorama.addListener('position_changed', function() {
		//var bounds = {north: 41.902, south: 41.896, east: 12.480,west: 12.469};
		var current_loc = panorama.getPosition();
		map.setCenter(current_loc);
		my_marker.setPosition(current_loc);
  		socket.emit('update_my_position', { username : username, loc : current_loc, lobby_id : lobby_id, colour : my_colour});

  		if(current_loc.lat() > bounds.north || current_loc.lat() < bounds.south || current_loc.lng() > bounds.east || current_loc.lng() < bounds.west){
  			$("#back_to_start").show();
  		}else{
  			$("#back_to_start").hide();
  		}
	});

  	//Bind this panorama to the minimap
  	map.setStreetView(panorama);
  	rectangle.setMap(map);

  	socket.on('get_starting_data', function(result){
  		my_colour = result.colour;
  		my_marker.setIcon({
		    path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
		    scale: 4,
		    rotation: panorama.pov.heading+180,
		    strokeColor: my_colour.stroke,
		    fillColor: my_colour.fill,
		    fillOpacity:100
		});
		player_count = result.lobby.players.length;
		$("#player_count").text(player_count);

		$.each(result.lobby.players, function( index, value ) {
			var html = "<tr id=\"row_" + value.socket_id + "\">" +
			    		"<td><span style=\"color:" + value.colour.fill +";\">&#9660;</span>"+ value.username + "</td>" +
			    		"<td>" + value.current_objective + "</td>" +
			       	"</tr>";
			$("#players_current_objectives").html($("#players_current_objectives").html() + html);

			if(value.socket_id == socket.id){
				$("#current_objective_count").text(value.current_objective);
				$("#total_objective_count").text(result.lobby.objectives);
			}
		});
  	});

	socket.on('update_player', function(result){
		update_player(result);
	});

	socket.on('player_left', function(result){
		$("#player_count").text(--player_count);

		$("#players_current_objectives #row_" + result.socket_id).remove();

		markers[result.socket_id]['panorama'].setMap(null);
		markers[result.socket_id]['map'].setMap(null);

		delete markers[result.socket_id];
	});

	socket.on('get_other_players', function(result){
		$.each(result, function( index, value ) {
			update_player(value);
		});
	});

	socket.on('player_has_joined', function(result){
		var players_name = result.username;
		var colour = result.colour;
		var socket_id = result.socket_id;
		var current_objective = result.current_objective;

		$("#player_count").text(++player_count);

		var html = "<tr id=\"row_" + socket_id + "\" >" +
			    		"<td><span style=\"color:" + colour.fill +";\">&#9660;</span>"+ players_name + "</td>" +
			    		"<td>"+ current_objective + "</td>" +
			       	"</tr>";

		$("#players_current_objectives").html($("#players_current_objectives").html() + html);

  		var lat_lng = result.loc;
		if(!markers[socket_id]) {
			markers[socket_id] = {};
			markers[socket_id]['panorama'] = new google.maps.Marker({
		      	position: lat_lng,
		      	map: panorama,
			    icon: {
			      	path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
			      	scale: 13,
			      	rotation: 0,
			      	strokeColor: colour.stroke,
				    fillColor:  colour.fill,
				    fillOpacity:1
			    },
		      	title: socket_id
		  	});
			markers[socket_id]['map'] = new google.maps.Marker({
		      	position: lat_lng,
		      	map: map,
			    icon: {
			      	path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
			      	scale: 4,
			      	rotation: 0,
			      	strokeColor: colour.stroke,
				    fillColor:  colour.fill,
				    fillOpacity:1
			    },
		      	title: socket_id
		  	});
		}
	});

  	//Add new message to the chat box
  	//Also shows a little notification on the toggle chat button
  	socket.on('ingame_message_s', function(result){
  		var output = "<span class=\"message\"><span class=\"name\">" + result.username + "</span>: <span class=\"content\">" + result.input + "</span></span></span><br>"
  		$(".game_chat .output").html($(".game_chat .output").html() + output);
  		if($("#toggle_chat").data('toggle') === "hide"){
  			new_message_count++;
  			$("#toggle_chat").html("Show Chat - " + new_message_count + " New <span class=\"glyphicon glyphicon-exclamation-sign\" aria-hidden=\"true\"></span>");
  		}
  	});

  	//Allow users to press enter to submit message
  	$("#chat_input").keyup(function(event){
	    if(event.keyCode == 13) $("#send_message").click();
	});

  	//Send message by clicking the button
  	$("#send_message").click(function(e){
  		//Get chat message
  		var input = $("#chat_input").val();
  		if(input == null || input == "") return;
    	
    	//Clear old chat message and focus back onto the input box
    	$("#chat_input").val('').focus();
    	
    	socket.emit('ingame_message_c', { input : input, username : username, lobby_id : lobby_id});
  	});

	socket.on('update_player_angle', function(result){
		var socket_id = result.socket_id;
		var colour = result.colour;
  		var angle = result.angle;
		//If no marker yet, set one up
		markers[socket_id]['map'].setIcon({
			      	path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
			      	scale: 4,
			      	rotation: angle+180,
			      	strokeColor: colour.stroke,
				    fillColor: colour.fill,
				    fillOpacity:1
		});
		
	});

	function update_player(result){
		var socket_id = result.socket_id;
		var colour = result.colour;
		var players_name = result.username;
  		var lat_lng = result.loc;
		//If no marker yet, set one up
		if(!markers[socket_id]) {
			markers[socket_id] = {};
			markers[socket_id]['panorama'] = new google.maps.Marker({
		      	position: lat_lng,
		      	map: panorama,
			    icon: {
			      	path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
			      	scale: 13,
			      	rotation: 0,
			      	strokeColor: colour.stroke,
				    fillColor: colour.fill,
				    fillOpacity:1
			    },
		      	title: socket_id
		  	});
			markers[socket_id]['map'] = new google.maps.Marker({
		      	position: lat_lng,
		      	map: map,
			    icon: {
			      	path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
			      	scale: 4,
			      	rotation: 0,
			      	strokeColor: colour.stroke,
				    fillColor: colour.fill,
				    fillOpacity:1
			    },
		      	title: socket_id
		  	});
		} else { //else update the current markers we have
			markers[socket_id]['panorama'].setPosition(lat_lng);
			markers[socket_id]['map'].setPosition(lat_lng);
		}
	}

	$("#back_to_start_button").click(function(){
		panorama.setPosition(google_start_loc);
		map.setCenter(google_start_loc);
		my_marker.setPosition(google_start_loc);
  		socket.emit('update_my_position', { username : username, loc : google_start_loc, lobby_id : lobby_id, colour : my_colour});
	});
}
google.maps.event.addDomListener(window, "load", initialize);


//http://stackoverflow.com/questions/639695/how-to-convert-latitude-or-longitude-to-meters
function measure(lat1, lon1, lat2, lon2){  // generally used geo measurement function
    var R = 6378.137; // Radius of earth in KM
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return d * 1000; // meters
}

function places_callback(results, status) {
	console.log(results);
	for(var x = 0; x < results.length; x++){
	  	new google.maps.Marker({
			position: results[x].geometry.location,
			map: map,
			title: results[x].name
		});
	}
}